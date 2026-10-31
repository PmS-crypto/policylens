import { langNote, llm, parseJson, type Lang } from "@/lib/ai";
import { getPolicy } from "@/lib/policies";
import { coverSummary, CONDITION_LABEL } from "@/lib/profile";
import { glossaryAnswer } from "@/lib/glossary";
import { relevantClauses } from "@/lib/retrieve";
import { verifyNumbers } from "@/lib/verify";
import type { Policy, Profile } from "@/lib/types";

interface Citation {
  policyId: string;
  clauseId: string;
}

const SYSTEM = `You are PolicyLens, a health insurance explainer for young Indian customers.
Answer ONLY from the policy clauses provided. If the clauses don't answer it, say so and suggest asking the insurer.
Relate the answer to the user's situation. Use ₹ and Indian number formatting. Be concise: at most 90 words.
Never promise a claim will be paid; say "as per the policy wording".
Return ONLY JSON: {"answer": "...", "citations": [{"policyId":"...","clauseId":"..."}]}.
In the answer you may use **bold** for policy names.`;

const GENERAL = `You are PolicyLens, helping a young Indian person choose health insurance through a short chat.
Mid-way through, they said something that isn't a direct answer: usually a question about an insurance term, a worry, or a side comment.
Reply in at most 45 words.
- If it's a question about an insurance term or how insurance works: explain it plainly. You may use one simple illustrative rupee example (e.g. "20% co-pay on a ₹50,000 bill = you pay ₹10,000").
- If it's about cost or which plan: say we'll show real numbers for their family in a minute. Never quote premiums or prices.
- If it's a feeling, worry or side comment: acknowledge it warmly in one or two sentences, with no numbers at all.
Never invent figures, policies or facts.
Don't recommend specific policies yet. Never end with a question and never repeat our question; we do that ourselves right after your reply. Plain text, no markdown.`;

export async function POST(req: Request) {
  const { question, policyIds, profile, lang, pending } = (await req.json()) as { question: string; policyIds: string[]; profile: Profile; lang?: Lang; pending?: string };

  // Mid-conversation, before any plans exist: answer like a friend, briefly, then hand back to the question.
  if (!policyIds?.length) {
    const ai = await llm(
      GENERAL + langNote(lang),
      `The user is answering this question from us: "${pending ?? ""}"\nInstead they said: """${question}"""`,
      300,
    );
    return Response.json({
      // We re-ask our own question right after, so drop any trailing question the model adds.
      answer: ai?.trim().replace(/(\s*[^.!?]*\?)+\s*$/, "").trim() || glossaryAnswer(question) || "Good question. I'll cover that properly once we've found your plans. For now, let's finish the basics.",
      citations: [],
      source: ai ? "ai" : "rules",
    });
  }
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
  const reply = lang === "hi" ? "\n\nReply in Hinglish written ONLY in Roman (English) letters, like a WhatsApp message. No Devanagari." : "\n\nReply in English.";
  let ai = parseJson<{ answer: string; citations: Citation[] }>(await llm(SYSTEM + langNote(lang), user + reply, 600));
  // Hinglish must stay in Roman script; retry once if the model drifts into Devanagari.
  if (lang === "hi" && ai?.answer && /[\u0900-\u097F]/.test(ai.answer))
    ai = parseJson<{ answer: string; citations: Citation[] }>(await llm(SYSTEM + langNote(lang), user + reply + " Your last reply used Devanagari. Use Roman letters only.", 600)) ?? ai;
  // Number check: every number the AI states must trace to these clauses or the user's own details.
  // One corrective retry; if it still can't be traced, we show the policy's own words instead.
  let replaced: string[] | null = null;
  if (ai?.answer) {
    const check = verifyNumbers(ai.answer, [user]);
    if (!check.ok) {
      const retry = parseJson<{ answer: string; citations: Citation[] }>(
        await llm(SYSTEM + langNote(lang), `${user}${reply}\n\nYour previous answer used numbers that are not in the clauses (${check.unsupported.join(", ")}). Use only numbers that appear in the clauses above.`, 600),
      );
      if (retry?.answer && verifyNumbers(retry.answer, [user]).ok) ai = retry;
      else {
        console.warn("[ask] unverifiable numbers, falling back to clause text:", check.unsupported);
        replaced = check.unsupported;
        ai = null;
      }
    }
  }
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
    // Every answer keeps its receipts: fall back to the best-matching clause per policy if the model gave none.
    const cited = citations.length
      ? citations
      : policies.flatMap((pol) => {
          const c = relevantClauses(question, pol)[0];
          return c ? [{ policyId: pol.id, clauseId: c.id }] : [];
        });
    return Response.json({ answer: ai.answer, citations: cited, source: "ai", checked: true });
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
    checked: true,
    replaced,
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
