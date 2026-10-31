import { POLICIES } from "./policies";
import {
  CITY_LABEL,
  CONDITION_LABEL,
  PRIVATE_ROOM_RATE,
  conditionHolder,
  effectivePriorities,
  eldestAge,
  inr,
  memberCounts,
  recommendSumInsured,
  youngestAge,
} from "./profile";
import { headlineScenario, simulate } from "./simulate";
import type { Excluded, Match, Policy, Priority, Profile, Reason } from "./types";

const SI_FACTOR: Record<number, number> = { 3: 0.6, 5: 0.75, 10: 1, 15: 1.15, 25: 1.32, 50: 1.6 };
const CITY_PREMIUM: Record<string, number> = { metro: 1.12, tier2: 1, tier3: 0.9 };

export function premiumFor(policy: Policy, p: Profile, si: number): number {
  const age = eldestAge(p);
  const { adults, kids } = memberCounts(p);
  const ageFactor = Math.max(0.8, policy.ageSlope ** (age - 30));
  const memberFactor = 1 + 0.6 * (adults - 1) + 0.25 * kids;
  const raw = policy.basePremium * ageFactor * memberFactor * (SI_FACTOR[si] ?? 1) * CITY_PREMIUM[p.city ?? "tier2"];
  return Math.round(raw / 100) * 100;
}

export const pickSumInsured = (policy: Policy, target: number) =>
  policy.siOptions.find((o) => o >= target) ?? policy.siOptions[policy.siOptions.length - 1];

/** Age at which co-pay starts biting for the eldest covered member, or null if never. */
export function copayApplies(policy: Policy, age: number) {
  if (!policy.copay.percent) return false;
  return policy.copay.fromAge === undefined || age >= policy.copay.fromAge;
}

interface Dim {
  key: Priority | "sublimits" | "headline";
  score: number;
  reason?: Reason;
}

