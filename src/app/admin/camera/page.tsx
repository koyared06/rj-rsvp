"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import QRCode from "qrcode";
import { ThemeToggle } from "@/components/theme-toggle";

type CameraSettings = {
  cameraEnabled: boolean;
  cameraRequireApproval: boolean;
  cameraGalleryUnlockDate: string;
  cameraGalleryUnlockTime: string;
  cameraMaxUploadMb: number;
  cameraShotLimitPerInvite: number;
  cameraLandingEnabled: boolean;
  cameraEventTitle: string;
  cameraEventSubtitle: string;
  cameraCoverImageUrl: string;
  cameraStartButtonLabel: string;
  countdownDays: number | null;
};

type CameraPhotoItem = {
  id: string;
  createdAt: string;
  inviteCode: string;
  uploaderName: string;
  status: "pending" | "approved" | "hidden" | "rejected" | string;
  isOwnPhoto: boolean;
  visibilityAt: string;
  imageUrl: string;
};

const ADMIN_SESSION_KEY = "rj_admin_session_v1";

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

function formatTimestamp(value: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export default function CameraAdminPage() {
  const [token, setToken] = useState("");
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cameraActionLoadingId, setCameraActionLoadingId] = useState("");
  const [qrEventId, setQrEventId] = useState("RJ2026");
  const [qrTableCode, setQrTableCode] = useState("");
  const [qrExpiresHours, setQrExpiresHours] = useState("48");
  const [qrGenerating, setQrGenerating] = useState(false);
  const [qrUrl, setQrUrl] = useState("");
  const [qrImageDataUrl, setQrImageDataUrl] = useState("");
  const [settings, setSettings] = useState<CameraSettings>({
    cameraEnabled: false,
    cameraRequireApproval: false,
    cameraGalleryUnlockDate: "",
    cameraGalleryUnlockTime: "",
    cameraMaxUploadMb: 3,
    cameraShotLimitPerInvite: 27,
    cameraLandingEnabled: true,
    cameraEventTitle: "Guest Camera",
    cameraEventSubtitle: "Capture moments from our celebration.",
    cameraCoverImageUrl: "",
    cameraStartButtonLabel: "Start Camera",
    countdownDays: null,
  });
  const [cameraPhotos, setCameraPhotos] = useState<CameraPhotoItem[]>([]);

  const pendingCount = useMemo(
    () => cameraPhotos.filter((photo) => photo.status === "pending").length,
    [cameraPhotos],
  );
  const approvedCount = useMemo(
    () => cameraPhotos.filter((photo) => photo.status === "approved").length,
    [cameraPhotos],
  );
  const hiddenCount = useMemo(
    () => cameraPhotos.filter((photo) => photo.status === "hidden").length,
    [cameraPhotos],
  );
  const rejectedCount = useMemo(
    () => cameraPhotos.filter((photo) => photo.status === "rejected").length,
    [cameraPhotos],
  );

  const loadCameraData = useCallback(
    async (adminToken: string, options?: { silent?: boolean }) => {
      const silent = options?.silent ?? false;
      if (!silent) {
        setRefreshing(true);
      }

      try {
        const [settingsResponse, photosResponse] = await Promise.all([
          fetch("/api/admin/camera/settings", {
            headers: { "x-admin-token": adminToken },
          }),
          fetch("/api/camera/list", {
            headers: { "x-admin-token": adminToken },
          }),
        ]);

        if (settingsResponse.status === 401 || photosResponse.status === 401) {
          clearStoredAdminSession();
          setConnected(false);
          setToken("");
          toast.error("Session expired", {
            description: "Please reconnect with your admin token.",
          });
          return;
        }

        const settingsPayload = await settingsResponse.json();
        const photosPayload = await photosResponse.json();

        if (!settingsResponse.ok) {
          const details = settingsPayload.details ? ` (${settingsPayload.details})` : "";
          toast.error("Load failed", {
            description: `${settingsPayload.error ?? "Unable to load camera settings."}${details}`,
          });
          return;
        }

        if (!photosResponse.ok) {
          const details = photosPayload.details ? ` (${photosPayload.details})` : "";
          toast.error("Load failed", {
            description: `${photosPayload.error ?? "Unable to load camera uploads."}${details}`,
          });
          return;
        }

        setSettings({
          cameraEnabled: Boolean(settingsPayload.settings?.cameraEnabled),
          cameraRequireApproval: Boolean(settingsPayload.settings?.cameraRequireApproval),
          cameraGalleryUnlockDate: settingsPayload.settings?.cameraGalleryUnlockDate ?? "",
          cameraGalleryUnlockTime: settingsPayload.settings?.cameraGalleryUnlockTime ?? "",
          cameraMaxUploadMb: Number(settingsPayload.settings?.cameraMaxUploadMb ?? 3),
          cameraShotLimitPerInvite: Number(
            settingsPayload.settings?.cameraShotLimitPerInvite ?? 27,
          ),
          cameraLandingEnabled:
            typeof settingsPayload.settings?.cameraLandingEnabled === "boolean"
              ? settingsPayload.settings.cameraLandingEnabled
              : true,
          cameraEventTitle: settingsPayload.settings?.cameraEventTitle ?? "Guest Camera",
          cameraEventSubtitle:
            settingsPayload.settings?.cameraEventSubtitle ??
            "Capture moments from our celebration.",
          cameraCoverImageUrl: settingsPayload.settings?.cameraCoverImageUrl ?? "",
          cameraStartButtonLabel:
            settingsPayload.settings?.cameraStartButtonLabel ?? "Start Camera",
          countdownDays:
            typeof settingsPayload.settings?.countdownDays === "number"
              ? settingsPayload.settings.countdownDays
              : null,
        });

        setCameraPhotos(Array.isArray(photosPayload.items) ? photosPayload.items : []);
      } catch {
        toast.error("Network error", {
          description: "Unable to load camera studio data right now.",
        });
      } finally {
        if (!silent) {
          setRefreshing(false);
        }
      }
    },
    [],
  );

  async function connectWithToken(adminToken: string) {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/camera/settings", {
        headers: { "x-admin-token": adminToken },
      });
      const payload = await response.json();

      if (!response.ok) {
        const details = payload.details ? ` (${payload.details})` : "";
        toast.error("Connect failed", {
          description: `${payload.error ?? "Unauthorized."}${details}`,
        });
        return;
      }

      writeStoredAdminSession(adminToken);
      setConnected(true);
      setToken(adminToken);
      toast.success("Connected", { description: "Camera Studio is ready." });
      await loadCameraData(adminToken, { silent: true });
    } catch {
      toast.error("Network error", {
        description: "Unable to connect right now.",
      });
    } finally {
      setLoading(false);
    }
  }

  async function onConnect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token.trim()) return;
    await connectWithToken(token.trim());
  }

  function disconnect() {
    clearStoredAdminSession();
    setConnected(false);
    setToken("");
    setCameraPhotos([]);
    toast("Disconnected", { description: "Camera admin session cleared." });
  }

  async function onSaveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;

    setSaving(true);
    try {
      const response = await fetch("/api/admin/camera/settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": token,
        },
        body: JSON.stringify({
          cameraEnabled: settings.cameraEnabled,
          cameraRequireApproval: settings.cameraRequireApproval,
          cameraGalleryUnlockDate: settings.cameraGalleryUnlockDate.trim(),
          cameraGalleryUnlockTime: settings.cameraGalleryUnlockTime.trim(),
          cameraMaxUploadMb: settings.cameraMaxUploadMb,
          cameraShotLimitPerInvite: settings.cameraShotLimitPerInvite,
          cameraLandingEnabled: settings.cameraLandingEnabled,
          cameraEventTitle: settings.cameraEventTitle.trim(),
          cameraEventSubtitle: settings.cameraEventSubtitle.trim(),
          cameraCoverImageUrl: settings.cameraCoverImageUrl.trim(),
          cameraStartButtonLabel: settings.cameraStartButtonLabel.trim(),
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        const details = payload.details ? ` (${payload.details})` : "";
        toast.error("Save failed", {
          description: `${payload.error ?? "Unable to save settings."}${details}`,
        });
        return;
      }

      setSettings((current) => ({
        ...current,
        cameraEnabled: Boolean(payload.settings?.cameraEnabled),
        cameraRequireApproval: Boolean(payload.settings?.cameraRequireApproval),
        cameraGalleryUnlockDate: payload.settings?.cameraGalleryUnlockDate ?? "",
        cameraGalleryUnlockTime: payload.settings?.cameraGalleryUnlockTime ?? "",
        cameraMaxUploadMb: Number(payload.settings?.cameraMaxUploadMb ?? 3),
        cameraShotLimitPerInvite: Number(
          payload.settings?.cameraShotLimitPerInvite ?? 27,
        ),
        cameraLandingEnabled:
          typeof payload.settings?.cameraLandingEnabled === "boolean"
            ? payload.settings.cameraLandingEnabled
            : current.cameraLandingEnabled,
        cameraEventTitle:
          payload.settings?.cameraEventTitle ?? current.cameraEventTitle,
        cameraEventSubtitle:
          payload.settings?.cameraEventSubtitle ?? current.cameraEventSubtitle,
        cameraCoverImageUrl:
          payload.settings?.cameraCoverImageUrl ?? current.cameraCoverImageUrl,
        cameraStartButtonLabel:
          payload.settings?.cameraStartButtonLabel ?? current.cameraStartButtonLabel,
      }));

      toast.success("Saved", { description: "Camera settings updated." });
    } catch {
      toast.error("Network error", {
        description: "Unable to save camera settings right now.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function moderatePhoto(
    id: string,
    action: "approve" | "hide" | "reject",
  ) {
    if (!token) return;
    const rejectionReason =
      action === "reject" ? window.prompt("Optional rejection reason:", "") ?? "" : "";

    setCameraActionLoadingId(id);
    try {
      const response = await fetch("/api/admin/camera/photo", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": token,
        },
        body: JSON.stringify({ id, action, rejectionReason }),
      });

      const payload = await response.json();
      if (!response.ok) {
        const details = payload.details ? ` (${payload.details})` : "";
        toast.error("Update failed", {
          description: `${payload.error ?? "Unable to update photo."}${details}`,
        });
        return;
      }

      toast.success("Photo updated", {
        description: `Status: ${payload.photo?.status ?? action}`,
      });
      await loadCameraData(token, { silent: true });
    } catch {
      toast.error("Network error", {
        description: "Unable to moderate photo right now.",
      });
    } finally {
      setCameraActionLoadingId("");
    }
  }

  async function generateCameraQr() {
    if (!token) return;
    setQrGenerating(true);
    try {
      const response = await fetch("/api/admin/camera/qr", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": token,
        },
        body: JSON.stringify({
          eventId: qrEventId.trim() || "RJ2026",
          tableCode: qrTableCode.trim() || "GENERAL",
          expiresInHours: Number.parseInt(qrExpiresHours, 10) || 48,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        const details = payload.details ? ` (${payload.details})` : "";
        toast.error("QR generation failed", {
          description: `${payload.error ?? "Unable to generate QR."}${details}`,
        });
        return;
      }

      const generatedUrl = payload.qr?.url ?? "";
      setQrUrl(generatedUrl);
      const qrDataUrl = await QRCode.toDataURL(generatedUrl, {
        width: 520,
        margin: 1,
      });
      setQrImageDataUrl(qrDataUrl);
      toast.success("QR generated", {
        description: `Session code: ${(payload.qr?.tableCode ?? qrTableCode) || "GENERAL"}`,
      });
    } catch {
      toast.error("Network error", {
        description: "Unable to generate QR right now.",
      });
    } finally {
      setQrGenerating(false);
    }
  }

  async function copyQrUrl() {
    if (!qrUrl) return;
    try {
      await navigator.clipboard.writeText(qrUrl);
      toast.success("Copied", { description: "Guest camera link copied." });
    } catch {
      toast.error("Copy failed", { description: "Please copy the link manually." });
    }
  }

  useEffect(() => {
    const stored = readStoredAdminSession();
    if (!stored) return;
    const timeoutId = window.setTimeout(() => {
      void connectWithToken(stored);
    }, 0);
    return () => window.clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold text-[var(--ink-deep)] sm:text-4xl">
            Camera Studio
          </h1>
          <p className="mt-2 text-sm text-[var(--ink-soft)]">
            Dedicated admin workspace for QR disposable camera settings and moderation.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[var(--ink-soft)]">
            <Link
              href="/admin"
              className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 hover:bg-[var(--surface-2)]"
            >
              Back To RSVP Admin
            </Link>
            <span>Security: uses the same `ADMIN_TOKEN` gate.</span>
          </div>
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
            disabled={loading || !token.trim()}
          >
            {loading ? "Connecting..." : "Connect"}
          </button>
        </form>
      ) : (
        <section className="mt-5 flex flex-col gap-3 rounded-2xl border border-[var(--success-border)] bg-[var(--success-soft)] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-[var(--success-text)]">
              Camera Studio Connected
            </p>
            <p className="text-xs text-[var(--success-text)]">Session: Active (tab only)</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              className="w-full rounded-lg border border-[var(--success-border)] px-4 py-2 text-sm text-[var(--success-text)] sm:w-auto"
              onClick={() => void loadCameraData(token)}
              disabled={refreshing}
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
            <button
              type="button"
              className="w-full rounded-lg bg-[var(--ink-deep)] px-4 py-2 text-sm text-[var(--background)] sm:w-auto"
              onClick={disconnect}
            >
              Disconnect
            </button>
          </div>
        </section>
      )}

      {connected ? (
        <>
          <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard label="Total Uploads" value={cameraPhotos.length} />
            <StatCard label="Pending" value={pendingCount} />
            <StatCard label="Approved" value={approvedCount} />
            <StatCard label="Hidden" value={hiddenCount} />
            <StatCard label="Rejected" value={rejectedCount} />
          </section>

          <section className="mt-6 rounded-2xl border border-[var(--info-border)] bg-[var(--info-soft)] p-4">
            <h2 className="text-lg font-semibold text-[var(--info-text)]">Camera Settings</h2>
            <p className="mt-1 text-xs text-[var(--info-text)]">
              `cameraMaxUploadMb=0` means no app-level cap. Platform upload limits still apply.
            </p>
            <form
              onSubmit={onSaveSettings}
              className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3"
            >
              <label className="flex items-center gap-2 rounded-lg border border-[var(--info-border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--info-text)]">
                <input
                  className="h-4 w-4"
                  type="checkbox"
                  checked={settings.cameraEnabled}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      cameraEnabled: event.target.checked,
                    }))
                  }
                />
                <span>Enable guest camera</span>
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-[var(--info-border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--info-text)]">
                <input
                  className="h-4 w-4"
                  type="checkbox"
                  checked={settings.cameraRequireApproval}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      cameraRequireApproval: event.target.checked,
                    }))
                  }
                />
                <span>Require approval</span>
              </label>
              <label className="flex w-full flex-col gap-1 text-sm text-[var(--info-text)]">
                <span>Gallery Unlock Date</span>
                <input
                  className="rounded-lg border border-[var(--info-border)] bg-[var(--surface)] px-3 py-2"
                  type="date"
                  value={settings.cameraGalleryUnlockDate}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      cameraGalleryUnlockDate: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="flex w-full flex-col gap-1 text-sm text-[var(--info-text)]">
                <span>Gallery Unlock Time</span>
                <input
                  className="rounded-lg border border-[var(--info-border)] bg-[var(--surface)] px-3 py-2"
                  type="time"
                  value={settings.cameraGalleryUnlockTime}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      cameraGalleryUnlockTime: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="flex w-full flex-col gap-1 text-sm text-[var(--info-text)]">
                <span>Max Upload (MB)</span>
                <input
                  className="rounded-lg border border-[var(--info-border)] bg-[var(--surface)] px-3 py-2"
                  type="number"
                  min={0}
                  max={100}
                  value={String(settings.cameraMaxUploadMb)}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      cameraMaxUploadMb: Number.parseInt(event.target.value, 10) || 0,
                    }))
                  }
                />
              </label>
              <label className="flex w-full flex-col gap-1 text-sm text-[var(--info-text)]">
                <span>Shot Limit Per Invite/Session</span>
                <input
                  className="rounded-lg border border-[var(--info-border)] bg-[var(--surface)] px-3 py-2"
                  type="number"
                  min={0}
                  max={500}
                  value={String(settings.cameraShotLimitPerInvite)}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      cameraShotLimitPerInvite:
                        Number.parseInt(event.target.value, 10) || 0,
                    }))
                  }
                />
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-[var(--info-border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--info-text)] sm:col-span-2 xl:col-span-3">
                <input
                  className="h-4 w-4"
                  type="checkbox"
                  checked={settings.cameraLandingEnabled}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      cameraLandingEnabled: event.target.checked,
                    }))
                  }
                />
                <span>Show landing page before opening camera</span>
              </label>
              <label className="flex w-full flex-col gap-1 text-sm text-[var(--info-text)] sm:col-span-2 xl:col-span-3">
                <span>Landing Event Title</span>
                <input
                  className="rounded-lg border border-[var(--info-border)] bg-[var(--surface)] px-3 py-2"
                  value={settings.cameraEventTitle}
                  maxLength={120}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      cameraEventTitle: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="flex w-full flex-col gap-1 text-sm text-[var(--info-text)] sm:col-span-2 xl:col-span-3">
                <span>Landing Subtitle</span>
                <textarea
                  className="rounded-lg border border-[var(--info-border)] bg-[var(--surface)] px-3 py-2"
                  value={settings.cameraEventSubtitle}
                  maxLength={240}
                  rows={3}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      cameraEventSubtitle: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="flex w-full flex-col gap-1 text-sm text-[var(--info-text)] sm:col-span-2 xl:col-span-3">
                <span>Landing Cover Image URL (https)</span>
                <input
                  className="rounded-lg border border-[var(--info-border)] bg-[var(--surface)] px-3 py-2"
                  value={settings.cameraCoverImageUrl}
                  placeholder="https://..."
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      cameraCoverImageUrl: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="flex w-full flex-col gap-1 text-sm text-[var(--info-text)]">
                <span>Landing Start Button Label</span>
                <input
                  className="rounded-lg border border-[var(--info-border)] bg-[var(--surface)] px-3 py-2"
                  value={settings.cameraStartButtonLabel}
                  maxLength={40}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      cameraStartButtonLabel: event.target.value,
                    }))
                  }
                />
              </label>
              <button
                type="submit"
                className="w-full rounded-lg bg-[var(--accent)] px-4 py-2 text-[var(--background)] disabled:opacity-50 sm:col-span-2 xl:col-span-3"
                disabled={saving}
              >
                {saving ? "Saving..." : "Save Camera Settings"}
              </button>
            </form>
          </section>

          <section className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <h2 className="text-lg font-semibold text-[var(--ink-deep)]">Guest QR Generator</h2>
            <p className="mt-1 text-xs text-[var(--ink-soft)]">
              Share this QR with guests. It opens `/cam` and does not expose admin access.
            </p>
            <p className="mt-1 text-xs text-[var(--ink-soft)]">
              Leave code blank for one universal event QR (recommended).
            </p>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <label className="flex flex-col gap-1 text-sm text-[var(--ink-soft)]">
                <span>Event ID</span>
                <input
                  className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2"
                  value={qrEventId}
                  onChange={(event) => setQrEventId(event.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-[var(--ink-soft)]">
                <span>Table/Guest Code (optional)</span>
                <input
                  className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2"
                  value={qrTableCode}
                  onChange={(event) => setQrTableCode(event.target.value)}
                  placeholder="GENERAL"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-[var(--ink-soft)]">
                <span>Expires In (hours)</span>
                <input
                  className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2"
                  type="number"
                  min={1}
                  max={720}
                  value={qrExpiresHours}
                  onChange={(event) => setQrExpiresHours(event.target.value)}
                />
              </label>
              <div className="flex items-end">
                <button
                  type="button"
                  className="w-full rounded-lg bg-[var(--ink-deep)] px-4 py-2 text-sm text-[var(--background)] disabled:opacity-50"
                  onClick={() => void generateCameraQr()}
                  disabled={qrGenerating}
                >
                  {qrGenerating ? "Generating..." : "Generate QR"}
                </button>
              </div>
            </div>

            {qrUrl ? (
              <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
                  <p className="text-xs uppercase tracking-[0.1em] text-[var(--ink-soft)]">
                    Guest Camera URL
                  </p>
                  <p className="mt-2 break-all text-xs text-[var(--ink-deep)]">{qrUrl}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs"
                      onClick={() => void copyQrUrl()}
                    >
                      Copy Link
                    </button>
                    <a
                      href={qrUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs"
                    >
                      Open Link
                    </a>
                  </div>
                </div>
                {qrImageDataUrl ? (
                  <img
                    src={qrImageDataUrl}
                    alt="Guest camera QR code"
                    className="h-44 w-44 rounded-xl border border-[var(--border)] bg-white p-2"
                  />
                ) : null}
              </div>
            ) : null}
          </section>

          <section className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-[var(--ink-deep)]">
                Camera Upload Moderation
              </h2>
              <p className="text-xs text-[var(--ink-soft)]">
                {cameraPhotos.length} upload(s) total
              </p>
            </div>
            {cameraPhotos.length === 0 ? (
              <div className="mt-3 rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-2)] p-4 text-sm text-[var(--ink-soft)]">
                No camera uploads yet.
              </div>
            ) : (
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {cameraPhotos.map((photo) => (
                  <article
                    key={photo.id}
                    className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-2)]"
                  >
                    <img
                      src={photo.imageUrl}
                      alt={`Camera upload by ${photo.uploaderName}`}
                      className="h-44 w-full object-cover"
                      loading="lazy"
                    />
                    <div className="space-y-2 px-3 py-3">
                      <p className="text-sm font-semibold text-[var(--ink-deep)]">
                        {photo.uploaderName}
                      </p>
                      <p className="text-xs text-[var(--ink-soft)]">
                        Invite: {photo.inviteCode || "-"}
                      </p>
                      <p className="text-xs text-[var(--ink-soft)]">
                        Uploaded: {formatTimestamp(photo.createdAt)}
                      </p>
                      <div className="flex items-center justify-between gap-2">
                        <span className="rounded-full bg-[var(--surface)] px-2 py-1 text-[10px] uppercase tracking-[0.08em] text-[var(--ink-soft)]">
                          {photo.status}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            className="rounded-md border border-[var(--success-border)] bg-[var(--success-soft)] px-2 py-1 text-[10px] uppercase tracking-[0.08em] text-[var(--success-text)] disabled:opacity-50"
                            onClick={() => void moderatePhoto(photo.id, "approve")}
                            disabled={cameraActionLoadingId === photo.id}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            className="rounded-md border border-[var(--warn-border)] bg-[var(--warn-soft)] px-2 py-1 text-[10px] uppercase tracking-[0.08em] text-[var(--warn-text)] disabled:opacity-50"
                            onClick={() => void moderatePhoto(photo.id, "hide")}
                            disabled={cameraActionLoadingId === photo.id}
                          >
                            Hide
                          </button>
                          <button
                            type="button"
                            className="rounded-md border border-[var(--error-border)] bg-[var(--error-soft)] px-2 py-1 text-[10px] uppercase tracking-[0.08em] text-[var(--error-text)] disabled:opacity-50"
                            onClick={() => void moderatePhoto(photo.id, "reject")}
                            disabled={cameraActionLoadingId === photo.id}
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      ) : null}
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
      <p className="text-xs uppercase tracking-[0.08em] text-[var(--ink-soft)]">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-[var(--ink-deep)]">{value}</p>
    </div>
  );
}
