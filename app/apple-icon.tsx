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
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundImage:
            "radial-gradient(circle at 50% 42%, rgba(227, 161, 75, 0.20), rgba(17, 15, 12, 0) 62%)",
          backgroundColor: "#110f0c",
          borderRadius: 40,
          color: "#e3a14b",
          fontSize: 74,
          fontWeight: 650,
          letterSpacing: "-4px",
          marginRight: "-4px",
        }}
      >
        tg
      </div>
    ),
    { ...size },
  );
}