function evaluate(policy: Policy, p: Profile, si: number, premium: number, cheapest: number): Dim[] {
  const dims: Dim[] = [];
  const pri = new Set(effectivePriorities(p));
  const city = p.city ?? "tier2";
  const roomRate = PRIVATE_ROOM_RATE[city];
  const eldest = eldestAge(p);

  // Room rent
  if (policy.roomRent.kind === "none") {
    dims.push({ key: "private_room", score: 1, reason: { kind: "good", title: "No room-rent cap", detail: pri.has("private_room") ? "You wanted a private room. Any room category is paid in full, with no deductions on the rest of your bill." : "Any room category is paid in full, so the rest of your bill is never cut proportionately.", clauseId: "room", priority: "private_room" } });
  } else if (policy.roomRent.kind === "single") {
    dims.push({ key: "private_room", score: 0.8, reason: { kind: "good", title: "Single private room covered", detail: "A standard private room is fully paid. Only upgrading to a deluxe room or suite triggers deductions.", clauseId: "room", priority: "private_room" } });
  } else {
    const cap = ((policy.roomRent.percent ?? 1) / 100) * si * 100000;
    const ok = cap >= roomRate;
    dims.push({
      key: "private_room",
      score: ok ? 0.55 : 0.15,
      reason: ok
        ? { kind: "caveat", title: `Room capped at ${inr(cap)}/day`, detail: `That covers a typical private room in a ${CITY_LABEL[city].toLowerCase()} (~${inr(roomRate)}) today, with little headroom as hospital tariffs rise.`, clauseId: "room", priority: "private_room" }
        : { kind: "bad", title: `Room capped at ${inr(cap)}/day`, detail: `A private room in a ${CITY_LABEL[city].toLowerCase()} costs ~${inr(roomRate)}/day. Choosing one cuts your whole claim proportionately, not just the room charge.`, clauseId: "room", priority: "private_room" },
    });
  }

  // Co-pay
  if (!policy.copay.percent) {
    dims.push({ key: "low_oop", score: 1, reason: { kind: "good", title: "No co-payment", detail: "The insurer pays the full admissible bill, at any age.", clauseId: "copay", priority: "low_oop" } });
  } else if (copayApplies(policy, eldest)) {
    const s = policy.copay.percent >= 20 ? 0.15 : 0.45;
    dims.push({ key: "low_oop", score: s, reason: { kind: "bad", title: `${policy.copay.percent}% co-pay on every claim`, detail: `${p.cover?.parents ? "For your parents" : "For you"}, ${policy.copay.percent}% of each admissible bill comes out of your pocket. On a ₹4L surgery that's ${inr(400000 * policy.copay.percent / 100)}.`, clauseId: "copay", priority: "low_oop" } });
  } else {
    const yrs = (policy.copay.fromAge ?? 0) - eldest;
    dims.push({ key: "low_oop", score: yrs <= 6 ? 0.55 : 0.8, reason: { kind: "caveat", title: `${policy.copay.percent}% co-pay from age ${policy.copay.fromAge}`, detail: yrs <= 6 ? `Your eldest member reaches ${policy.copay.fromAge} in about ${yrs} years. After that you pay ${policy.copay.percent}% of every claim.` : `Doesn't apply to you today, only to members aged ${policy.copay.fromAge}+.`, clauseId: "copay", priority: "low_oop" } });
  }

  // Pre-existing disease waiting period
  if (p.conditions?.length) {
    const y = policy.pedWaitYears;
    const conds = p.conditions.map((c) => CONDITION_LABEL[c]).join(" & ");
    const who = conditionHolder(p) === "parent" ? "your parent's" : "your";
    const s = y <= 1 ? 1 : y === 2 ? 0.7 : y === 3 ? 0.35 : 0.1;
    dims.push({ key: "ped_fast", score: s, reason: { kind: y <= 1 ? "good" : y === 2 ? "caveat" : "bad", title: `${conds} covered after ${y} year${y > 1 ? "s" : ""}`, detail: y <= 1 ? `Treatment for ${who} ${conds.toLowerCase()} is covered from year 2, one of the shortest waits available.` : `Any hospitalisation linked to ${who} ${conds.toLowerCase()} is not paid for the first ${y} years. You'd bear that cost fully.`, clauseId: "ped", priority: "ped_fast" } });
  }

  // Maternity
  if (pri.has("maternity")) {
    const m = policy.maternity;
    if (!m.covered) dims.push({ key: "maternity", score: 0, reason: { kind: "bad", title: "No maternity cover", detail: "You mentioned planning a baby. Delivery costs (₹60k–2L) would be fully out of pocket.", clauseId: "maternity", priority: "maternity" } });
    else dims.push({ key: "maternity", score: (m.waitYears ?? 0) <= 2 ? 1 : 0.6, reason: { kind: (m.waitYears ?? 0) <= 2 ? "good" : "caveat", title: `Maternity up to ${inr(m.limit ?? 0)} after ${m.waitYears} years`, detail: (m.waitYears ?? 0) <= 2 ? "Among the shortest maternity waits. Buy now and a delivery from year 3 onwards is covered, newborn included." : `If you're planning within ${m.waitYears} years, the delivery won't be covered. Buying early matters.`, clauseId: "maternity", priority: "maternity" } });
  }

  // Premium vs budget
  if (p.budget) {
    const r = premium / p.budget;
    dims.push({ key: "low_premium", score: r <= 1 ? 1 : r <= 1.2 ? 0.5 : 0.1, reason: { kind: r <= 1 ? "good" : r <= 1.2 ? "caveat" : "bad", title: r <= 1 ? "Fits your budget" : `${Math.round((r - 1) * 100)}% over budget`, detail: `Estimated ${inr(premium)}/year against your ${inr(p.budget)} budget.`, priority: "low_premium" } });
  } else {
    dims.push({ key: "low_premium", score: cheapest / premium, reason: pri.has("low_premium") ? { kind: premium === cheapest ? "good" : "caveat", title: premium === cheapest ? "Lowest premium of your options" : `${inr(premium - cheapest)} more than the cheapest option`, detail: `Estimated ${inr(premium)}/year.`, priority: "low_premium" } : undefined });
  }

  // Restoration
  const rs = policy.restoration === "unlimited" ? 1 : policy.restoration === "once" ? 0.5 : 0;
  dims.push({ key: "restoration", score: rs, reason: pri.has("restoration") || rs === 0 ? { kind: rs === 1 ? "good" : rs === 0.5 ? "caveat" : "bad", title: rs === 1 ? "Cover refills unlimited times" : rs === 0.5 ? "Cover refills once a year" : "Cover doesn't refill", detail: rs === 0 ? "If one claim uses up your sum insured, everyone else on the policy is uncovered for the rest of the year." : rs === 1 ? "If one person's claim uses up the cover, it resets for the next unrelated illness." : "One reset per year, only for an unrelated illness.", clauseId: "restoration", priority: "restoration" } : undefined });

  // Network
  dims.push({ key: "network", score: Math.min(1, policy.network / 11000), reason: pri.has("network") ? { kind: policy.network >= 9500 ? "good" : "caveat", title: `${policy.network.toLocaleString("en-IN")} cashless hospitals`, detail: policy.network >= 9500 ? "A large network means cashless treatment is more likely near you." : "Smaller network: check your preferred hospital is listed before buying." , priority: "network" } : undefined });

  // Sub-limits
  const subs = Object.entries(policy.sublimits);
  if (subs.length) {
    const txt = subs.map(([k, v]) => `${k === "knee" ? "knee replacement" : k === "cardiac" ? "heart procedures" : k} ${inr(v!)}`).join(", ");
    const senior = !!p.cover?.parents || eldest >= 50;
    dims.push({ key: "sublimits", score: senior ? 0.15 : 0.5, reason: { kind: senior ? "bad" : "caveat", title: "Hidden caps on common surgeries", detail: `Payouts are capped at ${txt}, regardless of your ${inr(si * 100000)} cover.${senior ? " These procedures are common for people over 55." : ""}`, clauseId: "sublimits", priority: "low_oop" } });
  } else {
    dims.push({ key: "sublimits", score: 1 });
  }

  if (policy.consumablesCovered && pri.has("low_oop")) {
    dims.push({ key: "low_oop", score: 1, reason: { kind: "good", title: "Consumables included", detail: "Gloves, PPE and similar items, often 5–10% of a bill, are paid too.", clauseId: "consumables", priority: "low_oop" } });
  }

  return dims;
}

