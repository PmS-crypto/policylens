import { langNote, llm, parseJson, type Lang } from "@/lib/ai";
import { parseFreeText } from "@/lib/parse";
import type { Profile } from "@/lib/types";

const SYSTEM = `You extract a health-insurance buyer profile from what an Indian user types.
Return ONLY a JSON object: {"patch": {...}, "reply": "..."}.
"patch" may contain only these keys, and only when the user clearly stated them:
- cover: {"self":bool,"partner":bool,"kids":bool,"parents":bool}  (who should be insured; "parents only" means self=false)
- selfAge: number, parentAge: number (elder parent), kidsCount: number
- planningBaby: bool
- conditions: array of "diabetes"|"bp"|"thyroid"|"heart"|"asthma" ([] if they say nobody has any)
- city: "metro"|"tier2"|"tier3", cityName: string
- employerCover: number in lakh (0 if none)
- priorities: array of "private_room"|"low_oop"|"ped_fast"|"low_premium"|"maternity"|"restoration"|"network"
- budget: number in rupees per year (null if they're unsure)
"reply" is ONE warm, plain-language sentence (max 25 words) acknowledging what they shared. No jargon, no recommendations, no questions.`;

export async function POST(req: Request) {
  const { text, profile, stepId, lang } = (await req.json()) as { text: string; profile: Profile; stepId?: string; lang?: Lang };
  const rules = parseFreeText(text, stepId);

  const raw = await llm(
    SYSTEM + langNote(lang),
    `Current question id: ${stepId ?? "none"}\nKnown profile: ${JSON.stringify(profile)}\nUser said: """${text}"""`,
    400,
  );
  const ai = parseJson<{ patch?: Partial<Profile>; reply?: string }>(raw);
  const patch = { ...(ai?.patch ?? {}) };

  // LLMs tend to fill "default" values the user never stated, which would skip questions.
  // Keep a defaulted field only if the user said something about it (or we're asking about it).
  const t = text.toLowerCase();
  const said = (re: RegExp, step: string) => re.test(t) || stepId === step;
  if (!patch.priorities?.length) delete patch.priorities;
  if (patch.kidsCount === 0) delete patch.kidsCount;
  if (patch.employerCover === 0 && !said(/company|employer|office|corporate|job|naukri/, "employer")) delete patch.employerCover;
  if (patch.planningBaby === false && !said(/baby|child|bachcha|pregnan/, "baby")) delete patch.planningBaby;
  if (patch.conditions?.length === 0 && !said(/healthy|no |none|nahi|koi/, "conditions")) delete patch.conditions;
  if (patch.budget === null && !said(/budget|sure|pata/, "budget")) delete patch.budget;

  return Response.json({
    patch: { ...rules, ...patch },
    reply: ai?.reply ?? null,
    source: ai ? "ai" : "rules",
  });
}
