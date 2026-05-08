"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import RingScrollIntro from "@/components/ring-scroll-intro";
import { ThemeToggle } from "@/components/theme-toggle";

type GuestAccessResult = {
  rowNumber: number;
  id: string;
  inviteCode: string;
  fullName: string;
  email: string;
  maxGuests: number;
  status: string;
  lastUpdated: string;
  notes: string;
};

type AccessSettings = {
  weddingDate: string;
  weddingTime: string;
  showCountdown: boolean;
  countdownDays: number | null;
};

type CountdownParts = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isComplete: boolean;
};

type MusicTrack = {
  id: string;
  title: string;
  fileName: string;
  streamUrl: string;
  isFeatured: boolean;
};

type GalleryPhoto = {
  src: string;
  alt: string;
  caption: string;
  objectPosition?: string;
  isFeatured?: boolean;
};

const DEFAULT_WEDDING_TIME = "16:00";
const WEDDING_VENUE_NAME = "Seville Garden";
const WEDDING_VENUE_ADDRESS =
  "3 Kab Martin Street, Tinajeros, Malabon, 1470 Kalakhang Maynila";
const WEDDING_MAP_URL =
  "https://www.google.com/maps/search/?api=1&query=Seville+Garden%2C+3+Kab+Martin+Street%2C+Tinajeros%2C+Malabon%2C+1470+Kalakhang+Maynila";
const WEDDING_MAP_EMBED_URL =
  "https://maps.google.com/maps?q=Seville%20Garden%2C%203%20Kab%20Martin%20Street%2C%20Tinajeros%2C%20Malabon%2C%201470%20Kalakhang%20Maynila&output=embed";
const GALLERY_PHOTOS: readonly GalleryPhoto[] = [
  {
    src: "/images/gallery/trio-smile-3.jpg",
    alt: "Red and Jess smiling together with family",
    caption: "Featured Moment",
    isFeatured: true,
    objectPosition: "50% 22%",
  },
  {
    src: "/images/gallery/duo-hold-flower-2.jpg",
    alt: "Red and Jess holding flowers",
    caption: "Blooming Together",
    objectPosition: "50% 26%",
  },
  {
    src: "/images/gallery/duo-with-shades-6.jpg",
    alt: "Red and Jess candid shot with shades",
    caption: "Playful Vibe",
    objectPosition: "50% 24%",
  },
  {
    src: "/images/gallery/duo-sit-7.jpg",
    alt: "Red and Jess seated portrait",
    caption: "Seated Portrait",
    objectPosition: "50% 24%",
  },
  {
    src: "/images/gallery/duo-hug-2.jpg",
    alt: "Red and Jess smiling during a hug",
    caption: "Warm Embrace",
    objectPosition: "50% 24%",
  },
  {
    src: "/images/gallery/tinginan-with-kuya.jpg",
    alt: "Red and Jess candid glance",
    caption: "Candid Glance",
    objectPosition: "50% 26%",
  },
];

