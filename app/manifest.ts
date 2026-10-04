import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "the garage",
    short_name: "tg",
    description: "CrossFit for KT and HT.",
    start_url: "/",
    display: "standalone",
    background_color: "#110f0c",
    theme_color: "#110f0c",
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