export function matchPolicies(p: Profile): { matches: Match[]; excluded: Excluded[]; targetSI: number } {
  const target = recommendSumInsured(p).lakh;
  const eldest = eldestAge(p);
  const youngest = youngestAge(p);
  const excluded: Excluded[] = [];
  const eligible = POLICIES.filter((pol) => {
    if (eldest > pol.maxEntryAge) {
      excluded.push({ policy: pol, why: `Accepts members only up to age ${pol.maxEntryAge}; your eldest member is ${eldest}.` });
      return false;
    }
    if (pol.minEntryAge && youngest < pol.minEntryAge) {
      excluded.push({ policy: pol, why: `Only for members aged ${pol.minEntryAge}+. Your cover includes younger members.` });
      return false;
    }
    return true;
  });

  const priced = eligible.map((pol) => {
    const si = pickSumInsured(pol, target);
    return { pol, si, premium: premiumFor(pol, p, si) };
  });
  const cheapest = Math.min(...priced.map((x) => x.premium));
  const explicit = new Set(effectivePriorities(p));
  const head = headlineScenario(p);

  const matches: Match[] = priced.map(({ pol, si, premium }) => {
    const dims = evaluate(pol, p, si, premium, cheapest);
    // The most likely costly event for this family weighs heavily: the plan we lead with should pay for it.
    const sim = simulate(pol, si, p, head.scenario, { year: head.year, room: "private" });
    dims.push({ key: "headline", score: sim.bill ? sim.insurerPays / sim.bill : 1 });
    let num = 0;
    let den = 0;
    for (const d of dims) {
      const w = d.key === "headline" ? 4 : explicit.has(d.key as Priority) ? 3 : d.key === "sublimits" ? 1.5 : 1;
      num += w * d.score;
      den += w;
    }
    const score = num / den;
    const metKeys = new Set<Priority>();
    for (const pr of explicit) {
      const relevant = dims.filter((d) => d.key === pr);
      if (relevant.length && Math.min(...relevant.map((d) => d.score)) >= 0.7) metKeys.add(pr);
    }
    const reasons = dims
      .map((d) => d.reason)
      .filter((r): r is Reason => !!r)
      .sort((a, b) => order(a) - order(b));
    return {
      policy: pol,
      sumInsured: si,
      premium,
      score,
      fit: score >= 0.75 ? "Strong fit" : score >= 0.55 ? "Good fit" : "Partial fit",
      prioritiesMet: metKeys.size,
      prioritiesTotal: explicit.size,
      reasons,
    } satisfies Match;
  });

  matches.sort((a, b) => b.score - a.score);
  const top = matches.slice(0, 3);
  if (top[0]) top[0].label = "Best fit for you";
  const rest = top.slice(1);
  if (rest.length) {
    const budget = rest.reduce((a, b) => (a.premium <= b.premium ? a : b));
    budget.label = budget.premium < top[0].premium ? "Budget pick" : "Strong alternative";
    rest.filter((m) => m !== budget).forEach((m) => (m.label = m.premium > top[0].premium ? "Maximum protection" : "Strong alternative"));
  }
  return { matches, excluded, targetSI: target };
}

const order = (r: Reason) => (r.kind === "good" ? 0 : r.kind === "caveat" ? 1 : 2);

/** Plain-language fine-print traps for a policy, independent of the user. */
export function redFlags(policy: Policy): string[] {
  const f: string[] = [];
  if (policy.roomRent.kind === "percent") f.push(`Room rent capped at ${policy.roomRent.percent}% of cover per day, with proportionate deduction`);
  if (policy.copay.percent) f.push(`${policy.copay.percent}% co-pay${policy.copay.fromAge ? ` from age ${policy.copay.fromAge}` : " on every claim"}`);
  if (policy.pedWaitYears >= 3) f.push(`${policy.pedWaitYears}-year wait for pre-existing conditions`);
  if (Object.keys(policy.sublimits).length) f.push("Sub-limits on common surgeries");
  if (!policy.consumablesCovered) f.push("Consumables (5–10% of most bills) not paid");
  if (policy.restoration === "none") f.push("Sum insured never refills");
  return f;
}
