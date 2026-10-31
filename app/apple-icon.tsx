import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  const u = 1.8;
  return new ImageResponse(
    (
      <div style={{ width: 180, height: 180, background: "#0d0b12", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
        <div style={{ width: 58 * u, height: 58 * u, borderRadius: 999, display: "flex", backgroundImage: "radial-gradient(circle at 30% 28%, #ffc6a8 0%, #ff8a6b 28%, #f49ac1 52%, #b7a6ff 76%, #6a4cff 100%)" }} />
      </div>
    ),
    size,
  );
}
