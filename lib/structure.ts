import { matchPolicies, pickSumInsured, premiumFor } from "./match";
import { conditionHolder, eldestAge, memberCounts, recommendSumInsured } from "./profile";
import { SCENARIOS, headlineScenario, simulate } from "./simulate";
import type { Match, Policy, Profile } from "./types";

/*
  Coverage structure and budget advice: the "what type of cover" half of discovery.
  Super top-up is illustrative, priced with the same model as base plans.
*/

export const TOPUP = {
  insurer: "Suraksha Health",
  name: "Super Shield Top-up",
  docVersion: "SHI-ST-v1.2",
  deductibles: [3, 5, 10, 15, 25] as const,
  covers: [10, 20, 50] as const,
  pedWaitYears: 3,
};

const TOPUP_BASE = 2600; // ₹20L cover over a ₹5L deductible, one adult aged 30, tier-2 city
const TOPUP_SLOPE = 1.05;
const DEDUCTIBLE_FACTOR: Record<number, number> = { 3: 1.3, 5: 1, 10: 0.65, 15: 0.52, 25: 0.4 };
const COVER_FACTOR: Record<number, number> = { 10: 0.75, 20: 1, 50: 1.35 };
const CITY: Record<string, number> = { metro: 1.12, tier2: 1, tier3: 0.9 };

export function topupPremium(p: Profile, deductible: number, cover: number) {
  const { adults, kids } = memberCounts(p);
  const ageFactor = Math.max(0.8, TOPUP_SLOPE ** (eldestAge(p) - 30));
  const memberFactor = 1 + 0.6 * (adults - 1) + 0.25 * kids;
  const raw = TOPUP_BASE * ageFactor * memberFactor * (DEDUCTIBLE_FACTOR[deductible] ?? 1) * (COVER_FACTOR[cover] ?? 1) * CITY[p.city ?? "tier2"] * (p.tobacco ? 1.15 : 1);
  return Math.round(raw / 100) * 100;
}

const nearestDeductible = (l: number) => TOPUP.deductibles.find((d) => d >= l) ?? TOPUP.deductibles[TOPUP.deductibles.length - 1];

export interface Layer {
  label: string;
  lakh: number;
  premium: number;
  kind: "base" | "topup" | "work";
}

export interface Structure {
  id: "topup" | "split" | "work" | "own";
  title: string;
  summary: string;
  layers: Layer[];
  totalCover: number; // lakh
  totalPremium: number;
  compare: { label: string; premium: number; cover: number };
  pros: string[];
  cons: string[];
}

