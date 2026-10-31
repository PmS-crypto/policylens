import { coverStartsAfterMonths } from "./dates";
import { CITY_COST_FACTOR, CONDITION_LABEL } from "./profile";
import type { Lang } from "./ai";
import { SCENARIOS, headlineScenario, headlineSentence, scenarioTitle, simulate, type Scenario } from "./simulate";
import type { Match, Profile } from "./types";

/**
 * "Do I even need insurance?" answered with this family's own numbers:
 * what the likeliest and the most serious hospital stays would cost without cover.
 */
export function riskSnapshot(p: Profile, best: Match, l: Lang = "en") {
  const hi = l === "hi";
  const city = p.city ?? "tier2";
  const cost = (s: Scenario) => Math.round((s.bill * CITY_COST_FACTOR[city]) / 1000) * 1000;
  const head = headlineScenario(p);
  const likely = { title: scenarioTitle(head.scenario, l), sentence: headlineSentence(p, l).replace(/^(If|Agar) /, ""), bill: cost(head.scenario) };
  const serious = SCENARIOS.filter((s) => s.relevant(p) && s.id !== head.scenario.id).sort((a, b) => b.bill - a.bill)[0];

  // Employer cover usually covers you and your spouse/kids, rarely parents.
  const forParent = head.scenario.who === "parent" || (head.scenario.who === "eldest" && !!p.cover?.parents);
  const employer = (p.employerCover ?? 0) * 100000;
  let employerLine: string | null = null;
  if (employer > 0)
    employerLine = forParent
      ? hi
        ? `Office ka ₹${p.employerCover}L cover parents ko cover nahi karta.`
        : `Your ₹${p.employerCover}L cover from work doesn't include parents.`
      : hi
        ? `Office ka ₹${p.employerCover}L cover help karta hai, par job badli toh gaya.`
        : `Your ₹${p.employerCover}L cover from work helps, but it's gone the day you switch jobs.`;

  const conditions = (p.conditions ?? []).map((c) => CONDITION_LABEL[c].toLowerCase().replace(/\bbp\b/, "BP"));
  return {
    likely,
    serious: serious ? { title: scenarioTitle(serious, l).replace(": ", " and "), bill: cost(serious) } : null,
    employerLine,
    premiumYears: likely.bill / best.premium,
    bestPremium: best.premium,
    waitLine: conditions.length
      ? hi
        ? `Waiting period tabhi shuru hota hai jab aap policy lete ho. Har mahina late matlab ${conditions.join(" aur ")} ka cover utna hi door.`
        : `Waiting periods only start when you buy. Every month you wait pushes cover for ${conditions.join(" and ")} further out.`
      : hi
        ? "Waiting period tabhi shuru hota hai jab aap policy lete ho. Jitna jaldi, utna jaldi full cover."
        : "Waiting periods only start when you buy, so the sooner you start, the sooner you're fully covered.",
  };
}

export type CoverageCell = { kind: "covered" | "partial" | "waiting"; youPay: number; from?: string; year: number };

/** "Will this actually cover me?" for every likely event: when cover starts and what you'd still pay. */
export function coverageMap(p: Profile, top: Match[]) {
  const scenarios = SCENARIOS.filter((s) => s.relevant(p)).slice(0, 5);
  // Claims in policy year y are covered once (y - 1) years of waiting have passed.
  const fromDate = (year: number) => coverStartsAfterMonths((year - 1) * 12);

  return scenarios.map((s) => ({
    scenario: s,
    cells: top.map((m): CoverageCell => {
      for (let year = 1; year <= 5; year++) {
        const r = simulate(m.policy, m.sumInsured, p, s, { year, room: "private" });
        if (!r.blocked) return { kind: year === 1 ? (r.youPay / r.bill > 0.2 ? "partial" : "covered") : "waiting", youPay: r.youPay, from: year > 1 ? fromDate(year) : undefined, year };
      }
      return { kind: "waiting", youPay: 0, from: "Not covered", year: 5 };
    }),
  }));
}
