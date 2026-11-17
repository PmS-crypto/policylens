import { POLICIES } from "./policies";
import {
  CITY_LABEL,
  CONDITION_LABEL,
  PRIVATE_ROOM_RATE,
  conditionHolder,
  effectivePriorities,
  eldestAge,
  inr,
  PLANNED_LABEL,
  parentNamePossessive,
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
  const tobacco = p.tobacco ? 1.15 : 1; // illustrative loading; insurers typically charge tobacco users more
  const raw = policy.basePremium * ageFactor * memberFactor * (SI_FACTOR[si] ?? 1) * CITY_PREMIUM[p.city ?? "tier2"] * tobacco;
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
  key: Priority | "sublimits" | "headline" | "planned";
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
    dims.push({ key: "private_room", score: 1, reason: { kind: "good", title: "No room limit", detail: pri.has("private_room") ? "You wanted a private room. Any room is fully paid, and nothing else gets cut." : "Any room is fully paid, so the rest of your bill is never cut.", clauseId: "room", priority: "private_room" } });
  } else if (policy.roomRent.kind === "single") {
    dims.push({ key: "private_room", score: 0.8, reason: { kind: "good", title: "Private room paid", detail: "A normal private room is fully paid. Only a fancier room makes the plan cut your bill.", clauseId: "room", priority: "private_room" } });
  } else {
    const cap = ((policy.roomRent.percent ?? 1) / 100) * si * 100000;
    const ok = cap >= roomRate;
    dims.push({
      key: "private_room",
      score: ok ? 0.55 : 0.15,
      reason: ok
        ? { kind: "caveat", title: `Room limit: ${inr(cap)} a day`, detail: `That pays for a private room in a ${CITY_LABEL[city].toLowerCase()} (about ${inr(roomRate)}) today. But hospital prices keep going up.`, clauseId: "room", priority: "private_room" }
        : { kind: "bad", title: `Room limit: ${inr(cap)} a day`, detail: `A private room in a ${CITY_LABEL[city].toLowerCase()} costs about ${inr(roomRate)} a day. Pick one, and the plan cuts your whole bill, not just the room.`, clauseId: "room", priority: "private_room" },
    });
  }

  // Co-pay
  if (!policy.copay.percent) {
    dims.push({ key: "low_oop", score: 1, reason: { kind: "good", title: "You never pay a share of the bill", detail: "The plan pays the whole bill it covers, at any age.", clauseId: "copay", priority: "low_oop" } });
  } else if (copayApplies(policy, eldest)) {
    const s = policy.copay.percent >= 20 ? 0.15 : 0.45;
    dims.push({ key: "low_oop", score: s, reason: { kind: "bad", title: `You pay ${policy.copay.percent}% of every bill`, detail: `On a ₹4L surgery, you'd pay ${inr(400000 * policy.copay.percent / 100)} yourself.`, clauseId: "copay", priority: "low_oop" } });
  } else {
    const yrs = (policy.copay.fromAge ?? 0) - eldest;
    dims.push({ key: "low_oop", score: yrs <= 6 ? 0.55 : 0.8, reason: { kind: "caveat", title: `You pay ${policy.copay.percent}% of bills from age ${policy.copay.fromAge}`, detail: yrs <= 6 ? `Your oldest family member turns ${policy.copay.fromAge} in about ${yrs} years. Then you pay ${policy.copay.percent}% of every bill.` : `Not for you now. It starts at age ${policy.copay.fromAge}.`, clauseId: "copay", priority: "low_oop" } });
  }

  // Pre-existing disease waiting period
  if (p.conditions?.length) {
    const y = policy.pedWaitYears;
    const conds = p.conditions.map((c) => CONDITION_LABEL[c]).join(" & ");
    const who = conditionHolder(p) === "parent" ? parentNamePossessive(p) : "your";
    const s = y <= 1 ? 1 : y === 2 ? 0.7 : y === 3 ? 0.35 : 0.1;
    dims.push({ key: "ped_fast", score: s, reason: { kind: y <= 1 ? "good" : y === 2 ? "caveat" : "bad", title: `${conds} covered after ${y} year${y > 1 ? "s" : ""}`, detail: y <= 1 ? `Care for ${who} ${conds.toLowerCase().replace(/\bbp\b/g, "BP")} is paid from year 2. That's one of the shortest waits.` : `For the first ${y} years, the plan pays nothing for ${who} ${conds.toLowerCase().replace(/\bbp\b/g, "BP")}. You'd pay it all yourself.`, clauseId: "ped", priority: "ped_fast" } });
  }

  // Maternity
  if (pri.has("maternity")) {
    const m = policy.maternity;
    if (!m.covered) dims.push({ key: "maternity", score: 0, reason: { kind: "bad", title: "Doesn't pay for having a baby", detail: "You said you're planning a baby. You'd pay the whole birth yourself (₹60k–2L).", clauseId: "maternity", priority: "maternity" } });
    else dims.push({ key: "maternity", score: (m.waitYears ?? 0) <= 2 ? 1 : 0.6, reason: { kind: (m.waitYears ?? 0) <= 2 ? "good" : "caveat", title: `Pays up to ${inr(m.limit ?? 0)} for a baby after ${m.waitYears} years`, detail: (m.waitYears ?? 0) <= 2 ? "One of the shortest waits. Buy now, and a birth from year 3 is paid, new baby too." : `If your baby comes within ${m.waitYears} years, the plan won't pay. Buy early.`, clauseId: "maternity", priority: "maternity" } });
  }

  // Premium vs budget
  if (p.budget) {
    const r = premium / p.budget;
    dims.push({ key: "low_premium", score: r <= 1 ? 1 : r <= 1.2 ? 0.5 : 0.1, reason: { kind: r <= 1 ? "good" : r <= 1.2 ? "caveat" : "bad", title: r <= 1 ? "Fits your budget" : `${Math.round((r - 1) * 100)}% over budget`, detail: `About ${inr(premium)} a year. Your budget is ${inr(p.budget)}.`, priority: "low_premium" } });
  } else {
    dims.push({ key: "low_premium", score: cheapest / premium, reason: pri.has("low_premium") ? { kind: premium === cheapest ? "good" : "caveat", title: premium === cheapest ? "Cheapest of your choices" : `${inr(premium - cheapest)} a year more than the cheapest`, detail: `About ${inr(premium)} a year.`, priority: "low_premium" } : undefined });
  }

  // Restoration
  const rs = policy.restoration === "unlimited" ? 1 : policy.restoration === "once" ? 0.5 : 0;
  dims.push({ key: "restoration", score: rs, reason: pri.has("restoration") || rs === 0 ? { kind: rs === 1 ? "good" : rs === 0.5 ? "caveat" : "bad", title: rs === 1 ? "Cover refills every time" : rs === 0.5 ? "Cover refills once a year" : "Cover doesn't refill", detail: rs === 0 ? "If one hospital stay uses up all the cover, no one else is covered until next year." : rs === 1 ? "If one person uses up the cover, it fills up again for a new illness." : "It fills up once a year, only for a new illness.", clauseId: "restoration", priority: "restoration" } : undefined });

  // Network
  dims.push({ key: "network", score: Math.min(1, policy.network / 11000), reason: pri.has("network") ? { kind: policy.network >= 9500 ? "good" : "caveat", title: `${policy.network.toLocaleString("en-IN")} hospitals where you don't pay first`, detail: policy.network >= 9500 ? "Lots of hospitals, so one near you is more likely." : "Fewer hospitals. Check yours is on the list before you buy." , priority: "network" } : undefined });

  // Treatment the family expects soon: the plan that covers it soonest, without a cap, should win
  for (const care of p.upcoming ?? []) {
    const cap = care === "cataract" ? policy.sublimits.cataract : care === "joint" ? policy.sublimits.knee : policy.sublimits.cardiac;
    const wait = care === "heart" ? (p.conditions?.some((c) => c === "heart" || c === "bp" || c === "diabetes") ? policy.pedWaitYears : 0) : policy.specificWaitYears;
    const label = PLANNED_LABEL[care];
    const score = (wait <= 1 ? 1 : wait === 2 ? 0.55 : 0.25) * (cap ? 0.4 : 1);
    const when = wait === 0 ? "paid after the first 30 days" : `paid after ${wait} year${wait > 1 ? "s" : ""}`;
    dims.push({
      key: "planned",
      score,
      reason: {
        kind: score >= 0.9 ? "good" : cap ? "bad" : "caveat",
        title: `${label} ${when}${cap ? `, only up to ${inr(cap)}` : ""}`,
        detail: cap
          ? `You said you may need this soon. This plan pays only up to ${inr(cap)} for it, whatever your cover.`
          : wait <= 1
            ? "You said you may need this soon. This is one of the shortest waits."
            : `You said you may need this soon. If it happens in the first ${wait} years, you pay for it yourself.`,
        clauseId: cap ? "sublimits" : care === "heart" ? "ped" : "specific",
      },
    });
  }

  // Sub-limits
  const subs = Object.entries(policy.sublimits);
  if (subs.length) {
    const txt = subs.map(([k, v]) => `${inr(v!)} for ${k === "knee" ? "a new knee" : k === "cardiac" ? "heart surgery" : k === "cataract" ? "eye surgery" : k}`).join(", ");
    const senior = !!p.cover?.parents || eldest >= 50;
    dims.push({ key: "sublimits", score: senior ? 0.15 : 0.5, reason: { kind: senior ? "bad" : "caveat", title: "Hidden limits on common surgeries", detail: `It pays only up to ${txt}, whatever your ${inr(si * 100000)} cover.${senior ? " People over 55 often need these." : ""}`, clauseId: "sublimits", priority: "low_oop" } });
  } else {
    dims.push({ key: "sublimits", score: 1 });
  }

  if (policy.consumablesCovered && pri.has("low_oop")) {
    dims.push({ key: "low_oop", score: 1, reason: { kind: "good", title: "Gloves, masks and needles paid", detail: "These are often 5–10% of a bill. This plan pays for them.", clauseId: "consumables", priority: "low_oop" } });
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
      excluded.push({ policy: pol, why: `Takes people only up to age ${pol.maxEntryAge}. Your oldest is ${eldest}.` });
      return false;
    }
    if (pol.minEntryAge && youngest < pol.minEntryAge) {
      excluded.push({ policy: pol, why: `Only for people aged ${pol.minEntryAge} and up. Someone in your family is younger.` });
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
    const byKey = new Map<string, { weight: number; total: number }>();
    for (const d of dims) {
      const w = weightOf(d.key, explicit);
      num += w * d.score;
      den += w;
      const g = byKey.get(d.key) ?? { weight: 0, total: 0 };
      g.weight += w;
      g.total += w * d.score;
      byKey.set(d.key, g);
    }
    const score = num / den;
    // Same numbers, grouped by factor, so the ranking can be shown and explained exactly as computed.
    const breakdown = [...byKey].map(([key, g]) => ({ key, label: FACTOR_LABEL[key] ?? key, weight: g.weight, score: g.total / g.weight })).sort((a, b) => b.weight - a.weight);
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
      breakdown,
    } satisfies Match;
  });

  matches.sort((a, b) => b.score - a.score);
  const top = matches.slice(0, 3);
  if (top[0]) top[0].label = "Best fit for you";
  const rest = top.slice(1);
  if (rest.length) {
    const budget = rest.reduce((a, b) => (a.premium <= b.premium ? a : b));
    // Only call it a budget pick if it actually fits the budget the user gave us.
    const fitsBudget = !p.budget || budget.premium <= p.budget;
    budget.label = budget.premium < top[0].premium ? (fitsBudget ? "Budget pick" : "Costs less") : "Good backup";
    rest.filter((m) => m !== budget).forEach((m) => (m.label = m.premium > top[0].premium ? "Most cover" : "Good backup"));
  }
  return { matches, excluded, targetSI: target };
}

