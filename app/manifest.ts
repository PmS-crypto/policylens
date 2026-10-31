import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PolicyLens",
    short_name: "PolicyLens",
    description: "Know what you'll pay before you buy health insurance.",
    start_url: "/",
    display: "standalone",
    background_color: "#12312a",
    theme_color: "#12312a",
    orientation: "portrait",
    icons: [
      { src: "/pwa-icon/192", sizes: "192x192", type: "image/png" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
