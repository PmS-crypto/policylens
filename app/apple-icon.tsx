import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  const u = 1.8;
  return new ImageResponse(
    (
      <div style={{ width: 180, height: 180, background: "#12312a", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
        <div style={{ position: "absolute", width: 52 * u, height: 14 * u, background: "#f7dc4a", top: 52 * u, left: 24 * u, borderRadius: 3 * u }} />
        <div style={{ width: 46 * u, height: 46 * u, borderRadius: 999, border: `${8 * u}px solid #ffffff`, display: "flex" }} />
      </div>
    ),
    size,
  );
}
