import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

const particles = [
  { x: 0.16, y: 0.2, size: 8, speed: 0.65, offset: 12 },
  { x: 0.28, y: 0.72, size: 5, speed: 0.9, offset: 40 },
  { x: 0.38, y: 0.35, size: 7, speed: 0.75, offset: 100 },
  { x: 0.52, y: 0.64, size: 6, speed: 0.82, offset: 62 },
  { x: 0.64, y: 0.28, size: 9, speed: 0.58, offset: 150 },
  { x: 0.75, y: 0.6, size: 6, speed: 0.95, offset: 18 },
  { x: 0.83, y: 0.4, size: 5, speed: 0.72, offset: 88 },
  { x: 0.9, y: 0.24, size: 10, speed: 0.45, offset: 140 },
];

export const WeddingRingCinematic: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();

  const driftX = Math.sin(frame / 55) * 34;
  const driftY = Math.cos(frame / 47) * 22;
  const subtleZoom = 1 + 0.018 * Math.sin(frame / 100);

  const introOpacity = interpolate(frame, [0, 22], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  const ringSpin = interpolate(frame, [0, durationInFrames], [0, 360], {
    extrapolateRight: "extend",
  });

  const ringTilt = 14 + Math.sin(frame / 38) * 3.5;
  const ringPulse = 1 + Math.sin(frame / 26) * 0.012;

  const flareX = width * (0.5 + Math.sin(frame / 95) * 0.14);
  const flareY = height * (0.5 + Math.cos(frame / 110) * 0.08);

  return (
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(circle at 50% 52%, #31231a 0%, #1f1712 38%, #100d0a 62%, #080707 100%)",
        overflow: "hidden",
        opacity: introOpacity,
      }}
    >
      <AbsoluteFill
        style={{
          transform: `translate(${driftX}px, ${driftY}px) scale(${subtleZoom})`,
        }}
      >
        <AbsoluteFill
          style={{
            background:
              "radial-gradient(circle at 20% 18%, rgba(253, 214, 146, 0.2) 0%, rgba(253, 214, 146, 0) 42%), radial-gradient(circle at 84% 72%, rgba(241, 181, 89, 0.14) 0%, rgba(241, 181, 89, 0) 48%)",
          }}
        />

        <AbsoluteFill>
          {particles.map((particle, index) => {
            const f = frame * particle.speed + particle.offset;
            const yDrift = Math.sin(f / 23) * 40;
            const xDrift = Math.cos(f / 31) * 22;
            const alpha = 0.2 + 0.18 * (Math.sin(f / 20) * 0.5 + 0.5);

            return (
              <div
                key={index}
                style={{
                  position: "absolute",
                  left: particle.x * width + xDrift,
                  top: particle.y * height + yDrift,
                  width: particle.size,
                  height: particle.size,
                  borderRadius: "9999px",
                  background: "rgba(255, 231, 186, 0.95)",
                  filter: "blur(0.8px)",
                  opacity: alpha,
                  boxShadow: "0 0 18px rgba(255, 214, 148, 0.65)",
                }}
              />
            );
          })}
        </AbsoluteFill>

        <AbsoluteFill
          style={{
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <div
            style={{
              width: 480,
              height: 480,
              borderRadius: "50%",
              background:
                "conic-gradient(from 0deg, #f8d081 0deg, #f0bb5f 75deg, #fff2bf 132deg, #e4a74e 192deg, #ffd893 252deg, #f6c76f 360deg)",
              transform: `rotate(${ringSpin}deg) rotateX(${ringTilt}deg) scale(${ringPulse})`,
              boxShadow:
                "0 0 80px rgba(251, 199, 120, 0.45), inset 0 0 40px rgba(255, 249, 219, 0.35), inset 0 0 120px rgba(150, 91, 26, 0.35)",
              position: "relative",
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 110,
                borderRadius: "50%",
                background:
                  "radial-gradient(circle at 45% 40%, rgba(24, 19, 15, 0.9) 0%, rgba(11, 10, 9, 1) 90%)",
                boxShadow: "inset 0 0 16px rgba(0,0,0,0.5)",
              }}
            />
          </div>
        </AbsoluteFill>

        <AbsoluteFill
          style={{
            pointerEvents: "none",
            background: `radial-gradient(circle at ${flareX}px ${flareY}px, rgba(255, 221, 160, 0.17) 0%, rgba(255, 221, 160, 0) 36%)`,
          }}
        />

        <AbsoluteFill
          style={{
            pointerEvents: "none",
            boxShadow: "inset 0 0 220px rgba(0, 0, 0, 0.72)",
          }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const verticalParticles = [
  { x: 0.14, y: 0.12, size: 6, speed: 0.8, offset: 0 },
  { x: 0.22, y: 0.34, size: 8, speed: 0.62, offset: 48 },
  { x: 0.31, y: 0.22, size: 5, speed: 0.95, offset: 91 },
  { x: 0.47, y: 0.78, size: 7, speed: 0.7, offset: 26 },
  { x: 0.62, y: 0.28, size: 6, speed: 0.88, offset: 132 },
  { x: 0.76, y: 0.52, size: 9, speed: 0.58, offset: 67 },
  { x: 0.82, y: 0.16, size: 6, speed: 0.84, offset: 153 },
  { x: 0.9, y: 0.62, size: 7, speed: 0.73, offset: 39 },
];

export const WeddingRingVertical: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();
  const base = Math.min(width, height);

  const moveX = Math.sin(frame / 66) * 26;
  const moveY = Math.cos(frame / 52) * 16;
  const zoom = 1 + Math.sin(frame / 130) * 0.02;

  const intro = interpolate(frame, [0, 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  const spin = interpolate(frame, [0, durationInFrames], [0, 300], {
    extrapolateRight: "extend",
  });

  const tilt = 16 + Math.sin(frame / 40) * 4;
  const scalePulse = 1 + Math.sin(frame / 24) * 0.01;
  const ringSize = base * 0.64;
  const innerInset = ringSize * 0.23;

  return (
    <AbsoluteFill
      style={{
        overflow: "hidden",
        opacity: intro,
        background:
          "radial-gradient(circle at 50% 54%, #231611 0%, #140f0c 42%, #0a0807 70%, #050404 100%)",
      }}
    >
      <AbsoluteFill
        style={{
          transform: `translate(${moveX}px, ${moveY}px) scale(${zoom})`,
        }}
      >
        <AbsoluteFill
          style={{
            background:
              "radial-gradient(circle at 24% 20%, rgba(245, 219, 173, 0.12) 0%, rgba(245, 219, 173, 0) 40%), radial-gradient(circle at 82% 68%, rgba(255, 199, 143, 0.14) 0%, rgba(255, 199, 143, 0) 44%)",
          }}
        />

        <AbsoluteFill>
          {verticalParticles.map((particle, index) => {
            const p = frame * particle.speed + particle.offset;
            const px = particle.x * width + Math.cos(p / 27) * 20;
            const py = particle.y * height + Math.sin(p / 19) * 32;
            const alpha = 0.18 + 0.22 * (Math.sin(p / 17) * 0.5 + 0.5);

            return (
              <div
                key={index}
                style={{
                  position: "absolute",
                  left: px,
                  top: py,
                  width: particle.size,
                  height: particle.size,
                  borderRadius: "9999px",
                  background: "rgba(255, 232, 197, 0.95)",
                  opacity: alpha,
                  filter: "blur(0.7px)",
                  boxShadow: "0 0 14px rgba(255, 210, 152, 0.6)",
                }}
              />
            );
          })}
        </AbsoluteFill>

        <AbsoluteFill
          style={{
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <div
            style={{
              width: ringSize,
              height: ringSize,
              borderRadius: "50%",
              position: "relative",
              background:
                "conic-gradient(from 0deg, #f0cb8a 0deg, #e9b66a 78deg, #fff0c8 126deg, #dfa05a 188deg, #ffd99f 252deg, #f2bf73 360deg)",
              transform: `rotate(${spin}deg) rotateX(${tilt}deg) scale(${scalePulse})`,
              boxShadow:
                "0 0 90px rgba(244, 187, 111, 0.36), inset 0 0 44px rgba(255, 243, 210, 0.34), inset 0 0 110px rgba(120, 72, 26, 0.34)",
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: innerInset,
                borderRadius: "50%",
                background:
                  "radial-gradient(circle at 45% 40%, rgba(24, 18, 14, 0.94) 0%, rgba(8, 7, 7, 1) 92%)",
                boxShadow: "inset 0 0 16px rgba(0, 0, 0, 0.45)",
              }}
            />
          </div>
        </AbsoluteFill>

        <AbsoluteFill
          style={{
            pointerEvents: "none",
            background: `radial-gradient(circle at ${width * (0.5 + Math.sin(frame / 80) * 0.12)}px ${
              height * (0.52 + Math.cos(frame / 96) * 0.1)
            }px, rgba(255, 222, 173, 0.16) 0%, rgba(255, 222, 173, 0) 34%)`,
          }}
        />

        <AbsoluteFill
          style={{
            pointerEvents: "none",
            boxShadow: "inset 0 0 220px rgba(0, 0, 0, 0.72)",
          }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const WeddingRingFromReference: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();

  const intro = interpolate(frame, [0, 22], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  const driftY = Math.sin(frame / 56) * 12;
  const driftX = Math.cos(frame / 71) * 9;
  const zoom = 1.02 + Math.sin(frame / 120) * 0.02;
  const shimmerX = interpolate(frame % durationInFrames, [0, durationInFrames], [-0.3 * width, 1.2 * width], {
    extrapolateRight: "extend",
  });

  return (
    <AbsoluteFill
      style={{
        opacity: intro,
        overflow: "hidden",
        background:
          "radial-gradient(circle at 50% 52%, #504f52 0%, #3d3d41 35%, #2f3034 62%, #26272a 100%)",
      }}
    >
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(circle at 22% 22%, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 38%), radial-gradient(circle at 80% 70%, rgba(255, 236, 194, 0.12) 0%, rgba(255,236,194,0) 45%)",
        }}
      />

      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          transform: `translate(${driftX}px, ${driftY}px) scale(${zoom})`,
        }}
      >
        <Img
          src={staticFile("ring-reference.png")}
          style={{
            width: "86%",
            height: "86%",
            objectFit: "contain",
            filter: "drop-shadow(0 24px 40px rgba(0,0,0,0.35))",
          }}
        />
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          pointerEvents: "none",
          background: `linear-gradient(105deg, rgba(255,255,255,0) 38%, rgba(255,255,255,0.22) 49%, rgba(255,255,255,0) 60%)`,
          transform: `translateX(${shimmerX}px)`,
          mixBlendMode: "screen",
        }}
      />

      <AbsoluteFill
        style={{
          pointerEvents: "none",
          boxShadow: "inset 0 0 170px rgba(0, 0, 0, 0.36)",
        }}
      />
    </AbsoluteFill>
  );
};
