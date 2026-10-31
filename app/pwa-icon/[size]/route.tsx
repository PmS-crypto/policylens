import { ImageResponse } from "next/og";

// App icon: the breathing aura orb, rendered at the requested size.
export async function GET(_req: Request, { params }: { params: Promise<{ size: string }> }) {
  const size = Math.min(1024, Math.max(48, Number((await params).size) || 512));
  const u = size / 100;
  return new ImageResponse(
    (
      <div style={{ width: size, height: size, background: "#0d0b12", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
        <div style={{ width: 58 * u, height: 58 * u, borderRadius: 999, display: "flex", backgroundImage: "radial-gradient(circle at 30% 28%, #ffc6a8 0%, #ff8a6b 28%, #f49ac1 52%, #b7a6ff 76%, #6a4cff 100%)" }} />
      </div>
    ),
    { width: size, height: size },
  );
}
