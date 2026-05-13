"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

type CameraSessionSettings = {
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
};

type CameraAccess = {
  eventId: string;
  tableCode: string;
  expiresAt: string;
};

type CameraGalleryItem = {
  id: string;
  createdAt: string;
  inviteCode: string;
  uploaderName: string;
  status: "pending" | "approved" | "hidden" | "rejected" | string;
  isOwnPhoto: boolean;
  visibilityAt: string;
  imageUrl: string;
};

type CameraUsage = {
  shotsUsed: number;
  shotsLimit: number;
  shotsLeft: number | null;
};
type CameraFacing = "environment" | "user";

const DEFAULT_SETTINGS: CameraSessionSettings = {
  cameraEnabled: false,
  cameraRequireApproval: true,
  cameraGalleryUnlockDate: "",
  cameraGalleryUnlockTime: "",
  cameraMaxUploadMb: 3,
  cameraShotLimitPerInvite: 27,
  cameraLandingEnabled: true,
  cameraEventTitle: "Guest Camera",
  cameraEventSubtitle: "Capture moments from our celebration.",
  cameraCoverImageUrl: "",
  cameraStartButtonLabel: "Start Camera",
};

function makeDeviceStorageKey(eventId: string) {
  return `rj_camera_device_${eventId}`;
}

function readOrCreateDeviceId(eventId: string) {
  const key = makeDeviceStorageKey(eventId);
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;

  const created =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  window.localStorage.setItem(key, created);
  return created;
}

