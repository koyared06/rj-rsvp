"use client";

import type { ReactNode } from "react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import QRCode from "qrcode";
import Image from "next/image";
import JSZip from "jszip";
import { ThemeToggle } from "@/components/theme-toggle";

type GuestRow = {
  rowNumber: number;
  id: string;
  inviteCode: string;
  inviteToken: string;
  fullName: string;
  email: string;
  maxGuests: number;
  status: "pending" | "attending" | "declined";
  lastUpdated: string;
  notes: string;
};

type RsvpRow = {
  rowNumber: number;
  timestamp: string;
  inviteCode: string;
  fullName: string;
  email: string;
  attendance: "attending" | "declined" | string;
  guestCount: number;
  dietaryRestrictions: string;
  songRequest: string;
  message: string;
  companionNames: string;
  source: string;
};

type EntourageCategoryRow = {
  rowNumber: number;
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  isVisible: boolean;
  createdAt: string;
  updatedAt: string;
};

type EntourageMemberRow = {
  rowNumber: number;
  id: string;
  categoryId: string;
  fullName: string;
  side: "bride" | "groom" | "none";
  memberOrder: number;
  isVisible: boolean;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

type DashboardResponse = {
  guests: GuestRow[];
  rsvps: RsvpRow[];
  stats: {
    totalGuests: number;
    pending: number;
    attending: number;
    declined: number;
    responses: number;
  };
  entourage: {
    categories: EntourageCategoryRow[];
    members: EntourageMemberRow[];
  };
  settings: {
    weddingDate: string;
    weddingTime: string;
    showCountdown: boolean;
    countdownDays: number | null;
  };
};

type GuestStatusFilter = "all" | "pending" | "attending" | "declined";
type RsvpStatusFilter = "all" | "attending" | "declined";
type SortDirection = "asc" | "desc";
type GuestSortField = "fullName" | "inviteCode" | "maxGuests" | "status" | "lastUpdated";
type RsvpSortField = "timestamp" | "fullName" | "attendance" | "guestCount";

export const dynamic = "force-dynamic";

const ADMIN_SESSION_KEY = "rj_admin_session_v1";
const DEFAULT_PAGE_SIZE = 8;
const DEFAULT_WEDDING_TIME = "16:00";
const MIN_GUEST_LIMIT = 1;
const MAX_GUEST_LIMIT = 20;

function toGuestLimit(value: string) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return MIN_GUEST_LIMIT;
  return Math.min(MAX_GUEST_LIMIT, Math.max(MIN_GUEST_LIMIT, parsed));
}

function normalizeCompareKey(value: string) {
  return value.trim().toLowerCase();
}

function readStoredAdminSession(): string | null {
  try {
    return window.sessionStorage.getItem(ADMIN_SESSION_KEY);
  } catch {
    return null;
  }
}

function writeStoredAdminSession(token: string) {
  window.sessionStorage.setItem(ADMIN_SESSION_KEY, token);
}

function clearStoredAdminSession() {
  window.sessionStorage.removeItem(ADMIN_SESSION_KEY);
}

