"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";

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

function makeAutoSubmitStorageKey(eventId: string) {
  return `rj_camera_auto_submit_${eventId}`;
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

function resolveGalleryUnlockMessage(settings: CameraSessionSettings) {
  const date = settings.cameraGalleryUnlockDate.trim();
  const time = settings.cameraGalleryUnlockTime.trim();
  if (!date) return "";

  const iso = `${date}T${time || "00:00"}:00`;
  const unlockAt = new Date(iso);
  if (Number.isNaN(unlockAt.getTime())) return "";

  const formatted = unlockAt.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  if (unlockAt.getTime() <= Date.now()) {
    return `Gallery unlock is active since ${formatted}.`;
  }
  return `Gallery photos unlock on ${formatted}.`;
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
  const [autoSubmitConfirmed, setAutoSubmitConfirmed] = useState<boolean>(() => {
    if (typeof window === "undefined" || !eventId) return false;
    try {
      return window.localStorage.getItem(makeAutoSubmitStorageKey(eventId)) === "true";
    } catch {
      return false;
    }
  });
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<CameraFacing>("environment");
  const [cameraTransitioning, setCameraTransitioning] = useState(false);
  const [keepCameraActive, setKeepCameraActive] = useState(true);
  const [cameraPermissionFailed, setCameraPermissionFailed] = useState(false);
  const [showFallbackUpload, setShowFallbackUpload] = useState(false);
  const [showGallerySheet, setShowGallerySheet] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [zoomOptions, setZoomOptions] = useState<number[]>([1]);
  const [selectedZoom, setSelectedZoom] = useState(1);
  const [started, setStarted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [showQrSheet, setShowQrSheet] = useState(false);
  const [qrImageDataUrl, setQrImageDataUrl] = useState("");
  const [qrRendering, setQrRendering] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const canCaptureMoreShots =
    usage.shotsLimit <= 0 || usage.shotsLeft === null || usage.shotsLeft > 0;
  const showLandingFirst = settings.cameraLandingEnabled;
  const showLandingScreen = showLandingFirst && !started;
  const shareableCameraUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    if (!eventId || !cameraToken) return "";
    const base = window.location.origin;
    const params = new URLSearchParams({ e: eventId, t: cameraToken });
    return `${base}/cam?${params.toString()}`;
  }, [cameraToken, eventId]);
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
    setTorchEnabled(false);
    setCameraOpen(false);
  }, []);

  const loadGallery = useCallback(async () => {
    if (!eventId || !cameraToken || !deviceId) return;
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
    if (autoSubmitConfirmed) {
      setFeedback("Processing shot...");
      await uploadPhoto(fileToUpload);
      return;
    }

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
    if (eventId) {
      try {
        window.localStorage.setItem(makeAutoSubmitStorageKey(eventId), "true");
      } catch {
        // Ignore storage write failures.
      }
    }
    setAutoSubmitConfirmed(true);
    setShowSubmitConfirm(false);
    setFeedback("Processing shot...");
    await uploadPhoto(pendingShotFile);
    setPendingShotFile(null);
  }

  async function openQrSheet() {
    if (!shareableCameraUrl) {
      setFeedback("Missing camera share link.");
      return;
    }
    setShowQrSheet(true);
    if (qrImageDataUrl || qrRendering) return;

    setQrRendering(true);
    try {
      const dataUrl = await QRCode.toDataURL(shareableCameraUrl, {
        width: 520,
        margin: 1,
      });
      setQrImageDataUrl(dataUrl);
    } catch {
      setFeedback("Unable to render QR code right now.");
    } finally {
      setQrRendering(false);
    }
  }

  async function shareCameraLink() {
    if (!shareableCameraUrl) {
      setFeedback("Missing camera share link.");
      return;
    }

    try {
      setSharing(true);
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        await navigator.share({
          title: settings.cameraEventTitle,
          text: `Join ${settings.cameraEventTitle} camera`,
          url: shareableCameraUrl,
        });
        return;
      }

      await navigator.clipboard.writeText(shareableCameraUrl);
      setFeedback("Camera link copied. You can paste and share it.");
    } catch {
      setFeedback("Sharing cancelled or not available on this device.");
    } finally {
      setSharing(false);
    }
  }

  async function applyZoomLevel(level: number) {
    const stream = streamRef.current;
    const track = stream?.getVideoTracks?.()[0];
    if (!track || !Number.isFinite(level)) return;

    try {
      const capabilities = (
        track as MediaStreamTrack & {
          getCapabilities?: () => unknown;
        }
      ).getCapabilities?.();

      const zoomCapability = (capabilities as Record<string, unknown> | undefined)?.[
        "zoom"
      ] as
        | { min?: number; max?: number; step?: number }
        | undefined;
      if (!zoomCapability || typeof zoomCapability.min !== "number" || typeof zoomCapability.max !== "number") {
        return;
      }

      const clamped = Math.max(zoomCapability.min, Math.min(level, zoomCapability.max));
      await track.applyConstraints({
        advanced: [{ zoom: clamped } as MediaTrackConstraintSet],
      });
      setSelectedZoom(level);
    } catch {
      // Ignore zoom apply failures on unsupported browsers.
    }
  }

  async function toggleFlash() {
    const stream = streamRef.current;
    const track = stream?.getVideoTracks?.()[0];
    if (!track) return;

    const nextValue = !torchEnabled;
    try {
      await track.applyConstraints({
        advanced: [{ torch: nextValue } as MediaTrackConstraintSet],
      });
      setTorchEnabled(nextValue);
    } catch {
      setFeedback("Flash/torch is not available on this camera.");
    }
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
    const track = stream.getVideoTracks()[0];

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

      try {
        const capabilities = (
          track as MediaStreamTrack & {
            getCapabilities?: () => unknown;
          }
        ).getCapabilities?.();

        const torchCap = (capabilities as Record<string, unknown> | undefined)?.["torch"];
        setTorchSupported(Boolean(torchCap));

        const zoomCap = (capabilities as Record<string, unknown> | undefined)?.["zoom"] as
          | { min?: number; max?: number }
          | undefined;
        if (zoomCap && typeof zoomCap.min === "number" && typeof zoomCap.max === "number") {
          const min = Math.max(1, Math.ceil(zoomCap.min));
          const max = Math.max(min, Math.floor(zoomCap.max));
          const built: number[] = [];
          for (let zoom = min; zoom <= Math.min(max, 3); zoom += 1) {
            built.push(zoom);
          }
          if (!built.includes(1)) {
            built.unshift(1);
          }
          const uniqueSorted = Array.from(new Set(built)).sort((a, b) => a - b);
          setZoomOptions(uniqueSorted);
          const defaultZoom = uniqueSorted.includes(1) ? 1 : uniqueSorted[0];
          setSelectedZoom(defaultZoom);
          if (defaultZoom) {
            const clamped = Math.max(
              zoomCap.min,
              Math.min(defaultZoom, zoomCap.max),
            );
            await track.applyConstraints({
              advanced: [{ zoom: clamped } as MediaTrackConstraintSet],
            });
          }
        } else {
          setZoomOptions([1]);
          setSelectedZoom(1);
        }
      } catch {
        setTorchSupported(false);
        setZoomOptions([1]);
        setSelectedZoom(1);
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

  const galleryUnlockMessage = resolveGalleryUnlockMessage(settings);

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
              <button
                type="button"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/30 bg-black/45 text-white"
                onClick={() => stopCamera(true)}
                aria-label="Close camera"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                  <path
                    d="M18.3 5.71a1 1 0 00-1.41 0L12 10.59 7.11 5.7A1 1 0 005.7 7.12L10.58 12l-4.9 4.89a1 1 0 101.42 1.41L12 13.41l4.89 4.9a1 1 0 001.41-1.42L13.42 12l4.9-4.89a1 1 0 00-.02-1.4z"
                    fill="currentColor"
                  />
                </svg>
              </button>
              <button
                type="button"
                className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/30 bg-black/45 text-white"
                onClick={() => setShowFallbackUpload((current) => !current)}
                aria-label="Upload photo"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                  <path
                    d="M20 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V6a2 2 0 00-2-2zM8.5 11A1.5 1.5 0 1110 9.5 1.5 1.5 0 018.5 11zm3.8 6H5.2l3.3-4.2 2.2 2.7 3.2-3.8L18.8 17h-5.7zM19 8h-2V6h-2V4h2V2h2v2h2v2h-2z"
                    fill="currentColor"
                  />
                </svg>
              </button>
            </div>

            <div className="pointer-events-none absolute inset-x-0 top-7 z-10 px-14 text-center">
              <p className="truncate text-3xl font-semibold tracking-tight text-white drop-shadow-lg">
                {settings.cameraEventTitle}
              </p>
              <p className="truncate text-xs text-white/75 drop-shadow">{settings.cameraEventSubtitle}</p>
            </div>

            <div className="absolute right-3 top-1/2 z-10 flex -translate-y-1/2 flex-col gap-2">
              <button
                type="button"
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/25 bg-black/55 text-white/95 backdrop-blur-sm"
                onClick={() => void openQrSheet()}
                aria-label="Open QR share"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                  <path
                    d="M3 3h7v7H3V3zm11 0h7v7h-7V3zM3 14h7v7H3v-7zm13 2h2v2h-2v-2zm-2-2h2v2h-2v-2zm4 4h2v2h-2v-2zm-4 2h2v2h-2v-2zm4-10h3v3h-3v-3z"
                    fill="currentColor"
                  />
                </svg>
              </button>
              <button
                type="button"
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/25 bg-black/55 text-white/95 backdrop-blur-sm disabled:opacity-40"
                onClick={() => void shareCameraLink()}
                disabled={sharing}
                aria-label="Share camera link"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                  <path
                    d="M14 3l7 7-7 7-1.4-1.4 4.6-4.6H8a5 5 0 000 10h3v2H8a7 7 0 010-14h9.2l-4.6-4.6L14 3z"
                    fill="currentColor"
                  />
                </svg>
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

            {showQrSheet ? (
              <div className="absolute inset-0 z-30 flex items-end bg-black/50 p-3">
                <div className="w-full rounded-3xl border border-white/20 bg-[#2c2940] p-4 shadow-2xl backdrop-blur-sm">
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      className="rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs text-white"
                      onClick={() => setShowQrSheet(false)}
                    >
                      Close
                    </button>
                    <p className="text-sm font-semibold text-white">Share QR Code</p>
                    <div className="w-12" />
                  </div>
                  <p className="mt-2 text-center text-xs text-white/75">
                    Anyone can join this camera by scanning this QR code.
                  </p>

                  <div className="mt-4 rounded-2xl border border-white/20 bg-white/95 p-4">
                    {qrRendering ? (
                      <div className="flex h-56 items-center justify-center text-sm text-black/70">
                        Rendering QR...
                      </div>
                    ) : qrImageDataUrl ? (
                      <img
                        src={qrImageDataUrl}
                        alt="Guest camera QR code"
                        className="mx-auto h-56 w-56 rounded-xl object-contain"
                      />
                    ) : (
                      <div className="flex h-56 items-center justify-center text-sm text-black/70">
                        QR unavailable.
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    className="mt-4 w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-white disabled:opacity-40"
                    onClick={() => void shareCameraLink()}
                    disabled={sharing || !shareableCameraUrl}
                  >
                    {sharing ? "Sharing..." : "Share Link"}
                  </button>
                </div>
              </div>
            ) : null}

            {!cameraOpen ? (
              <div className="absolute inset-x-0 bottom-28 z-10 px-6">
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

            <div className="absolute inset-x-0 bottom-5 z-10 px-4">
              <div className="mx-auto max-w-sm">
                <div className="mb-3 flex justify-center gap-2">
                  {zoomOptions.map((zoom) => (
                    <button
                      key={zoom}
                      type="button"
                      className={`rounded-lg px-3 py-1 text-xs font-semibold ${
                        selectedZoom === zoom
                          ? "bg-white text-black"
                          : "border border-white/30 bg-black/45 text-white"
                      }`}
                      onClick={() => void applyZoomLevel(zoom)}
                      disabled={!cameraOpen || cameraTransitioning}
                    >
                      {zoom}x
                    </button>
                  ))}
                </div>

                <div className="flex items-end justify-between">
                  <div className="flex w-20 flex-col items-center gap-2">
                    <button
                      type="button"
                      className="flex h-11 w-11 items-center justify-center rounded-full border border-white/35 bg-black/50 text-white disabled:opacity-40"
                      onClick={() => void toggleFlash()}
                      disabled={!cameraOpen || !torchSupported}
                      aria-label="Toggle flash"
                    >
                      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                        <path
                          d="M11 2L5 13h5l-1 9 10-13h-6l2-7h-4z"
                          fill={torchEnabled ? "currentColor" : "none"}
                          stroke="currentColor"
                          strokeWidth="1.6"
                        />
                      </svg>
                    </button>
                    <p className="text-center text-xs font-semibold text-white">
                      {usage.shotsLimit > 0 ? usage.shotsLeft ?? 0 : "Unlimited"}
                    </p>
                  </div>

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

                  <div className="flex w-20 flex-col items-center gap-2">
                    <button
                      type="button"
                      className="flex h-11 w-11 items-center justify-center rounded-full border border-white/35 bg-black/50 text-white disabled:opacity-40"
                      onClick={() => void switchCameraFacing()}
                      disabled={!cameraOpen || uploading || cameraTransitioning}
                      aria-label="Flip camera"
                    >
                      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                        <path
                          d="M7 7h6l-2-2m2 2l-2 2M17 17h-6l2 2m-2-2l2-2M3 8a5 5 0 015-5h8a5 5 0 015 5v8a5 5 0 01-5 5H8a5 5 0 01-5-5V8z"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="h-16 w-16 overflow-hidden rounded-xl border border-white/40 bg-black/45 shadow-xl"
                      onClick={() => setShowGallerySheet(true)}
                      aria-label="Open gallery"
                    >
                      {previewUrl ? (
                        <img
                          src={previewUrl}
                          alt="Latest shot preview"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="inline-flex h-full w-full items-center justify-center text-[10px] text-white/75">
                          Gallery
                        </span>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {showGallerySheet ? (
              <div className="absolute inset-0 z-30 flex items-end bg-black/55 p-3">
                <div className="w-full rounded-3xl border border-white/20 bg-[#171822] p-4 shadow-2xl">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-white">Event Gallery</p>
                    <button
                      type="button"
                      className="rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs text-white"
                      onClick={() => setShowGallerySheet(false)}
                    >
                      Close
                    </button>
                  </div>
                  {galleryUnlockMessage ? (
                    <p className="mt-2 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs text-white/80">
                      {galleryUnlockMessage}
                    </p>
                  ) : null}
                  {galleryItems.length === 0 ? (
                    <p className="mt-3 rounded-lg border border-dashed border-white/20 px-3 py-2 text-sm text-white/70">
                      No photos yet.
                    </p>
                  ) : (
                    <div className="mt-3 grid max-h-80 grid-cols-3 gap-2 overflow-auto pr-1">
                      {galleryItems.map((item) => (
                        <article key={item.id} className="overflow-hidden rounded-lg border border-white/10">
                          <img
                            src={item.imageUrl}
                            alt={`Photo by ${item.uploaderName}`}
                            className="h-24 w-full object-cover"
                            loading="lazy"
                          />
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : null}

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
        </div>
      )}
    </main>
  );
}