export default function Home() {
  const router = useRouter();
  const accessCheckedRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [inviteCode, setInviteCode] = useState("");
  const [inviteToken, setInviteToken] = useState("");
  const [accessLoading, setAccessLoading] = useState(true);
  const [selectedGuest, setSelectedGuest] = useState<GuestAccessResult | null>(null);
  const [settings, setSettings] = useState<AccessSettings>({
    weddingDate: "",
    weddingTime: DEFAULT_WEDDING_TIME,
    showCountdown: true,
    countdownDays: null,
  });
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [accessError, setAccessError] = useState("");

  const [attendance, setAttendance] = useState<"attending" | "declined">("attending");
  const [guestCount, setGuestCount] = useState(1);
  const [companionNameByIndex, setCompanionNameByIndex] = useState<Record<number, string>>({});
  const [email, setEmail] = useState("");
  const [dietaryRestrictions, setDietaryRestrictions] = useState("");
  const [songRequest, setSongRequest] = useState("");
  const [message, setMessage] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [musicTracks, setMusicTracks] = useState<MusicTrack[]>([]);
  const [musicLoading, setMusicLoading] = useState(true);
  const [musicError, setMusicError] = useState("");
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isPlayerVisible, setIsPlayerVisible] = useState(false);
  const [isPlayerExpanded, setIsPlayerExpanded] = useState(false);
  const [isPlaylistOpen, setIsPlaylistOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [shouldAutoplay, setShouldAutoplay] = useState(false);
  const [autoplayNotice, setAutoplayNotice] = useState("");
  const [isNavbarVisible, setIsNavbarVisible] = useState(false);
  const [isGcashModalOpen, setIsGcashModalOpen] = useState(false);
  const [selectedGcashRecipient, setSelectedGcashRecipient] = useState<"groom" | "bride">("groom");
  const canUseDom = typeof window !== "undefined";

  useEffect(() => {
    if (!isGcashModalOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsGcashModalOpen(false);
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isGcashModalOpen]);

  const countdown = useMemo(
    () => getCountdownParts(settings.weddingDate, settings.weddingTime, nowMs),
    [settings.weddingDate, settings.weddingTime, nowMs],
  );
  const ceremonyTimeLabel = useMemo(
    () => formatWeddingTime(settings.weddingTime),
    [settings.weddingTime],
  );

  const countdownMessage = useMemo(() => {
    if (!countdown) return "";
    if (countdown.isComplete) return "Wedding day is today";
    if (countdown.days === 1) return "1 day to go";
    return `${countdown.days} days to go`;
  }, [countdown]);
  const introWeddingDateLabel = useMemo(
    () => (settings.weddingDate ? formatWeddingDate(settings.weddingDate) : "June 6, 2026"),
    [settings.weddingDate],
  );

  const maxGuestMessage = useMemo(() => {
    if (!selectedGuest) return "";
    return `Invite limit: up to ${selectedGuest.maxGuests} guest(s).`;
  }, [selectedGuest]);

  const expectedCompanionCount = useMemo(() => {
    if (attendance !== "attending") return 0;
    return Math.max(0, guestCount - 1);
  }, [attendance, guestCount]);

  const companionNames = useMemo(
    () =>
      Array.from({ length: expectedCompanionCount }, (_, index) =>
        (companionNameByIndex[index] ?? "").trim(),
      ),
    [companionNameByIndex, expectedCompanionCount],
  );

  const missingCompanionIndexes = useMemo(
    () =>
      companionNames
        .map((name, index) => (name ? -1 : index))
        .filter((index) => index >= 0),
    [companionNames],
  );

  const hasCompanionValidationError = missingCompanionIndexes.length > 0;
  const currentTrack = useMemo(
    () => musicTracks[currentTrackIndex] ?? null,
    [musicTracks, currentTrackIndex],
  );
  const hasMoreSongs = musicTracks.length > 1;

  const loadMusicPlaylist = useCallback(async () => {
    setMusicLoading(true);
    setMusicError("");

    try {
      const response = await fetch("/api/music/playlist");
      const payload = await response.json();

      if (!response.ok) {
        const details = payload.details ? ` (${payload.details})` : "";
        const msg = `${payload.error ?? "Unable to load music playlist."}${details}`;
        setMusicError(msg);
        return;
      }

      const tracks = Array.isArray(payload.tracks)
        ? (payload.tracks as MusicTrack[])
        : [];
      setMusicTracks(tracks);
      if (tracks.length === 0) {
        setMusicError("No music files found in BALANAY FAM/music.");
      }
    } catch {
      setMusicError("Network error while loading music playlist.");
    } finally {
      setMusicLoading(false);
    }
  }, []);

  const tryPlayCurrentTrack = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;

    try {
      await audio.play();
      setIsPlaying(true);
      setAutoplayNotice("");
    } catch {
      setIsPlaying(false);
      setAutoplayNotice("Tap play on the mini player to start audio.");
    }
  }, [currentTrack]);

  const validateAccess = useCallback(async (invite: string, token: string) => {
    setAccessLoading(true);
    setAccessError("");

    try {
      const response = await fetch(
        `/api/rsvp/access?invite=${encodeURIComponent(invite)}&token=${encodeURIComponent(token)}`,
      );
      const payload = await response.json();

      if (!response.ok) {
        const details = payload.details ? ` (${payload.details})` : "";
        const msg = `${payload.error ?? "Invalid invitation link."}${details}`;
        setAccessError(msg);
        setSelectedGuest(null);
        toast.error("Access denied", { description: msg });
        return;
      }

      setSelectedGuest(payload.guest);
      setSettings({
        weddingDate: payload.settings?.weddingDate ?? "",
        weddingTime: payload.settings?.weddingTime ?? DEFAULT_WEDDING_TIME,
        showCountdown:
          typeof payload.settings?.showCountdown === "boolean"
            ? payload.settings.showCountdown
            : true,
        countdownDays:
          typeof payload.settings?.countdownDays === "number"
            ? payload.settings.countdownDays
            : null,
      });
      setGuestCount(Math.min(payload.guest.maxGuests, 1));
      setCompanionNameByIndex({});
      setSubmitAttempted(false);
      toast.success("Invitation verified", {
        description: `Welcome, ${payload.guest.fullName}.`,
      });
    } catch {
      const msg = "Network error validating invitation link.";
      setAccessError(msg);
      setSelectedGuest(null);
      toast.error("Network error", { description: msg });
    } finally {
      setAccessLoading(false);
    }
  }, []);

  const loadPublicSettings = useCallback(async () => {
    try {
      const response = await fetch("/api/rsvp/settings");
      const payload = await response.json();
      if (!response.ok) return;

      setSettings({
        weddingDate: payload.settings?.weddingDate ?? "",
        weddingTime: payload.settings?.weddingTime ?? DEFAULT_WEDDING_TIME,
        showCountdown:
          typeof payload.settings?.showCountdown === "boolean"
            ? payload.settings.showCountdown
            : true,
        countdownDays:
          typeof payload.settings?.countdownDays === "number"
            ? payload.settings.countdownDays
            : null,
      });
    } catch {
      // Best-effort fetch. RSVP access flow still provides settings on valid invite links.
    }
  }, []);

  useEffect(() => {
    if (accessCheckedRef.current) return;
    accessCheckedRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const invite = (params.get("invite") ?? "").trim();
    const token = (params.get("token") ?? "").trim();

    const rafId = window.requestAnimationFrame(() => {
      void loadPublicSettings();
      setInviteCode(invite);
      setInviteToken(token);
      if (!invite || !token) {
        setAccessError(
          "This RSVP page requires your personal invitation link. Please use the QR or link sent by Red & Jess.",
        );
        setAccessLoading(false);
        return;
      }
      void validateAccess(invite, token);
    });

    return () => window.cancelAnimationFrame(rafId);
  }, [loadPublicSettings, validateAccess]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const rafId = window.requestAnimationFrame(() => {
      void loadMusicPlaylist();
    });

    return () => window.cancelAnimationFrame(rafId);
  }, [loadMusicPlaylist]);

  useEffect(() => {
    if (!shouldAutoplay || !currentTrack) return;

    const rafId = window.requestAnimationFrame(() => {
      void tryPlayCurrentTrack();
      setShouldAutoplay(false);
    });

    return () => window.cancelAnimationFrame(rafId);
  }, [currentTrack, shouldAutoplay, tryPlayCurrentTrack]);

  useEffect(() => {
    const handleOverlayVisibility = (event: Event) => {
      const customEvent = event as CustomEvent<{ visible?: boolean }>;
      const overlayVisible = customEvent.detail?.visible ?? true;
      setIsNavbarVisible(!overlayVisible);
    };

    window.addEventListener("ring-overlay-visibility", handleOverlayVisibility);
    return () => window.removeEventListener("ring-overlay-visibility", handleOverlayVisibility);
  }, []);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const animatedElements = Array.from(
      document.querySelectorAll<HTMLElement>("[data-scroll-animate]"),
    );

    if (animatedElements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("is-in-view");
          observer.unobserve(entry.target);
        }
      },
      {
        threshold: 0.18,
        rootMargin: "0px 0px -10% 0px",
      },
    );

    animatedElements.forEach((element) => {
      element.classList.add("scroll-animate-ready");
      observer.observe(element);
    });

    return () => observer.disconnect();
  }, []);

  function handlePlayOurSong() {
    if (musicTracks.length === 0) return;
    setIsPlayerVisible(true);
    setIsPlayerExpanded(true);
    setIsPlaylistOpen(false);
    setCurrentTrackIndex(0);
    setShouldAutoplay(true);
  }

  function handleTogglePlayback() {
    if (!currentTrack) return;
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) {
      void tryPlayCurrentTrack();
      return;
    }

    audio.pause();
    setIsPlaying(false);
  }

  function handleNextTrack() {
    if (musicTracks.length <= 1) return;
    setCurrentTrackIndex((current) => {
      const nextIndex = (current + 1) % musicTracks.length;
      return nextIndex;
    });
    setShouldAutoplay(true);
  }

  function handleSelectTrack(index: number) {
    setCurrentTrackIndex(index);
    setIsPlayerVisible(true);
    setIsPlayerExpanded(true);
    setShouldAutoplay(true);
  }

  function handleStopPlayer() {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    setIsPlaying(false);
    setIsPlaylistOpen(false);
    setIsPlayerExpanded(false);
    setIsPlayerVisible(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitAttempted(true);
    if (!selectedGuest) {
      const msg = "Invalid invitation. Please open your personal RSVP link.";
      setFeedback(msg);
      toast.warning("Invitation required", { description: msg });
      return;
    }

    if (hasCompanionValidationError) {
      const firstMissing = missingCompanionIndexes[0];
      const msg = `Please fill Companion ${firstMissing + 1} before submitting.`;
      setFeedback(msg);
      toast.warning("Incomplete companion names", { description: msg });
      return;
    }

    setSubmitLoading(true);
    setFeedback("");

    try {
      const response = await fetch("/api/rsvp/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inviteCode,
          inviteToken,
          fullName: selectedGuest.fullName,
          email,
          attendance,
          guestCount,
          companionNames,
          dietaryRestrictions,
          songRequest,
          message,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        const details = payload.details ? ` (${payload.details})` : "";
        const msg = `${payload.error ?? "Unable to submit RSVP."}${details}`;
        setFeedback(msg);
        toast.error("RSVP failed", { description: msg });
        return;
      }

      const statusMessage = payload.replaced
        ? "Your RSVP was updated successfully."
        : "Your RSVP was submitted successfully.";

      toast.success("RSVP saved", {
        description: statusMessage,
      });

      const params = new URLSearchParams({
        name: selectedGuest.fullName,
        code: selectedGuest.inviteCode,
        attendance,
        guests: String(guestCount),
        status: payload.replaced ? "updated" : "submitted",
      });

      router.push(`/thank-you?${params.toString()}`);
    } catch {
      const msg = "Network error while submitting RSVP.";
      setFeedback(msg);
      toast.error("Network error", { description: msg });
    } finally {
      setSubmitLoading(false);
    }
  }

  return (
    <main className="relative text-[var(--foreground)]">
      <RingScrollIntro weddingDateLabel={introWeddingDateLabel} />

      <header
        id="top-navbar"
        className={`fixed inset-x-0 top-0 z-40 border-b border-[var(--sand)]/70 bg-[color-mix(in_srgb,var(--background)_90%,var(--ring-bg)_10%)]/92 backdrop-blur transition-all duration-700 ${
          isNavbarVisible ? "translate-y-0 opacity-100" : "-translate-y-4 opacity-0 pointer-events-none"
        }`}
      >
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--ink-soft)]">Together with their families</p>
            <p className="font-display text-xl text-[var(--ink-deep)]">Red & Jess</p>
          </div>
          <div className="flex items-center gap-3">
            <nav className="hidden items-center gap-5 text-sm text-[var(--ink-soft)] md:flex">
              <a href="#story" className="hover:text-[var(--ink-deep)]">Our Story</a>
              <a href="#details" className="hover:text-[var(--ink-deep)]">Details</a>
              <a href="#rsvp" className="hover:text-[var(--ink-deep)]">RSVP</a>
              <a href="#registry" className="hover:text-[var(--ink-deep)]">Gift</a>
              <a href="#gallery" className="hover:text-[var(--ink-deep)]">Gallery</a>
              <a href="#faq" className="hover:text-[var(--ink-deep)]">FAQ</a>
            </nav>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="relative z-10 bg-[var(--background)] pt-[72px]">
      <div className="pointer-events-none absolute left-[-120px] top-[-80px] h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(185,138,87,0.30),transparent_65%)] cinematic-glow" />
      <div className="pointer-events-none absolute bottom-[-100px] right-[-80px] h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(126,74,66,0.26),transparent_65%)] cinematic-glow" />

      <section
        id="home"
        data-scroll-animate="up"
        className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.2fr_1fr] lg:py-16"
      >
        <div className="cinematic-reveal">
          <p className="text-xs uppercase tracking-[0.25em] text-[var(--ink-soft)]">A Love Story In Motion</p>
          <h1 className="mt-3 font-display text-5xl leading-[0.95] text-[var(--ink-deep)] sm:text-6xl md:text-7xl">
            Red
            <span className="mx-2 text-[var(--gold)]">&</span>
            Jess
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-[var(--ink-soft)] sm:text-lg">
            Invite you to celebrate their wedding day. Kindly respond through your personal invite
            link and explore the details below.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href="#rsvp"
              className="rounded-full bg-[var(--ink-deep)] px-6 py-3 text-sm font-semibold text-[var(--cream)] transition hover:bg-[var(--rosewood)]"
            >
              RSVP Now
            </a>
            <a
              href="#details"
              className="rounded-full border border-[var(--sand)] bg-[var(--cream)] px-6 py-3 text-sm font-semibold text-[var(--ink-deep)] transition hover:border-[var(--gold)]"
            >
              View Details
            </a>
            <button
              type="button"
              onClick={handlePlayOurSong}
              disabled={musicLoading || musicTracks.length === 0}
              className="rounded-full border border-[var(--gold)] bg-[var(--cream)] px-6 py-3 text-sm font-semibold text-[var(--ink-deep)] transition hover:bg-[var(--gold)]/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {musicLoading ? "Loading songs..." : "Play Our Song"}
            </button>
          </div>
          {musicError ? (
            <p className="mt-3 text-sm text-[var(--rosewood)]">{musicError}</p>
          ) : (
            <p className="mt-3 text-sm text-[var(--ink-soft)]">
              Start with our featured song, then explore more tracks in the mini player.
            </p>
          )}

          {settings.showCountdown && settings.weddingDate && countdown ? (
            <div className="mt-8 rounded-2xl border border-[var(--sand)] bg-[var(--cream)]/90 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-[var(--ink-soft)]">Wedding Day</p>
              <p className="mt-1 font-display text-3xl text-[var(--ink-deep)]">
                {formatWeddingDate(settings.weddingDate)}
              </p>
              <p className="mt-1 text-sm font-medium uppercase tracking-[0.1em] text-[var(--ink-soft)]">
                {ceremonyTimeLabel}
              </p>
              <div className="mt-4 grid grid-cols-4 gap-2">
                <CountdownUnit label="Days" value={countdown.days} />
                <CountdownUnit label="Hours" value={countdown.hours} />
                <CountdownUnit label="Minutes" value={countdown.minutes} />
                <CountdownUnit label="Seconds" value={countdown.seconds} />
              </div>
              <p className="mt-3 text-sm font-medium text-[var(--ink-soft)]">{countdownMessage}</p>
            </div>
          ) : null}
        </div>

        <div className="cinematic-reveal-slow">
          <HeroWeddingPhotoCard />
        </div>
      </section>

      <section
        id="story"
        data-scroll-animate="left"
        className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6"
      >
        <SectionHeading title="Our Story" subtitle="What began as a simple hello became our favorite adventure." />
        <div className="mt-7 grid gap-6 lg:grid-cols-[1fr_1.1fr]">
          <PlaceholderImageCard
            label="Story Timeline Photo"
            note="Replace with travel/proposal image"
            heightClassName="h-[320px] sm:h-[420px]"
          />
          <div className="space-y-4">
            <TimelineItem date="[Month Year]" text="We met at [place]." />
            <TimelineItem date="[Month Year]" text="First trip together to [location]." />
            <TimelineItem date="[Month Year]" text="The proposal at [location]." />
          </div>
        </div>
      </section>

      <section
        id="details"
        data-scroll-animate="right"
        className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6"
      >
        <SectionHeading title="Wedding Details" subtitle="Everything you need for the day." />
        <div className="mt-7 grid gap-6 md:grid-cols-2">
          <VenueMapCard ceremonyTimeLabel={ceremonyTimeLabel} />
          <ColorMotifCard />
        </div>
      </section>

      <section
        id="rsvp"
        data-scroll-animate="up"
        className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6"
      >
        <SectionHeading
          title="Kindly Respond"
          subtitle="The favor of your reply is requested, on or before May 16, 2026."
        />
        <div
          data-scroll-animate="pop"
          className="mt-7 rounded-2xl border border-[var(--sand)] bg-[var(--surface)] p-5 shadow-sm sm:p-6"
        >
          {accessLoading ? (
            <p className="text-sm text-[var(--ink-soft)]">Validating invitation link...</p>
          ) : accessError ? (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {accessError}
            </p>
          ) : selectedGuest ? (
            <>
              <p className="text-sm text-[var(--ink-soft)]">You are responding for:</p>
              <p className="mt-1 font-display text-3xl text-[var(--ink-deep)]">{selectedGuest.fullName}</p>
              <p className="mt-2 text-sm text-[var(--ink-soft)]">{maxGuestMessage}</p>
              <p className="mt-3 rounded-lg border border-[var(--rosewood)]/35 bg-[var(--gold)]/10 px-3 py-2 text-sm text-[var(--ink-deep)]">
                <span className="mr-1 font-semibold uppercase tracking-[0.08em] text-[var(--rosewood)]">
                  Please Note:
                </span>
                Please understand that, as much as we would love to celebrate with everyone, we have
                limited venue capacity and resources. Because of this, each invitation is reserved
                only for the guest name(s) listed and is non-transferable. We truly appreciate your
                understanding, love, and support.
              </p>

              {selectedGuest.status !== "pending" ? (
                <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  We found an existing RSVP. Submitting again will update your previous response.
                </p>
              ) : null}

              <form onSubmit={handleSubmit} className="mt-5 grid gap-3">
                <label className="text-sm font-medium text-[var(--ink-deep)]">Attendance</label>
                <select
                  className="rounded-lg border border-[var(--sand)] bg-[var(--cream)] px-3 py-2"
                  value={attendance}
                  onChange={(event) => {
                    const nextAttendance = event.target.value as "attending" | "declined";
                    setAttendance(nextAttendance);
                    setSubmitAttempted(false);
                    if (nextAttendance === "declined") {
                      setGuestCount(0);
                      return;
                    }
                    setGuestCount((currentCount) => {
                      if (currentCount < 1) return 1;
                      if (currentCount > selectedGuest.maxGuests) return selectedGuest.maxGuests;
                      return currentCount;
                    });
                  }}
                >
                  <option value="attending">Joyfully Attending</option>
                  <option value="declined">Regretfully Declining</option>
                </select>

                <label className="text-sm font-medium text-[var(--ink-deep)]">Guest Count</label>
                <input
                  className="rounded-lg border border-[var(--sand)] bg-[var(--cream)] px-3 py-2"
                  type="number"
                  min={attendance === "declined" ? 0 : 1}
                  max={selectedGuest.maxGuests}
                  value={guestCount}
                  onChange={(event) => {
                    const raw = Number(event.target.value || 0);
                    const bounded = Number.isFinite(raw)
                      ? Math.max(0, Math.min(selectedGuest.maxGuests, raw))
                      : 0;
                    setGuestCount(bounded);
                    setSubmitAttempted(false);
                  }}
                />

                {expectedCompanionCount > 0 ? (
                  <div className="rounded-xl border border-[var(--sand)] bg-[var(--cream)] p-3">
                    <p className="text-sm font-medium text-[var(--ink-deep)]">Companion Names</p>
                    <p className="mt-1 text-xs text-[var(--ink-soft)]">
                      Please provide the {expectedCompanionCount} companion name(s) joining you.
                    </p>
                    <div className="mt-3 grid gap-2">
                      {Array.from({ length: expectedCompanionCount }, (_, index) => (
                        <div key={`companion-${index + 1}`}>
                          <input
                            className={`w-full rounded-lg border bg-[var(--surface-2)] px-3 py-2 ${
                              submitAttempted && missingCompanionIndexes.includes(index)
                                ? "border-rose-400"
                                : "border-[var(--sand)]"
                            }`}
                            value={companionNameByIndex[index] ?? ""}
                            onChange={(event) => {
                              setCompanionNameByIndex((current) => ({
                                ...current,
                                [index]: event.target.value,
                              }));
                              setSubmitAttempted(false);
                            }}
                            placeholder={`Companion ${index + 1} full name`}
                          />
                          {submitAttempted && missingCompanionIndexes.includes(index) ? (
                            <p className="mt-1 text-xs text-rose-600">Please fill Companion {index + 1}.</p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                <label className="text-sm font-medium text-[var(--ink-deep)]">Email</label>
                <input
                  className="rounded-lg border border-[var(--sand)] bg-[var(--cream)] px-3 py-2"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                />

                <label className="text-sm font-medium text-[var(--ink-deep)]">Dietary Restrictions</label>
                <input
                  className="rounded-lg border border-[var(--sand)] bg-[var(--cream)] px-3 py-2"
                  value={dietaryRestrictions}
                  onChange={(event) => setDietaryRestrictions(event.target.value)}
                  placeholder="Optional"
                />

                <label className="text-sm font-medium text-[var(--ink-deep)]">Song Request</label>
                <input
                  className="rounded-lg border border-[var(--sand)] bg-[var(--cream)] px-3 py-2"
                  value={songRequest}
                  onChange={(event) => setSongRequest(event.target.value)}
                  placeholder="Optional"
                />

                <label className="text-sm font-medium text-[var(--ink-deep)]">Message to Couple</label>
                <textarea
                  className="rounded-lg border border-[var(--sand)] bg-[var(--cream)] px-3 py-2"
                  rows={3}
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="Optional"
                />

                <button
                  type="submit"
                  className="mt-2 rounded-lg bg-[var(--rosewood)] px-4 py-3 text-white transition hover:opacity-95 disabled:opacity-50"
                  disabled={submitLoading || hasCompanionValidationError}
                >
                  {submitLoading ? "Submitting..." : "Submit RSVP"}
                </button>
                {hasCompanionValidationError ? (
                  <p className="text-xs text-[var(--ink-soft)]">
                    Complete all companion names to enable RSVP submit.
                  </p>
                ) : null}
              </form>
            </>
          ) : null}
        </div>

        {feedback ? (
          <p
            data-scroll-animate="up"
            className="mt-5 rounded-xl border border-[var(--sand)] bg-[var(--cream)] p-3 text-sm text-[var(--ink-deep)]"
          >
            {feedback}
          </p>
        ) : null}
      </section>

      <section
        id="registry"
        data-scroll-animate="right"
        className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6"
      >
        <SectionHeading title="Gift Guide" subtitle="Your presence and prayers are the greatest gift." />
        <div className="mx-auto mt-7 max-w-2xl">
          <div
            data-scroll-animate="up"
            className="mx-auto rounded-2xl border border-[var(--sand)] bg-[var(--cream)]/80 px-5 py-4 sm:px-6"
          >
            <p className="text-center text-base italic leading-relaxed text-[var(--ink-deep)] sm:text-lg">
              With all that we have, we&apos;ve been truly blessed, your presence and prayers are all
              that we request. But if you desire to give nonetheless, monetary gift is one we
              suggest.
            </p>
          </div>
          <div
            data-scroll-animate="up"
            className="mt-5 flex justify-center"
          >
            <button
              type="button"
              onClick={() => {
                setSelectedGcashRecipient("groom");
                setIsGcashModalOpen(true);
              }}
              aria-haspopup="dialog"
              aria-expanded={isGcashModalOpen}
              aria-controls="gcash-qr-panel"
              className="rounded-xl border border-[var(--sand)] bg-[var(--cream)] px-5 py-2.5 text-sm font-semibold text-[var(--ink-deep)] transition hover:bg-[var(--surface-2)]"
            >
              Show GCash QR
            </button>
          </div>
          <div
            id="gcash-qr-panel"
            aria-hidden={!isGcashModalOpen}
          />
        </div>
      </section>

      {canUseDom
        ? createPortal(
            <div
              role="dialog"
              aria-modal="true"
              aria-label="GCash QR code"
              className={`fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto p-4 pt-6 sm:items-center sm:pt-4 transition-opacity duration-300 ease-out ${
                isGcashModalOpen
                  ? "opacity-100 pointer-events-auto"
                  : "opacity-0 pointer-events-none"
              }`}
              aria-hidden={!isGcashModalOpen}
              onClick={() => setIsGcashModalOpen(false)}
            >
              <div className="absolute inset-0 bg-transparent backdrop-blur-sm" />
              <div
                className={`relative my-2 min-h-0 w-full max-w-sm overflow-visible rounded-2xl border border-[var(--sand)] bg-[var(--cream)] p-3 shadow-xl transition duration-300 ease-out sm:my-0 sm:max-w-[22rem] ${
                  isGcashModalOpen ? "translate-y-0 scale-100" : "translate-y-3 scale-95"
                }`}
                onClick={(event) => event.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => setIsGcashModalOpen(false)}
                  aria-label="Close GCash QR modal"
                  className="absolute -right-2 -top-2 inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--sand)] bg-[var(--cream)] text-[var(--ink-deep)] shadow-md transition hover:bg-[var(--surface-2)] sm:-right-3 sm:-top-3"
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 20 20"
                    className="h-4 w-4"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M5 5L15 15M15 5L5 15"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
                <div className="mx-auto mb-3 grid w-full max-w-xs grid-cols-2 gap-2 rounded-xl border border-[var(--sand)] bg-[var(--surface-2)] p-1">
                  <button
                    type="button"
                    onClick={() => setSelectedGcashRecipient("groom")}
                    className={`rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] transition ${
                      selectedGcashRecipient === "groom"
                        ? "bg-[var(--cream)] text-[var(--ink-deep)] shadow-sm"
                        : "text-[var(--ink-soft)] hover:text-[var(--ink-deep)]"
                    }`}
                  >
                    Groom
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedGcashRecipient("bride")}
                    className={`rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] transition ${
                      selectedGcashRecipient === "bride"
                        ? "bg-[var(--cream)] text-[var(--ink-deep)] shadow-sm"
                        : "text-[var(--ink-soft)] hover:text-[var(--ink-deep)]"
                    }`}
                  >
                    Bride
                  </button>
                </div>
                <div className="mx-auto w-full max-w-[19rem] overflow-hidden rounded-2xl border border-[var(--sand)] bg-[var(--cream)] p-2">
                  <p className="pb-2 text-center text-xs font-semibold uppercase tracking-[0.1em] text-[var(--ink-soft)]">
                    {selectedGcashRecipient === "groom" ? "Groom GCash" : "Bride GCash"}
                  </p>
                  <Image
                    src={
                      selectedGcashRecipient === "groom"
                        ? "/images/red-gcash.jpg"
                        : "/images/jess-gcash.jpg"
                    }
                    alt={
                      selectedGcashRecipient === "groom"
                        ? "GCash QR code for groom"
                        : "GCash QR code for bride"
                    }
                    width={960}
                    height={960}
                    className="h-auto w-full rounded-xl border border-[var(--sand)] bg-[var(--surface-2)]"
                  />
                  <p className="mt-2 text-center text-sm font-semibold tracking-[0.04em] text-[#005DE3]">
                    {selectedGcashRecipient === "groom" ? "RE*****O B." : "JE***A MA**E E."}
                  </p>
                </div>
                <div className="mt-3">
                  <p className="text-center text-xs uppercase tracking-[0.12em] text-[var(--ink-soft)]">
                    Scan to Send via GCash
                  </p>
                </div>
                <p className="mt-2 text-center text-[11px] text-[var(--ink-soft)]">
                  Tap outside the card or press Esc to close.
                </p>
              </div>
            </div>,
            document.body,
          )
        : null}

      <section
        id="gallery"
        data-scroll-animate="up"
        className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6"
      >
        <SectionHeading title="Gallery" subtitle="A few moments from our journey together." />
        <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {GALLERY_PHOTOS.map((photo) => (
            <GalleryPhotoCard
              key={photo.src}
              src={photo.src}
              alt={photo.alt}
              caption={photo.caption}
              isFeatured={photo.isFeatured}
              objectPosition={photo.objectPosition}
            />
          ))}
        </div>
      </section>

      <section
        id="faq"
        data-scroll-animate="left"
        className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6"
      >
        <SectionHeading title="FAQ" subtitle="A few quick answers before the big day." />
        <div className="mt-7 space-y-3">
          <FaqItem question="What time should I arrive?" answer="Please arrive by 3:30 PM. The ceremony starts at 4:00 PM." />
          <FaqItem
            question="Can I bring a plus-one?"
            answer="Due to limited venue capacity and resources, each invitation is reserved only for the guest name(s) listed and is non-transferable. Thank you for understanding."
          />
          <FaqItem question="Are children invited?" answer="[Clarify if this is adults-only or family-friendly.]" />
          <FaqItem question="Where should I park?" answer="[Add parking details and overflow options.]" />
          <FaqItem
            question="What should I wear?"
            answer="Dress code is Semi-Formal. Any color is welcome, as long as it is pastel."
          />
        </div>
      </section>

      <section
        id="contact"
        data-scroll-animate="right"
        className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6"
      >
        <div
          data-scroll-animate="pop"
          className="rounded-2xl border border-[var(--sand)] bg-[var(--cream)] p-6 text-center"
        >
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--ink-soft)]">Need Help?</p>
          <p className="mt-2 font-display text-4xl text-[var(--ink-deep)]">Contact</p>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-[var(--ink-soft)]">
            For questions, contact{" "}
            <a
              href="https://m.me/DaddyBadekPogi"
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-[var(--ink-deep)] underline decoration-[var(--gold)] underline-offset-4"
            >
              Koya Red
            </a>{" "}
            on Messenger, email{" "}
            <a
              href="mailto:koyaredofficial@gmail.com"
              className="font-semibold text-[var(--ink-deep)] underline decoration-[var(--gold)] underline-offset-4"
            >
              koyaredofficial@gmail.com
            </a>
            , or call/text{" "}
            <a
              href="tel:09510641719"
              className="font-semibold text-[var(--ink-deep)] underline decoration-[var(--gold)] underline-offset-4"
            >
              09510641719
            </a>
            .
          </p>
        </div>
      </section>

      {isPlayerVisible && currentTrack ? (
        <div className="fixed bottom-4 right-4 z-50 w-[min(92vw,370px)]">
          <audio
            ref={audioRef}
            src={currentTrack.streamUrl}
            preload="metadata"
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onError={() => {
              setIsPlaying(false);
              setAutoplayNotice("Unable to play this track. Please try another song.");
            }}
            onEnded={() => {
              setCurrentTrackIndex((current) => {
                if (current + 1 < musicTracks.length) {
                  setShouldAutoplay(true);
                  return current + 1;
                }
                setIsPlaying(false);
                return current;
              });
            }}
          />
          {isPlayerExpanded ? (
            <div className="rounded-2xl border border-[var(--sand)] bg-[var(--cream)]/95 p-4 shadow-xl backdrop-blur">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--ink-soft)]">
                    {currentTrack.isFeatured ? "Our Song" : "Now Playing"}
                  </p>
                  <p className="truncate font-semibold text-[var(--ink-deep)]">{currentTrack.title}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPlayerExpanded(false)}
                  className="rounded-full border border-[var(--sand)] px-2 py-1 text-xs font-semibold text-[var(--ink-soft)] hover:text-[var(--ink-deep)]"
                >
                  Hide
                </button>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleTogglePlayback}
                  className="rounded-full bg-[var(--ink-deep)] px-4 py-2 text-xs font-semibold text-[var(--cream)]"
                >
                  {isPlaying ? "Pause" : "Play"}
                </button>
                <button
                  type="button"
                  onClick={handleNextTrack}
                  disabled={musicTracks.length <= 1}
                  className="rounded-full border border-[var(--sand)] px-4 py-2 text-xs font-semibold text-[var(--ink-deep)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next Song
                </button>
                <button
                  type="button"
                  onClick={handleStopPlayer}
                  className="rounded-full border border-[var(--rosewood)] px-4 py-2 text-xs font-semibold text-[var(--rosewood)]"
                >
                  Stop
                </button>
                {hasMoreSongs ? (
                  <button
                    type="button"
                    onClick={() => setIsPlaylistOpen((current) => !current)}
                    className="rounded-full border border-[var(--gold)] px-4 py-2 text-xs font-semibold text-[var(--ink-deep)]"
                  >
                    {isPlaylistOpen ? "Hide More Songs" : "More Songs"}
                  </button>
                ) : null}
              </div>
              {autoplayNotice ? (
                <p className="mt-2 text-xs text-[var(--rosewood)]">{autoplayNotice}</p>
              ) : null}
              {isPlaylistOpen ? (
                <div className="mt-3 rounded-xl border border-[var(--sand)] bg-[var(--surface-2)] p-2">
                  <p className="px-2 text-[10px] uppercase tracking-[0.14em] text-[var(--ink-soft)]">
                    More Songs
                  </p>
                  <div className="mt-2 space-y-1">
                    {musicTracks.slice(1).map((track, index) => {
                      const trackIndex = index + 1;
                      const isCurrent = trackIndex === currentTrackIndex;
                      return (
                        <button
                          key={track.id}
                          type="button"
                          onClick={() => handleSelectTrack(trackIndex)}
                          className={`block w-full rounded-lg px-3 py-2 text-left text-xs transition ${
                            isCurrent
                              ? "bg-[var(--ink-deep)] text-[var(--cream)]"
                              : "bg-[var(--cream)] text-[var(--ink-deep)] hover:bg-[var(--sand)]/60"
                          }`}
                        >
                          {track.title}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-full border border-[var(--sand)] bg-[var(--cream)]/95 px-2 py-2 shadow-xl backdrop-blur">
              <button
                type="button"
                onClick={() => setIsPlayerExpanded(true)}
                className="min-w-0 flex-1 rounded-full px-2 py-1 text-left"
              >
                <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--ink-soft)]">
                  {isPlaying ? "Playing" : "Paused"}
                </p>
                <p className="truncate text-sm font-semibold text-[var(--ink-deep)]">
                  {currentTrack.title}
                </p>
              </button>
              <button
                type="button"
                onClick={handleTogglePlayback}
                className="rounded-full bg-[var(--ink-deep)] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--cream)]"
              >
                {isPlaying ? "Pause" : "Play"}
              </button>
              <button
                type="button"
                onClick={() => setIsPlayerExpanded(true)}
                className="rounded-full border border-[var(--sand)] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--ink-soft)]"
              >
                Open
              </button>
            </div>
          )}
        </div>
      ) : null}

      <footer
        data-scroll-animate="up"
        className="border-t border-[var(--sand)]/80 px-4 py-8 text-center text-xs text-[var(--ink-soft)] sm:px-6"
      >
        Red & Jess Wedding RSVP
      </footer>
      </div>
    </main>
  );
}

function SectionHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div data-scroll-animate="up">
      <p className="text-xs uppercase tracking-[0.18em] text-[var(--ink-soft)]">Section</p>
      <h2 className="mt-2 font-display text-4xl text-[var(--ink-deep)] sm:text-5xl">{title}</h2>
      <p className="mt-2 max-w-2xl text-sm text-[var(--ink-soft)] sm:text-base">{subtitle}</p>
    </div>
  );
}