function formatTimestamp(value: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export default function CameraLandingPage() {
  const qrParams = useMemo(() => {
    if (typeof window === "undefined") {
      return { eventId: "", cameraToken: "" };
    }
    const params = new URLSearchParams(window.location.search);
    return {
      eventId: (params.get("e") ?? "").trim(),
      cameraToken: (params.get("t") ?? "").trim(),
    };
  }, []);
  const eventId = qrParams.eventId;
  const cameraToken = qrParams.cameraToken;
  const [deviceId, setDeviceId] = useState("");
  const [access, setAccess] = useState<CameraAccess | null>(null);
  const [settings, setSettings] = useState<CameraSessionSettings>(DEFAULT_SETTINGS);
  const [galleryItems, setGalleryItems] = useState<CameraGalleryItem[]>([]);
  const [usage, setUsage] = useState<CameraUsage>({
    shotsUsed: 0,
    shotsLimit: 27,
    shotsLeft: 27,
  });
  const [uploaderName, setUploaderName] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pendingShotFile, setPendingShotFile] = useState<File | null>(null);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<CameraFacing>("environment");
  const [cameraTransitioning, setCameraTransitioning] = useState(false);
  const [keepCameraActive, setKeepCameraActive] = useState(true);
  const [cameraPermissionFailed, setCameraPermissionFailed] = useState(false);
  const [showFallbackUpload, setShowFallbackUpload] = useState(false);
  const [showFeed, setShowFeed] = useState(false);
  const [started, setStarted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const canCaptureMoreShots =
    usage.shotsLimit <= 0 || usage.shotsLeft === null || usage.shotsLeft > 0;
  const showLandingFirst = settings.cameraLandingEnabled;
  const showLandingScreen = showLandingFirst && !started;
  const previewUrl = useMemo(
    () => (selectedFile ? URL.createObjectURL(selectedFile) : ""),
    [selectedFile],
  );

  const stopCamera = useCallback((manualClose = false) => {
    const stream = streamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (manualClose) {
      setKeepCameraActive(false);
    }
    setCameraOpen(false);
  }, []);

  const loadGallery = useCallback(async () => {
    if (!eventId || !cameraToken || !deviceId) return;
    setGalleryLoading(true);
    try {
      const params = new URLSearchParams({
        e: eventId,
        t: cameraToken,
        device: deviceId,
      });
      const response = await fetch(`/api/camera/list?${params.toString()}`);
      const payload = await response.json();
      if (!response.ok) {
        setFeedback(payload.error ?? "Unable to load gallery.");
        return;
      }

      setGalleryItems(Array.isArray(payload.items) ? payload.items : []);
      if (payload.usage) {
        setUsage({
          shotsUsed: Number(payload.usage.shotsUsed ?? 0),
          shotsLimit: Number(payload.usage.shotsLimit ?? settings.cameraShotLimitPerInvite),
          shotsLeft:
            typeof payload.usage.shotsLeft === "number" || payload.usage.shotsLeft === null
              ? payload.usage.shotsLeft
              : null,
        });
      }
    } catch {
      setFeedback("Unable to load gallery right now.");
    } finally {
      setGalleryLoading(false);
    }
  }, [cameraToken, deviceId, eventId, settings.cameraShotLimitPerInvite]);

  const startCamera = useCallback(
    async (preferredFacing: CameraFacing = cameraFacing) => {
      if (!canCaptureMoreShots) {
        setFeedback("Shot limit reached.");
        return;
      }

      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        setFeedback("Camera is not supported in this browser. Use upload as fallback.");
        return;
      }

      setCameraTransitioning(true);
      const hadStream = Boolean(streamRef.current);
      stopCamera(false);
      if (hadStream) {
        await new Promise((resolve) => window.setTimeout(resolve, 120));
      }

      const backupFacing: CameraFacing =
        preferredFacing === "environment" ? "user" : "environment";
      const cameraConstraints: MediaStreamConstraints[] = [
        {
          video: {
            facingMode: { ideal: preferredFacing },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        },
        { video: { facingMode: preferredFacing }, audio: false },
        { video: { facingMode: backupFacing }, audio: false },
        { video: true, audio: false },
      ];

      try {
        let stream: MediaStream | null = null;
        for (const constraints of cameraConstraints) {
          try {
            stream = await navigator.mediaDevices.getUserMedia(constraints);
            break;
          } catch {
            continue;
          }
        }

        if (!stream) {
          setCameraPermissionFailed(true);
          setFeedback("Camera permission blocked or unavailable. Use upload as fallback.");
          setCameraTransitioning(false);
          return;
        }

        streamRef.current = stream;
        setCameraPermissionFailed(false);
        setKeepCameraActive(true);
        setCameraFacing(preferredFacing);
        setCameraOpen(true);
        setFeedback("");
      } catch {
        setCameraPermissionFailed(true);
        setFeedback("Camera permission blocked. Use upload as fallback.");
      } finally {
        setCameraTransitioning(false);
      }
    },
    [cameraFacing, canCaptureMoreShots, stopCamera],
  );

  const switchCameraFacing = useCallback(async () => {
    const nextFacing: CameraFacing =
      cameraFacing === "environment" ? "user" : "environment";
    await startCamera(nextFacing);
  }, [cameraFacing, startCamera]);

  async function uploadPhoto(fileToUpload: File) {
    if (!canCaptureMoreShots) {
      setFeedback("Shot limit reached.");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.set("eventId", eventId);
      formData.set("cameraToken", cameraToken);
      formData.set("deviceId", deviceId);
      formData.set("uploaderName", uploaderName.trim() || "Guest");
      formData.set("file", fileToUpload, fileToUpload.name);

      const response = await fetch("/api/camera/upload", {
        method: "POST",
        body: formData,
      });
      const payload = await response.json();
      if (!response.ok) {
        const hint = typeof payload.hint === "string" && payload.hint ? ` ${payload.hint}` : "";
        setFeedback(`${payload.error ?? "Unable to upload."}${hint}`);
        if (payload.usage) {
          setUsage({
            shotsUsed: Number(payload.usage.shotsUsed ?? usage.shotsUsed),
            shotsLimit: Number(payload.usage.shotsLimit ?? usage.shotsLimit),
            shotsLeft:
              typeof payload.usage.shotsLeft === "number" || payload.usage.shotsLeft === null
                ? payload.usage.shotsLeft
                : usage.shotsLeft,
          });
        }
        return;
      }

      if (payload.usage) {
        setUsage({
          shotsUsed: Number(payload.usage.shotsUsed ?? usage.shotsUsed),
          shotsLimit: Number(payload.usage.shotsLimit ?? usage.shotsLimit),
          shotsLeft:
            typeof payload.usage.shotsLeft === "number" || payload.usage.shotsLeft === null
              ? payload.usage.shotsLeft
              : usage.shotsLeft,
        });
      }

      setSelectedFile(fileToUpload);
      setFeedback(
        payload.photo?.status === "pending"
          ? "Shot saved. Waiting for approval."
          : "Shot saved.",
      );
      await loadGallery();
    } catch {
      setFeedback("Network error uploading photo.");
    } finally {
      setUploading(false);
    }
  }

  async function captureShot() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !cameraOpen) {
      setFeedback("Camera is not ready.");
      return;
    }

    const width = video.videoWidth || 0;
    const height = video.videoHeight || 0;
    if (width < 1 || height < 1) {
      setFeedback("Unable to capture frame.");
      return;
    }

    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      setFeedback("Unable to process camera frame.");
      return;
    }
    context.drawImage(video, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", 0.95);
    });
    if (!blob) {
      setFeedback("Unable to capture photo.");
      return;
    }

    const fileToUpload = new File([blob], `cam-${Date.now()}.jpg`, {
      type: "image/jpeg",
    });
    setSelectedFile(fileToUpload);
    setPendingShotFile(fileToUpload);
    setShowSubmitConfirm(true);
    setFeedback("Shot captured.");
  }

  async function onUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedFile) {
      setFeedback("Please capture or pick a photo first.");
      return;
    }
    await uploadPhoto(selectedFile);
  }

  async function confirmSubmitPendingShot() {
    if (!pendingShotFile) return;
    setShowSubmitConfirm(false);
    setFeedback("Processing shot...");
    await uploadPhoto(pendingShotFile);
    setPendingShotFile(null);
  }

  useEffect(() => {
    let cancelled = false;

    const loadSession = async () => {
      if (!eventId || !cameraToken) {
        if (!cancelled) {
          setError("Missing camera QR parameters.");
          setLoading(false);
        }
        return;
      }

      const device = readOrCreateDeviceId(eventId);
      try {
        const sessionParams = new URLSearchParams({ e: eventId, t: cameraToken });
        const response = await fetch(`/api/camera/session?${sessionParams.toString()}`);
        const payload = await response.json();
        if (!response.ok) {
          if (!cancelled) {
            setError(payload.error ?? "Invalid QR session.");
          }
          return;
        }

        if (!cancelled) {
          setDeviceId(device);
          setAccess(payload.access ?? null);
          setSettings({
            cameraEnabled: Boolean(payload.settings?.cameraEnabled),
            cameraRequireApproval: Boolean(payload.settings?.cameraRequireApproval),
            cameraGalleryUnlockDate: payload.settings?.cameraGalleryUnlockDate ?? "",
            cameraGalleryUnlockTime: payload.settings?.cameraGalleryUnlockTime ?? "",
            cameraMaxUploadMb: Number(payload.settings?.cameraMaxUploadMb ?? 3),
            cameraShotLimitPerInvite: Number(payload.settings?.cameraShotLimitPerInvite ?? 27),
            cameraLandingEnabled:
              typeof payload.settings?.cameraLandingEnabled === "boolean"
                ? payload.settings.cameraLandingEnabled
                : true,
            cameraEventTitle: payload.settings?.cameraEventTitle ?? "Guest Camera",
            cameraEventSubtitle:
              payload.settings?.cameraEventSubtitle ??
              "Capture moments from our celebration.",
            cameraCoverImageUrl: payload.settings?.cameraCoverImageUrl ?? "",
            cameraStartButtonLabel:
              payload.settings?.cameraStartButtonLabel ?? "Start Camera",
          });
          setUploaderName(
            payload.access?.tableCode ? `Guest (${payload.access.tableCode})` : "Guest",
          );
        }
      } catch {
        if (!cancelled) {
          setError("Unable to validate camera session.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadSession();

    return () => {
      cancelled = true;
    };
  }, [cameraToken, eventId]);

  useEffect(() => {
    if (!eventId || !cameraToken || !deviceId || loading || error) return;
    const timer = window.setTimeout(() => {
      void loadGallery();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [cameraToken, deviceId, error, eventId, loadGallery, loading]);

  useEffect(
    () => () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      stopCamera(false);
    },
    [previewUrl, stopCamera],
  );

  useEffect(() => {
    if (showLandingScreen) return;
    if (cameraOpen || uploading || cameraTransitioning) return;
    if (!keepCameraActive || cameraPermissionFailed || !canCaptureMoreShots) return;

    const timer = window.setTimeout(() => {
      void startCamera();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [
    cameraOpen,
    cameraPermissionFailed,
    cameraTransitioning,
    canCaptureMoreShots,
    keepCameraActive,
    showLandingScreen,
    startCamera,
    uploading,
  ]);

  useEffect(() => {
    if (!cameraOpen) return;
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream) return;

    let cancelled = false;
    const attachAndPlay = async () => {
      video.muted = true;
      video.autoplay = true;
      video.playsInline = true;
      video.setAttribute("playsinline", "true");
      video.setAttribute("webkit-playsinline", "true");
      video.srcObject = stream;

      try {
        await video.play();
      } catch {
        // Playback can fail on some browsers until user interacts again.
      }

      window.setTimeout(() => {
        if (cancelled) return;
        if (!video.videoWidth || !video.videoHeight) {
          setFeedback(
            "Camera opened but preview is blocked. Try closing and opening camera again, or use upload fallback.",
          );
        }
      }, 900);
    };

    void attachAndPlay();

    return () => {
      cancelled = true;
    };
  }, [cameraOpen]);

  if (loading) {
    return (
      <main className="mx-auto max-w-xl px-4 py-10 text-center text-sm text-[var(--ink-soft)]">
        Validating camera access...
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto max-w-xl px-4 py-10">
        <div className="rounded-xl border border-[var(--error-border)] bg-[var(--error-soft)] p-4 text-sm text-[var(--error-text)]">
          {error}
        </div>
      </main>
    );
  }

  const headerSubtitle = access?.tableCode
    ? `Session: ${access.tableCode}`
    : "Event Camera Session";

  return (
    <main className="min-h-screen bg-[#090909] text-white">
      {showLandingScreen ? (
        <section className="relative flex min-h-screen items-end justify-center overflow-hidden px-4 py-10">
          {settings.cameraCoverImageUrl ? (
            <img
              src={settings.cameraCoverImageUrl}
              alt="Event camera cover"
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_#454545_0%,_#121212_52%,_#060606_100%)]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/40" />
          <div className="relative z-10 w-full max-w-md rounded-3xl border border-white/20 bg-black/40 p-5 backdrop-blur-sm">
            <p className="text-xs uppercase tracking-[0.18em] text-white/70">{headerSubtitle}</p>
            <h1 className="mt-2 text-3xl font-semibold">{settings.cameraEventTitle}</h1>
            <p className="mt-2 text-sm text-white/80">{settings.cameraEventSubtitle}</p>
            <button
              type="button"
              className="mt-5 w-full rounded-full bg-white px-5 py-3 text-sm font-semibold uppercase tracking-[0.12em] text-black"
              onClick={() => {
                setStarted(true);
                setKeepCameraActive(true);
                void startCamera();
              }}
            >
              {settings.cameraStartButtonLabel}
            </button>
          </div>
        </section>
      ) : (
        <div className="mx-auto flex w-full max-w-md flex-col sm:py-4">
          <section className="relative min-h-[78vh] overflow-hidden bg-black sm:min-h-[88vh] sm:rounded-[34px] sm:border sm:border-white/15">
            {cameraOpen ? (
              <video
                ref={videoRef}
                className="absolute inset-0 h-full w-full object-cover"
                autoPlay
                muted
                playsInline
              />
            ) : (
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_#3d3d3d_0%,_#141414_52%,_#050505_100%)]" />
            )}

            <div className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-black/80 to-transparent" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-52 bg-gradient-to-t from-black/90 via-black/55 to-transparent" />

            <div className="relative z-10 flex items-start justify-between p-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-white/65">
                  {headerSubtitle}
                </p>
                <p className="mt-1 text-sm font-semibold text-white">
                  {usage.shotsLimit > 0
                    ? `${usage.shotsLeft ?? 0} shots left`
                    : "Unlimited shots"}
                </p>
              </div>
              <button
                type="button"
                className="rounded-full border border-white/35 bg-black/40 px-3 py-1 text-xs text-white"
                onClick={() => setShowFallbackUpload((current) => !current)}
              >
                {showFallbackUpload ? "Hide Upload" : "Upload"}
              </button>
            </div>

            {showSubmitConfirm ? (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 px-6">
                <div className="w-full max-w-xs rounded-2xl border border-white/25 bg-black/75 p-4 backdrop-blur-sm">
                  <p className="text-center text-lg font-semibold text-white">Submit photo?</p>
                  <p className="mt-2 text-center text-xs leading-relaxed text-white/80">
                    You can continue taking more shots after submitting this one.
                  </p>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      className="rounded-lg border border-white/25 px-3 py-2 text-sm text-white"
                      onClick={() => {
                        setShowSubmitConfirm(false);
                        setPendingShotFile(null);
                        setFeedback("Submission cancelled.");
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-black"
                      onClick={() => void confirmSubmitPendingShot()}
                    >
                      Submit
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {!cameraOpen ? (
              <div className="absolute inset-x-0 bottom-24 z-10 px-6">
                <button
                  type="button"
                  className="w-full rounded-full bg-white px-5 py-3 text-sm font-semibold uppercase tracking-[0.12em] text-black disabled:opacity-40"
                  onClick={() => void startCamera()}
                  disabled={!canCaptureMoreShots || cameraTransitioning}
                >
                  {cameraTransitioning ? "Switching..." : "Open Camera"}
                </button>
              </div>
            ) : null}

            {previewUrl ? (
              <img
                src={previewUrl}
                alt="Latest shot preview"
                className="absolute bottom-28 right-4 z-10 h-20 w-16 rounded-lg border border-white/40 object-cover shadow-xl"
              />
            ) : null}

            <div className="absolute inset-x-0 bottom-4 z-10 px-4">
              <div className="mx-auto flex w-full max-w-xs items-center justify-between">
                <button
                  type="button"
                  className="h-12 w-12 rounded-full border border-white/40 bg-black/45 text-xs text-white disabled:opacity-40"
                  onClick={() => void switchCameraFacing()}
                  disabled={!cameraOpen || uploading || cameraTransitioning}
                  aria-label="Switch camera"
                >
                  Flip
                </button>

                <button
                  type="button"
                  className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-white/20 disabled:opacity-40"
                  onClick={() => void captureShot()}
                  disabled={
                    !cameraOpen ||
                    !canCaptureMoreShots ||
                    uploading ||
                    cameraTransitioning
                  }
                  aria-label="Capture shot"
                >
                  <span className="h-14 w-14 rounded-full bg-white" />
                </button>

                <button
                  type="button"
                  className="h-12 w-12 rounded-full border border-white/40 bg-black/45 text-xs text-white"
                  onClick={() => stopCamera(true)}
                  aria-label="Close camera"
                >
                  Close
                </button>
              </div>
            </div>

            <canvas ref={canvasRef} className="hidden" />
          </section>

          {showFallbackUpload ? (
            <section className="mt-3 rounded-2xl border border-white/15 bg-white/5 p-3">
              <form onSubmit={onUpload} className="space-y-3">
                <label className="flex flex-col gap-1 text-xs text-white/75">
                  <span>Name (optional)</span>
                  <input
                    className="rounded-lg border border-white/20 bg-black/30 px-3 py-2 text-sm text-white"
                    value={uploaderName}
                    onChange={(event) => setUploaderName(event.target.value)}
                    maxLength={120}
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-white/75">
                  <span>Upload fallback (from gallery/files)</span>
                  <input
                    className="rounded-lg border border-white/20 bg-black/30 px-3 py-2 text-sm text-white"
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                  />
                </label>
                <button
                  type="submit"
                  className="w-full rounded-full bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-black disabled:opacity-40"
                  disabled={uploading || !selectedFile || !canCaptureMoreShots}
                >
                  {uploading ? "Uploading..." : "Upload Selected Photo"}
                </button>
              </form>
            </section>
          ) : null}

          {feedback ? (
            <p className="mt-3 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white/85">
              {feedback}
            </p>
          ) : null}

          <button
            type="button"
            className="mt-4 w-full rounded-full border border-white/20 bg-white/8 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-white"
            onClick={() => setShowFeed((current) => !current)}
          >
            {showFeed ? "Hide Live Event Feed" : "See Live Event Feed"}
          </button>

          {showFeed ? (
            <section className="mt-3 rounded-2xl border border-white/15 bg-white/5 p-3">
              <p className="text-xs uppercase tracking-[0.16em] text-white/60">Live Event Feed</p>
              {galleryLoading ? (
                <p className="mt-2 text-sm text-white/70">Loading photos...</p>
              ) : galleryItems.length === 0 ? (
                <p className="mt-2 rounded-lg border border-dashed border-white/20 px-3 py-2 text-sm text-white/70">
                  No photos yet.
                </p>
              ) : (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {galleryItems.slice(0, 12).map((item) => (
                    <article
                      key={item.id}
                      className="overflow-hidden rounded-lg border border-white/10"
                    >
                      <img
                        src={item.imageUrl}
                        alt={`Photo by ${item.uploaderName}`}
                        className="h-24 w-full object-cover"
                        loading="lazy"
                      />
                      <div className="px-2 py-1">
                        <p className="truncate text-[11px] text-white/90">{item.uploaderName}</p>
                        <p className="truncate text-[10px] text-white/60">
                          {formatTimestamp(item.createdAt)}
                        </p>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          ) : null}
        </div>
      )}
    </main>
  );
}