export default function AdminPage() {
  const [token, setToken] = useState("");
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [bulkQrLoading, setBulkQrLoading] = useState(false);
  const [normalizeLoading, setNormalizeLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [isAddGuestModalOpen, setIsAddGuestModalOpen] = useState(false);
  const [isEditGuestModalOpen, setIsEditGuestModalOpen] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [isCreateEntourageCategoryModalOpen, setIsCreateEntourageCategoryModalOpen] = useState(false);
  const [isCreateEntourageMemberModalOpen, setIsCreateEntourageMemberModalOpen] = useState(false);
  const [isEditEntourageCategoryModalOpen, setIsEditEntourageCategoryModalOpen] = useState(false);
  const [isEditEntourageMemberModalOpen, setIsEditEntourageMemberModalOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [weddingDateInput, setWeddingDateInput] = useState("");
  const [weddingTimeInput, setWeddingTimeInput] = useState(DEFAULT_WEDDING_TIME);
  const [showCountdownInput, setShowCountdownInput] = useState(true);
  const [countdownSettingsDirty, setCountdownSettingsDirty] = useState(false);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [maxGuests, setMaxGuests] = useState(String(MIN_GUEST_LIMIT));
  const [notes, setNotes] = useState("");
  const [editRowNumber, setEditRowNumber] = useState<number | null>(null);
  const [editFullName, setEditFullName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editMaxGuests, setEditMaxGuests] = useState(String(MIN_GUEST_LIMIT));
  const [editNotes, setEditNotes] = useState("");
  const [editStatus, setEditStatus] = useState<GuestRow["status"]>("pending");
  const [qrGuest, setQrGuest] = useState<GuestRow | null>(null);
  const [qrImageDataUrl, setQrImageDataUrl] = useState("");

  const [activeTab, setActiveTab] = useState<"guests" | "rsvps" | "entourage">("guests");
  const [activeEntourageTab, setActiveEntourageTab] = useState<"categories" | "members">(
    "categories",
  );
  const [entourageBusy, setEntourageBusy] = useState(false);
  const [categoryNameInput, setCategoryNameInput] = useState("");
  const [categorySlugInput, setCategorySlugInput] = useState("");
  const [categorySortOrderInput, setCategorySortOrderInput] = useState("10");
  const [categoryVisibleInput, setCategoryVisibleInput] = useState(true);
  const [memberNameInput, setMemberNameInput] = useState("");
  const [memberCategoryIdInput, setMemberCategoryIdInput] = useState("");
  const [memberSideInput, setMemberSideInput] = useState<EntourageMemberRow["side"]>("none");
  const [memberOrderInput, setMemberOrderInput] = useState("10");
  const [memberVisibleInput, setMemberVisibleInput] = useState(true);
  const [memberNotesInput, setMemberNotesInput] = useState("");
  const [memberSearchInput, setMemberSearchInput] = useState("");
  const [memberCategoryFilter, setMemberCategoryFilter] = useState("all");
  const [editingCategoryId, setEditingCategoryId] = useState("");
  const [editCategoryNameInput, setEditCategoryNameInput] = useState("");
  const [editCategorySlugInput, setEditCategorySlugInput] = useState("");
  const [editCategorySortOrderInput, setEditCategorySortOrderInput] = useState("10");
  const [editCategoryVisibleInput, setEditCategoryVisibleInput] = useState(true);
  const [editingMemberId, setEditingMemberId] = useState("");
  const [editMemberNameInput, setEditMemberNameInput] = useState("");
  const [editMemberCategoryIdInput, setEditMemberCategoryIdInput] = useState("");
  const [editMemberSideInput, setEditMemberSideInput] = useState<EntourageMemberRow["side"]>("none");
  const [editMemberOrderInput, setEditMemberOrderInput] = useState("10");
  const [editMemberVisibleInput, setEditMemberVisibleInput] = useState(true);
  const [editMemberNotesInput, setEditMemberNotesInput] = useState("");
  const [guestSearch, setGuestSearch] = useState("");
  const [guestStatusFilter, setGuestStatusFilter] = useState<GuestStatusFilter>("all");
  const [guestPage, setGuestPage] = useState(1);
  const [guestPageSize, setGuestPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [guestSortField, setGuestSortField] = useState<GuestSortField>("lastUpdated");
  const [guestSortDirection, setGuestSortDirection] = useState<SortDirection>("desc");

  const [rsvpSearch, setRsvpSearch] = useState("");
  const [rsvpStatusFilter, setRsvpStatusFilter] = useState<RsvpStatusFilter>("all");
  const [rsvpPage, setRsvpPage] = useState(1);
  const [rsvpPageSize, setRsvpPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [rsvpSortField, setRsvpSortField] = useState<RsvpSortField>("timestamp");
  const [rsvpSortDirection, setRsvpSortDirection] = useState<SortDirection>("desc");

  const attendingHeadCount = useMemo(() => {
    if (!dashboard) return 0;
    return dashboard.rsvps
      .filter((item) => item.attendance === "attending")
      .reduce((sum, item) => sum + item.guestCount, 0);
  }, [dashboard]);

  const countdownSummary = useMemo(() => {
    if (!dashboard?.settings.weddingDate) {
      return "Wedding date is not set yet.";
    }

    const countdownDays = dashboard.settings.countdownDays;
    if (countdownDays === null) {
      return "Wedding date is invalid. Please save a valid date.";
    }

    if (countdownDays > 1) return `${countdownDays} days before wedding day.`;
    if (countdownDays === 1) return "1 day before wedding day.";
    if (countdownDays === 0) return "Wedding day is today.";

    const daysAgo = Math.abs(countdownDays);
    return `Wedding day passed ${daysAgo} day${daysAgo === 1 ? "" : "s"} ago.`;
  }, [dashboard]);

  const countdownVisibilitySummary = useMemo(
    () => (dashboard?.settings.showCountdown ? "Visible on RSVP page" : "Hidden on RSVP page"),
    [dashboard],
  );

  const filteredGuests = useMemo(() => {
    if (!dashboard) return [];
    const term = guestSearch.trim().toLowerCase();
    return dashboard.guests.filter((guest) => {
      const matchesStatus = guestStatusFilter === "all" || guest.status === guestStatusFilter;
      if (!matchesStatus) return false;
      if (!term) return true;
      return [guest.fullName, guest.inviteCode, guest.email, guest.notes]
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [dashboard, guestSearch, guestStatusFilter]);

  const sortedGuests = useMemo(() => {
    const data = [...filteredGuests];
    data.sort((a, b) => {
      let compare = 0;
      if (guestSortField === "maxGuests") {
        compare = a.maxGuests - b.maxGuests;
      } else if (guestSortField === "lastUpdated") {
        compare = new Date(a.lastUpdated || 0).getTime() - new Date(b.lastUpdated || 0).getTime();
      } else {
        compare = String(a[guestSortField]).localeCompare(String(b[guestSortField]));
      }
      return guestSortDirection === "asc" ? compare : -compare;
    });
    return data;
  }, [filteredGuests, guestSortField, guestSortDirection]);

  const guestTotalPages = Math.max(1, Math.ceil(sortedGuests.length / guestPageSize));
  const guestCurrentPage = Math.min(guestPage, guestTotalPages);
  const paginatedGuests = sortedGuests.slice(
    (guestCurrentPage - 1) * guestPageSize,
    guestCurrentPage * guestPageSize,
  );

  const filteredRsvps = useMemo(() => {
    if (!dashboard) return [];
    const term = rsvpSearch.trim().toLowerCase();
    return dashboard.rsvps.filter((rsvp) => {
      const matchesStatus = rsvpStatusFilter === "all" || rsvp.attendance === rsvpStatusFilter;
      if (!matchesStatus) return false;
      if (!term) return true;
      return [
        rsvp.fullName,
        rsvp.inviteCode,
        rsvp.email,
        rsvp.companionNames,
        rsvp.message,
      ]
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [dashboard, rsvpSearch, rsvpStatusFilter]);

  const sortedRsvps = useMemo(() => {
    const data = [...filteredRsvps];
    data.sort((a, b) => {
      let compare = 0;
      if (rsvpSortField === "guestCount") {
        compare = a.guestCount - b.guestCount;
      } else if (rsvpSortField === "timestamp") {
        compare = new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime();
      } else {
        compare = String(a[rsvpSortField]).localeCompare(String(b[rsvpSortField]));
      }
      return rsvpSortDirection === "asc" ? compare : -compare;
    });
    return data;
  }, [filteredRsvps, rsvpSortField, rsvpSortDirection]);

  const rsvpTotalPages = Math.max(1, Math.ceil(sortedRsvps.length / rsvpPageSize));
  const rsvpCurrentPage = Math.min(rsvpPage, rsvpTotalPages);
  const paginatedRsvps = sortedRsvps.slice(
    (rsvpCurrentPage - 1) * rsvpPageSize,
    rsvpCurrentPage * rsvpPageSize,
  );

  const entourageCategories = useMemo(
    () =>
      [...(dashboard?.entourage.categories ?? [])].sort((a, b) => {
        if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
        return a.name.localeCompare(b.name);
      }),
    [dashboard],
  );

  const categoryNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const category of entourageCategories) {
      map.set(category.id, category.name);
    }
    return map;
  }, [entourageCategories]);

  const entourageMembers = useMemo(
    () =>
      [...(dashboard?.entourage.members ?? [])].sort((a, b) => {
        const categoryA = categoryNameById.get(a.categoryId) ?? "";
        const categoryB = categoryNameById.get(b.categoryId) ?? "";
        const categoryCompare = categoryA.localeCompare(categoryB);
        if (categoryCompare !== 0) return categoryCompare;
        if (a.memberOrder !== b.memberOrder) return a.memberOrder - b.memberOrder;
        return a.fullName.localeCompare(b.fullName);
      }),
    [categoryNameById, dashboard],
  );

  const filteredEntourageMembers = useMemo(() => {
    const term = memberSearchInput.trim().toLowerCase();
    return entourageMembers.filter((member) => {
      const matchesCategory =
        memberCategoryFilter === "all" || member.categoryId === memberCategoryFilter;
      if (!matchesCategory) return false;
      if (!term) return true;

      const categoryName = categoryNameById.get(member.categoryId) ?? "";
      return [member.fullName, member.side, member.notes, categoryName]
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [categoryNameById, entourageMembers, memberCategoryFilter, memberSearchInput]);

  const categoryIndexById = useMemo(() => {
    const map = new Map<string, number>();
    entourageCategories.forEach((category, index) => {
      map.set(category.id, index);
    });
    return map;
  }, [entourageCategories]);

  const memberIdsByCategory = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const member of entourageMembers) {
      const bucket = map.get(member.categoryId) ?? [];
      bucket.push(member.id);
      map.set(member.categoryId, bucket);
    }
    return map;
  }, [entourageMembers]);

  const activeMemberCategoryId = memberCategoryIdInput || entourageCategories[0]?.id || "";

  const canMoveCategoryUp = (categoryId: string) =>
    (categoryIndexById.get(categoryId) ?? 0) > 0;
  const canMoveCategoryDown = (categoryId: string) =>
    (categoryIndexById.get(categoryId) ?? 0) < entourageCategories.length - 1;
  const canMoveMemberUp = (memberId: string, categoryId: string) =>
    (memberIdsByCategory.get(categoryId)?.indexOf(memberId) ?? -1) > 0;
  const canMoveMemberDown = (memberId: string, categoryId: string) => {
    const ids = memberIdsByCategory.get(categoryId) ?? [];
    const index = ids.indexOf(memberId);
    return index >= 0 && index < ids.length - 1;
  };

  const loadDashboard = useCallback(async (
    adminToken: string,
    options?: { silent?: boolean; skipSuccessFeedback?: boolean },
  ) => {
    const silent = options?.silent ?? false;
    const skipSuccessFeedback = options?.skipSuccessFeedback ?? false;

    if (!silent) {
      setLoading(true);
      setFeedback("");
    }

    try {
      const response = await fetch("/api/admin/dashboard", {
        headers: { "x-admin-token": adminToken },
      });

      const payload = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          clearStoredAdminSession();
          setConnected(false);
          setDashboard(null);
          setToken("");
        }

        if (!silent) {
          setConnected(false);
          setDashboard(null);
          const details = payload.details ? ` (${payload.details})` : "";
          const msg = `${payload.error ?? "Unable to load dashboard."}${details}`;
          setFeedback(msg);
          toast.error("Load failed", { description: msg });
        }

        if (!silent) {
          clearStoredAdminSession();
        }

        return;
      }

      setConnected(true);
      setDashboard(payload);
      setToken(adminToken);
      if (payload.entourage?.categories?.length > 0) {
        setMemberCategoryIdInput((current) => current || payload.entourage.categories[0].id);
      }
      if (!countdownSettingsDirty) {
        setWeddingDateInput(payload.settings?.weddingDate ?? "");
        setWeddingTimeInput(payload.settings?.weddingTime ?? DEFAULT_WEDDING_TIME);
        setShowCountdownInput(
          typeof payload.settings?.showCountdown === "boolean"
            ? payload.settings.showCountdown
            : true,
        );
      }

      if (!skipSuccessFeedback && !silent) {
        setFeedback("");
        toast.success("Connected", {
          description: "Admin dashboard connected to Google Sheet.",
        });
      }

      writeStoredAdminSession(adminToken);
    } catch (error) {
      if (!silent) {
        setConnected(false);
        setDashboard(null);
        const msg = "Network error loading dashboard.";
        setFeedback(msg);
        toast.error("Network error", { description: msg });
      } else {
        console.error("Silent dashboard refresh failed:", error);
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [countdownSettingsDirty]);

  async function onConnect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await loadDashboard(token);
  }

  function disconnectAdminSession() {
    clearStoredAdminSession();
    setToken("");
    setConnected(false);
    setDashboard(null);
    setFeedback("Disconnected from admin session.");
    toast("Disconnected", { description: "Admin session cleared for this browser tab." });
  }

async function onSaveWeddingDate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const authToken = token;
    if (!authToken) return;

    setSettingsSaving(true);
    try {
      const response = await fetch("/api/admin/dashboard", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": authToken,
        },
        body: JSON.stringify({
          weddingDate: weddingDateInput.trim(),
          weddingTime: weddingTimeInput.trim(),
          showCountdown: showCountdownInput,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        const details = payload.details ? ` (${payload.details})` : "";
        const message = `${payload.error ?? "Unable to save wedding date."}${details}`;
        toast.error("Save failed", { description: message });
        return;
      }

      setCountdownSettingsDirty(false);
      setWeddingDateInput(payload.settings?.weddingDate ?? "");
      setWeddingTimeInput(payload.settings?.weddingTime ?? DEFAULT_WEDDING_TIME);
      setShowCountdownInput(
        typeof payload.settings?.showCountdown === "boolean"
          ? payload.settings.showCountdown
          : true,
      );
      setDashboard((current) => {
        if (!current) return current;
        return {
          ...current,
          settings: payload.settings,
        };
      });
      toast.success("Wedding countdown updated", {
        description: showCountdownInput
          ? "Countdown settings saved and visible on RSVP page."
          : "Countdown settings saved and hidden on RSVP page.",
      });
    } catch {
      toast.error("Network error", {
        description: "Unable to save wedding date right now.",
      });
    } finally {
      setSettingsSaving(false);
    }
  }

  async function onAddGuest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const authToken = token;
    if (!authToken) return;

    setLoading(true);
    setFeedback("");

    try {
      const response = await fetch("/api/admin/guest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": authToken,
        },
        body: JSON.stringify({
          fullName,
          email,
          maxGuests: toGuestLimit(maxGuests),
          notes,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        const details = payload.details ? ` (${payload.details})` : "";
        const msg = `${payload.error ?? "Unable to create guest."}${details}`;
        setFeedback(msg);
        toast.error("Add guest failed", { description: msg });
        return;
      }

      setFullName("");
      setEmail("");
      setMaxGuests(String(MIN_GUEST_LIMIT));
      setNotes("");
      const generated = payload.inviteCode ? ` Invite code: ${payload.inviteCode}` : "";
      const successMessage = `Guest added.${generated}`;
      setFeedback(successMessage);
      toast.success("Guest created", { description: successMessage });
      setIsAddGuestModalOpen(false);
      await loadDashboard(authToken, { skipSuccessFeedback: true });
    } catch {
      const msg = "Network error adding guest.";
      setFeedback(msg);
      toast.error("Network error", { description: msg });
    } finally {
      setLoading(false);
    }
  }

  function openEditGuest(guest: GuestRow) {
    setEditRowNumber(guest.rowNumber);
    setEditFullName(guest.fullName);
    setEditEmail(guest.email ?? "");
    setEditMaxGuests(String(guest.maxGuests));
    setEditNotes(guest.notes ?? "");
    setEditStatus(guest.status);
    setIsEditGuestModalOpen(true);
  }

  async function onEditGuestSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editRowNumber) return;
    await updateGuest(editRowNumber, {
      fullName: editFullName,
      email: editEmail,
      maxGuests: toGuestLimit(editMaxGuests),
      notes: editNotes,
      status: editStatus,
    });
    setIsEditGuestModalOpen(false);
  }

  function buildGuestInviteUrl(guest: GuestRow) {
    if (typeof window === "undefined") return "";
    const params = new URLSearchParams({
      invite: guest.inviteCode,
      token: guest.inviteToken,
    });
    return `${window.location.origin}/?${params.toString()}`;
  }

  async function openQrModal(guest: GuestRow) {
    const url = buildGuestInviteUrl(guest);
    if (!url) return;

    try {
      const qr = await QRCode.toDataURL(url, {
        width: 380,
        margin: 1,
      });
      setQrGuest(guest);
      setQrImageDataUrl(qr);
      setIsQrModalOpen(true);
    } catch (error) {
      console.error("QR generation error:", error);
      toast.error("QR failed", { description: "Unable to generate QR right now." });
    }
  }

  async function copyQrLink() {
    if (!qrGuest) return;
    const url = buildGuestInviteUrl(qrGuest);
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied", { description: "Guest RSVP link copied to clipboard." });
    } catch {
      toast.error("Copy failed", { description: "Unable to copy the RSVP link." });
    }
  }

  function downloadQrImage() {
    if (!qrImageDataUrl || !qrGuest) return;
    const link = document.createElement("a");
    link.href = qrImageDataUrl;
    link.download = `${qrGuest.fullName.replace(/\\s+/g, "-").toLowerCase()}-rsvp-qr.png`;
    link.click();
  }

  async function onDeleteGuest(guest: GuestRow) {
    const authToken = token;
    if (!authToken) return;

    const confirmed = window.confirm(
      `Delete guest \"${guest.fullName}\" (${guest.inviteCode})? This cannot be undone.`,
    );
    if (!confirmed) return;

    setLoading(true);
    setFeedback("");
    try {
      const response = await fetch("/api/admin/guest", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": authToken,
        },
        body: JSON.stringify({ rowNumber: guest.rowNumber }),
      });

      const payload = await response.json();
      if (!response.ok) {
        const details = payload.details ? ` (${payload.details})` : "";
        const msg = `${payload.error ?? "Unable to delete guest."}${details}`;
        setFeedback(msg);
        toast.error("Delete failed", { description: msg });
        return;
      }

      setFeedback("Guest deleted.");
      toast.success("Guest deleted", {
        description: `${guest.fullName} was removed from guest list.`,
      });
      await loadDashboard(authToken, { skipSuccessFeedback: true });
    } catch {
      const msg = "Network error deleting guest.";
      setFeedback(msg);
      toast.error("Network error", { description: msg });
    } finally {
      setLoading(false);
    }
  }

  async function onNormalizeGuestSheet() {
    const authToken = token;
    if (!authToken) return;

    const confirmed = window.confirm(
      "Normalize all guest rows to the new schema? This rewrites guest rows and adds missing invite tokens.",
    );
    if (!confirmed) return;

    setNormalizeLoading(true);
    try {
      const response = await fetch("/api/admin/normalize-guests", {
        method: "POST",
        headers: {
          "x-admin-token": authToken,
        },
      });
      const payload = await response.json();
      if (!response.ok) {
        const details = payload.details ? ` (${payload.details})` : "";
        const msg = `${payload.error ?? "Unable to normalize sheet."}${details}`;
        toast.error("Normalize failed", { description: msg });
        return;
      }

      toast.success("Normalization complete", {
        description: `${payload.normalizedRows} row(s) normalized, ${payload.tokenGeneratedCount} token(s) generated.`,
      });
      await loadDashboard(authToken, { skipSuccessFeedback: true });
    } catch {
      toast.error("Network error", {
        description: "Unable to normalize guest sheet right now.",
      });
    } finally {
      setNormalizeLoading(false);
    }
  }

  function toSafeFilePart(value: string) {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }

  async function downloadAllGuestQrs() {
    if (!dashboard || dashboard.guests.length === 0) {
      toast("No guests", { description: "There are no guests to export." });
      return;
    }

    setBulkQrLoading(true);
    try {
      const zip = new JSZip();
      const linksCsvLines = ["full_name,invite_code,link"];

      for (const guest of dashboard.guests) {
        const url = buildGuestInviteUrl(guest);
        const qrDataUrl = await QRCode.toDataURL(url, {
          width: 380,
          margin: 1,
        });
        const base64 = qrDataUrl.split(",")[1] ?? "";
        const safeName = toSafeFilePart(guest.fullName) || "guest";
        const safeCode = toSafeFilePart(guest.inviteCode) || "code";
        zip.file(`${safeName}-${safeCode}.png`, base64, { base64: true });
        linksCsvLines.push(`"${guest.fullName}","${guest.inviteCode}","${url}"`);
      }

      zip.file("guest-links.csv", linksCsvLines.join("\n"));

      const blob = await zip.generateAsync({ type: "blob" });
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = "red-jess-guest-qrs.zip";
      link.click();
      URL.revokeObjectURL(objectUrl);

      toast.success("QR ZIP ready", {
        description: `Downloaded ${dashboard.guests.length} guest QR code(s).`,
      });
    } catch (error) {
      console.error("Bulk QR generation error:", error);
      toast.error("Download failed", {
        description: "Unable to generate guest QR ZIP right now.",
      });
    } finally {
      setBulkQrLoading(false);
    }
  }

  useEffect(() => {
    const session = readStoredAdminSession();
    if (!session) return;
    const rafId = window.requestAnimationFrame(() => {
      void loadDashboard(session, { silent: true, skipSuccessFeedback: true });
    });

    return () => window.cancelAnimationFrame(rafId);
  }, [loadDashboard]);

  useEffect(() => {
    if (!connected || !token) return;

    const id = window.setInterval(() => {
      void loadDashboard(token, { silent: true, skipSuccessFeedback: true });
    }, 10000);

    return () => window.clearInterval(id);
  }, [connected, token, loadDashboard]);

  async function updateGuest(
    rowNumber: number,
    updates: Partial<Pick<GuestRow, "fullName" | "email" | "maxGuests" | "status" | "notes">>,
  ) {
    const authToken = token;
    if (!authToken) return;

    setLoading(true);
    setFeedback("");

    try {
      const response = await fetch("/api/admin/guest", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": authToken,
        },
        body: JSON.stringify({
          rowNumber,
          ...updates,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        const details = payload.details ? ` (${payload.details})` : "";
        const msg = `${payload.error ?? "Unable to update guest."}${details}`;
        setFeedback(msg);
        toast.error("Update failed", { description: msg });
        return;
      }

      setFeedback("Guest updated.");
      toast.success("Saved", { description: "Guest details updated." });
      await loadDashboard(authToken, { skipSuccessFeedback: true });
    } catch {
      const msg = "Network error updating guest.";
      setFeedback(msg);
      toast.error("Network error", { description: msg });
    } finally {
      setLoading(false);
    }
  }

  async function onCreateEntourageCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const authToken = token;
    if (!authToken) return;

    const normalizedName = normalizeCompareKey(categoryNameInput);
    const normalizedSlug = normalizeCompareKey(categorySlugInput);
    const hasNameDuplicate = entourageCategories.some(
      (category) => normalizeCompareKey(category.name) === normalizedName,
    );
    const hasSlugDuplicate =
      normalizedSlug.length > 0 &&
      entourageCategories.some((category) => normalizeCompareKey(category.slug) === normalizedSlug);

    if (hasNameDuplicate || hasSlugDuplicate) {
      const continueCreate = window.confirm(
        "Possible duplicate detected (same category name or slug). Continue anyway?",
      );
      if (!continueCreate) return;
    }

    setEntourageBusy(true);
    try {
      const sortOrder = Number.parseInt(categorySortOrderInput, 10);
      const response = await fetch("/api/admin/entourage-category", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": authToken,
        },
        body: JSON.stringify({
          name: categoryNameInput,
          slug: categorySlugInput || undefined,
          sortOrder: Number.isNaN(sortOrder) ? undefined : sortOrder,
          isVisible: categoryVisibleInput,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        const details = payload.details ? ` (${payload.details})` : "";
        toast.error("Create failed", {
          description: `${payload.error ?? "Unable to create category."}${details}`,
        });
        return;
      }

      setCategoryNameInput("");
      setCategorySlugInput("");
      setCategorySortOrderInput("10");
      setCategoryVisibleInput(true);
      setIsCreateEntourageCategoryModalOpen(false);
      toast.success("Category created");
      await loadDashboard(authToken, { skipSuccessFeedback: true });
    } catch {
      toast.error("Network error", { description: "Unable to create category right now." });
    } finally {
      setEntourageBusy(false);
    }
  }

  async function onCreateEntourageMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const authToken = token;
    if (!authToken) return;
    if (!activeMemberCategoryId) {
      toast.warning("Add a category first", {
        description: "Create at least one entourage category before adding members.",
      });
      return;
    }

    const hasDuplicateMemberInCategory = entourageMembers.some(
      (member) =>
        member.categoryId === activeMemberCategoryId &&
        normalizeCompareKey(member.fullName) === normalizeCompareKey(memberNameInput),
    );
    if (hasDuplicateMemberInCategory) {
      const continueCreate = window.confirm(
        "Duplicate member name detected in this category. Continue anyway?",
      );
      if (!continueCreate) return;
    }

    setEntourageBusy(true);
    try {
      const memberOrder = Number.parseInt(memberOrderInput, 10);
      const response = await fetch("/api/admin/entourage-member", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": authToken,
        },
        body: JSON.stringify({
          categoryId: activeMemberCategoryId,
          fullName: memberNameInput,
          side: memberSideInput,
          memberOrder: Number.isNaN(memberOrder) ? undefined : memberOrder,
          isVisible: memberVisibleInput,
          notes: memberNotesInput,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        const details = payload.details ? ` (${payload.details})` : "";
        toast.error("Create failed", {
          description: `${payload.error ?? "Unable to create member."}${details}`,
        });
        return;
      }

      setMemberNameInput("");
      setMemberOrderInput("10");
      setMemberSideInput("none");
      setMemberVisibleInput(true);
      setMemberNotesInput("");
      setIsCreateEntourageMemberModalOpen(false);
      toast.success("Member created");
      await loadDashboard(authToken, { skipSuccessFeedback: true });
    } catch {
      toast.error("Network error", { description: "Unable to create member right now." });
    } finally {
      setEntourageBusy(false);
    }
  }

  async function onDeleteEntourageCategory(category: EntourageCategoryRow) {
    const authToken = token;
    if (!authToken) return;
    const confirmed = window.confirm(
      `Delete category \"${category.name}\"? This only works when category has no members.`,
    );
    if (!confirmed) return;

    setEntourageBusy(true);
    try {
      const response = await fetch("/api/admin/entourage-category", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": authToken,
        },
        body: JSON.stringify({ id: category.id }),
      });
      const payload = await response.json();
      if (!response.ok) {
        const details = payload.details ? ` (${payload.details})` : "";
        toast.error("Delete failed", {
          description: `${payload.error ?? "Unable to delete category."}${details}`,
        });
        return;
      }
      toast.success("Category deleted");
      await loadDashboard(authToken, { skipSuccessFeedback: true });
    } catch {
      toast.error("Network error", { description: "Unable to delete category right now." });
    } finally {
      setEntourageBusy(false);
    }
  }

  async function onDeleteEntourageMember(member: EntourageMemberRow) {
    const authToken = token;
    if (!authToken) return;
    const confirmed = window.confirm(`Delete member \"${member.fullName}\"?`);
    if (!confirmed) return;

    setEntourageBusy(true);
    try {
      const response = await fetch("/api/admin/entourage-member", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": authToken,
        },
        body: JSON.stringify({ id: member.id }),
      });
      const payload = await response.json();
      if (!response.ok) {
        const details = payload.details ? ` (${payload.details})` : "";
        toast.error("Delete failed", {
          description: `${payload.error ?? "Unable to delete member."}${details}`,
        });
        return;
      }
      toast.success("Member deleted");
      await loadDashboard(authToken, { skipSuccessFeedback: true });
    } catch {
      toast.error("Network error", { description: "Unable to delete member right now." });
    } finally {
      setEntourageBusy(false);
    }
  }

  async function onToggleCategoryVisibility(category: EntourageCategoryRow) {
    const authToken = token;
    if (!authToken) return;

    setEntourageBusy(true);
    try {
      const response = await fetch("/api/admin/entourage-category", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": authToken,
        },
        body: JSON.stringify({
          id: category.id,
          isVisible: !category.isVisible,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        const details = payload.details ? ` (${payload.details})` : "";
        toast.error("Update failed", {
          description: `${payload.error ?? "Unable to update category."}${details}`,
        });
        return;
      }
      await loadDashboard(authToken, { skipSuccessFeedback: true });
    } catch {
      toast.error("Network error", { description: "Unable to update category right now." });
    } finally {
      setEntourageBusy(false);
    }
  }

  async function onToggleMemberVisibility(member: EntourageMemberRow) {
    const authToken = token;
    if (!authToken) return;

    setEntourageBusy(true);
    try {
      const response = await fetch("/api/admin/entourage-member", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": authToken,
        },
        body: JSON.stringify({
          id: member.id,
          isVisible: !member.isVisible,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        const details = payload.details ? ` (${payload.details})` : "";
        toast.error("Update failed", {
          description: `${payload.error ?? "Unable to update member."}${details}`,
        });
        return;
      }
      await loadDashboard(authToken, { skipSuccessFeedback: true });
    } catch {
      toast.error("Network error", { description: "Unable to update member right now." });
    } finally {
      setEntourageBusy(false);
    }
  }

  async function onMoveCategory(categoryId: string, direction: "up" | "down") {
    const authToken = token;
    if (!authToken) return;

    const index = entourageCategories.findIndex((category) => category.id === categoryId);
    if (index < 0) return;

    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= entourageCategories.length) return;

    const current = entourageCategories[index];
    const target = entourageCategories[targetIndex];

    setEntourageBusy(true);
    try {
      const responses = await Promise.all([
        fetch("/api/admin/entourage-category", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "x-admin-token": authToken,
          },
          body: JSON.stringify({ id: current.id, sortOrder: target.sortOrder }),
        }),
        fetch("/api/admin/entourage-category", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "x-admin-token": authToken,
          },
          body: JSON.stringify({ id: target.id, sortOrder: current.sortOrder }),
        }),
      ]);
      if (responses.some((response) => !response.ok)) {
        throw new Error("Unable to reorder category.");
      }

      await loadDashboard(authToken, { skipSuccessFeedback: true });
    } catch {
      toast.error("Network error", { description: "Unable to reorder category right now." });
    } finally {
      setEntourageBusy(false);
    }
  }

  async function onMoveMember(
    memberId: string,
    categoryId: string,
    direction: "up" | "down",
  ) {
    const authToken = token;
    if (!authToken) return;

    const membersInCategory = entourageMembers.filter(
      (member) => member.categoryId === categoryId,
    );
    const index = membersInCategory.findIndex((member) => member.id === memberId);
    if (index < 0) return;

    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= membersInCategory.length) return;

    const current = membersInCategory[index];
    const target = membersInCategory[targetIndex];

    setEntourageBusy(true);
    try {
      const responses = await Promise.all([
        fetch("/api/admin/entourage-member", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "x-admin-token": authToken,
          },
          body: JSON.stringify({ id: current.id, memberOrder: target.memberOrder }),
        }),
        fetch("/api/admin/entourage-member", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "x-admin-token": authToken,
          },
          body: JSON.stringify({ id: target.id, memberOrder: current.memberOrder }),
        }),
      ]);
      if (responses.some((response) => !response.ok)) {
        throw new Error("Unable to reorder member.");
      }

      await loadDashboard(authToken, { skipSuccessFeedback: true });
    } catch {
      toast.error("Network error", { description: "Unable to reorder member right now." });
    } finally {
      setEntourageBusy(false);
    }
  }

  function onEditEntourageCategory(category: EntourageCategoryRow) {
    setEditingCategoryId(category.id);
    setEditCategoryNameInput(category.name);
    setEditCategorySlugInput(category.slug);
    setEditCategorySortOrderInput(String(category.sortOrder));
    setEditCategoryVisibleInput(category.isVisible);
    setIsEditEntourageCategoryModalOpen(true);
  }

  async function onEditEntourageCategorySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const authToken = token;
    if (!authToken || !editingCategoryId) return;

    const normalizedName = normalizeCompareKey(editCategoryNameInput);
    const normalizedSlug = normalizeCompareKey(editCategorySlugInput);
    const hasNameDuplicate = entourageCategories.some(
      (category) =>
        category.id !== editingCategoryId &&
        normalizeCompareKey(category.name) === normalizedName,
    );
    const hasSlugDuplicate = entourageCategories.some(
      (category) =>
        category.id !== editingCategoryId &&
        normalizeCompareKey(category.slug) === normalizedSlug,
    );

    if (hasNameDuplicate || hasSlugDuplicate) {
      const continueSave = window.confirm(
        "Possible duplicate detected (same category name or slug). Continue saving?",
      );
      if (!continueSave) return;
    }

    setEntourageBusy(true);
    try {
      const sortOrder = Number.parseInt(editCategorySortOrderInput, 10);
      const response = await fetch("/api/admin/entourage-category", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": authToken,
        },
        body: JSON.stringify({
          id: editingCategoryId,
          name: editCategoryNameInput,
          slug: editCategorySlugInput,
          sortOrder: Number.isNaN(sortOrder) ? undefined : sortOrder,
          isVisible: editCategoryVisibleInput,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        const details = payload.details ? ` (${payload.details})` : "";
        toast.error("Update failed", {
          description: `${payload.error ?? "Unable to update category."}${details}`,
        });
        return;
      }

      toast.success("Category updated");
      setIsEditEntourageCategoryModalOpen(false);
      setEditingCategoryId("");
      await loadDashboard(authToken, { skipSuccessFeedback: true });
    } catch {
      toast.error("Network error", { description: "Unable to update category right now." });
    } finally {
      setEntourageBusy(false);
    }
  }

  function onEditEntourageMember(member: EntourageMemberRow) {
    setEditingMemberId(member.id);
    setEditMemberNameInput(member.fullName);
    setEditMemberCategoryIdInput(member.categoryId);
    setEditMemberSideInput(member.side);
    setEditMemberOrderInput(String(member.memberOrder));
    setEditMemberVisibleInput(member.isVisible);
    setEditMemberNotesInput(member.notes);
    setIsEditEntourageMemberModalOpen(true);
  }

  async function onEditEntourageMemberSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const authToken = token;
    if (!authToken || !editingMemberId || !editMemberCategoryIdInput) return;

    const hasDuplicateMemberInCategory = entourageMembers.some(
      (member) =>
        member.id !== editingMemberId &&
        member.categoryId === editMemberCategoryIdInput &&
        normalizeCompareKey(member.fullName) === normalizeCompareKey(editMemberNameInput),
    );

    if (hasDuplicateMemberInCategory) {
      const continueSave = window.confirm(
        "Duplicate member name detected in this category. Continue saving?",
      );
      if (!continueSave) return;
    }

    setEntourageBusy(true);
    try {
      const memberOrder = Number.parseInt(editMemberOrderInput, 10);
      const response = await fetch("/api/admin/entourage-member", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": authToken,
        },
        body: JSON.stringify({
          id: editingMemberId,
          categoryId: editMemberCategoryIdInput,
          fullName: editMemberNameInput,
          side: editMemberSideInput,
          memberOrder: Number.isNaN(memberOrder) ? undefined : memberOrder,
          isVisible: editMemberVisibleInput,
          notes: editMemberNotesInput,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        const details = payload.details ? ` (${payload.details})` : "";
        toast.error("Update failed", {
          description: `${payload.error ?? "Unable to update member."}${details}`,
        });
        return;
      }

      toast.success("Member updated");
      setIsEditEntourageMemberModalOpen(false);
      setEditingMemberId("");
      await loadDashboard(authToken, { skipSuccessFeedback: true });
    } catch {
      toast.error("Network error", { description: "Unable to update member right now." });
    } finally {
      setEntourageBusy(false);
    }
  }

  function onStatCardClick(target: "all" | "pending" | "attending" | "declined" | "headcount") {
    if (target === "all") {
      setActiveTab("guests");
      setGuestStatusFilter("all");
      setGuestPage(1);
      return;
    }

    if (target === "pending") {
      setActiveTab("guests");
      setGuestStatusFilter("pending");
      setGuestPage(1);
      return;
    }

    if (target === "headcount") {
      setActiveTab("rsvps");
      setRsvpStatusFilter("attending");
      setRsvpPage(1);
      return;
    }

    setGuestStatusFilter(target);
    setGuestPage(1);
    setRsvpStatusFilter(target);
    setRsvpPage(1);
  }

  function toggleGuestSort(field: GuestSortField) {
    if (guestSortField === field) {
      setGuestSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setGuestSortField(field);
    setGuestSortDirection("asc");
  }

  function toggleRsvpSort(field: RsvpSortField) {
    if (rsvpSortField === field) {
      setRsvpSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setRsvpSortField(field);
    setRsvpSortDirection("asc");
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold text-[var(--ink-deep)] sm:text-4xl">Admin Panel</h1>
          <p className="mt-2 text-sm text-[var(--ink-soft)]">
            Google Sheets-backed guest management for Red & Jess RSVP.
          </p>
          <p className="mt-1 text-xs text-[color-mix(in_srgb,var(--ink-soft)_84%,var(--foreground)_16%)]">Dashboard auto-refreshes every 10 seconds.</p>
        </div>
        <ThemeToggle />
      </div>

      {!connected ? (
        <form
          onSubmit={onConnect}
          className="mt-5 flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:flex-row"
        >
          <input
            className="w-full rounded-lg border border-[var(--border)] px-3 py-2"
            type="password"
            placeholder="Enter ADMIN_TOKEN"
            value={token}
            onChange={(event) => setToken(event.target.value)}
          />
          <button
            type="submit"
            className="w-full rounded-lg bg-[var(--ink-deep)] px-4 py-2 text-[var(--background)] disabled:opacity-50 sm:w-auto"
            disabled={loading || !token}
          >
            {loading ? "Loading..." : "Connect"}
          </button>
        </form>
      ) : (
        <section className="mt-5 flex flex-col gap-3 rounded-2xl border border-[var(--success-border)] bg-[var(--success-soft)] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-[var(--success-text)]">Connected to Google Sheet</p>
            <p className="text-xs text-[var(--success-text)]">Session: Active (tab only)</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              className="w-full rounded-lg border border-[var(--success-border)] px-4 py-2 text-sm text-[var(--success-text)] sm:w-auto"
              onClick={() =>
                void loadDashboard(token, {
                  skipSuccessFeedback: true,
                })
              }
              disabled={loading || !token}
            >
              Refresh
            </button>
            <button
              type="button"
              className="w-full rounded-lg bg-[var(--ink-deep)] px-4 py-2 text-sm text-[var(--background)] sm:w-auto"
              onClick={disconnectAdminSession}
            >
              Disconnect
            </button>
          </div>
        </section>
      )}

      {feedback ? (
        <p className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink-soft)]">
          {feedback}
        </p>
      ) : null}

      {dashboard ? (
        <>
          <section className="mt-6 rounded-2xl border border-[var(--info-border)] bg-[var(--info-soft)] p-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-lg font-semibold text-[var(--info-text)]">Wedding Countdown Settings</h2>
              <div className="text-xs text-[var(--info-text)] sm:text-right">
                <p>{countdownSummary}</p>
                <p>{countdownVisibilitySummary}</p>
              </div>
            </div>
            <form
              onSubmit={onSaveWeddingDate}
              className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-[minmax(0,220px)_minmax(0,180px)_minmax(0,1fr)_auto]"
            >
              <label className="flex w-full flex-col gap-1 text-sm text-[var(--info-text)]">
                <span>Wedding Date</span>
                <input
                  className="rounded-lg border border-[var(--info-border)] bg-[var(--surface)] px-3 py-2"
                  type="date"
                  value={weddingDateInput}
                  onChange={(event) => {
                    setWeddingDateInput(event.target.value);
                    setCountdownSettingsDirty(true);
                  }}
                />
              </label>
              <label className="flex w-full flex-col gap-1 text-sm text-[var(--info-text)]">
                <span>Wedding Time</span>
                <input
                  className="rounded-lg border border-[var(--info-border)] bg-[var(--surface)] px-3 py-2"
                  type="time"
                  value={weddingTimeInput}
                  onChange={(event) => {
                    setWeddingTimeInput(event.target.value || DEFAULT_WEDDING_TIME);
                    setCountdownSettingsDirty(true);
                  }}
                />
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-[var(--info-border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--info-text)]">
                <input
                  className="h-4 w-4"
                  type="checkbox"
                  checked={showCountdownInput}
                  onChange={(event) => {
                    setShowCountdownInput(event.target.checked);
                    setCountdownSettingsDirty(true);
                  }}
                />
                <span>Show countdown on RSVP page</span>
              </label>
              <button
                type="submit"
	                className="w-full rounded-lg bg-[var(--accent)] px-4 py-2 text-[var(--background)] disabled:opacity-50 md:col-span-2 lg:col-span-1"
                disabled={settingsSaving || loading}
              >
                {settingsSaving ? "Saving..." : "Save Countdown Settings"}
              </button>
            </form>
            <p className="mt-2 text-xs text-[var(--info-text)]">
              Use the toggle if you want to hide the countdown card without removing date/time.
            </p>
          </section>

          <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard
              label="Invited Guests"
              value={dashboard.stats.totalGuests}
              tone="slate"
              active={activeTab === "guests" && guestStatusFilter === "all"}
              onClick={() => onStatCardClick("all")}
            />
            <StatCard
              label="Pending"
              value={dashboard.stats.pending}
              tone="amber"
              active={activeTab === "guests" && guestStatusFilter === "pending"}
              onClick={() => onStatCardClick("pending")}
            />
            <StatCard
              label="Attending"
              value={dashboard.stats.attending}
              tone="emerald"
              active={
                (activeTab === "guests" && guestStatusFilter === "attending") ||
                (activeTab === "rsvps" && rsvpStatusFilter === "attending")
              }
              onClick={() => onStatCardClick("attending")}
            />
            <StatCard
              label="Declined"
              value={dashboard.stats.declined}
              tone="rose"
              active={
                (activeTab === "guests" && guestStatusFilter === "declined") ||
                (activeTab === "rsvps" && rsvpStatusFilter === "declined")
              }
              onClick={() => onStatCardClick("declined")}
            />
            <StatCard
              label="Headcount"
              value={attendingHeadCount}
              tone="sky"
              active={activeTab === "rsvps" && rsvpStatusFilter === "attending"}
              onClick={() => onStatCardClick("headcount")}
            />
          </section>

          <section className="mt-8 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-xl font-semibold text-[var(--ink-deep)]">Guest Management</h2>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  className="w-full rounded-lg border border-[var(--warn-border)] bg-[var(--warn-soft)] px-4 py-2 text-sm text-[var(--warn-text)] sm:w-auto"
                  onClick={() => void onNormalizeGuestSheet()}
                  disabled={normalizeLoading || loading}
                >
                  {normalizeLoading ? "Normalizing..." : "Normalize Columns"}
                </button>
                <button
                  type="button"
                  className="w-full rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--ink-soft)] sm:w-auto"
                  onClick={() => void downloadAllGuestQrs()}
                  disabled={bulkQrLoading || loading || dashboard.guests.length === 0}
                >
                  {bulkQrLoading ? "Preparing ZIP..." : "Download All QR (ZIP)"}
                </button>
                <button
                  type="button"
                  className="w-full rounded-lg bg-[var(--success)] px-4 py-2 text-[var(--background)] sm:w-auto"
                  onClick={() => setIsAddGuestModalOpen(true)}
                >
                  Add Guest
                </button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-2 rounded-xl bg-[var(--surface-2)] p-1 sm:grid-cols-3">
              <button
                type="button"
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                  activeTab === "guests"
                    ? "bg-[var(--surface)] text-[var(--ink-deep)] shadow-sm"
                    : "text-[var(--ink-soft)] hover:bg-[color-mix(in_srgb,var(--surface-2)_82%,var(--border)_18%)]"
                }`}
                onClick={() => setActiveTab("guests")}
              >
                Guests ({dashboard.guests.length})
              </button>
              <button
                type="button"
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                  activeTab === "rsvps"
                    ? "bg-[var(--surface)] text-[var(--ink-deep)] shadow-sm"
                    : "text-[var(--ink-soft)] hover:bg-[color-mix(in_srgb,var(--surface-2)_82%,var(--border)_18%)]"
                }`}
                onClick={() => setActiveTab("rsvps")}
              >
                RSVP Submissions ({dashboard.rsvps.length})
              </button>
              <button
                type="button"
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                  activeTab === "entourage"
                    ? "bg-[var(--surface)] text-[var(--ink-deep)] shadow-sm"
                    : "text-[var(--ink-soft)] hover:bg-[color-mix(in_srgb,var(--surface-2)_82%,var(--border)_18%)]"
                }`}
                onClick={() => setActiveTab("entourage")}
              >
                Entourage ({dashboard.entourage.members.length})
              </button>
            </div>

            {activeTab === "guests" ? (
              <>
                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
                  <input
                    className="rounded-lg border border-[var(--border)] px-3 py-2"
                    placeholder="Search guest, invite code, email, notes"
                    value={guestSearch}
                    onChange={(event) => {
                      setGuestSearch(event.target.value);
                      setGuestPage(1);
                    }}
                  />
                  <select
                    className="rounded-lg border border-[var(--border)] px-3 py-2"
                    value={guestStatusFilter}
                    onChange={(event) => {
                      setGuestStatusFilter(event.target.value as GuestStatusFilter);
                      setGuestPage(1);
                    }}
                  >
                    <option value="all">All statuses</option>
                    <option value="pending">Pending</option>
                    <option value="attending">Attending</option>
                    <option value="declined">Declined</option>
                  </select>
                  <select
                    className="rounded-lg border border-[var(--border)] px-3 py-2"
                    value={String(guestPageSize)}
                    onChange={(event) => {
                      setGuestPageSize(Number(event.target.value));
                      setGuestPage(1);
                    }}
                  >
                    <option value="8">8 per page</option>
                    <option value="15">15 per page</option>
                    <option value="25">25 per page</option>
                  </select>
                  <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--ink-soft)]">
                    {filteredGuests.length} result(s) - Sort: {guestSortField} ({guestSortDirection})
                  </div>
                </div>

                <div className="mt-4 space-y-3 md:hidden">
                  {paginatedGuests.length === 0 ? (
                    <EmptyState label="No guests match your filter." />
                  ) : (
                    paginatedGuests.map((guest) => (
                      <article
                        key={`${guest.rowNumber}-${guest.id}-card`}
                        className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <p className="font-semibold text-[var(--ink-deep)]">{guest.fullName}</p>
                          <StatusBadge status={guest.status} />
                        </div>
                        <p className="mt-1 text-xs text-[var(--ink-soft)]">Invite: {guest.inviteCode}</p>
                        <p className="mt-1 text-xs text-[var(--ink-soft)]">Email: {guest.email || "-"}</p>
                        <p className="mt-1 text-xs text-[var(--ink-soft)]">Max guests: {guest.maxGuests}</p>
                        <p className="mt-2 text-xs text-[color-mix(in_srgb,var(--ink-soft)_84%,var(--foreground)_16%)]">Notes: {guest.notes || "-"}</p>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <div className="col-span-2 flex items-center gap-2">
                            <IconActionButton
                              title="Edit guest"
                              onClick={() => openEditGuest(guest)}
                              icon={<EditIcon />}
                            />
                            <IconActionButton
                              title="Show QR"
                              onClick={() => void openQrModal(guest)}
                              icon={<QrIcon />}
                            />
                            <IconActionButton
                              title="Delete guest"
                              onClick={() => void onDeleteGuest(guest)}
                              icon={<TrashIcon />}
                              tone="danger"
                            />
                          </div>
                        </div>
                        <p className="mt-2 text-[11px] text-[color-mix(in_srgb,var(--ink-soft)_84%,var(--foreground)_16%)]">
                          Updated: {formatTimestamp(guest.lastUpdated)}
                        </p>
                      </article>
                    ))
                  )}
                </div>

                <div className="mt-4 hidden overflow-auto md:block">
                  <table className="w-full min-w-[980px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border)] text-left text-[var(--ink-soft)]">
                        <th className="p-2">
                          <button type="button" onClick={() => toggleGuestSort("fullName")}>
                            Name {sortMark(guestSortField, guestSortDirection, "fullName")}
                          </button>
                        </th>
                        <th className="p-2">
                          <button type="button" onClick={() => toggleGuestSort("inviteCode")}>
                            Invite {sortMark(guestSortField, guestSortDirection, "inviteCode")}
                          </button>
                        </th>
                        <th className="p-2">Email</th>
                        <th className="p-2">
                          <button type="button" onClick={() => toggleGuestSort("maxGuests")}>
                            Max {sortMark(guestSortField, guestSortDirection, "maxGuests")}
                          </button>
                        </th>
                        <th className="p-2">
                          <button type="button" onClick={() => toggleGuestSort("status")}>
                            Status {sortMark(guestSortField, guestSortDirection, "status")}
                          </button>
                        </th>
                        <th className="p-2">Notes</th>
                        <th className="p-2">
                          <button type="button" onClick={() => toggleGuestSort("lastUpdated")}>
                            Updated {sortMark(guestSortField, guestSortDirection, "lastUpdated")}
                          </button>
                        </th>
                        <th className="p-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedGuests.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="p-4 text-center text-[color-mix(in_srgb,var(--ink-soft)_84%,var(--foreground)_16%)]">
                            No guests match your filter.
                          </td>
                        </tr>
                      ) : (
                        paginatedGuests.map((guest) => (
                          <tr key={`${guest.rowNumber}-${guest.id}`} className="border-b border-[var(--border)]">
                            <td className="p-2 font-medium text-[var(--ink-deep)]">{guest.fullName}</td>
                            <td className="p-2">{guest.inviteCode}</td>
                            <td className="p-2">{guest.email || "-"}</td>
                            <td className="p-2">{guest.maxGuests}</td>
                            <td className="p-2">
                              <StatusBadge status={guest.status} />
                            </td>
                            <td className="p-2">{guest.notes || "-"}</td>
                            <td className="p-2 text-[var(--ink-soft)]">{formatTimestamp(guest.lastUpdated)}</td>
                            <td className="p-2">
                              <div className="flex items-center gap-2">
                                <IconActionButton
                                  title="Edit guest"
                                  onClick={() => openEditGuest(guest)}
                                  icon={<EditIcon />}
                                />
                                <IconActionButton
                                  title="Show QR"
                                  onClick={() => void openQrModal(guest)}
                                  icon={<QrIcon />}
                                />
                                <IconActionButton
                                  title="Delete guest"
                                  onClick={() => void onDeleteGuest(guest)}
                                  icon={<TrashIcon />}
                                  tone="danger"
                                />
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <Pagination
                  currentPage={guestCurrentPage}
                  totalPages={guestTotalPages}
                  onPageChange={setGuestPage}
                />
              </>
            ) : activeTab === "rsvps" ? (
              <>
                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
                  <input
                    className="rounded-lg border border-[var(--border)] px-3 py-2"
                    placeholder="Search name, code, companions, message"
                    value={rsvpSearch}
                    onChange={(event) => {
                      setRsvpSearch(event.target.value);
                      setRsvpPage(1);
                    }}
                  />
                  <select
                    className="rounded-lg border border-[var(--border)] px-3 py-2"
                    value={rsvpStatusFilter}
                    onChange={(event) => {
                      setRsvpStatusFilter(event.target.value as RsvpStatusFilter);
                      setRsvpPage(1);
                    }}
                  >
                    <option value="all">All attendance</option>
                    <option value="attending">Attending</option>
                    <option value="declined">Declined</option>
                  </select>
                  <select
                    className="rounded-lg border border-[var(--border)] px-3 py-2"
                    value={String(rsvpPageSize)}
                    onChange={(event) => {
                      setRsvpPageSize(Number(event.target.value));
                      setRsvpPage(1);
                    }}
                  >
                    <option value="8">8 per page</option>
                    <option value="15">15 per page</option>
                    <option value="25">25 per page</option>
                  </select>
                  <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--ink-soft)]">
                    {filteredRsvps.length} result(s) - Sort: {rsvpSortField} ({rsvpSortDirection})
                  </div>
                </div>

                <div className="mt-4 space-y-3 md:hidden">
                  {paginatedRsvps.length === 0 ? (
                    <EmptyState label="No RSVP submissions match your filter." />
                  ) : (
                    paginatedRsvps.map((rsvp) => (
                      <article
                        key={`${rsvp.rowNumber}-${rsvp.timestamp}-card`}
                        className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <p className="font-semibold text-[var(--ink-deep)]">{rsvp.fullName}</p>
                          <AttendanceBadge attendance={rsvp.attendance} />
                        </div>
                        <p className="mt-1 text-xs text-[var(--ink-soft)]">Invite: {rsvp.inviteCode}</p>
                        <p className="mt-1 text-xs text-[var(--ink-soft)]">Guests: {rsvp.guestCount}</p>
                        <p className="mt-1 text-xs text-[var(--ink-soft)]">
                          Companions: {rsvp.companionNames || "-"}
                        </p>
                        <p className="mt-1 text-xs text-[var(--ink-soft)]">Message: {rsvp.message || "-"}</p>
                        <p className="mt-2 text-[11px] text-[color-mix(in_srgb,var(--ink-soft)_84%,var(--foreground)_16%)]">
                          Submitted: {formatTimestamp(rsvp.timestamp)}
                        </p>
                      </article>
                    ))
                  )}
                </div>

                <div className="mt-4 hidden overflow-auto md:block">
                  <table className="w-full min-w-[1060px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border)] text-left text-[var(--ink-soft)]">
                        <th className="p-2">
                          <button type="button" onClick={() => toggleRsvpSort("timestamp")}>
                            Time {sortMark(rsvpSortField, rsvpSortDirection, "timestamp")}
                          </button>
                        </th>
                        <th className="p-2">
                          <button type="button" onClick={() => toggleRsvpSort("fullName")}>
                            Name {sortMark(rsvpSortField, rsvpSortDirection, "fullName")}
                          </button>
                        </th>
                        <th className="p-2">
                          <button type="button" onClick={() => toggleRsvpSort("attendance")}>
                            Attendance {sortMark(rsvpSortField, rsvpSortDirection, "attendance")}
                          </button>
                        </th>
                        <th className="p-2">
                          <button type="button" onClick={() => toggleRsvpSort("guestCount")}>
                            Guests {sortMark(rsvpSortField, rsvpSortDirection, "guestCount")}
                          </button>
                        </th>
                        <th className="p-2">Companions</th>
                        <th className="p-2">Message</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedRsvps.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="p-4 text-center text-[color-mix(in_srgb,var(--ink-soft)_84%,var(--foreground)_16%)]">
                            No RSVP submissions match your filter.
                          </td>
                        </tr>
                      ) : (
                        paginatedRsvps.map((rsvp) => (
                          <tr
                            key={`${rsvp.rowNumber}-${rsvp.timestamp}`}
                            className="border-b border-[var(--border)]"
                          >
                            <td className="p-2 text-[var(--ink-soft)]">{formatTimestamp(rsvp.timestamp)}</td>
                            <td className="p-2 font-medium text-[var(--ink-deep)]">{rsvp.fullName}</td>
                            <td className="p-2">
                              <AttendanceBadge attendance={rsvp.attendance} />
                            </td>
                            <td className="p-2">{rsvp.guestCount}</td>
                            <td className="p-2">{rsvp.companionNames || "-"}</td>
                            <td className="p-2">{rsvp.message || "-"}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <Pagination
                  currentPage={rsvpCurrentPage}
                  totalPages={rsvpTotalPages}
                  onPageChange={setRsvpPage}
                />
              </>
            ) : (
              <>
                <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-1 sm:w-fit">
                  <div className="grid grid-cols-2 gap-1">
                    <button
                      type="button"
                      className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                        activeEntourageTab === "categories"
                          ? "bg-[var(--surface)] text-[var(--ink-deep)] shadow-sm"
                          : "text-[var(--ink-soft)] hover:bg-[color-mix(in_srgb,var(--surface-2)_82%,var(--border)_18%)]"
                      }`}
                      onClick={() => setActiveEntourageTab("categories")}
                    >
                      Categories
                    </button>
                    <button
                      type="button"
                      className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                        activeEntourageTab === "members"
                          ? "bg-[var(--surface)] text-[var(--ink-deep)] shadow-sm"
                          : "text-[var(--ink-soft)] hover:bg-[color-mix(in_srgb,var(--surface-2)_82%,var(--border)_18%)]"
                      }`}
                      onClick={() => setActiveEntourageTab("members")}
                    >
                      Members
                    </button>
                  </div>
                </div>

                <p className="mt-3 text-xs text-[color-mix(in_srgb,var(--ink-soft)_84%,var(--foreground)_16%)]">
                  Google Sheets tabs needed:{" "}
                  <span className="font-medium">EntourageCategories</span> (id, name, slug, sortOrder, isVisible,
                  createdAt, updatedAt) and{" "}
                  <span className="font-medium">EntourageMembers</span> (id, categoryId, fullName, side,
                  memberOrder, isVisible, notes, createdAt, updatedAt).
                </p>

                {activeEntourageTab === "categories" ? (
                  <>
                    <div className="mt-4 flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
                      <p className="text-sm text-[var(--ink-soft)]">
                        Manage dynamic entourage categories and display order.
                      </p>
                      <button
                        type="button"
                        className="rounded-lg bg-[var(--ink-deep)] px-4 py-2 text-sm text-[var(--background)]"
                        onClick={() => setIsCreateEntourageCategoryModalOpen(true)}
                      >
                        New Category
                      </button>
                    </div>

                    <div className="mt-4 overflow-auto rounded-xl border border-[var(--border)]">
                      <table className="w-full min-w-[560px] border-collapse text-sm">
                        <thead>
                          <tr className="border-b border-[var(--border)] bg-[var(--surface-2)] text-left text-[var(--ink-soft)]">
                            <th className="p-2">Category</th>
                            <th className="p-2">Slug</th>
                            <th className="p-2">Order</th>
                            <th className="p-2">Visible</th>
                            <th className="p-2">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {entourageCategories.length === 0 ? (
                            <tr>
                              <td
                                colSpan={5}
                                className="p-4 text-center text-[color-mix(in_srgb,var(--ink-soft)_84%,var(--foreground)_16%)]"
                              >
                                No categories yet.
                              </td>
                            </tr>
                          ) : (
                            entourageCategories.map((category) => (
                              <tr key={category.id} className="border-b border-[var(--border)]">
                                <td className="p-2 font-medium text-[var(--ink-deep)]">{category.name}</td>
                                <td className="p-2">{category.slug}</td>
                                <td className="p-2">{category.sortOrder}</td>
                                <td className="p-2">{category.isVisible ? "Yes" : "No"}</td>
                                <td className="p-2">
                                  <div className="flex items-center gap-2">
                                    <IconActionButton
                                      title="Move up"
                                      onClick={() => void onMoveCategory(category.id, "up")}
                                      icon={<ChevronUpIcon />}
                                      disabled={!canMoveCategoryUp(category.id)}
                                    />
                                    <IconActionButton
                                      title="Move down"
                                      onClick={() => void onMoveCategory(category.id, "down")}
                                      icon={<ChevronDownIcon />}
                                      disabled={!canMoveCategoryDown(category.id)}
                                    />
                                    <IconActionButton
                                      title={category.isVisible ? "Hide category" : "Show category"}
                                      onClick={() => void onToggleCategoryVisibility(category)}
                                      icon={<EyeIcon visible={category.isVisible} />}
                                    />
                                    <IconActionButton
                                      title="Edit category"
                                      onClick={() => onEditEntourageCategory(category)}
                                      icon={<EditIcon />}
                                    />
                                    <IconActionButton
                                      title="Delete category"
                                      onClick={() => void onDeleteEntourageCategory(category)}
                                      icon={<TrashIcon />}
                                      tone="danger"
                                    />
                                  </div>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="mt-4 flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
                      <p className="text-sm text-[var(--ink-soft)]">
                        Manage entourage members, side labels, and sequence per category.
                      </p>
                      <button
                        type="button"
                        className="rounded-lg bg-[var(--success)] px-4 py-2 text-sm text-[var(--background)] disabled:opacity-50"
                        onClick={() => setIsCreateEntourageMemberModalOpen(true)}
                        disabled={entourageCategories.length === 0}
                      >
                        New Member
                      </button>
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <input
                        className="rounded-lg border border-[var(--border)] px-3 py-2"
                        placeholder="Search member, side, category, note"
                        value={memberSearchInput}
                        onChange={(event) => setMemberSearchInput(event.target.value)}
                      />
                      <select
                        className="rounded-lg border border-[var(--border)] px-3 py-2"
                        value={memberCategoryFilter}
                        onChange={(event) => setMemberCategoryFilter(event.target.value)}
                      >
                        <option value="all">All categories</option>
                        {entourageCategories.map((category) => (
                          <option key={`filter-${category.id}`} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="mt-4 overflow-auto rounded-xl border border-[var(--border)]">
                      <table className="w-full min-w-[700px] border-collapse text-sm">
                        <thead>
                          <tr className="border-b border-[var(--border)] bg-[var(--surface-2)] text-left text-[var(--ink-soft)]">
                            <th className="p-2">Name</th>
                            <th className="p-2">Category</th>
                            <th className="p-2">Side</th>
                            <th className="p-2">Order</th>
                            <th className="p-2">Visible</th>
                            <th className="p-2">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredEntourageMembers.length === 0 ? (
                            <tr>
                              <td
                                colSpan={6}
                                className="p-4 text-center text-[color-mix(in_srgb,var(--ink-soft)_84%,var(--foreground)_16%)]"
                              >
                                No members match your filter.
                              </td>
                            </tr>
                          ) : (
                            filteredEntourageMembers.map((member) => (
                              <tr key={member.id} className="border-b border-[var(--border)]">
                                <td className="p-2 font-medium text-[var(--ink-deep)]">{member.fullName}</td>
                                <td className="p-2">{categoryNameById.get(member.categoryId) ?? member.categoryId}</td>
                                <td className="p-2">
                                  <SideBadge side={member.side} />
                                </td>
                                <td className="p-2">{member.memberOrder}</td>
                                <td className="p-2">{member.isVisible ? "Yes" : "No"}</td>
                                <td className="p-2">
                                  <div className="flex items-center gap-2">
                                    <IconActionButton
                                      title="Move up"
                                      onClick={() =>
                                        void onMoveMember(member.id, member.categoryId, "up")
                                      }
                                      icon={<ChevronUpIcon />}
                                      disabled={!canMoveMemberUp(member.id, member.categoryId)}
                                    />
                                    <IconActionButton
                                      title="Move down"
                                      onClick={() =>
                                        void onMoveMember(member.id, member.categoryId, "down")
                                      }
                                      icon={<ChevronDownIcon />}
                                      disabled={!canMoveMemberDown(member.id, member.categoryId)}
                                    />
                                    <IconActionButton
                                      title={member.isVisible ? "Hide member" : "Show member"}
                                      onClick={() => void onToggleMemberVisibility(member)}
                                      icon={<EyeIcon visible={member.isVisible} />}
                                    />
                                    <IconActionButton
                                      title="Edit member"
                                      onClick={() => onEditEntourageMember(member)}
                                      icon={<EditIcon />}
                                    />
                                    <IconActionButton
                                      title="Delete member"
                                      onClick={() => void onDeleteEntourageMember(member)}
                                      icon={<TrashIcon />}
                                      tone="danger"
                                    />
                                  </div>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </>
            )}
          </section>
        </>
      ) : null}

      {isAddGuestModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/50 p-0 sm:items-center sm:justify-center sm:p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full rounded-t-2xl bg-[var(--surface)] p-4 shadow-xl sm:max-w-xl sm:rounded-2xl sm:p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-[var(--ink-deep)]">Add Guest</h2>
              <button
                type="button"
                className="rounded-md border border-[var(--border)] px-3 py-1 text-sm"
                onClick={() => setIsAddGuestModalOpen(false)}
              >
                Close
              </button>
            </div>
            <p className="mt-1 text-sm text-[var(--ink-soft)]">
              Invite code will be auto-generated after save.
            </p>

            <form onSubmit={onAddGuest} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input
                className="rounded-lg border border-[var(--border)] px-3 py-2"
                placeholder="Full Name"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
              />
              <input
                className="rounded-lg border border-[var(--border)] px-3 py-2"
                placeholder="Email (optional)"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
              <input
                className="rounded-lg border border-[var(--border)] px-3 py-2"
                type="number"
                min={MIN_GUEST_LIMIT}
                max={MAX_GUEST_LIMIT}
                placeholder="Max Guests"
                value={maxGuests}
                onChange={(event) => setMaxGuests(event.target.value)}
              />
              <input
                className="sm:col-span-2 rounded-lg border border-[var(--border)] px-3 py-2"
                placeholder="Notes (optional)"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
              <button
                type="submit"
                className="w-full rounded-lg bg-[var(--success)] px-4 py-2 text-[var(--background)] disabled:opacity-50 sm:w-auto"
                disabled={loading}
              >
                {loading ? "Saving..." : "Save Guest"}
              </button>
            </form>
          </div>
        </div>
      ) : null}

      {isEditGuestModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/50 p-0 sm:items-center sm:justify-center sm:p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full rounded-t-2xl bg-[var(--surface)] p-4 shadow-xl sm:max-w-xl sm:rounded-2xl sm:p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-[var(--ink-deep)]">Edit Guest</h2>
              <button
                type="button"
                className="rounded-md border border-[var(--border)] px-3 py-1 text-sm"
                onClick={() => setIsEditGuestModalOpen(false)}
              >
                Close
              </button>
            </div>
            <p className="mt-1 text-sm text-[var(--ink-soft)]">Update guest details and save changes.</p>

            <form onSubmit={onEditGuestSubmit} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input
                className="rounded-lg border border-[var(--border)] px-3 py-2"
                placeholder="Full Name"
                value={editFullName}
                onChange={(event) => setEditFullName(event.target.value)}
              />
              <input
                className="rounded-lg border border-[var(--border)] px-3 py-2"
                placeholder="Email (optional)"
                value={editEmail}
                onChange={(event) => setEditEmail(event.target.value)}
              />
              <input
                className="rounded-lg border border-[var(--border)] px-3 py-2"
                type="number"
                min={MIN_GUEST_LIMIT}
                max={MAX_GUEST_LIMIT}
                placeholder="Max Guests"
                value={editMaxGuests}
                onChange={(event) => setEditMaxGuests(event.target.value)}
              />
              <select
                className="rounded-lg border border-[var(--border)] px-3 py-2"
                value={editStatus}
                onChange={(event) => setEditStatus(event.target.value as GuestRow["status"])}
              >
                <option value="pending">pending</option>
                <option value="attending">attending</option>
                <option value="declined">declined</option>
              </select>
              <input
                className="sm:col-span-2 rounded-lg border border-[var(--border)] px-3 py-2"
                placeholder="Notes (optional)"
                value={editNotes}
                onChange={(event) => setEditNotes(event.target.value)}
              />
              <button
                type="submit"
                className="w-full rounded-lg bg-[var(--ink-deep)] px-4 py-2 text-[var(--background)] disabled:opacity-50 sm:w-auto"
                disabled={loading || !editRowNumber}
              >
                {loading ? "Saving..." : "Save Changes"}
              </button>
            </form>
          </div>
        </div>
      ) : null}

      {isCreateEntourageCategoryModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/50 p-0 sm:items-center sm:justify-center sm:p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full rounded-t-2xl bg-[var(--surface)] p-4 shadow-xl sm:max-w-xl sm:rounded-2xl sm:p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-[var(--ink-deep)]">New Category</h2>
              <button
                type="button"
                className="rounded-md border border-[var(--border)] px-3 py-1 text-sm"
                onClick={() => setIsCreateEntourageCategoryModalOpen(false)}
              >
                Close
              </button>
            </div>
            <p className="mt-1 text-sm text-[var(--ink-soft)]">
              Add a category that will appear in public entourage sections.
            </p>

            <form onSubmit={onCreateEntourageCategory} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input
                className="rounded-lg border border-[var(--border)] px-3 py-2"
                placeholder="Category Name"
                value={categoryNameInput}
                onChange={(event) => setCategoryNameInput(event.target.value)}
              />
              <input
                className="rounded-lg border border-[var(--border)] px-3 py-2"
                placeholder="Slug (optional)"
                value={categorySlugInput}
                onChange={(event) => setCategorySlugInput(event.target.value)}
              />
              <input
                className="rounded-lg border border-[var(--border)] px-3 py-2"
                type="number"
                placeholder="Sort Order"
                value={categorySortOrderInput}
                onChange={(event) => setCategorySortOrderInput(event.target.value)}
              />
              <label className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={categoryVisibleInput}
                  onChange={(event) => setCategoryVisibleInput(event.target.checked)}
                />
                Visible
              </label>
              <button
                type="submit"
                className="w-full rounded-lg bg-[var(--ink-deep)] px-4 py-2 text-[var(--background)] disabled:opacity-50 sm:w-auto sm:col-span-2"
                disabled={entourageBusy}
              >
                {entourageBusy ? "Saving..." : "Create Category"}
              </button>
            </form>
          </div>
        </div>
      ) : null}

      {isCreateEntourageMemberModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/50 p-0 sm:items-center sm:justify-center sm:p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full rounded-t-2xl bg-[var(--surface)] p-4 shadow-xl sm:max-w-xl sm:rounded-2xl sm:p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-[var(--ink-deep)]">New Member</h2>
              <button
                type="button"
                className="rounded-md border border-[var(--border)] px-3 py-1 text-sm"
                onClick={() => setIsCreateEntourageMemberModalOpen(false)}
              >
                Close
              </button>
            </div>
            <p className="mt-1 text-sm text-[var(--ink-soft)]">
              Add a person under a selected entourage category.
            </p>

            <form onSubmit={onCreateEntourageMember} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input
                className="rounded-lg border border-[var(--border)] px-3 py-2 sm:col-span-2"
                placeholder="Full Name"
                value={memberNameInput}
                onChange={(event) => setMemberNameInput(event.target.value)}
              />
              <select
                className="rounded-lg border border-[var(--border)] px-3 py-2"
                value={activeMemberCategoryId}
                onChange={(event) => setMemberCategoryIdInput(event.target.value)}
              >
                {entourageCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              <select
                className="rounded-lg border border-[var(--border)] px-3 py-2"
                value={memberSideInput}
                onChange={(event) =>
                  setMemberSideInput(event.target.value as EntourageMemberRow["side"])
                }
              >
                <option value="none">none</option>
                <option value="bride">bride</option>
                <option value="groom">groom</option>
              </select>
              <input
                className="rounded-lg border border-[var(--border)] px-3 py-2"
                type="number"
                placeholder="Order"
                value={memberOrderInput}
                onChange={(event) => setMemberOrderInput(event.target.value)}
              />
              <label className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={memberVisibleInput}
                  onChange={(event) => setMemberVisibleInput(event.target.checked)}
                />
                Visible
              </label>
              <input
                className="rounded-lg border border-[var(--border)] px-3 py-2 sm:col-span-2"
                placeholder="Notes (optional)"
                value={memberNotesInput}
                onChange={(event) => setMemberNotesInput(event.target.value)}
              />
              <button
                type="submit"
                className="w-full rounded-lg bg-[var(--success)] px-4 py-2 text-[var(--background)] disabled:opacity-50 sm:w-auto sm:col-span-2"
                disabled={entourageBusy || entourageCategories.length === 0}
              >
                {entourageBusy ? "Saving..." : "Create Member"}
              </button>
            </form>
          </div>
        </div>
      ) : null}

      {isEditEntourageCategoryModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/50 p-0 sm:items-center sm:justify-center sm:p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full rounded-t-2xl bg-[var(--surface)] p-4 shadow-xl sm:max-w-xl sm:rounded-2xl sm:p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-[var(--ink-deep)]">Edit Category</h2>
              <button
                type="button"
                className="rounded-md border border-[var(--border)] px-3 py-1 text-sm"
                onClick={() => setIsEditEntourageCategoryModalOpen(false)}
              >
                Close
              </button>
            </div>
            <p className="mt-1 text-sm text-[var(--ink-soft)]">Update category details and visibility.</p>

            <form onSubmit={onEditEntourageCategorySubmit} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input
                className="rounded-lg border border-[var(--border)] px-3 py-2"
                placeholder="Category Name"
                value={editCategoryNameInput}
                onChange={(event) => setEditCategoryNameInput(event.target.value)}
              />
              <input
                className="rounded-lg border border-[var(--border)] px-3 py-2"
                placeholder="Slug"
                value={editCategorySlugInput}
                onChange={(event) => setEditCategorySlugInput(event.target.value)}
              />
              <input
                className="rounded-lg border border-[var(--border)] px-3 py-2"
                type="number"
                placeholder="Sort Order"
                value={editCategorySortOrderInput}
                onChange={(event) => setEditCategorySortOrderInput(event.target.value)}
              />
              <label className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={editCategoryVisibleInput}
                  onChange={(event) => setEditCategoryVisibleInput(event.target.checked)}
                />
                Visible
              </label>
              <button
                type="submit"
                className="w-full rounded-lg bg-[var(--ink-deep)] px-4 py-2 text-[var(--background)] disabled:opacity-50 sm:w-auto sm:col-span-2"
                disabled={entourageBusy || !editingCategoryId}
              >
                {entourageBusy ? "Saving..." : "Save Category"}
              </button>
            </form>
          </div>
        </div>
      ) : null}

      {isEditEntourageMemberModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/50 p-0 sm:items-center sm:justify-center sm:p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full rounded-t-2xl bg-[var(--surface)] p-4 shadow-xl sm:max-w-xl sm:rounded-2xl sm:p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-[var(--ink-deep)]">Edit Member</h2>
              <button
                type="button"
                className="rounded-md border border-[var(--border)] px-3 py-1 text-sm"
                onClick={() => setIsEditEntourageMemberModalOpen(false)}
              >
                Close
              </button>
            </div>
            <p className="mt-1 text-sm text-[var(--ink-soft)]">Update member info, category, and display options.</p>

            <form onSubmit={onEditEntourageMemberSubmit} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input
                className="rounded-lg border border-[var(--border)] px-3 py-2 sm:col-span-2"
                placeholder="Full Name"
                value={editMemberNameInput}
                onChange={(event) => setEditMemberNameInput(event.target.value)}
              />
              <select
                className="rounded-lg border border-[var(--border)] px-3 py-2"
                value={editMemberCategoryIdInput}
                onChange={(event) => setEditMemberCategoryIdInput(event.target.value)}
              >
                {entourageCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              <select
                className="rounded-lg border border-[var(--border)] px-3 py-2"
                value={editMemberSideInput}
                onChange={(event) =>
                  setEditMemberSideInput(event.target.value as EntourageMemberRow["side"])
                }
              >
                <option value="none">none</option>
                <option value="bride">bride</option>
                <option value="groom">groom</option>
              </select>
              <input
                className="rounded-lg border border-[var(--border)] px-3 py-2"
                type="number"
                placeholder="Member Order"
                value={editMemberOrderInput}
                onChange={(event) => setEditMemberOrderInput(event.target.value)}
              />
              <label className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={editMemberVisibleInput}
                  onChange={(event) => setEditMemberVisibleInput(event.target.checked)}
                />
                Visible
              </label>
              <input
                className="rounded-lg border border-[var(--border)] px-3 py-2 sm:col-span-2"
                placeholder="Notes (optional)"
                value={editMemberNotesInput}
                onChange={(event) => setEditMemberNotesInput(event.target.value)}
              />
              <button
                type="submit"
                className="w-full rounded-lg bg-[var(--ink-deep)] px-4 py-2 text-[var(--background)] disabled:opacity-50 sm:w-auto sm:col-span-2"
                disabled={entourageBusy || !editingMemberId}
              >
                {entourageBusy ? "Saving..." : "Save Member"}
              </button>
            </form>
          </div>
        </div>
      ) : null}

      {isQrModalOpen && qrGuest ? (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/50 p-0 sm:items-center sm:justify-center sm:p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full rounded-t-2xl bg-[var(--surface)] p-4 shadow-xl sm:max-w-lg sm:rounded-2xl sm:p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-[var(--ink-deep)]">Guest QR</h2>
              <button
                type="button"
                className="rounded-md border border-[var(--border)] px-3 py-1 text-sm"
                onClick={() => setIsQrModalOpen(false)}
              >
                Close
              </button>
            </div>
            <p className="mt-1 text-sm text-[var(--ink-soft)]">{qrGuest.fullName}</p>
            <p className="text-xs text-[color-mix(in_srgb,var(--ink-soft)_84%,var(--foreground)_16%)]">Invite code: {qrGuest.inviteCode}</p>

            <div className="mt-4 flex justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
              {qrImageDataUrl ? (
                <Image
                  src={qrImageDataUrl}
                  alt={`QR code for ${qrGuest.fullName}`}
                  className="h-64 w-64 rounded-lg"
                  width={256}
                  height={256}
                  unoptimized
                />
              ) : (
                <p className="text-sm text-[color-mix(in_srgb,var(--ink-soft)_84%,var(--foreground)_16%)]">Generating QR...</p>
              )}
            </div>

            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
                onClick={() => void copyQrLink()}
              >
                Copy Link
              </button>
              <button
                type="button"
                className="rounded-lg bg-[var(--ink-deep)] px-3 py-2 text-sm text-[var(--background)]"
                onClick={downloadQrImage}
              >
                Download QR
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function StatCard({
  label,
  value,
  tone,
  active,
  onClick,
}: {
  label: string;
  value: number;
  tone: "slate" | "amber" | "emerald" | "rose" | "sky";
  active?: boolean;
  onClick?: () => void;
}) {
  const tones: Record<string, string> = {
    slate: "border-[var(--border)] bg-[var(--surface-2)]",
    amber: "border-[var(--warn-border)] bg-[var(--warn-soft)]",
    emerald: "border-[var(--success-border)] bg-[var(--success-soft)]",
    rose: "border-[var(--error-border)] bg-[var(--error-soft)]",
    sky: "border-[var(--info-border)] bg-[var(--info-soft)]",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border p-4 text-left transition hover:shadow-sm ${tones[tone]} ${
        active ? "ring-2 ring-[var(--accent)]" : ""
      }`}
    >
      <p className="text-sm text-[var(--ink-soft)]">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-[var(--ink-deep)]">{value}</p>
    </button>
  );
}

