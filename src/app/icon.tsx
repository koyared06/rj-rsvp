import { ImageResponse } from "next/og";

export const size = {
  width: 64,
  height: 64,
};

export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #2a1b17 0%, #4a2a23 100%)",
          color: "#f7ebd8",
          fontSize: 24,
          fontWeight: 700,
          letterSpacing: "-0.5px",
        }}
      >
        R&J
      </div>
    ),
    {
      ...size,
    }
  );
}
