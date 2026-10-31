import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PolicyLens",
    short_name: "PolicyLens",
    description: "Health insurance, explained before you buy.",
    start_url: "/",
    display: "standalone",
    background_color: "#0f2b25",
    theme_color: "#0f2b25",
    orientation: "portrait",
    icons: [
      { src: "/pwa-icon/192", sizes: "192x192", type: "image/png" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