function StatusBadge({ status }: { status: GuestRow["status"] }) {
  if (status === "attending") {
    return (
      <span className="rounded-full bg-[var(--success-soft)] px-2 py-1 text-xs font-medium text-[var(--success-text)]">
        attending
      </span>
    );
  }
  if (status === "declined") {
    return (
      <span className="rounded-full bg-[var(--error-soft)] px-2 py-1 text-xs font-medium text-[var(--error-text)]">
        declined
      </span>
    );
  }
  return (
    <span className="rounded-full bg-[var(--warn-soft)] px-2 py-1 text-xs font-medium text-[var(--warn-text)]">
      pending
    </span>
  );
}

function AttendanceBadge({ attendance }: { attendance: string }) {
  if (attendance === "attending") {
    return (
      <span className="rounded-full bg-[var(--success-soft)] px-2 py-1 text-xs font-medium text-[var(--success-text)]">
        attending
      </span>
    );
  }
  if (attendance === "declined") {
    return (
      <span className="rounded-full bg-[var(--error-soft)] px-2 py-1 text-xs font-medium text-[var(--error-text)]">
        declined
      </span>
    );
  }
  return (
    <span className="rounded-full bg-[var(--surface-2)] px-2 py-1 text-xs font-medium text-[var(--ink-soft)]">
      {attendance}
    </span>
  );
}

