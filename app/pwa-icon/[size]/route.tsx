import { ImageResponse } from "next/og";

// App icon: a lens ring over a highlighter stroke, rendered at the requested size.
export async function GET(_req: Request, { params }: { params: Promise<{ size: string }> }) {
  const size = Math.min(1024, Math.max(48, Number((await params).size) || 512));
  const u = size / 100;
  return new ImageResponse(
    (
      <div style={{ width: size, height: size, background: "#12312a", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
        <div style={{ position: "absolute", width: 52 * u, height: 14 * u, background: "#f7dc4a", top: 52 * u, left: 24 * u, borderRadius: 3 * u }} />
        <div style={{ width: 46 * u, height: 46 * u, borderRadius: 999, border: `${8 * u}px solid #ffffff`, display: "flex" }} />
      </div>
    ),
    { width: size, height: size },
  );
}
