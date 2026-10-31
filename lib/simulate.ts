import { copayApplies } from "./match";
import { CITY_COST_FACTOR, PRIVATE_ROOM_RATE, conditionHolder, eldestAge } from "./profile";
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
  { id: "dengue", title: "Dengue, 4 nights in hospital", icon: "🦟", blurb: "The most common monsoon claim in India", bill: 115000, days: 4, category: "general", who: "eldest", relevant: () => true },
  { id: "cardiac", title: "Heart attack: angioplasty", icon: "🫀", blurb: "Emergency procedure with one stent", bill: 450000, days: 5, category: "cardiac", who: "eldest", ped: ["heart", "bp", "diabetes"], relevant: () => true },
  { id: "knee", title: "Knee replacement", icon: "🦵", blurb: "Very common after 55", bill: 380000, days: 5, category: "knee", who: "parent", relevant: (p) => !!p.cover?.parents || eldestAge(p) >= 50 },
  { id: "cataract", title: "Cataract surgery (one eye)", icon: "👁️", blurb: "A day-care procedure", bill: 75000, days: 0, category: "cataract", who: "parent", relevant: (p) => !!p.cover?.parents || eldestAge(p) >= 50 },
  { id: "diabetes", title: "Diabetes complication", icon: "🩸", blurb: "Kidney infection needing admission", bill: 180000, days: 5, category: "general", who: "eldest", ped: ["diabetes"], relevant: (p) => !!p.conditions?.includes("diabetes") },
  { id: "childbirth", title: "C-section delivery", icon: "👶", blurb: "Including newborn care", bill: 165000, days: 4, category: "maternity", who: "partner", relevant: (p) => !!p.cover?.partner && (p.planningBaby ?? (p.selfAge ?? 40) < 38) },
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
    if (!policy.maternity.covered) return block("Maternity not covered", "maternity", "This policy excludes childbirth entirely.");
    if (opts.year <= (policy.maternity.waitYears ?? 0)) return block(`In ${policy.maternity.waitYears}-year maternity waiting period`, "maternity", `Delivery in year ${opts.year} falls inside the waiting period.`);
  }
  if ((s.category === "knee" || s.category === "cataract") && opts.year <= policy.specificWaitYears)
    return block(`In ${policy.specificWaitYears}-year specified-disease waiting period`, "specific", `Planned ${s.category === "knee" ? "joint replacement" : "cataract"} surgery in year ${opts.year} isn't covered yet.`);
  const patientHasConditions = s.who === "eldest" || conditionHolder(p) === (s.who === "parent" ? "parent" : "self");
  const pedHit = patientHasConditions && s.ped?.some((c) => p.conditions?.includes(c));
  if (pedHit && opts.year <= policy.pedWaitYears)
    return block(`Linked to a pre-existing condition (${policy.pedWaitYears}-year wait)`, "ped", `Insurers treat this as a complication of a declared condition. Year ${opts.year} is inside the waiting period.`);

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
      lines.push({ label: "Room rent above the cap", amount: roomExcess, clauseId: "room", note: `Room costs ₹${Math.round(rate).toLocaleString("en-IN")}/day, policy pays up to ₹${Math.round(cap).toLocaleString("en-IN")}/day.` });
      lines.push({ label: "Proportionate deduction", amount: prop, clauseId: "room", note: `Doctor, surgery and nursing charges are paid only ${Math.round((cap / rate) * 100)}%, because the room exceeded the cap.` });
      admissible -= roomExcess + prop;
    }
  }

  if (!policy.consumablesCovered) {
    const c = bill * 0.06;
    lines.push({ label: "Consumables not paid", amount: c, clauseId: "consumables", note: "Gloves, PPE kits, syringes and similar items." });
    admissible -= c;
  }

  const sub = s.category === "knee" ? policy.sublimits.knee : s.category === "cataract" ? policy.sublimits.cataract : s.category === "cardiac" ? policy.sublimits.cardiac : undefined;
  if (sub && admissible > sub) {
    lines.push({ label: "Above the sub-limit", amount: admissible - sub, clauseId: "sublimits", note: `This procedure is capped at ₹${sub.toLocaleString("en-IN")} regardless of your sum insured.` });
    admissible = sub;
  }
  if (s.category === "maternity" && policy.maternity.limit && admissible > policy.maternity.limit) {
    lines.push({ label: "Above the maternity limit", amount: admissible - policy.maternity.limit, clauseId: "maternity", note: `Delivery is capped at ₹${policy.maternity.limit.toLocaleString("en-IN")}.` });
    admissible = policy.maternity.limit;
  }

  if (copayApplies(policy, age)) {
    const c = admissible * (policy.copay.percent / 100);
    lines.push({ label: `${policy.copay.percent}% co-payment`, amount: c, clauseId: "copay", note: `Applies because the patient is ${age}.` });
    admissible -= c;
  }

  const siAmt = si * 100000;
  if (admissible > siAmt) {
    lines.push({ label: "Above your sum insured", amount: admissible - siAmt, note: `Your cover is ₹${si} lakh.` });
    admissible = siAmt;
  }

  const insurerPays = Math.max(0, Math.round(admissible));
  return { bill, insurerPays, youPay: bill - insurerPays, blocked: false, lines: lines.map((l) => ({ ...l, amount: Math.round(l.amount) })) };
}

export const YEAR_LABEL: Record<number, string> = { 1: "This year", 2: "Next year", 3: "In 2 years", 4: "In 3 years" };

const PHRASE: Record<string, string> = {
  dengue: "spends 4 nights in hospital with dengue",
  cardiac: "needs an angioplasty after a heart attack",
  knee: "needs a knee replacement",
  cataract: "needs cataract surgery",
  diabetes: "is admitted for a diabetes complication",
  childbirth: "has a C-section delivery",
};

/** The single most likely costly event for this family, used to headline each plan. */
export function headlineScenario(p: Profile): { scenario: Scenario; sentence: string; year: number } {
  const id = p.conditions?.includes("diabetes")
    ? "diabetes"
    : p.conditions?.some((c) => c === "heart" || c === "bp")
      ? "cardiac"
      : p.cover?.parents || eldestAge(p) >= 50
        ? "knee"
        : p.planningBaby && p.cover?.partner
          ? "childbirth"
          : "dengue";
  const scenario = SCENARIOS.find((s) => s.id === id)!;
  const who = id === "childbirth" ? "your partner" : scenario.who === "parent" || (scenario.who === "eldest" && p.cover?.parents) ? "your parent" : "you";
  const verb = who === "you" ? PHRASE[id].replace(/^is /, "are ").replace(/^needs/, "need").replace(/^spends/, "spend").replace(/^has/, "have") : PHRASE[id];
  const year = id === "childbirth" ? 3 : 2;
  return { scenario, sentence: `If ${who} ${verb} ${YEAR_LABEL[year].toLowerCase()}`, year };
}