function SideBadge({ side }: { side: EntourageMemberRow["side"] }) {
  if (side === "bride") {
    return (
      <span className="rounded-full bg-[var(--error-soft)] px-2 py-1 text-xs font-medium text-[var(--error-text)]">
        bride
      </span>
    );
  }
  if (side === "groom") {
    return (
      <span className="rounded-full bg-[var(--info-soft)] px-2 py-1 text-xs font-medium text-[var(--info-text)]">
        groom
      </span>
    );
  }
  return (
    <span className="rounded-full bg-[var(--surface-2)] px-2 py-1 text-xs font-medium text-[var(--ink-soft)]">
      none
    </span>
  );
}

function Pagination({
  currentPage,
  totalPages,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-[color-mix(in_srgb,var(--ink-soft)_84%,var(--foreground)_16%)]">
        Page {currentPage} of {totalPages}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="rounded border border-[var(--border)] px-3 py-1 text-xs disabled:opacity-40"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        >
          Previous
        </button>
        <button
          type="button"
          className="rounded border border-[var(--border)] px-3 py-1 text-xs disabled:opacity-40"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
        >
          Next
        </button>
      </div>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-2)] p-4 text-sm text-[color-mix(in_srgb,var(--ink-soft)_84%,var(--foreground)_16%)]">
      {label}
    </div>
  );
}

