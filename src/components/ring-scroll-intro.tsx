"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type RingSequenceManifest = {
  frameCount: number;
  width: number;
  height: number;
  fps: number;
  pattern: string;
  startIndex: number;
};

type RingScrollIntroProps = {
  weddingDateLabel: string;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function frameUrl(pattern: string, frameNumber: number) {
  return pattern.replace("%04d", String(frameNumber).padStart(4, "0"));
}

function getSequenceBounds(frameCount: number) {
  const startFrameIndex = Math.min(Math.max(0, 4), Math.max(0, frameCount - 1));
  const peakFrameIndex = Math.max(startFrameIndex, frameCount - 1);
  return { startFrameIndex, peakFrameIndex };
}

function emitOverlayVisibility(visible: boolean) {
  window.dispatchEvent(
    new CustomEvent("ring-overlay-visibility", {
      detail: { visible },
    }),
  );
}

export default function RingScrollIntro({
  weddingDateLabel,
}: RingScrollIntroProps) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imagesRef = useRef<Array<HTMLImageElement | null>>([]);
  const frameCountRef = useRef(0);
  const activeFrameRef = useRef(-1);
  const activeParallaxOffsetRef = useRef(Number.NaN);
  const overlayVisibleRef = useRef(true);
  const blendOpacityRef = useRef(0);
  const canvasOpacityRef = useRef(1);
  const textOpacityRef = useRef(1);
  const isReducedMotionRef = useRef(false);
  const [showOverlay, setShowOverlay] = useState(true);
  const [blendOpacity, setBlendOpacity] = useState(0);
  const [canvasOpacity, setCanvasOpacity] = useState(1);
  const [textOpacity, setTextOpacity] = useState(1);

  const drawFrame = useCallback((frameIndex: number, parallaxOffset = 0) => {
    const canvas = canvasRef.current;
    const image = imagesRef.current[frameIndex];
    if (!canvas || !image) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    const devicePixelRatio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const nextWidth = Math.max(1, Math.floor(rect.width * devicePixelRatio));
    const nextHeight = Math.max(1, Math.floor(rect.height * devicePixelRatio));

    if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
      canvas.width = nextWidth;
      canvas.height = nextHeight;
    }

    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);

    const scale =
      Math.max(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight) * 1.06;
    const drawWidth = image.naturalWidth * scale;
    const drawHeight = image.naturalHeight * scale;
    const drawX = (canvas.width - drawWidth) / 2;
    const drawY = (canvas.height - drawHeight) / 2 - parallaxOffset;

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(image, drawX, drawY, drawWidth, drawHeight);
    activeFrameRef.current = frameIndex;
    activeParallaxOffsetRef.current = parallaxOffset;
  }, []);

  const drawFromScroll = useCallback(() => {
    const section = sectionRef.current;
    if (!section) return;

    const rect = section.getBoundingClientRect();
    const scrollableDistance = Math.max(1, rect.height - window.innerHeight);
    const progress = clamp((-rect.top) / scrollableDistance, 0, 1);
    const shouldShowOverlay = progress < 0.999;
    const nextBlendOpacity = clamp((progress - 0.72) / 0.2, 0, 1);
    const nextCanvasOpacity = 1 - clamp((progress - 0.84) / 0.16, 0, 1);
    const nextTextOpacity = 1 - clamp((progress - 0.68) / 0.18, 0, 1);

    if (overlayVisibleRef.current !== shouldShowOverlay) {
      overlayVisibleRef.current = shouldShowOverlay;
      setShowOverlay(shouldShowOverlay);
      emitOverlayVisibility(shouldShowOverlay);
    }

    if (Math.abs(nextBlendOpacity - blendOpacityRef.current) >= 0.02) {
      blendOpacityRef.current = nextBlendOpacity;
      setBlendOpacity(nextBlendOpacity);
    }

    if (Math.abs(nextCanvasOpacity - canvasOpacityRef.current) >= 0.02) {
      canvasOpacityRef.current = nextCanvasOpacity;
      setCanvasOpacity(nextCanvasOpacity);
    }

    if (Math.abs(nextTextOpacity - textOpacityRef.current) >= 0.02) {
      textOpacityRef.current = nextTextOpacity;
      setTextOpacity(nextTextOpacity);
    }

    const frameCount = frameCountRef.current;
    if (frameCount <= 0) return;
    const { startFrameIndex, peakFrameIndex } = getSequenceBounds(frameCount);

    if (isReducedMotionRef.current) {
      if (
        activeFrameRef.current !== startFrameIndex ||
        Number.isFinite(activeParallaxOffsetRef.current)
      ) {
        drawFrame(startFrameIndex, 0);
      }
      return;
    }

    const segmentProgress = progress <= 0.5 ? progress / 0.5 : (progress - 0.5) / 0.5;
    const nextFrame = progress <= 0.5
      ? Math.round(startFrameIndex + (peakFrameIndex - startFrameIndex) * segmentProgress)
      : Math.round(peakFrameIndex + (startFrameIndex - peakFrameIndex) * segmentProgress);
    const parallaxOffset = (progress - 0.5) * 80;
    const needsFrameUpdate = nextFrame !== activeFrameRef.current;
    const needsParallaxUpdate =
      !Number.isFinite(activeParallaxOffsetRef.current) ||
      Math.abs(parallaxOffset - activeParallaxOffsetRef.current) >= 0.75;

    if (needsFrameUpdate || needsParallaxUpdate) {
      drawFrame(nextFrame, parallaxOffset);
    }
  }, [drawFrame]);

  useEffect(() => {
    let isCancelled = false;

    async function loadSequence() {
      const response = await fetch("/ring-sequence/manifest.json", { cache: "force-cache" });
      if (!response.ok) {
        throw new Error("Unable to load ring sequence manifest.");
      }

      const manifest = (await response.json()) as RingSequenceManifest;
      frameCountRef.current = manifest.frameCount;
      imagesRef.current = new Array(manifest.frameCount).fill(null);

      const imagePromises = Array.from({ length: manifest.frameCount }, (_, index) => {
        const sequenceNumber = manifest.startIndex + index;
        const src = frameUrl(manifest.pattern, sequenceNumber);

        return new Promise<void>((resolve) => {
          const image = new Image();
          image.decoding = "async";
          image.onload = () => {
            imagesRef.current[index] = image;
            resolve();
          };
          image.onerror = () => resolve();
          image.src = src;
        });
      });

      await Promise.all(imagePromises);
      if (isCancelled) return;

      const { startFrameIndex } = getSequenceBounds(manifest.frameCount);
      drawFrame(startFrameIndex, 0);
      drawFromScroll();
    }

    void loadSequence().catch((error) => {
      console.error("Ring scroll intro load error:", error);
    });

    return () => {
      isCancelled = true;
    };
  }, [drawFrame, drawFromScroll]);

  useEffect(() => {
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    isReducedMotionRef.current = reducedMotionQuery.matches;

    const handleReducedMotionChange = (event: MediaQueryListEvent) => {
      isReducedMotionRef.current = event.matches;
      drawFromScroll();
    };

    reducedMotionQuery.addEventListener("change", handleReducedMotionChange);

    let animationFrameId = 0;
    const onScrollOrResize = () => {
      if (animationFrameId) return;
      animationFrameId = window.requestAnimationFrame(() => {
        animationFrameId = 0;
        drawFromScroll();
      });
    };

    window.addEventListener("scroll", onScrollOrResize, { passive: true });
    window.addEventListener("resize", onScrollOrResize);

    onScrollOrResize();

    return () => {
      reducedMotionQuery.removeEventListener("change", handleReducedMotionChange);
      window.removeEventListener("scroll", onScrollOrResize);
      window.removeEventListener("resize", onScrollOrResize);
      if (animationFrameId) {
        window.cancelAnimationFrame(animationFrameId);
      }
    };
  }, [drawFromScroll]);

  return (
    <>
      <section
        ref={sectionRef}
        aria-label="Ring cinematic intro"
        className="relative h-[320vh] bg-[linear-gradient(to_bottom,var(--ring-bg)_0%,var(--ring-bg)_76%,var(--background)_100%)]"
      />
      <div
        className={`pointer-events-none fixed inset-0 z-30 overflow-hidden transition-opacity duration-500 ${
          showOverlay ? "opacity-100" : "opacity-0"
        }`}
      >
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" style={{ opacity: canvasOpacity }} />
        <div className="ring-intro-fade absolute inset-0" />
        <div className="absolute inset-0 bg-[var(--background)]" style={{ opacity: blendOpacity }} />
        <div className="absolute inset-0 flex items-center justify-center px-6" style={{ opacity: textOpacity }}>
          <div className="ring-intro-glass text-center text-[#fff6ef]">
            <p className="ring-intro-kicker text-xs uppercase tracking-[0.34em] sm:text-sm">
              Together with their families
            </p>
            <h1 className="ring-intro-couple mt-4 font-display text-5xl leading-[0.95] sm:text-7xl">
              Red & Jess
            </h1>
            <p className="ring-intro-date mt-4 text-sm uppercase tracking-[0.22em] sm:text-base">
              {weddingDateLabel}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
