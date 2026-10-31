import { affordCeiling, effectiveBudget, premiumInFiveYears } from "./afford";
import { POLICIES } from "./policies";
import { CITY_LABEL, CONDITION_LABEL, PLANNED_LABEL, PRIVATE_ROOM_RATE, conditionHolder, coverSummary, eldestAge, inr, parentsShort, recommendSumInsured } from "./profile";
import { SCENARIOS, headlineScenario, simulate } from "./simulate";
import type { Excluded, Match, Profile } from "./types";

/*
  Inference: what PolicyLens worked out from the answers, beyond what was literally said.
  Each line is "what I noticed → what I did about it", in plain words, so the reasoning is visible.
*/

export interface Inference {
  kind: "family" | "health" | "money" | "scheme" | "check" | "result";
  noticed: string;
  did: string;
  /** Worth keeping on the plans screen (not just the loader). */
  keep?: boolean;
}

export function inferences(p: Profile, plan: Profile, top: Match[], excluded: Excluded[]): Inference[] {
  const out: Inference[] = [];
  const eldest = eldestAge(p);
  const c = p.cover;
  const who = c?.parents ? parentsShort(p) : "you";

  out.push({
    kind: "family",
    noticed: `Covering ${coverSummary(p).replace(/ · /g, ", ")}.`,
    did: eldest >= 61 ? `The eldest is ${eldest}, so I'm checking co-pay rules that start at 60+.` : `Premiums and eligibility follow the eldest, aged ${eldest}.`,
  });

  if (p.conditions?.length) {
    const holder = conditionHolder(p) === "parent" ? (who === "you" ? "your parent" : who) : p.conditionWho === "partner" ? "your partner" : "you";
    out.push({
      kind: "health",
      noticed: `${p.conditions.map((x) => CONDITION_LABEL[x]).join(" and ")} for ${holder}.`,
      did: "Plans that cover existing illnesses sooner move up. A 1-year wait beats a 3-year one.",
      keep: true,
    });
  }
  if (p.upcoming?.length) {
    out.push({
      kind: "health",
      noticed: `${p.upcoming.map((u) => PLANNED_LABEL[u]).join(" and ")} may be needed soon.`,
      did: "Checking which plans cover it soonest, and which cap the payout.",
      keep: true,
    });
  }
  if (p.city) {
    out.push({
      kind: "family",
      noticed: `Treatment in a ${CITY_LABEL[p.city].toLowerCase()}, where a private room is about ${inr(PRIVATE_ROOM_RATE[p.city])} a day.`,
      did: "Checking every plan's room-rent cap against that.",
    });
  }

  // Money: sustainability first, then headroom
  const cap = affordCeiling(p);
  const eff = effectiveBudget(p);
  if (cap) {
    out.push({
      kind: "money",
      noticed: `Household income of about ${inr(p.income!)} a year.`,
      did:
        eff.source === "income" && p.budget
          ? `Keeping premiums under ${inr(cap)} a year (about 5%), so you can keep renewing as they rise. That's below the budget you mentioned.`
          : `Keeping premiums under ${inr(cap)} a year (about 5%), so renewals stay comfortable.`,
      keep: true,
    });
  }
  if (p.savings === "no" || p.savings === "partly") {
    out.push({
      kind: "money",
      noticed: p.savings === "no" ? "A ₹5 lakh bill would land on savings that can't take it." : "Savings could cover part of a big bill.",
      did: `Suggesting ₹${recommendSumInsured(p).lakh} lakh of cover so one bill doesn't wipe you out.`,
    });
  }
  if ((p.employerCover ?? 0) > 0) {
    out.push({ kind: "money", noticed: `₹${p.employerCover} lakh of cover from work.`, did: "Not counting on it: it ends the day you switch jobs." });
  }
  if ((p.existingCover ?? 0) > 0) {
    out.push({ kind: "money", noticed: `An existing ₹${p.existingCover} lakh policy.`, did: "Looking at topping it up, so you keep the waiting periods already served.", keep: true });
  }

  // Government schemes an insurer would never mention
  const seventy = (c?.parents && (p.parentAge ?? 0) >= 70) || (c?.self && (p.selfAge ?? 0) >= 70);
  if (seventy) {
    out.push({
      kind: "scheme",
      noticed: `${c?.parents && (p.parentAge ?? 0) >= 70 ? "Your parent is" : "You are"} 70 or older.`,
      did: "Everyone 70+ can get ₹5 lakh a year of free cover under Ayushman Bharat (PM-JAY), at empanelled hospitals, regardless of income. Use it as a first layer and buy less on top.",
      keep: true,
    });
  } else if (p.income !== undefined && p.income !== null && p.income <= 500000) {
    out.push({
      kind: "scheme",
      noticed: "Household income under ₹5 lakh.",
      did: "You may qualify for free ₹5 lakh family cover under Ayushman Bharat (PM-JAY). Check eligibility on the Ayushman app before paying for a private plan.",
      keep: true,
    });
  }

  out.push({
    kind: "check",
    noticed: `Reading ${POLICIES.length} policies clause by clause.`,
    did: excluded.length ? `${excluded.length} can't accept your family, so they're out.` : "All of them can accept your family.",
  });
  const relevant = SCENARIOS.filter((s) => s.relevant(p)).length;
  out.push({ kind: "check", noticed: `Running ${relevant} likely hospital bills through every plan's rules.`, did: "Waiting periods, room caps, co-pay, surgery caps, consumables." });

  const best = top[0];
  if (!best && c?.parents && (c.self || c.partner || c.kids)) {
    out.push({
      kind: "result",
      noticed: "No single policy accepts everyone together, because of the age gap.",
      did: `I'll plan ${who === "you" ? "your parents'" : `${who === "your parents" ? "your parents'" : `${who}'s`}`} cover separately from yours. That's usually better anyway.`,
      keep: true,
    });
  }
  if (best) {
    const head = headlineScenario(p);
    const r = simulate(best.policy, best.sumInsured, plan, head.scenario, { year: head.year, room: "private" });
    out.push({
      kind: "result",
      noticed: `Best fit: ${best.policy.insurer} ${best.policy.name}.`,
      did: r.blocked ? `${head.sentence}, it wouldn't pay yet, so I've also lined up options that do.` : `${head.sentence}, it pays ${inr(r.insurerPays)} of the ${inr(r.bill)} bill.`,
    });
    if (cap) {
      const later = premiumInFiveYears(best.policy, plan, best.sumInsured);
      if (later > cap * 1.15)
        out.push({
          kind: "money",
          noticed: `In 5 years, ${best.policy.name} may cost about ${inr(later)} a year.`,
          did: "That's beyond what's comfortable for your income. A layered plan or a separate plan for parents keeps renewals affordable; skipping a renewal loses every waiting period you've served.",
          keep: true,
        });
    }
  }
  return out;
}
