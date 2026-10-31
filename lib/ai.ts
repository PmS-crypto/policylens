// Thin, provider-agnostic LLM call. Uses Sarvam if SARVAM_API_KEY is set, then
// Claude (ANTHROPIC_API_KEY), then OpenAI (OPENAI_API_KEY), otherwise returns null so callers fall back
// to the deterministic rules engine (the demo never breaks without a key).

export function aiProvider(): "sarvam" | "anthropic" | "openai" | null {
  if (process.env.SARVAM_API_KEY) return "sarvam";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.OPENAI_API_KEY) return "openai";
  return null;
}

export async function llm(system: string, user: string, maxTokens = 700): Promise<string | null> {
  const provider = aiProvider();
  try {
    if (provider === "sarvam") {
      const res = await fetch("https://api.sarvam.ai/v1/chat/completions", {
        method: "POST",
        headers: { "content-type": "application/json", "api-subscription-key": process.env.SARVAM_API_KEY! },
        signal: AbortSignal.timeout(15000),
        body: JSON.stringify({
          model: process.env.SARVAM_MODEL || "sarvam-105b-conversations",
          // sarvam-105b reasons before answering, so leave room beyond the visible reply.
          max_tokens: maxTokens * 4,
          temperature: 0.2,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        }),
      });
      if (!res.ok) throw new Error(`sarvam ${res.status}: ${await res.text()}`);
      const data = await res.json();
      const text: string | null = data.choices?.[0]?.message?.content ?? null;
      return text?.replace(/<think>[\s\S]*?<\/think>/g, "").trim() || null;
    }
    if (provider === "anthropic") {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY!,
          "anthropic-version": "2023-06-01",
        },
        signal: AbortSignal.timeout(15000),
        body: JSON.stringify({
          model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
          max_tokens: maxTokens,
          system,
          messages: [{ role: "user", content: user }],
        }),
      });
      if (!res.ok) throw new Error(`anthropic ${res.status}: ${await res.text()}`);
      const data = await res.json();
      return data.content?.map((b: { text?: string }) => b.text ?? "").join("") ?? null;
    }
    if (provider === "openai") {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        signal: AbortSignal.timeout(15000),
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || "gpt-4o-mini",
          max_tokens: maxTokens,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        }),
      });
      if (!res.ok) throw new Error(`openai ${res.status}: ${await res.text()}`);
      const data = await res.json();
      return data.choices?.[0]?.message?.content ?? null;
    }
  } catch (e) {
    console.error("[llm]", e);
  }
  return null;
}

export function parseJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]) as T;
  } catch {
    return null;
  }
}

export type Lang = "en" | "hi"; // "hi" = Hinglish (Roman script)

/** Voice + language instructions appended to every system prompt. */
export const langNote = (lang?: Lang) =>
  "\n\nVoice: a smart, warm friend in their late twenties who happens to know insurance inside out. Conversational and direct, short sentences, zero corporate jargon. A light young touch is fine (\"real talk\", \"honestly\", \"heads up\") but stay credible: no slang overload, no emojis, never flippant about health or money." +
  (lang === "hi"
    ? "\nLanguage: Hinglish, the way young urban Indians text. Hindi written in Roman (Latin) script, naturally mixed with English words (policy, cover, claim, premium, hospital stay in English). NEVER use Devanagari script. Example tone: \"Seedhi baat: yeh plan 1 saal baad hi diabetes cover karega.\" Keep policy names, ₹ amounts, § numbers and JSON keys unchanged."
    : "\nLanguage: English.");
