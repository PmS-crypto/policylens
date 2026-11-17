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
    did: eldest >= 61 ? `The oldest is ${eldest}. Some plans make you pay part of each bill after 60. I'm checking that.` : `The oldest is ${eldest}. That sets the price.`,
  });

  if (p.conditions?.length) {
    const holder = conditionHolder(p) === "parent" ? (who === "you" ? "your parent" : who) : p.conditionWho === "partner" ? "your partner" : "you";
    out.push({
      kind: "health",
      noticed: `${p.conditions.map((x) => CONDITION_LABEL[x]).join(" and ")} for ${holder}.`,
      did: "Plans that pay for it sooner go higher. A 1-year wait beats 3 years.",
      keep: true,
    });
  }
  if (p.upcoming?.length) {
    out.push({
      kind: "health",
      noticed: `${p.upcoming.map((u) => PLANNED_LABEL[u]).join(" and ")} may be needed soon.`,
      did: "Checking which plans pay soonest, and which pay only part.",
      keep: true,
    });
  }
  if (p.city) {
    out.push({
      kind: "family",
      noticed: `Hospital in a ${CITY_LABEL[p.city].toLowerCase()}. A room there costs about ${inr(PRIVATE_ROOM_RATE[p.city])} a day.`,
      did: "Checking each plan's room limit against that.",
    });
  }

  // Money: sustainability first, then headroom
  const cap = affordCeiling(p);
  const eff = effectiveBudget(p);
  if (cap) {
    out.push({
      kind: "money",
      noticed: `Your family earns about ${inr(p.income!)} a year.`,
      did:
        eff.source === "income" && p.budget
          ? `Keeping the cost under ${inr(cap)} a year (about 5%). Then you can keep paying as it rises. That's less than your budget.`
          : `Keeping the cost under ${inr(cap)} a year (about 5%). Then paying each year stays easy.`,
      keep: true,
    });
  }
  if (p.savings === "no" || p.savings === "partly") {
    out.push({
      kind: "money",
      noticed: p.savings === "no" ? "Your savings can't pay a ₹5 lakh bill." : "Your savings could pay part of a big bill.",
      did: `Suggesting ₹${recommendSumInsured(p).lakh} lakh cover, so one bill won't empty your savings.`,
    });
  }
  if ((p.employerCover ?? 0) > 0) {
    out.push({ kind: "money", noticed: `₹${p.employerCover} lakh of cover from work.`, did: "Not counting it. It ends when you leave the job." });
  }
  if ((p.existingCover ?? 0) > 0) {
    out.push({ kind: "money", noticed: `Your own ₹${p.existingCover} lakh plan.`, did: "Looking at extra cover on top. You keep the waiting time you've done.", keep: true });
  }

  // Government schemes an insurer would never mention
  const seventy = (c?.parents && (p.parentAge ?? 0) >= 70) || (c?.self && (p.selfAge ?? 0) >= 70);
  if (seventy) {
    out.push({
      kind: "scheme",
      noticed: `${c?.parents && (p.parentAge ?? 0) >= 70 ? "Your parent is" : "You are"} 70 or older.`,
      did: "Everyone 70+ gets ₹5 lakh a year of free cover from Ayushman Bharat (PM-JAY). It works at listed hospitals, whatever you earn. Use it first and buy less.",
      keep: true,
    });
  } else if (p.income !== undefined && p.income !== null && p.income <= 500000) {
    out.push({
      kind: "scheme",
      noticed: "Your family earns under ₹5 lakh.",
      did: "You may get ₹5 lakh family cover free from Ayushman Bharat (PM-JAY). Check on the Ayushman app before you buy a plan.",
      keep: true,
    });
  }

  out.push({
    kind: "check",
    noticed: `Reading all ${POLICIES.length} plans, line by line.`,
    did: excluded.length ? `${excluded.length} won't take your family, so they're out.` : "All of them will take your family.",
  });
  const relevant = SCENARIOS.filter((s) => s.relevant(p)).length;
  out.push({ kind: "check", noticed: `Testing ${relevant} likely hospital bills on every plan.`, did: "Waiting time, room limits, your share, surgery limits, gloves and needles." });

  const best = top[0];
  if (!best && c?.parents && (c.self || c.partner || c.kids)) {
    out.push({
      kind: "result",
      noticed: "No one plan takes everyone, because of the age gap.",
      did: `I'll plan ${who === "you" ? "your parents'" : `${who === "your parents" ? "your parents'" : `${who}'s`}`} cover apart from yours. That's often better anyway.`,
      keep: true,
    });
  }
  if (best) {
    const head = headlineScenario(p);
    const r = simulate(best.policy, best.sumInsured, plan, head.scenario, { year: head.year, room: "private" });
    out.push({
      kind: "result",
      noticed: `Best fit: ${best.policy.insurer} ${best.policy.name}.`,
      did: r.blocked ? `${head.sentence}, it wouldn't pay yet. So I found other plans that do.` : `${head.sentence}, it pays ${inr(r.insurerPays)} of the ${inr(r.bill)} bill.`,
    });
    if (cap) {
      const later = premiumInFiveYears(best.policy, plan, best.sumInsured);
      if (later > cap * 1.15)
        out.push({
          kind: "money",
          noticed: `In 5 years, ${best.policy.name} may cost about ${inr(later)} a year.`,
          did: "That's too much for your income. Try extra cover on top, or a separate plan for parents. If you stop paying, you lose all the waiting time you've done.",
          keep: true,
        });
    }
  }
  return out;
}
