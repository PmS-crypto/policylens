// Voice input: browser-recorded audio (WebM/Opus or MP4/AAC) → Sarvam speech-to-text.
// Works in every browser that can record, including iOS Safari, and handles Indian accents well.

export async function POST(req: Request) {
  const key = process.env.SARVAM_API_KEY;
  if (!key) return Response.json({ error: "Voice input needs a Sarvam API key." }, { status: 501 });

  const form = await req.formData().catch(() => null);
  const audio = form?.get("file");
  if (!(audio instanceof Blob) || audio.size === 0) return Response.json({ error: "No audio received." }, { status: 400 });

  const body = new FormData();
  body.append("file", audio, (audio as File).name || "voice.webm");
  body.append("model", "saarika:v2.5");
  body.append("language_code", "en-IN");

  try {
    const res = await fetch("https://api.sarvam.ai/speech-to-text", {
      method: "POST",
      headers: { "api-subscription-key": key },
      body,
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) throw new Error(`sarvam stt ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return Response.json({ text: (data.transcript ?? "").trim() });
  } catch (e) {
    console.error("[transcribe]", e);
    return Response.json({ error: "Couldn't transcribe that. Try again, or type it." }, { status: 502 });
  }
}
