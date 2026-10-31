import { ImageResponse } from "next/og";

// App icon: a lens ring with a gold verification dot, rendered at the requested size.
export async function GET(_req: Request, { params }: { params: Promise<{ size: string }> }) {
  const size = Math.min(1024, Math.max(48, Number((await params).size) || 512));
  const u = size / 100;
  return new ImageResponse(
    (
      <div style={{ width: size, height: size, background: "#0f2b25", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
        <div style={{ width: 46 * u, height: 46 * u, borderRadius: 999, border: `${7 * u}px solid #ffffff`, display: "flex" }} />
        <div style={{ position: "absolute", width: 13 * u, height: 13 * u, borderRadius: 999, background: "#b8913e", right: 24 * u, bottom: 24 * u }} />
      </div>
    ),
    { width: size, height: size },
  );
}
