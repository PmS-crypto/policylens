import type { CityTier, Condition, Priority, Profile } from "./types";

export const CONDITION_LABEL: Record<Condition, string> = {
  diabetes: "Diabetes",
  bp: "High BP",
  thyroid: "Thyroid",
  heart: "Heart problem",
  asthma: "Asthma",
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  private_room: "Own room",
  low_oop: "Pay less yourself",
  ped_fast: "Old illness paid soon",
  low_premium: "Low price",
  maternity: "Having a baby",
  restoration: "Cover that refills",
  network: "Lots of hospitals",
};

export const CITY_LABEL: Record<CityTier, string> = {
  metro: "Big city",
  tier2: "Mid-size city",
  tier3: "Small town",
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
  if (c.partner && (p.partnerAge ?? p.selfAge)) ages.push((p.partnerAge ?? p.selfAge)!);
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
  if (c.partner) parts.push(p.partnerAge ? `Partner (${p.partnerAge})` : "Partner");
  if (c.kids) parts.push(`${p.kidsCount ?? 1} kid${(p.kidsCount ?? 1) > 1 ? "s" : ""}`);
  if (c.parents) parts.push(p.parentAge ? `Parents (${p.parentAge})` : "Parents");
  return parts.join(" · ");
}

/** "your dad", "your mum" or "your parent", from what the user said. */
export const parentName = (p: Profile) => (p.parentWho === "dad" ? "your dad" : p.parentWho === "mum" ? "your mum" : "your parent");
export const parentNamePossessive = (p: Profile) => (p.parentWho === "dad" ? "your dad's" : p.parentWho === "mum" ? "your mum's" : "your parent's");
/** "Dad", "Mum" or "your parents" for headlines. */
export const parentsShort = (p: Profile) => (p.parentWho === "dad" ? "Dad" : p.parentWho === "mum" ? "Mum" : "your parents");

/** Who has the declared conditions: what the user told us, else parents if they're covered, else the buyer. */
export const conditionHolder = (p: Profile): "parent" | "self" =>
  p.conditionWho ? (p.conditionWho === "parent" ? "parent" : "self") : p.cover?.parents ? "parent" : "self";

export const PLANNED_LABEL: Record<"cataract" | "joint" | "heart", string> = {
  cataract: "Eye (cataract) surgery",
  joint: "New knee or hip",
  heart: "Heart surgery",
};

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
      ? "A big surgery in a big-city hospital often costs ₹4–8L"
      : `Enough for hospital costs in a ${CITY_LABEL[p.city ?? "tier2"].toLowerCase()}`,
  );
  const { adults, kids } = memberCounts(p);
  if (adults + kids >= 3) {
    si += 5;
    why.push(`${adults + kids} people share one cover, so one big bill shouldn't use it all`);
  }
  if (p.cover?.parents) {
    si += 5;
    why.push("Parents over 55 go to hospital much more often");
  }
  if (p.conditions?.length && !p.cover?.parents) {
    si += 5;
    why.push("An illness you already have makes a big bill more likely");
  }
  if (p.savings === "no") {
    si += 5;
    why.push("A big bill would hurt your savings, so we added extra");
  }
  if (p.existingCover && p.existingCover > 0) {
    why.push(`Keep your own ₹${p.existingCover}L plan and add extra cover on top`);
  }
  if (p.employerCover && p.employerCover > 0) {
    why.push(`Your ${lakh(p.employerCover)} cover from work ends if you leave, so we don't count it`);
  }
  const options = [5, 10, 15, 25, 50];
  si = options.find((o) => o >= si) ?? 25;
  return { lakh: Math.min(si, 25), why };
}

export function isProfileComplete(p: Profile) {
  return !!p.cover && p.conditions !== undefined && !!p.city && p.priorities !== undefined && p.budget !== undefined;
}
