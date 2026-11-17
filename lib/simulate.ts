import { copayApplies } from "./match";
import { CITY_COST_FACTOR, PRIVATE_ROOM_RATE, conditionHolder, eldestAge, parentName } from "./profile";
import type { Condition, Policy, Profile } from "./types";

export type RoomType = "shared" | "private" | "deluxe";
export const ROOM_FACTOR: Record<RoomType, number> = { shared: 0.5, private: 1, deluxe: 1.7 };

export interface Scenario {
  id: string;
  title: string;
  icon: string;
  blurb: string;
  bill: number; // metro cost
  days: number;
  category: "general" | "knee" | "cataract" | "maternity" | "cardiac";
  who: "self" | "parent" | "partner" | "eldest";
  ped?: Condition[];
  relevant: (p: Profile) => boolean;
}

export const SCENARIOS: Scenario[] = [
  { id: "dengue", title: "Dengue fever, 4 nights in hospital", icon: "🦟", blurb: "Very common in the rainy season", bill: 115000, days: 4, category: "general", who: "eldest", relevant: () => true },
  { id: "cardiac", title: "Heart attack", icon: "🫀", blurb: "Doctors put one tiny tube in the heart", bill: 450000, days: 5, category: "cardiac", who: "eldest", ped: ["heart", "bp", "diabetes"], relevant: () => true },
  { id: "knee", title: "New knee surgery", icon: "🦵", blurb: "Very common after 55", bill: 380000, days: 5, category: "knee", who: "parent", relevant: (p) => !!p.cover?.parents || eldestAge(p) >= 50 || !!p.upcoming?.includes("joint") },
  { id: "cataract", title: "Eye surgery (one eye)", icon: "👁️", blurb: "You go home the same day", bill: 75000, days: 0, category: "cataract", who: "parent", relevant: (p) => !!p.cover?.parents || eldestAge(p) >= 50 || !!p.upcoming?.includes("cataract") },
  { id: "diabetes", title: "Sugar (diabetes) problem", icon: "🩸", blurb: "A kidney infection that needs a hospital stay", bill: 180000, days: 5, category: "general", who: "eldest", ped: ["diabetes"], relevant: (p) => !!p.conditions?.includes("diabetes") },
  { id: "childbirth", title: "Having a baby (C-section)", icon: "👶", blurb: "Care for the new baby too", bill: 165000, days: 4, category: "maternity", who: "partner", relevant: (p) => !!p.cover?.partner && (p.planningBaby ?? (p.selfAge ?? 40) < 38) },
];

export interface SimLine {
  label: string;
  amount: number;
  clauseId?: string;
  note: string;
}

export interface SimResult {
  bill: number;
  insurerPays: number;
  youPay: number;
  blocked: boolean;
  lines: SimLine[];
}

function patientAge(p: Profile, who: Scenario["who"]) {
  if (who === "parent") return p.parentAge ?? eldestAge(p);
  if (who === "eldest") return eldestAge(p);
  return p.selfAge ?? 30;
}

