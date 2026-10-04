import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
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
          fontSize: 220,
          fontWeight: 650,
          letterSpacing: "-12px",
        }}
      >
        tg
      </div>
    ),
    { ...size },
  );
}
