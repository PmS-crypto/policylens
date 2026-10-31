import { PRIORITY_LABEL } from "./profile";
import type { Condition, Priority, Profile } from "./types";

export interface Chip {
  label: string;
  value: string;
  hint?: string;
}

export interface Step {
  id: string;
  ask: (p: Profile) => string;
  hint?: (p: Profile) => string | undefined;
  chips: (p: Profile) => Chip[];
  multi?: boolean;
  max?: number;
  layout?: "tiles";
  done: (p: Profile) => boolean;
  skip?: (p: Profile) => boolean;
  apply: (p: Profile, values: string[]) => Profile;
  /** A short, just-in-time explainer shown after the user answers. */
  insight?: (p: Profile) => string | null;
}

export const STEPS: Step[] = [
  {
    id: "goal",
    ask: () => "Let's start with people, not policies. Who do you want to protect?",
    chips: () => [
      { label: "Me", value: "self", hint: "Just yourself" },
      { label: "Partner", value: "partner", hint: "Husband or wife" },
      { label: "Kids", value: "kids", hint: "Children" },
      { label: "Parents", value: "parents", hint: "Mom, dad or both" },
    ],
    multi: true,
    layout: "tiles",
    done: (p) => !!p.cover,
    apply: (p, v) => ({
      ...p,
      cover: { self: v.includes("self"), partner: v.includes("partner"), kids: v.includes("kids"), parents: v.includes("parents") },
    }),
  },
  {
    id: "selfAge",
    ask: (p) => (p.cover?.partner ? "How old are you? (I'll assume your partner is about the same age.)" : "How old are you?"),
    chips: () => [
      { label: "Under 25", value: "23" },
      { label: "25–30", value: "28" },
      { label: "31–35", value: "33" },
      { label: "36–40", value: "38" },
      { label: "41–50", value: "45" },
      { label: "51–60", value: "55" },
    ],
    skip: (p) => !p.cover?.self && !p.cover?.partner,
    done: (p) => p.selfAge !== undefined,
    apply: (p, [v]) => ({ ...p, selfAge: Number(v) }),
  },
  {
    id: "parentAge",
    ask: () => "How old is your elder parent? Age changes eligibility, waiting periods and co-pay, so it matters a lot here.",
    chips: () => [
      { label: "50–55", value: "53" },
      { label: "56–60", value: "58" },
      { label: "61–65", value: "63" },
      { label: "66–70", value: "68" },
      { label: "71+", value: "73" },
    ],
    skip: (p) => !p.cover?.parents,
    done: (p) => p.parentAge !== undefined,
    apply: (p, [v]) => ({ ...p, parentAge: Number(v) }),
    insight: (p) =>
      (p.parentAge ?? 0) >= 61
        ? "Heads up: many plans add a 20% co-pay for people over 60. That means you pay a fifth of every hospital bill. I'll flag every policy that does this."
        : "They'll cross 60 soon. Several plans start a co-pay at 61, so I'll check what happens then, not just today.",
  },
  {
    id: "kids",
    ask: () => "How many kids will be on the policy?",
    chips: () => [
      { label: "1", value: "1" },
      { label: "2", value: "2" },
      { label: "3", value: "3" },
    ],
    skip: (p) => !p.cover?.kids,
    done: (p) => p.kidsCount !== undefined,
    apply: (p, [v]) => ({ ...p, kidsCount: Number(v) }),
  },
  {
    id: "baby",
    ask: () => "Are you planning a baby in the next 3 years?",
    chips: () => [
      { label: "Yes", value: "yes" },
      { label: "Maybe", value: "maybe" },
      { label: "No", value: "no" },
    ],
    skip: (p) => !p.cover?.partner || (p.selfAge ?? 99) >= 40,
    done: (p) => p.planningBaby !== undefined,
    apply: (p, [v]) => ({ ...p, planningBaby: v !== "no" }),
    insight: (p) =>
      p.planningBaby
        ? "Good to know early. Maternity cover has a 2–4 year waiting period, so the time to buy is before you plan, not after."
        : null,
  },
  {
    id: "conditions",
    ask: (p) =>
      p.cover?.parents
        ? "Do your parents (or anyone else you're covering) have an existing health condition?"
        : "Does anyone you're covering have an existing health condition?",
    hint: () => "This only helps me check waiting periods. Always declare conditions to the insurer: non-disclosure is a top reason claims get rejected.",
    chips: () => [
      { label: "None", value: "none" },
      { label: "Diabetes", value: "diabetes" },
      { label: "High BP", value: "bp" },
      { label: "Thyroid", value: "thyroid" },
      { label: "Heart condition", value: "heart" },
      { label: "Asthma", value: "asthma" },
    ],
    multi: true,
    done: (p) => p.conditions !== undefined,
    apply: (p, vals) => ({ ...p, conditions: vals.filter((v) => v !== "none") as Condition[] }),
    insight: (p) =>
      p.conditions?.length
        ? "This is the single biggest difference between plans for you. Pre-existing conditions are covered only after a 1–4 year waiting period, and that gap varies a lot."
        : null,
  },
  {
    id: "city",
    ask: () => "Where would you usually go for treatment?",
    chips: () => [
      { label: "Metro (Mumbai, Delhi, Bengaluru…)", value: "metro" },
      { label: "Tier-2 city (Jaipur, Indore…)", value: "tier2" },
      { label: "Smaller town", value: "tier3" },
    ],
    done: (p) => !!p.city,
    apply: (p, [v]) => ({ ...p, city: v as Profile["city"] }),
    insight: (p) =>
      p.city === "metro"
        ? "Metro hospitals charge around ₹7,000/day for a private room. That's above the room-rent cap of many budget plans, and crossing the cap cuts your entire claim, not just the room charge."
        : null,
  },
  {
    id: "employer",
    ask: () => "Do you have health cover through your employer?",
    chips: () => [
      { label: "No", value: "0" },
      { label: "Up to ₹3L", value: "3" },
      { label: "₹3–5L", value: "5" },
      { label: "More than ₹5L", value: "10" },
    ],
    skip: (p) => !p.cover?.self,
    done: (p) => p.employerCover !== undefined,
    apply: (p, [v]) => ({ ...p, employerCover: Number(v) }),
    insight: (p) =>
      (p.employerCover ?? 0) > 0
        ? "Useful, but it ends the day you leave the job. Waiting periods on a personal policy only start counting once you buy one, so starting early pays off."
        : null,
  },
  {
    id: "priorities",
    ask: () => "What matters most to you? Pick up to 3.",
    chips: () => (Object.keys(PRIORITY_LABEL) as Priority[]).map((k) => ({ label: PRIORITY_LABEL[k], value: k, hint: PRIORITY_HINT[k] })),
    multi: true,
    max: 3,
    layout: "tiles",
    done: (p) => p.priorities !== undefined,
    apply: (p, vals) => ({ ...p, priorities: vals as Priority[] }),
  },
  {
    id: "budget",
    ask: () => "Last one. What yearly premium feels comfortable?",
    chips: () => [
      { label: "Under ₹15k", value: "15000" },
      { label: "₹15–25k", value: "25000" },
      { label: "₹25–40k", value: "40000" },
      { label: "₹40–60k", value: "60000" },
      { label: "₹60k+", value: "100000" },
      { label: "Not sure, guide me", value: "null" },
    ],
    done: (p) => p.budget !== undefined,
    apply: (p, [v]) => ({ ...p, budget: v === "null" ? null : Number(v) }),
  },
];

const PRIORITY_HINT: Record<Priority, string> = {
  private_room: "Your own room, no deductions",
  low_oop: "Pay as little as possible at claim time",
  ped_fast: "Shorter wait for illnesses you already have",
  low_premium: "Keep the yearly cost down",
  maternity: "Delivery and newborn costs",
  restoration: "Cover resets if one claim uses it up",
  network: "More hospitals where you don't pay upfront",
};

export const nextStep =(p: Profile) => STEPS.find((s) => !s.done(p) && !s.skip?.(p)) ?? null;

export const stepProgress = (p: Profile) => {
  const live = STEPS.filter((s) => !s.skip?.(p));
  return { done: live.filter((s) => s.done(p)).length, total: live.length };
};