function IconActionButton({
  title,
  onClick,
  icon,
  tone = "default",
  disabled = false,
}: {
  title: string;
  onClick: () => void;
  icon: ReactNode;
  tone?: "default" | "danger";
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={title}
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg border p-2 transition ${
        tone === "danger"
          ? "border-[var(--error-border)] bg-[var(--error-soft)] text-[var(--error-text)] hover:bg-[var(--error-soft)]"
          : "border-[var(--border)] bg-[var(--surface)] text-[var(--ink-soft)] hover:bg-[var(--surface-2)]"
      } ${disabled ? "cursor-not-allowed opacity-40 hover:bg-[var(--surface)]" : ""}`}
    >
      {icon}
    </button>
  );
}

function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

function QrIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
      <path d="M3 3h8v8H3V3zm2 2v4h4V5H5zm8-2h8v8h-8V3zm2 2v4h4V5h-4zM3 13h8v8H3v-8zm2 2v4h4v-4H5zm8 0h2v2h-2v-2zm2 2h2v2h-2v-2zm2-2h2v2h-2v-2zm-4 4h2v2h-2v-2zm4 0h4v2h-4v-2z" />
    </svg>
  );
}

function EyeIcon({ visible }: { visible: boolean }) {
  if (visible) {
    return (
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 19C5 19 1 12 1 12a21.84 21.84 0 0 1 5.06-7.94" />
      <path d="M9.9 4.24A10.56 10.56 0 0 1 12 4c7 0 11 8 11 8a21.8 21.8 0 0 1-3.17 4.63" />
      <path d="M14.12 14.12a3 3 0 0 1-4.24-4.24" />
      <path d="M1 1l22 22" />
    </svg>
  );
}

function ChevronUpIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 15l-6-6-6 6" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function sortMark(
  activeField: string,
  direction: SortDirection,
  currentField: string,
) {
  if (activeField !== currentField) return "";
  return direction === "asc" ? "↑" : "↓";
}

function formatTimestamp(value: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}


