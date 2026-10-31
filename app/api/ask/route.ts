import { langNote, llm, parseJson, type Lang } from "@/lib/ai";
import { getPolicy } from "@/lib/policies";
import { coverSummary, CONDITION_LABEL } from "@/lib/profile";
import { relevantClauses } from "@/lib/retrieve";
import type { Policy, Profile } from "@/lib/types";

interface Citation {
  policyId: string;
  clauseId: string;
}

const SYSTEM = `You are PolicyLens, a plain-spoken health insurance explainer for Indian customers.
Answer ONLY from the policy clauses provided. If the clauses don't answer it, say so and suggest asking the insurer.
Relate the answer to the user's situation. Use ₹ and Indian number formatting. Be concise: at most 90 words.
Never promise a claim will be paid; say "as per the policy wording".
Return ONLY JSON: {"answer": "...", "citations": [{"policyId":"...","clauseId":"..."}]}.
In the answer you may use **bold** for policy names.`;

export async function POST(req: Request) {
  const { question, policyIds, profile, lang } = (await req.json()) as { question: string; policyIds: string[]; profile: Profile; lang?: Lang };
  const policies = policyIds.map(getPolicy).filter((p): p is Policy => !!p);

  const context = policies
    .map((p) => {
      const cl = relevantClauses(question, p).concat(p.clauses.filter((c) => c.id === "exclusions"));
      const uniq = [...new Map(cl.map((c) => [c.id, c])).values()];
      return `POLICY ${p.id} — ${p.insurer} ${p.name} (doc ${p.docVersion}, verified ${p.lastVerified})\n` +
        uniq.map((c) => `  [${c.id}] §${c.section} ${c.title}: ${c.text}`).join("\n");
    })
    .join("\n\n");

  const user = `User situation: covering ${coverSummary(profile)}; conditions: ${(profile.conditions ?? []).map((c) => CONDITION_LABEL[c]).join(", ") || "none"}; city: ${profile.cityName ?? profile.city ?? "unknown"}.\n\nClauses:\n${context}\n\nQuestion: ${question}`;
  const ai = parseJson<{ answer: string; citations: Citation[] }>(await llm(SYSTEM + langNote(lang), user, 600));
  if (ai?.answer) {
    // Models sometimes cite "§4.1" or "ped" interchangeably; normalise to clause ids we can link to.
    const citations = (ai.citations ?? [])
      .map(({ policyId, clauseId }) => {
        const p = getPolicy(policyId);
        const id = String(clauseId).replace(/^§/, "");
        const c = p?.clauses.find((x) => x.id === id || x.section === id);
        return p && c ? { policyId: p.id, clauseId: c.id } : null;
      })
      .filter((c): c is Citation => !!c);
    return Response.json({ answer: ai.answer, citations, source: "ai" });
  }

  // Fallback: retrieval-only answer that quotes the most relevant clause per policy.
  const citations: Citation[] = [];
  const parts = policies.map((p) => {
    const c = relevantClauses(question, p)[0];
    if (!c) return `**${p.insurer} ${p.name}**: the policy wording doesn't address this directly. Check with the insurer.`;
    citations.push({ policyId: p.id, clauseId: c.id });
    return `**${p.insurer} ${p.name}**, ${c.title} (§${c.section}): ${c.text}`;
  });
  const short = shortAnswer(question, policies);
  return Response.json({
    answer: `${short ? `**Short answer:** ${short}\n\n` : ""}Here's what the policy wording says:\n\n${parts.join("\n\n")}`,
    citations,
    source: "rules",
  });
}

// One-line synthesis from structured policy data for the most common questions.
function shortAnswer(question: string, policies: Policy[]): string | null {
  const q = question.toLowerCase();
  const group = (f: (p: Policy) => string) => {
    const by = new Map<string, string[]>();
    policies.forEach((p) => by.set(f(p), [...(by.get(f(p)) ?? []), p.name]));
    return [...by].map(([v, names]) => `${names.join(" & ")}: ${v}`).join("; ") + ".";
  };
  if (/diabet|sugar|bp|blood pressure|thyroid|heart|asthma|pre-?existing|existing|condition/.test(q))
    return group((p) => `covered after ${p.pedWaitYears} year${p.pedWaitYears > 1 ? "s" : ""}`);
  if (/room|private|suite|deluxe/.test(q))
    return group((p) => (p.roomRent.kind === "none" ? "any room, no cap" : p.roomRent.kind === "single" ? "up to a single private room" : `capped at ${p.roomRent.percent}% of cover per day`));
  if (/co-?pay|pocket/.test(q)) return group((p) => (p.copay.percent ? `${p.copay.percent}% co-pay${p.copay.fromAge ? ` from age ${p.copay.fromAge}` : ""}` : "no co-pay"));
  if (/pregnan|maternity|baby|deliver/.test(q)) return group((p) => (p.maternity.covered ? `up to ₹${p.maternity.limit?.toLocaleString("en-IN")} after ${p.maternity.waitYears} years` : "not covered"));
  if (/knee|joint|cataract/.test(q))
    return group((p) => `after ${p.specificWaitYears} year${p.specificWaitYears > 1 ? "s" : ""}${p.sublimits.knee && /knee|joint/.test(q) ? `, capped at ₹${p.sublimits.knee.toLocaleString("en-IN")}` : p.sublimits.cataract && /cataract/.test(q) ? `, capped at ₹${p.sublimits.cataract.toLocaleString("en-IN")}` : ""}`);
  return null;
}