/** Ways to build cover that usually beat "one big plan": layered top-ups, separate parents' cover, topping up work cover. */
export function coverageStructures(p: Profile, top: Match[]): Structure[] {
  const best = top[0];
  if (!best) return [];
  const out: Structure[] = [];
  const target = recommendSumInsured(p).lakh;

  // 1. Base + super top-up: a smaller base plan for everyday claims, a cheap top-up for the big ones.
  const baseSI = best.policy.siOptions.find((o) => o >= 5) ?? best.policy.siOptions[0];
  if (baseSI < best.sumInsured || best.sumInsured < 25) {
    const ded = nearestDeductible(baseSI);
    const topCover = TOPUP.covers.find((c) => ded + c >= Math.max(25, target * 2)) ?? 50;
    const basePrem = premiumFor(best.policy, p, baseSI);
    const topPrem = topupPremium(p, ded, topCover);
    const total = basePrem + topPrem;
    // Compare against the same plan at the cover size closest to the layered total, so the saving is like-for-like.
    const closest = [...best.policy.siOptions].sort((a, b) => Math.abs(a - (ded + topCover)) - Math.abs(b - (ded + topCover)))[0];
    const same = premiumFor(best.policy, p, closest);
    out.push({
      id: "topup",
      title: "Base plan + super top-up",
      summary:
        total <= best.premium
          ? `₹${ded + topCover} lakh of cover for ${fmt(total)} a year, less than ₹${best.sumInsured} lakh on one plan.`
          : `₹${ded + topCover} lakh of cover for ${fmt(total)} a year: ${round1((ded + topCover) / best.sumInsured)}× the cover for ${fmt(total - best.premium)} more.`,
      layers: [
        { label: `${best.policy.name} base`, lakh: ded, premium: basePrem, kind: "base" },
        { label: TOPUP.name, lakh: topCover, premium: topPrem, kind: "topup" },
      ],
      totalCover: ded + topCover,
      totalPremium: total,
      compare: { label: `${best.policy.name}, ₹${closest}L on its own`, premium: same, cover: closest },
      pros: [
        `The top-up only pays once a year's bills cross ₹${ded} lakh, which is why it's so cheap (${fmt(topPrem)} a year).`,
        `Everyday claims still go through ${best.policy.name} exactly as before; the top-up is there for the rare, very large year.`,
      ],
      cons: [`The top-up has its own ${TOPUP.pedWaitYears}-year wait for existing illnesses.`, "Two policies to renew, though one insurer keeps claims simple."],
    });
  }

  // 2. Separate cover for parents: their age stops inflating everyone's premium, and their claims can't drain the family's cover.
  const c = p.cover;
  if (c?.parents && (c.self || c.partner || c.kids)) {
    const parentsSick = conditionHolder(p) === "parent";
    const young: Profile = { ...p, cover: { ...c, parents: false }, conditions: parentsSick ? [] : p.conditions };
    const elders: Profile = { ...p, cover: { self: false, partner: false, kids: false, parents: true }, conditions: parentsSick ? p.conditions : [] };
    const ym = matchPolicies(young).matches[0];
    const em = matchPolicies(elders).matches[0];
    if (ym && em) {
      const total = ym.premium + em.premium;
      out.push({
        id: "split",
        title: "Separate policy for your parents",
        summary:
          total <= best.premium
            ? `Two policies for ${fmt(total)} a year, ${fmt(best.premium - total)} less than one shared floater.`
            : `Two policies for ${fmt(total)} a year (${fmt(total - best.premium)} more), and nobody's claim can use up someone else's cover.`,
        layers: [
          { label: `${ym.policy.name} for your family`, lakh: ym.sumInsured, premium: ym.premium, kind: "base" },
          { label: `${em.policy.name} for your parents`, lakh: em.sumInsured, premium: em.premium, kind: "topup" },
        ],
        totalCover: ym.sumInsured + em.sumInsured,
        totalPremium: total,
        compare: { label: `One floater for everyone (${best.policy.name})`, premium: best.premium, cover: best.sumInsured },
        pros: [
          "A floater is priced on its eldest member, so your parents' age pushes up the premium for everyone.",
          `A big claim for your parents can't use up the ₹${ym.sumInsured} lakh meant for your family.`,
          `${em.policy.name} is designed for people over 55, with shorter waits for existing illnesses.`,
          ...(p.upcoming?.some((u) => u === "joint" || u === "cataract") && em.policy.specificWaitYears < best.policy.specificWaitYears
            ? [`The surgery you're expecting is covered after ${em.policy.specificWaitYears} year${em.policy.specificWaitYears > 1 ? "s" : ""} on ${em.policy.name}, versus ${best.policy.specificWaitYears} on ${best.policy.name}.`]
            : []),
        ],
        cons: [em.policy.copay.percent ? `${em.policy.name} has a ${em.policy.copay.percent}% co-pay on parents' claims.` : "Two renewals a year instead of one."],
      });
    }
  }

  // 3. Top up a policy you already own: keeps the waiting periods you've served, adds big cover cheaply.
  const own = p.existingCover ?? 0;
  if (own > 0) {
    const ded = nearestDeductible(own);
    const prem = topupPremium(p, ded, 20);
    out.push({
      id: "own",
      title: `Top up your existing ₹${own}L policy`,
      summary: `Keep your current policy and add ₹20 lakh on top for ${fmt(prem)} a year, instead of starting over.`,
      layers: [
        { label: "Your current policy", lakh: own, premium: 0, kind: "work" },
        { label: TOPUP.name, lakh: 20, premium: prem, kind: "topup" },
      ],
      totalCover: own + 20,
      totalPremium: prem,
      compare: { label: `${best.policy.name}, ₹${best.sumInsured}L as a new policy`, premium: best.premium, cover: best.sumInsured },
      pros: ["You keep the waiting periods you've already served on your current policy.", "Far cheaper than replacing it with a bigger plan."],
      cons: ["Your current policy's own limits (room rent, co-pay) still apply to the first layer."],
    });
  }

  // 4. Top up your work cover: cheap, large protection on top of what your employer already pays for.
  const work = p.employerCover ?? 0;
  if (work > 0 && own === 0 && c?.self && !c.parents) {
    const ded = nearestDeductible(work);
    const prem = topupPremium(p, ded, 20);
    out.push({
      id: "work",
      title: `Super top-up over your ₹${work}L work cover`,
      summary: `₹${ded + 20} lakh of protection for ${fmt(prem)} a year, using your employer's cover as the first layer.`,
      layers: [
        { label: "Your work cover", lakh: work, premium: 0, kind: "work" },
        { label: TOPUP.name, lakh: 20, premium: prem, kind: "topup" },
      ],
      totalCover: ded + 20,
      totalPremium: prem,
      compare: { label: `${best.policy.name}, ₹${best.sumInsured}L on its own`, premium: best.premium, cover: best.sumInsured },
      pros: ["The cheapest way to big cover while you're employed.", "Waiting periods start counting now, so they're done if you ever buy a base plan."],
      cons: [`If you leave your job, you pay the first ₹${ded} lakh of every year's bills yourself. Pair it with a small personal plan before you switch.`],
    });
  }

  return out;
}