export function simulate(
  policy: Policy,
  si: number,
  p: Profile,
  s: Scenario,
  opts: { year: number; room: RoomType; bill?: number },
): SimResult {
  const city = p.city ?? "tier2";
  const bill = Math.round(opts.bill ?? s.bill * CITY_COST_FACTOR[city]);
  const age = patientAge(p, s.who);
  const lines: SimLine[] = [];
  const block = (label: string, clauseId: string, note: string): SimResult => ({
    bill,
    insurerPays: 0,
    youPay: bill,
    blocked: true,
    lines: [{ label, amount: bill, clauseId, note }],
  });

  // Waiting periods and outright exclusions
  if (s.category === "maternity") {
    if (!policy.maternity.covered) return block("Baby not covered", "maternity", "This plan never pays for having a baby.");
    if (opts.year <= (policy.maternity.waitYears ?? 0)) return block(`Too soon: ${policy.maternity.waitYears}-year wait for a baby`, "maternity", `In year ${opts.year}, the plan pays nothing for a baby yet.`);
  }
  if ((s.category === "knee" || s.category === "cataract") && opts.year <= policy.specificWaitYears)
    return block(`Too soon: ${policy.specificWaitYears}-year wait for this surgery`, "specific", `In year ${opts.year}, the plan pays nothing for ${s.category === "knee" ? "a new knee" : "eye surgery"} yet.`);
  const patientHasConditions = s.who === "eldest" || conditionHolder(p) === (s.who === "parent" ? "parent" : "self");
  const pedHit = patientHasConditions && s.ped?.some((c) => p.conditions?.includes(c));
  if (pedHit && opts.year <= policy.pedWaitYears)
    return block(`Old illness: ${policy.pedWaitYears}-year wait`, "ped", `This comes from an illness you already have. In year ${opts.year}, the plan pays nothing yet.`);

  let admissible = bill;

  // Room rent and proportionate deduction
  if (s.days > 0) {
    const rate = PRIVATE_ROOM_RATE[city] * ROOM_FACTOR[opts.room];
    const cap =
      policy.roomRent.kind === "none"
        ? Infinity
        : policy.roomRent.kind === "single"
          ? PRIVATE_ROOM_RATE[city]
          : ((policy.roomRent.percent ?? 1) / 100) * si * 100000;
    if (rate > cap) {
      const roomExcess = (rate - cap) * s.days;
      const associated = (bill - rate * s.days) * 0.55;
      const prop = associated * (1 - cap / rate);
      lines.push({ label: "Room costs more than allowed", amount: roomExcess, clauseId: "room", note: `The room is ₹${Math.round(rate).toLocaleString("en-IN")} a day. The plan pays up to ₹${Math.round(cap).toLocaleString("en-IN")} a day.` });
      lines.push({ label: "Doctor's bill cut too", amount: prop, clauseId: "room", note: `The room costs too much, so the plan pays only ${Math.round((cap / rate) * 100)}% of doctor, surgery and nurse costs.` });
      admissible -= roomExcess + prop;
    }
  }

  if (!policy.consumablesCovered) {
    const c = bill * 0.06;
    lines.push({ label: "Gloves, masks and needles", amount: c, clauseId: "consumables", note: "This plan doesn't pay for these." });
    admissible -= c;
  }

  const sub = s.category === "knee" ? policy.sublimits.knee : s.category === "cataract" ? policy.sublimits.cataract : s.category === "cardiac" ? policy.sublimits.cardiac : undefined;
  if (sub && admissible > sub) {
    lines.push({ label: "Over the limit for this surgery", amount: admissible - sub, clauseId: "sublimits", note: `The plan pays only up to ₹${sub.toLocaleString("en-IN")} for this, whatever your cover.` });
    admissible = sub;
  }
  if (s.category === "maternity" && policy.maternity.limit && admissible > policy.maternity.limit) {
    lines.push({ label: "Over the limit for a baby", amount: admissible - policy.maternity.limit, clauseId: "maternity", note: `The plan pays only up to ₹${policy.maternity.limit.toLocaleString("en-IN")} for a baby.` });
    admissible = policy.maternity.limit;
  }

  if (copayApplies(policy, age)) {
    const c = admissible * (policy.copay.percent / 100);
    lines.push({ label: `Your ${policy.copay.percent}% share`, amount: c, clauseId: "copay", note: `You pay this part because the patient is ${age}.` });
    admissible -= c;
  }

  const siAmt = si * 100000;
  if (admissible > siAmt) {
    lines.push({ label: "More than your cover", amount: admissible - siAmt, note: `Your cover is ₹${si} lakh.` });
    admissible = siAmt;
  }

  const insurerPays = Math.max(0, Math.round(admissible));
  return { bill, insurerPays, youPay: bill - insurerPays, blocked: false, lines: lines.map((l) => ({ ...l, amount: Math.round(l.amount) })) };
}

