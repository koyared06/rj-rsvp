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

  const [activeTab, setActiveTab] = useState<"guests" | "rsvps">("guests");
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
        rsvp.dietaryRestrictions,
        rsvp.songRequest,
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

            <div className="mt-4 grid grid-cols-1 gap-2 rounded-xl bg-[var(--surface-2)] p-1 sm:grid-cols-2">
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
            ) : (
              <>
                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
                  <input
                    className="rounded-lg border border-[var(--border)] px-3 py-2"
                    placeholder="Search name, code, companions, dietary, song, message"
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
                        <p className="mt-1 text-xs text-[var(--ink-soft)]">
                          Dietary: {rsvp.dietaryRestrictions || "-"}
                        </p>
                        <p className="mt-1 text-xs text-[var(--ink-soft)]">Song: {rsvp.songRequest || "-"}</p>
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
                        <th className="p-2">Dietary</th>
                        <th className="p-2">Song</th>
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
                            <td className="p-2">{rsvp.dietaryRestrictions || "-"}</td>
                            <td className="p-2">{rsvp.songRequest || "-"}</td>
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
}: {
  title: string;
  onClick: () => void;
  icon: ReactNode;
  tone?: "default" | "danger";
}) {
  return (
    <button
      type="button"
      aria-label={title}
      title={title}
      onClick={onClick}
      className={`rounded-lg border p-2 transition ${
        tone === "danger"
          ? "border-[var(--error-border)] bg-[var(--error-soft)] text-[var(--error-text)] hover:bg-[var(--error-soft)]"
          : "border-[var(--border)] bg-[var(--surface)] text-[var(--ink-soft)] hover:bg-[var(--surface-2)]"
      }`}
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