function PlaceholderImageCard({
  label,
  note,
  heightClassName,
}: {
  label: string;
  note: string;
  heightClassName: string;
}) {
  return (
    <div
      data-scroll-animate="pop"
      className={`rounded-2xl border border-[var(--sand)] bg-[linear-gradient(135deg,rgba(251,245,236,0.78),rgba(233,218,198,0.62))] p-4 ${heightClassName}`}
    >
      <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-[var(--gold)]/60 bg-[color-mix(in_srgb,var(--surface-2)_70%,transparent)] px-4 text-center">
        <p className="font-display text-2xl text-[var(--ink-deep)]">{label}</p>
        <p className="mt-2 text-xs uppercase tracking-[0.13em] text-[var(--ink-soft)]">{note}</p>
      </div>
    </div>
  );
}

function GalleryPhotoCard({
  src,
  alt,
  caption,
  isFeatured = false,
  objectPosition,
}: {
  src: string;
  alt: string;
  caption: string;
  isFeatured?: boolean;
  objectPosition?: string;
}) {
  return (
    <figure
      data-scroll-animate="pop"
      className={`group relative overflow-hidden rounded-2xl border border-[var(--sand)] bg-[var(--cream)] ${
        isFeatured ? "h-[320px] sm:col-span-2 sm:h-[460px] lg:col-span-2" : "h-[220px]"
      }`}
    >
      <Image
        src={src}
        alt={alt}
        fill
        sizes={isFeatured ? "(max-width: 640px) 100vw, 66vw" : "(max-width: 640px) 100vw, 33vw"}
        className="object-cover object-center transition duration-500 group-hover:scale-[1.03]"
        style={{ objectPosition: objectPosition ?? "50% 25%" }}
      />
      <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent px-4 pb-4 pt-8">
        <p className="text-xs uppercase tracking-[0.15em] text-[var(--cream)]/90">{caption}</p>
      </figcaption>
    </figure>
  );
}

