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
- partnerAge: number
- conditionWho: "self"|"partner"|"parent" (who has the existing condition)
- upcoming: array of "cataract"|"joint"|"heart" (treatment expected in the next 2 years; [] if they say none)
- existingCover: number in lakh for a personal policy they already hold (0 if none; NOT employer cover)
- savings: "covered"|"partly"|"no" (could savings absorb a ₹5 lakh bill)
- tobacco: bool (anyone covered smokes or uses tobacco)
- income: number, household income per YEAR in rupees (convert monthly to yearly; null if they decline)
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
  if (patch.upcoming?.length === 0 && !said(/surgery|treatment|operation|nothing planned|no surgery/, "upcoming")) delete patch.upcoming;
  if (patch.tobacco === false && !said(/smok|tobacco|cigarette/, "tobacco")) delete patch.tobacco;
  if (patch.existingCover === 0 && !said(/policy|insurance|cover/, "existingCover")) delete patch.existingCover;
  if (patch.income === null && !said(/income|earn|salary|prefer not/, "income")) delete patch.income;
  if (patch.savings && !said(/saving|afford|pay|bill/, "savings")) delete patch.savings;
  if (patch.conditionWho && !said(/mom|mum|mother|dad|father|parent|wife|husband|partner|i have|me/, "conditionWho")) delete patch.conditionWho;

  return Response.json({
    patch: { ...rules, ...patch },
    reply: ai?.reply ?? null,
    source: ai ? "ai" : "rules",
  });
}
