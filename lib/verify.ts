/*
  Number checker for AI answers.
  Rule: every number the AI states must trace back to the text we gave it (policy clauses, the
  engine's computed facts, the user's own profile), allowing only plain unit conversions
  (12 months = 1 year, ₹15 lakh = ₹15,00,000). Anything else is treated as invented and rejected.
*/

const UNIT: Record<string, number> = { lakh: 1e5, lac: 1e5, lakhs: 1e5, l: 1e5, k: 1e3, thousand: 1e3, crore: 1e7, cr: 1e7 };

/** Pull every number out of a piece of text, normalised to plain values (₹1.5 lakh → 150000). */
export function extractNumbers(text: string): { raw: string; value: number }[] {
  const clean = text
    .replace(/§\s?[\d.()a-z]+/gi, " ") // clause references like §4.1 or §3.1(a)
    .replace(/\b[A-Z]{2,}-[A-Z0-9.-]+\b/g, " "); // document versions like UHI-MP-v1.7
  const out: { raw: string; value: number }[] = [];
  const re = /(\d[\d,]*(?:\.\d+)?)\s*(lakhs?|lac|crore|cr|thousand|k|l)?\b/gi;
  for (const m of clean.matchAll(re)) {
    const n = parseFloat(m[1].replace(/,/g, ""));
    if (!Number.isFinite(n)) continue;
    const unit = m[2]?.toLowerCase();
    out.push({ raw: m[0].trim(), value: unit ? n * (UNIT[unit] ?? 1) : n });
  }
  return out;
}

function allowedSet(sources: string[]) {
  const set: number[] = [];
  for (const { value } of sources.flatMap(extractNumbers)) {
    set.push(value, value * 12, value / 12, value * 1e5, value / 1e5, value * 100, value / 100);
  }
  return set;
}

const close = (a: number, b: number) => Math.abs(a - b) <= Math.max(1, Math.abs(b) * 0.005);

/** Check an AI answer against its sources. Small counting words ("2 policies") are ignored. */
export function verifyNumbers(answer: string, sources: string[]): { ok: boolean; unsupported: string[] } {
  const allowed = allowedSet(sources);
  const unsupported = extractNumbers(answer)
    .filter(({ value }) => value > 3) // "1 of 3 plans", "2 policies": counts, not claims
    .filter(({ value }) => !allowed.some((a) => close(value, a)))
    .map(({ raw }) => raw);
  return { ok: unsupported.length === 0, unsupported: [...new Set(unsupported)] };
}