function HeroWeddingPhotoCard() {
  return (
    <div className="relative mx-auto h-[560px] w-full max-w-[440px] sm:h-[640px] sm:max-w-[500px]">
      <div className="relative h-full overflow-hidden">
        <Image
          src="/images/floral-border/tinginan pink roses border.png"
          alt="Red and Jess wedding portrait"
          fill
          priority
          sizes="(max-width: 640px) 100vw, 38vw"
          className="object-contain object-center"
        />
      </div>
    </div>
  );
}

function TimelineItem({ date, text }: { date: string; text: string }) {
  return (
    <div data-scroll-animate="right" className="rounded-2xl border border-[var(--sand)] bg-[var(--cream)] p-4">
      <p className="text-xs uppercase tracking-[0.14em] text-[var(--ink-soft)]">{date}</p>
      <p className="mt-2 text-sm text-[var(--ink-deep)]">{text}</p>
    </div>
  );
}

function VenueMapCard({ ceremonyTimeLabel }: { ceremonyTimeLabel: string }) {
  return (
    <div data-scroll-animate="left" className="rounded-2xl border border-[var(--sand)] bg-[var(--cream)] p-5">
      <p className="font-display text-3xl text-[var(--ink-deep)]">Ceremony & Reception</p>
      <div className="mt-3 space-y-1">
        <p className="text-sm text-[var(--ink-soft)]">{ceremonyTimeLabel}</p>
        <p className="text-sm text-[var(--ink-soft)]">{WEDDING_VENUE_NAME}</p>
        <p className="text-sm text-[var(--ink-soft)]">{WEDDING_VENUE_ADDRESS}</p>
      </div>
      <div className="mt-4 overflow-hidden rounded-xl border border-[var(--sand)] bg-[var(--surface-2)]">
        <iframe
          title="Seville Garden map preview"
          src={WEDDING_MAP_EMBED_URL}
          className="h-[260px] w-full"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>
      <a
        href={WEDDING_MAP_URL}
        target="_blank"
        rel="noreferrer"
        className="mt-4 inline-block rounded-full border border-[var(--gold)] px-4 py-2 text-xs font-semibold text-[var(--ink-deep)]"
      >
        Open in Maps
      </a>
    </div>
  );
}