export interface Lever {
  id: string;
  title: string;
  premium: number;
  fits: boolean;
  saving: number;
  youPay: number; // on the family's likeliest hospital visit
  extraYouPay: number; // versus the best-fit plan
  giveUp: string;
  /** True when this lever leaves the family's likeliest hospital visit largely unpaid. */
  risky?: boolean;
}

/** "Make it fit my budget": concrete levers when the best fit costs more than the family can pay. */
export function budgetLevers(p: Profile, top: Match[], all: Match[]): { over: number; levers: Lever[] } | null {
  const best = top[0];
  if (!best || !p.budget || best.premium <= p.budget) return null;
  const budget = p.budget;
  const head = headlineScenario(p);
  const pay = (pol: Policy, si: number) => simulate(pol, si, p, head.scenario, { year: head.year, room: "private" }).youPay;
  const bestPay = pay(best.policy, best.sumInsured);
  const levers: Lever[] = [];

  // 1. Same plan, less cover
  const lower = [...best.policy.siOptions].reverse().find((o) => o < best.sumInsured);
  if (lower) {
    const prem = premiumFor(best.policy, p, lower);
    const serious = SCENARIOS.filter((s) => s.relevant(p)).sort((a, b) => b.bill - a.bill)[0];
    const gap = serious ? simulate(best.policy, lower, p, serious, { year: 4, room: "private" }).youPay - simulate(best.policy, best.sumInsured, p, serious, { year: 4, room: "private" }).youPay : 0;
    levers.push({
      id: "lower",
      title: `Keep ${best.policy.name}, drop to ₹${lower} lakh cover`,
      premium: prem,
      fits: prem <= budget,
      saving: best.premium - prem,
      youPay: pay(best.policy, lower),
      extraYouPay: pay(best.policy, lower) - bestPay,
      giveUp: gap > 0 ? `Less headroom: a ${serious!.title.toLowerCase()} could cost you ${fmt(gap)} more.` : `Less headroom for a big year, but your likeliest hospital visit is still covered the same.`,
    });
  }

  // 2. Smaller base + top-up on the cheapest suitable plan
  const cheapBase = [...all].sort((a, b) => premiumFor(a.policy, p, a.policy.siOptions.find((o) => o >= 5) ?? a.policy.siOptions[0]) - premiumFor(b.policy, p, b.policy.siOptions.find((o) => o >= 5) ?? b.policy.siOptions[0]))[0];
  if (cheapBase) {
    const si = cheapBase.policy.siOptions.find((o) => o >= 5) ?? cheapBase.policy.siOptions[0];
    const ded = nearestDeductible(si);
    const prem = premiumFor(cheapBase.policy, p, si) + topupPremium(p, ded, 20);
    const yp = pay(cheapBase.policy, si);
    levers.push({
      id: "layer",
      title: `${cheapBase.policy.name} ₹${si}L + ₹20L super top-up`,
      premium: prem,
      fits: prem <= budget,
      saving: best.premium - prem,
      youPay: yp,
      extraYouPay: yp - bestPay,
      giveUp: firstCatch(cheapBase) ?? `₹${ded + 20} lakh total cover, but the top-up only starts after ₹${ded} lakh of bills in a year.`,
    });
  }

  // 3. Separate parents' policy: often the biggest saving for mixed-age families
  const c = p.cover;
  if (c?.parents && (c.self || c.partner || c.kids)) {
    const parentsSick = conditionHolder(p) === "parent";
    const young: Profile = { ...p, cover: { ...c, parents: false }, conditions: parentsSick ? [] : p.conditions };
    const elders: Profile = { ...p, cover: { self: false, partner: false, kids: false, parents: true }, conditions: parentsSick ? p.conditions : [] };
    const ym = matchPolicies(young).matches[0];
    const em = matchPolicies(elders).matches[0];
    if (ym && em) {
      const prem = ym.premium + em.premium;
      const forParent = head.scenario.who === "parent" || head.scenario.who === "eldest";
      const yp = forParent
        ? simulate(em.policy, em.sumInsured, elders, head.scenario, { year: head.year, room: "private" }).youPay
        : simulate(ym.policy, ym.sumInsured, young, head.scenario, { year: head.year, room: "private" }).youPay;
      levers.push({
        id: "split",
        title: `${ym.policy.name} for your family + ${em.policy.name} for your parents`,
        premium: prem,
        fits: prem <= budget,
        saving: best.premium - prem,
        youPay: yp,
        extraYouPay: yp - bestPay,
        giveUp: "Two renewals instead of one, and each policy has its own cover limit.",
      });
    }
  }

  // 4. The best plan that already fits
  const fitting = all.filter((m) => m.premium <= budget).sort((a, b) => b.score - a.score)[0];
  if (fitting && fitting.policy.id !== best.policy.id) {
    const yp = pay(fitting.policy, fitting.sumInsured);
    levers.push({
      id: "switch",
      title: `Switch to ${fitting.policy.name}`,
      premium: fitting.premium,
      fits: true,
      saving: best.premium - fitting.premium,
      youPay: yp,
      extraYouPay: yp - bestPay,
      giveUp: firstCatch(fitting) ?? "Fewer extras than your best fit.",
    });
  }

  const headBill = simulate(best.policy, best.sumInsured, p, head.scenario, { year: head.year, room: "private" }).bill;
  for (const l of levers) l.risky = l.youPay > headBill * 0.5;
  // Levers that fit first, then the ones that protect best, then the cheapest
  levers.sort((a, b) => Number(!!a.risky) - Number(!!b.risky) || Number(b.fits) - Number(a.fits) || a.extraYouPay - b.extraYouPay || a.premium - b.premium);
  return { over: best.premium - budget, levers };
}

function firstCatch(m: Match) {
  const r = m.reasons.find((x) => x.kind === "bad") ?? m.reasons.find((x) => x.kind === "caveat");
  return r ? `${r.title}. ${r.detail}` : null;
}

const fmt = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
const round1 = (n: number) => Math.round(n * 10) / 10;
