import type { CityTier, Condition, Priority, Profile } from "./types";

export const CONDITION_LABEL: Record<Condition, string> = {
  diabetes: "Diabetes",
  bp: "High BP",
  thyroid: "Thyroid",
  heart: "Heart condition",
  asthma: "Asthma",
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  private_room: "Private room",
  low_oop: "Minimal out-of-pocket",
  ped_fast: "Existing conditions covered fast",
  low_premium: "Low premium",
  maternity: "Maternity cover",
  restoration: "Cover that refills",
  network: "Wide hospital network",
};

export const CITY_LABEL: Record<CityTier, string> = {
  metro: "Metro city",
  tier2: "Tier-2 city",
  tier3: "Smaller town",
};

// Typical single private room tariff per day, used to judge room-rent caps.
export const PRIVATE_ROOM_RATE: Record<CityTier, number> = { metro: 7000, tier2: 5000, tier3: 3500 };
export const CITY_COST_FACTOR: Record<CityTier, number> = { metro: 1, tier2: 0.8, tier3: 0.65 };

export const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
export const lakh = (l: number) => `₹${l}L`;
export const compactInr = (n: number) =>
  n >= 100000 ? `₹${(n / 100000).toFixed(n % 100000 === 0 ? 0 : 1)}L` : n >= 1000 ? `₹${Math.round(n / 1000)}k` : inr(n);

export function coveredAges(p: Profile): number[] {
  const ages: number[] = [];
  const c = p.cover;
  if (!c) return ages;
  if (c.self && p.selfAge) ages.push(p.selfAge);
  if (c.partner && p.selfAge) ages.push(p.selfAge);
  if (c.kids) ages.push(6);
  if (c.parents && p.parentAge) ages.push(p.parentAge);
  return ages;
}

export const eldestAge = (p: Profile) => Math.max(30, ...coveredAges(p));
export const youngestAge = (p: Profile) => Math.min(...coveredAges(p), 99);

export function memberCounts(p: Profile) {
  const c = p.cover ?? { self: true, partner: false, kids: false, parents: false };
  const adults = (c.self ? 1 : 0) + (c.partner ? 1 : 0) + (c.parents ? 2 : 0);
  const kids = c.kids ? p.kidsCount ?? 1 : 0;
  return { adults: Math.max(adults, 1), kids };
}

export function coverSummary(p: Profile): string {
  const c = p.cover;
  if (!c) return "—";
  const parts: string[] = [];
  if (c.self) parts.push(p.selfAge ? `You (${p.selfAge})` : "You");
  if (c.partner) parts.push("Partner");
  if (c.kids) parts.push(`${p.kidsCount ?? 1} kid${(p.kidsCount ?? 1) > 1 ? "s" : ""}`);
  if (c.parents) parts.push(p.parentAge ? `Parents (${p.parentAge})` : "Parents");
  return parts.join(" · ");
}

/** Who has the declared conditions: parents if they're covered, otherwise the buyer. */
export const conditionHolder = (p: Profile): "parent" | "self" => (p.cover?.parents ? "parent" : "self");

export function effectivePriorities(p: Profile): Priority[] {
  const set = new Set<Priority>(p.priorities ?? []);
  if (p.conditions?.length) set.add("ped_fast");
  if (p.planningBaby) set.add("maternity");
  return [...set];
}

export function recommendSumInsured(p: Profile): { lakh: number; why: string[] } {
  const why: string[] = [];
  let si = p.city === "tier3" ? 5 : 10;
  why.push(
    p.city === "metro"
      ? "A major surgery in a metro hospital commonly costs ₹4–8L"
      : `Base cover suited to treatment costs in a ${CITY_LABEL[p.city ?? "tier2"].toLowerCase()}`,
  );
  const { adults, kids } = memberCounts(p);
  if (adults + kids >= 3) {
    si += 5;
    why.push(`${adults + kids} people share one floater, so one big claim shouldn't wipe it out`);
  }
  if (p.cover?.parents) {
    si += 5;
    why.push("Parents over 55 are far more likely to need hospitalisation");
  }
  if (p.conditions?.length && !p.cover?.parents) {
    si += 5;
    why.push("Existing conditions raise the odds of a large claim");
  }
  if (p.employerCover && p.employerCover > 0) {
    why.push(`Your ${lakh(p.employerCover)} employer cover ends if you change jobs, so we don't count on it`);
  }
  const options = [5, 10, 15, 25, 50];
  si = options.find((o) => o >= si) ?? 25;
  return { lakh: Math.min(si, 25), why };
}

export function isProfileComplete(p: Profile) {
  return !!p.cover && p.conditions !== undefined && !!p.city && p.priorities !== undefined && p.budget !== undefined;
}