function ColorMotifCard() {
  return (
    <div data-scroll-animate="up" className="rounded-2xl border border-[var(--sand)] bg-[var(--cream)] p-5">
      <p className="text-xs uppercase tracking-[0.16em] text-[var(--ink-soft)]">Color Motif</p>
      <p className="mt-2 text-lg text-[var(--ink-deep)]">Pastel Colors</p>
      <p className="mt-1 text-sm font-medium text-[var(--ink-deep)]">Dress Code: Semi-Formal</p>
      <p className="mt-4 text-sm text-[var(--ink-soft)]">
        Any color is welcome, as long as it is pastel. Please arrive by 3:30 PM so everyone is
        comfortably seated before the ceremony begins.
      </p>
      <div className="mt-4 overflow-hidden rounded-xl border border-[var(--sand)] bg-[var(--surface-2)] p-3">
        <Image
          src="/images/pastel-color-palette.svg"
          alt="Pastel color palette inspiration"
          width={960}
          height={540}
          className="h-auto w-full rounded-lg border border-[var(--sand)] bg-[var(--surface-2)]"
        />
      </div>
      <p className="mt-3 text-center text-xs uppercase tracking-[0.12em] text-[var(--ink-soft)]">
        Pastel Color Inspiration
      </p>
    </div>
  );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  return (
    <details data-scroll-animate="up" className="rounded-xl border border-[var(--sand)] bg-[var(--cream)] p-4">
      <summary className="cursor-pointer list-none font-medium text-[var(--ink-deep)]">{question}</summary>
      <p className="mt-2 text-sm text-[var(--ink-soft)]">{answer}</p>
    </details>
  );
}

