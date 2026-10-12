import { ImageResponse } from "next/og";

export function generateImageMetadata() {
  return [
    {
      id: "any",
      contentType: "image/png",
      size: { width: 512, height: 512 },
      alt: "the garage",
    },
    {
      id: "maskable",
      contentType: "image/png",
      size: { width: 512, height: 512 },
      alt: "the garage",
    },
  ];
}

export default async function Icon({ id }: { id: Promise<string | number> }) {
  const variant = await id;
  const maskable = variant === "maskable";
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
          borderRadius: maskable ? 0 : 116,
          color: "#e3a14b",
          fontSize: maskable ? 190 : 210,
          fontWeight: 650,
          letterSpacing: "-10px",
          marginRight: "-10px",
        }}
      >
        tg
      </div>
    ),
    { width: 512, height: 512 },
  );
}