/** How much each factor counts. The family's likeliest hospital visit counts most; their stated priorities next. */
export function weightOf(key: string, explicit: Set<Priority>) {
  return key === "headline" ? 4 : key === "planned" ? 3 : explicit.has(key as Priority) ? 3 : key === "sublimits" ? 1.5 : 1;
}

export const FACTOR_LABEL: Record<string, string> = {
  headline: "What you'd pay for your most likely hospital trip",
  planned: "Paying for the surgery you expect",
  private_room: "Room limits",
  low_oop: "What you pay yourself at the hospital",
  ped_fast: "Wait for illnesses you already have",
  low_premium: "Yearly cost against your budget",
  maternity: "Having a baby",
  restoration: "Cover that refills",
  network: "Hospitals where you don't pay first",
  sublimits: "Limits on common surgeries",
};

const order = (r: Reason) => (r.kind === "good" ? 0 : r.kind === "caveat" ? 1 : 2);

/** Plain-language fine-print traps for a policy, independent of the user. */
export function redFlags(policy: Policy): string[] {
  const f: string[] = [];
  if (policy.roomRent.kind === "percent") f.push(`Room limit: ${policy.roomRent.percent}% of your cover a day. A bigger room cuts the whole bill`);
  if (policy.copay.percent) f.push(`You pay ${policy.copay.percent}% of every bill${policy.copay.fromAge ? ` from age ${policy.copay.fromAge}` : ""}`);
  if (policy.pedWaitYears >= 3) f.push(`You wait ${policy.pedWaitYears} years for illnesses you already have`);
  if (Object.keys(policy.sublimits).length) f.push("Limits on common surgeries");
  if (!policy.consumablesCovered) f.push("Doesn't pay for gloves, masks and needles (5–10% of most bills)");
  if (policy.restoration === "none") f.push("Cover never refills");
  return f;
}