function CountdownUnit({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-[var(--sand)] bg-[var(--surface-2)] px-2 py-2 text-center">
      <p className="text-xl font-semibold tabular-nums text-[var(--ink-deep)]">
        {String(value).padStart(2, "0")}
      </p>
      <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--ink-soft)]">{label}</p>
    </div>
  );
}

function formatWeddingDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const [yearRaw, monthRaw, dayRaw] = value.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return value;
  }

  const utcDate = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(utcDate.getTime())) return value;

  return utcDate.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatWeddingTime(value: string) {
  const parsed = parseWeddingTime(value);
  if (!parsed) return "4:00 PM";

  const date = new Date();
  date.setHours(parsed.hours, parsed.minutes, 0, 0);
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function getCountdownParts(
  weddingDate: string,
  weddingTime: string,
  currentTimeMs: number,
): CountdownParts | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weddingDate)) return null;
  const [yearRaw, monthRaw, dayRaw] = weddingDate.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }

  const parsedTime = parseWeddingTime(weddingTime) ?? parseWeddingTime(DEFAULT_WEDDING_TIME);
  if (!parsedTime) return null;

  const target = new Date(
    year,
    month - 1,
    day,
    parsedTime.hours,
    parsedTime.minutes,
    0,
    0,
  );
  if (Number.isNaN(target.getTime())) return null;

  const diffMs = target.getTime() - currentTimeMs;
  if (diffMs <= 0) {
    return {
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      isComplete: true,
    };
  }

  const totalSeconds = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return {
    days,
    hours,
    minutes,
    seconds,
    isComplete: false,
  };
}

function parseWeddingTime(value: string): { hours: number; minutes: number } | null {
  const matched = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!matched) return null;

  return {
    hours: Number(matched[1]),
    minutes: Number(matched[2]),
  };
}

