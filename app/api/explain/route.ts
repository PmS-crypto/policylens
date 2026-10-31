import { langNote, llm, type Lang } from "@/lib/ai";
import { matchPolicies } from "@/lib/match";
import { CONDITION_LABEL, PRIORITY_LABEL, coverSummary, effectivePriorities } from "@/lib/profile";
import type { Profile } from "@/lib/types";

const SYSTEM = `You write the "Why this fits you" note for a health insurance recommendation in India.
Use ONLY the facts given. Speak directly to the user ("you"). 2–3 sentences, max 60 words.
First sentence: connect the policy to what they told us. Last sentence: the single most important trade-off, honestly.
No hype, no guarantees, no markdown.`;

export async function POST(req: Request) {
  const { profile, lang } = (await req.json()) as { profile: Profile; lang?: Lang };
  const { matches } = matchPolicies(profile);
  const top = matches.slice(0, 3);
  const pri = effectivePriorities(profile).map((p) => PRIORITY_LABEL[p]);

  const notes = await Promise.all(
    top.map(async (m) => {
      const good = m.reasons.filter((r) => r.kind === "good");
      const bad = m.reasons.filter((r) => r.kind !== "good");
      const facts = `User: covering ${coverSummary(profile)}; conditions ${(profile.conditions ?? []).map((c) => CONDITION_LABEL[c]).join(", ") || "none"}; priorities ${pri.join(", ") || "none stated"}.
Policy: ${m.policy.insurer} ${m.policy.name}, ₹${m.sumInsured}L cover, est. ₹${m.premium}/yr, label "${m.label}".
Strengths: ${good.map((r) => `${r.title} (${r.detail})`).join("; ") || "none"}.
Trade-offs: ${bad.map((r) => `${r.title} (${r.detail})`).join("; ") || "none"}.`;
      const ai = await llm(SYSTEM + langNote(lang), facts, 250);
      return { policyId: m.policy.id, note: ai?.trim() || fallback(profile, pri, good.map((r) => r.title), bad[0]?.title), source: ai ? "ai" : "rules" };
    }),
  );
  return Response.json({ notes });
}

function fallback(p: Profile, pri: string[], good: string[], tradeoff?: string) {
  const asked = pri.length ? `You told us ${pri.slice(0, 2).join(" and ").toLowerCase()} matter most.` : `You're covering ${coverSummary(p).toLowerCase()}.`;
  const why = good.length ? ` This plan delivers on that: ${good.slice(0, 2).map(lc).join(", ")}.` : "";
  const trade = tradeoff ? ` The trade-off to accept: ${lc(tradeoff)}.` : " We found no major trade-off for your situation.";
  return asked + why + trade;
}

// Lower-case only the leading word so names like "Diabetes" or "BP" keep their case.
const lc = (s: string) => (/^(No|Fits|Cover|Single|Room|Maternity|Consumables|Hidden|Lowest)\b/.test(s) ? s[0].toLowerCase() + s.slice(1) : s);