export const YEAR_LABEL: Record<number, string> = { 1: "This year", 2: "Next year", 3: "In 2 years", 4: "In 3 years" };

const PHRASE: Record<string, string> = {
  dengue: "spends 4 nights in hospital with dengue",
  cardiac: "has a heart attack",
  knee: "needs a new knee",
  cataract: "needs eye surgery",
  diabetes: "is in hospital with a sugar problem",
  childbirth: "has a baby by C-section",
};

/** The single most likely costly event for this family, used to headline each plan. */
export function headlineScenario(p: Profile): { scenario: Scenario; sentence: string; year: number } {
  // Expected treatment beats statistics: if the family told us what's coming, that's the bill to show.
  const planned = p.upcoming?.includes("joint") ? "knee" : p.upcoming?.includes("heart") ? "cardiac" : p.upcoming?.includes("cataract") ? "cataract" : null;
  const id = planned
    ? planned
    : p.conditions?.includes("diabetes")
    ? "diabetes"
    : p.conditions?.some((c) => c === "heart" || c === "bp")
      ? "cardiac"
      : p.cover?.parents || eldestAge(p) >= 50
        ? "knee"
        : p.planningBaby && p.cover?.partner
          ? "childbirth"
          : "dengue";
  const scenario = SCENARIOS.find((s) => s.id === id)!;
  const who = id === "childbirth" ? "your partner" : (scenario.who === "parent" || scenario.who === "eldest") && p.cover?.parents && conditionHolder(p) === "parent" ? parentName(p) : (scenario.who === "parent" && p.cover?.parents) ? parentName(p) : "you";
  const verb = who === "you" ? PHRASE[id].replace(/^is /, "are ").replace(/^needs/, "need").replace(/^spends/, "spend").replace(/^has/, "have") : PHRASE[id];
  const year = id === "childbirth" ? 3 : 2;
  return { scenario, sentence: `If ${who} ${verb} ${YEAR_LABEL[year].toLowerCase()}`, year };
}

/* Hinglish copy for scenarios, years and the headline sentence */

export const TITLE_HI: Record<string, string> = {
  dengue: "Dengue, 4 raat hospital",
  cardiac: "Heart attack: angioplasty",
  knee: "Knee replacement",
  cataract: "Cataract surgery (ek aankh)",
  diabetes: "Sugar ki complication",
  childbirth: "C-section delivery",
};

export const YEAR_LABEL_HI: Record<number, string> = { 1: "Is saal", 2: "Agle saal", 3: "2 saal baad", 4: "3 saal baad" };

const PHRASE_HI: Record<string, string> = {
  dengue: "dengue se 4 raat hospital mein rahe",
  cardiac: "heart attack ke baad angioplasty karwani pade",
  knee: "knee replacement karwana pade",
  cataract: "cataract surgery karwani pade",
  diabetes: "sugar ki complication se admit ho",
  childbirth: "C-section delivery ho",
};

export const scenarioTitle = (s: Scenario, l: "en" | "hi") => (l === "hi" ? TITLE_HI[s.id] ?? s.title : s.title);
export const yearLabel = (y: number, l: "en" | "hi") => (l === "hi" ? YEAR_LABEL_HI[y] : YEAR_LABEL[y]);

/** The headline sentence in the user's language, e.g. "Agar papa/mummy sugar ki complication se admit ho agle saal". */
export function headlineSentence(p: Profile, l: "en" | "hi") {
  const h = headlineScenario(p);
  if (l === "en") return h.sentence;
  const id = h.scenario.id;
  const who = id === "childbirth" ? "partner ki" : h.scenario.who === "parent" || (h.scenario.who === "eldest" && p.cover?.parents) ? "mummy/papa" : "aap";
  return `Agar ${YEAR_LABEL_HI[h.year].toLowerCase()} ${who} ${PHRASE_HI[id]}`;
}
