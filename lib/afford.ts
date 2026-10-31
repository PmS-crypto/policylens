import { premiumFor } from "./match";
import type { Policy, Profile } from "./types";

/*
  Affordability: a plan only protects you if you can keep renewing it. A lapse loses every
  waiting period you've served, so we plan for premiums that stay comfortable as they rise with age.
*/

/** Guide: keep the yearly health premium within about 5% of household income. */
export const AFFORD_SHARE = 0.05;

export const affordCeiling = (p: Profile) => (p.income ? Math.round((p.income * AFFORD_SHARE) / 1000) * 1000 : null);

/** The budget the engine plans against: the user's own, capped by what their income can sustain. */
export function effectiveBudget(p: Profile): { amount: number | null; source: "you" | "income" | null } {
  const cap = affordCeiling(p);
  if (p.budget && cap) return p.budget <= cap ? { amount: p.budget, source: "you" } : { amount: cap, source: "income" };
  if (p.budget) return { amount: p.budget, source: "you" };
  if (cap) return { amount: cap, source: "income" };
  return { amount: null, source: null };
}

/** The profile the engine plans with: same family, budget replaced by the sustainable one. */
export function planningProfile(p: Profile): Profile {
  const b = effectiveBudget(p);
  return b.amount ? { ...p, budget: b.amount } : p;
}

/** Premium five years from now: everyone is five years older, which is what renewals actually cost. */
export function premiumInFiveYears(policy: Policy, p: Profile, si: number) {
  const older: Profile = {
    ...p,
    selfAge: p.selfAge ? p.selfAge + 5 : p.selfAge,
    partnerAge: p.partnerAge ? p.partnerAge + 5 : p.partnerAge,
    parentAge: p.parentAge ? p.parentAge + 5 : p.parentAge,
  };
  return premiumFor(policy, older, si);
}
