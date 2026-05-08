"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  MUSIC_PLAYER_REQUEST_EVENT,
  MUSIC_PLAYER_STATUS_EVENT,
  type MusicPlayerRequestDetail,
  type MusicPlayerStatusDetail,
} from "@/lib/music-player-events";

type MusicTrack = {
  id: string;
  title: string;
  fileName: string;
  streamUrl: string;
  isFeatured: boolean;
};

const PLAYER_VISIBLE_ROUTES = new Set(["/", "/gallery", "/thank-you"]);
const MUSIC_PLAYER_STATE_KEY = "rj_music_player_state_v1";

type PersistedMusicPlayerState = {
  trackId?: string;
  trackIndex?: number;
  currentTime?: number;
  isPlaying?: boolean;
  isPlayerVisible?: boolean;
  isPlayerExpanded?: boolean;
  isPlaylistOpen?: boolean;
};

export function GlobalMusicPlayer() {
  const pathname = usePathname();
  const hasAutoStartedPlayerRef = useRef(false);
  const shouldPlayFeaturedWhenReadyRef = useRef(false);
  const hasHydratedPersistedStateRef = useRef(false);
  const persistedStateRef = useRef<PersistedMusicPlayerState | null>(null);
  const pendingSeekSecondsRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
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
  const [isRingOverlayVisible, setIsRingOverlayVisible] = useState(() => pathname === "/");
  const [isNearHomeTop, setIsNearHomeTop] = useState(() => pathname === "/");

  const currentTrack = useMemo(
    () => musicTracks[currentTrackIndex] ?? null,
    [musicTracks, currentTrackIndex],
  );
  const hasMoreSongs = musicTracks.length > 1;
  const shouldRenderPlayer = PLAYER_VISIBLE_ROUTES.has(pathname);
  const shouldHideControlsForIntro = pathname === "/" && (isRingOverlayVisible || isNearHomeTop);

  const persistPlayerState = useCallback(() => {
    if (typeof window === "undefined") return;

    const audio = audioRef.current;
    const currentTime = audio ? audio.currentTime : 0;
    const stateToPersist: PersistedMusicPlayerState = {
      trackId: currentTrack?.id,
      trackIndex: currentTrackIndex,
      currentTime: Number.isFinite(currentTime) ? Math.max(0, currentTime) : 0,
      isPlaying: audio ? !audio.paused : isPlaying,
      isPlayerVisible,
      isPlayerExpanded,
      isPlaylistOpen,
    };

    try {
      window.localStorage.setItem(MUSIC_PLAYER_STATE_KEY, JSON.stringify(stateToPersist));
    } catch {
      // Best-effort persistence only.
    }
  }, [
    currentTrack,
    currentTrackIndex,
    isPlayerExpanded,
    isPlayerVisible,
    isPlaying,
    isPlaylistOpen,
  ]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(MUSIC_PLAYER_STATE_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored) as PersistedMusicPlayerState;
      persistedStateRef.current = parsed;
    } catch {
      persistedStateRef.current = null;
    }
  }, []);

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

  useEffect(() => {
    const rafId = window.requestAnimationFrame(() => {
      void loadMusicPlaylist();
    });

    return () => window.cancelAnimationFrame(rafId);
  }, [loadMusicPlaylist]);

  useEffect(() => {
    if (pathname !== "/") return;

    const handleOverlayVisibility = (event: Event) => {
      const customEvent = event as CustomEvent<{ visible?: boolean }>;
      setIsRingOverlayVisible(customEvent.detail?.visible ?? true);
    };

    window.addEventListener("ring-overlay-visibility", handleOverlayVisibility);
    return () => window.removeEventListener("ring-overlay-visibility", handleOverlayVisibility);
  }, [pathname]);

  useEffect(() => {
    if (pathname !== "/") return;

    const syncHomeTopVisibility = () => {
      const threshold = window.innerHeight * 0.7;
      setIsNearHomeTop(window.scrollY < threshold);
    };

    syncHomeTopVisibility();
    window.addEventListener("scroll", syncHomeTopVisibility, { passive: true });
    window.addEventListener("resize", syncHomeTopVisibility);

    return () => {
      window.removeEventListener("scroll", syncHomeTopVisibility);
      window.removeEventListener("resize", syncHomeTopVisibility);
    };
  }, [pathname]);

  useEffect(() => {
    if (musicLoading || musicTracks.length === 0) return;

    const featuredTrackIndex = musicTracks.findIndex((track) => track.isFeatured);
    const initialTrackIndex = featuredTrackIndex >= 0 ? featuredTrackIndex : 0;

    if (!hasHydratedPersistedStateRef.current) {
      hasHydratedPersistedStateRef.current = true;
      const persisted = persistedStateRef.current;
      if (persisted) {
        const persistedTrackId = persisted.trackId?.trim();
        const matchedTrackIndex =
          persistedTrackId
            ? musicTracks.findIndex((track) => track.id === persistedTrackId)
            : -1;
        const fallbackTrackIndex =
          typeof persisted.trackIndex === "number" &&
          persisted.trackIndex >= 0 &&
          persisted.trackIndex < musicTracks.length
            ? persisted.trackIndex
            : initialTrackIndex;
        const nextTrackIndex = matchedTrackIndex >= 0 ? matchedTrackIndex : fallbackTrackIndex;
        const persistedCurrentTime = Number(persisted.currentTime);
        pendingSeekSecondsRef.current =
          Number.isFinite(persistedCurrentTime) && persistedCurrentTime > 0
            ? persistedCurrentTime
            : null;

        hasAutoStartedPlayerRef.current = true;
        setCurrentTrackIndex(nextTrackIndex);
        setIsPlayerVisible(persisted.isPlayerVisible ?? true);
        setIsPlayerExpanded(persisted.isPlayerExpanded ?? false);
        setIsPlaylistOpen(persisted.isPlaylistOpen ?? false);
        setShouldAutoplay(Boolean(persisted.isPlaying));
        return;
      }
    }

    if (shouldPlayFeaturedWhenReadyRef.current) {
      shouldPlayFeaturedWhenReadyRef.current = false;
      setCurrentTrackIndex(initialTrackIndex);
      setIsPlayerVisible(true);
      setIsPlayerExpanded(true);
      setIsPlaylistOpen(false);
      setShouldAutoplay(true);
      return;
    }

    if (hasAutoStartedPlayerRef.current) return;
    if (pathname !== "/") return;

    hasAutoStartedPlayerRef.current = true;
    const rafId = window.requestAnimationFrame(() => {
      setCurrentTrackIndex(initialTrackIndex);
      setIsPlayerVisible(true);
      setIsPlayerExpanded(false);
      setIsPlaylistOpen(false);
      setShouldAutoplay(true);
    });

    return () => window.cancelAnimationFrame(rafId);
  }, [musicLoading, musicTracks, pathname]);

  useEffect(() => {
    if (!shouldAutoplay || !currentTrack) return;

    const rafId = window.requestAnimationFrame(() => {
      void tryPlayCurrentTrack();
      setShouldAutoplay(false);
    });

    return () => window.cancelAnimationFrame(rafId);
  }, [currentTrack, shouldAutoplay, tryPlayCurrentTrack]);

  useEffect(() => {
    persistPlayerState();
  }, [persistPlayerState]);

  useEffect(() => {
    const saveOnLeave = () => {
      persistPlayerState();
    };

    window.addEventListener("beforeunload", saveOnLeave);
    window.addEventListener("pagehide", saveOnLeave);
    return () => {
      window.removeEventListener("beforeunload", saveOnLeave);
      window.removeEventListener("pagehide", saveOnLeave);
    };
  }, [persistPlayerState]);

  useEffect(() => {
    if (!shouldRenderPlayer || !isPlayerVisible) return;

    const intervalId = window.setInterval(() => {
      persistPlayerState();
    }, 2000);

    return () => window.clearInterval(intervalId);
  }, [isPlayerVisible, persistPlayerState, shouldRenderPlayer]);

  useEffect(() => {
    const detail: MusicPlayerStatusDetail = {
      loading: musicLoading,
      hasTracks: musicTracks.length > 0,
      error: musicError,
    };
    window.dispatchEvent(
      new CustomEvent<MusicPlayerStatusDetail>(MUSIC_PLAYER_STATUS_EVENT, { detail }),
    );
  }, [musicError, musicLoading, musicTracks.length]);

  useEffect(() => {
    const handlePlayerRequest = (event: Event) => {
      const customEvent = event as CustomEvent<MusicPlayerRequestDetail>;
      if (customEvent.detail?.action !== "playFeatured") return;

      if (musicTracks.length === 0) {
        shouldPlayFeaturedWhenReadyRef.current = true;
        setIsPlayerVisible(true);
        setIsPlayerExpanded(true);
        return;
      }

      const featuredTrackIndex = musicTracks.findIndex((track) => track.isFeatured);
      const initialTrackIndex = featuredTrackIndex >= 0 ? featuredTrackIndex : 0;
      setCurrentTrackIndex(initialTrackIndex);
      setIsPlayerVisible(true);
      setIsPlayerExpanded(true);
      setIsPlaylistOpen(false);
      setShouldAutoplay(true);
    };

    window.addEventListener(MUSIC_PLAYER_REQUEST_EVENT, handlePlayerRequest);
    return () => window.removeEventListener(MUSIC_PLAYER_REQUEST_EVENT, handlePlayerRequest);
  }, [musicTracks]);

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

  if (!shouldRenderPlayer || !isPlayerVisible || !currentTrack) return null;

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 w-[min(92vw,370px)] transition-opacity duration-300 ${
        shouldHideControlsForIntro ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      <audio
        ref={audioRef}
        src={currentTrack.streamUrl}
        preload="metadata"
        onLoadedMetadata={() => {
          const audio = audioRef.current;
          if (!audio) return;
          const pendingSeekSeconds = pendingSeekSecondsRef.current;
          if (pendingSeekSeconds === null) return;
          const safeSeekSeconds = Math.min(
            Math.max(0, pendingSeekSeconds),
            Number.isFinite(audio.duration) && audio.duration > 0
              ? Math.max(0, audio.duration - 0.25)
              : pendingSeekSeconds,
          );
          audio.currentTime = safeSeekSeconds;
          pendingSeekSecondsRef.current = null;
        }}
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
      {shouldHideControlsForIntro ? null : isPlayerExpanded ? (
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
  );
}
