import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#110f0c",
          color: "#e3a14b",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 78,
          fontWeight: 650,
          letterSpacing: "-4px",
        }}
      >
        tg
      </div>
    ),
    { ...size },
  );
}
