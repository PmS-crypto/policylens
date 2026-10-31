import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  const u = 1.8;
  return new ImageResponse(
    (
      <div style={{ width: 180, height: 180, background: "#0f2b25", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
        <div style={{ width: 46 * u, height: 46 * u, borderRadius: 999, border: `${7 * u}px solid #ffffff`, display: "flex" }} />
        <div style={{ position: "absolute", width: 13 * u, height: 13 * u, borderRadius: 999, background: "#b8913e", right: 24 * u, bottom: 24 * u }} />
      </div>
    ),
    size,
  );
}
