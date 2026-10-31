import type { Clause, Policy } from "./types";

// Keyword → clause routing for the no-LLM fallback and for grounding LLM answers.
const TOPICS: [RegExp, string[]][] = [
  [/room|ward|suite|icu|deluxe|private/, ["room"]],
  [/co-?pay|share|percent|pay (myself|from pocket)|out of pocket|my pocket/, ["copay", "consumables"]],
  [/diabet|sugar|bp|blood pressure|thyroid|heart|asthma|pre-?existing|existing|ped|condition/, ["ped"]],
  [/pregnan|maternity|baby|deliver|c-?section|newborn/, ["maternity"]],
  [/cataract|knee|joint|hernia|surgery|procedure/, ["specific", "sublimits"]],
  [/sub-?limit|cap|limit/, ["sublimits", "room"]],
  [/refill|restor|exhaust|run out|used up/, ["restoration"]],
  [/exclu|not covered|isn't covered|never|cosmetic|dental/, ["exclusions"]],
  [/consumable|gloves|ppe/, ["consumables"]],
  [/bonus|ncb|claim[- ]free/, ["ncb"]],
  [/wait|when|how long|first year|30 days/, ["initial", "ped", "specific"]],
  [/opd|consult|pharmacy|doctor visit/, ["opd"]],
  [/age|old|senior|entry/, ["entry", "copay"]],
];

export function relevantClauses(question: string, policy: Policy): Clause[] {
  const q = question.toLowerCase();
  const ids = new Set<string>();
  for (const [re, cl] of TOPICS) if (re.test(q)) cl.forEach((c) => ids.add(c));
  if (!ids.size) ["room", "copay", "ped", "exclusions"].forEach((c) => ids.add(c));
  return policy.clauses.filter((c) => ids.has(c.id));
}
