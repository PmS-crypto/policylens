import type { Lang } from "./ai";
import { CONDITION_LABEL, parentsShort } from "./profile";
import type { Condition, PlannedCare, Priority, Profile } from "./types";

/*
  The conversation script. Voice: a smart friend who happens to know insurance.
  Young, warm, direct. Light on slang, never on facts. "hi" means Hinglish (Roman script).
*/

export interface Chip {
  label: string;
  value: string;
  hint?: string;
}

export interface Step {
  id: string;
  ask: (p: Profile, l: Lang) => string;
  hint?: (p: Profile, l: Lang) => string | undefined;
  chips: (p: Profile, l: Lang) => Chip[];
  multi?: boolean;
  max?: number;
  layout?: "tiles";
  done: (p: Profile) => boolean;
  skip?: (p: Profile) => boolean;
  apply: (p: Profile, values: string[]) => Profile;
  /** A short, just-in-time explainer shown after the user answers. */
  insight?: (p: Profile, l: Lang) => string | null;
}

export const t = (l: Lang, en: string, hi: string) => (l === "hi" ? hi : en);

export const STEPS: Step[] = [
  {
    id: "goal",
    ask: (_, l) => t(l, "Okay, let's start with your people, not policies. Who are we covering?", "Chalo, policies baad mein. Pehle batao, kisko cover karna hai?"),
    chips: (_, l) => [
      { label: t(l, "Me", "Main"), value: "self", hint: t(l, "Just you", "Sirf aap") },
      { label: "Partner", value: "partner", hint: t(l, "Husband or wife", "Husband ya wife") },
      { label: t(l, "Kids", "Bachche"), value: "kids", hint: t(l, "The little ones", "Chhote wale") },
      { label: t(l, "Parents", "Mummy-Papa"), value: "parents", hint: t(l, "Mom, dad or both", "Ek ya dono") },
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
    ask: (_, l) => t(l, "How old are you?", "Aapki age kya hai?"),
    chips: (_, l) => [
      { label: t(l, "Under 25", "25 se kam"), value: "23" },
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
    id: "partnerAge",
    ask: (_, l) => t(l, "And your partner's age?", "Aur partner ki age?"),
    hint: (_, l) => t(l, "Why I'm asking: premiums and eligibility follow the eldest person on the policy.", "Kyun pooch raha hoon: premium aur eligibility sabse bade member ki age se tay hote hain."),
    chips: (_, l) => [
      { label: t(l, "Under 25", "25 se kam"), value: "23" },
      { label: "25–30", value: "28" },
      { label: "31–35", value: "33" },
      { label: "36–40", value: "38" },
      { label: "41–50", value: "45" },
      { label: "51–60", value: "55" },
    ],
    skip: (p) => !p.cover?.partner,
    done: (p) => p.partnerAge !== undefined,
    apply: (p, [v]) => ({ ...p, partnerAge: Number(v) }),
  },
  {
    id: "parentAge",
    ask: (_, l) =>
      t(l, "How old is your elder parent? Age changes a lot here: who'll accept them, waiting periods, co-pay.", "Ghar mein elder parent ki age kitni hai? Yahan age se kaafi farak padta hai: eligibility, waiting period, co-pay sab."),
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
    insight: (p, l) =>
      (p.parentAge ?? 0) >= 61
        ? t(
            l,
            `Most plans add a 20% co-pay after 60, which means you'd pay a fifth of every hospital bill for ${parentsShort(p)}. I'll call out every plan that does this.`,
            "Seedhi baat: bahut saare plans 60 ke baad 20% co-pay laga dete hain. Matlab har hospital bill ka ek-paanchva hissa aapki jeb se. Main har aise plan ko flag karunga.",
          )
        : t(
            l,
            `${parentsShort(p) === "your parents" ? "They'll" : parentsShort(p) === "Dad" ? "He'll" : "She'll"} cross 60 soon, and some plans start a co-pay at 61. So I'll check what happens then, not just today.`,
            "Woh jaldi 60 cross karenge, aur kuch plans 61 se co-pay shuru kar dete hain. Toh main aaj ka nahi, aage ka bhi dekhunga.",
          ),
  },
  {
    id: "kids",
    ask: (_, l) => t(l, "How many kids are we adding?", "Kitne bachche add karne hain?"),
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
    ask: (_, l) => t(l, "Any baby plans in the next 3 years? No pressure, it just changes the maths.", "Agle 3 saal mein baby plan hai? Koi pressure nahi, bas calculation badal jaata hai."),
    chips: (_, l) => [
      { label: t(l, "Yes", "Haan"), value: "yes" },
      { label: t(l, "Maybe", "Shayad"), value: "maybe" },
      { label: t(l, "No", "Nahi"), value: "no" },
    ],
    skip: (p) => !p.cover?.partner || (p.selfAge ?? 99) >= 40,
    done: (p) => p.planningBaby !== undefined,
    apply: (p, [v]) => ({ ...p, planningBaby: v !== "no" }),
    insight: (p, l) =>
      p.planningBaby
        ? t(
            l,
            "Good call telling me now. Maternity cover has a 2–4 year waiting period, so you buy before you plan, not after.",
            "Achha kiya abhi bata diya. Maternity cover mein 2–4 saal ka waiting period hota hai, toh plan karne se pehle lena padta hai, baad mein nahi.",
          )
        : null,
  },
  {
    id: "conditions",
    ask: (p, l) =>
      p.cover?.parents
        ? t(l, "Do your parents, or anyone else here, have an existing health condition?", "Mummy-Papa ya kisi aur ko pehle se koi health condition hai?")
        : t(l, "Does anyone you're covering have an existing health condition?", "Jinhe cover kar rahe ho, unme kisi ko pehle se koi health condition hai?"),
    hint: (_, l) =>
      t(
        l,
        "This stays between us and only helps me check waiting periods. Always declare it to the insurer though: hiding it is a top reason claims get rejected.",
        "Yeh sirf waiting period check karne ke liye hai, kisi ke saath share nahi hota. Par insurer ko hamesha sach batana: chhupane se claims reject hote hain.",
      ),
    chips: (_, l) => [
      { label: t(l, "None", "Kuch nahi"), value: "none" },
      { label: t(l, "Diabetes", "Sugar / Diabetes"), value: "diabetes" },
      { label: "High BP", value: "bp" },
      { label: "Thyroid", value: "thyroid" },
      { label: t(l, "Heart condition", "Heart problem"), value: "heart" },
      { label: "Asthma", value: "asthma" },
    ],
    multi: true,
    done: (p) => p.conditions !== undefined,
    apply: (p, vals) => ({ ...p, conditions: vals.filter((v) => v !== "none") as Condition[] }),
    insight: (p, l) =>
      p.conditions?.length
        ? t(
            l,
            p.cover?.parents
              ? `${p.conditions.map((c) => CONDITION_LABEL[c]).join(" and ")} for ${parentsShort(p)}: noted. That's exactly what I'll check every plan against, because existing conditions are only covered after a 1–4 year wait, and that's where plans differ most.`
              : `${p.conditions.map((c) => CONDITION_LABEL[c]).join(" and ")}: noted. Existing conditions are only covered after a 1–4 year wait, and that's where plans differ most. I'll check every plan against it.`,
            "Aapke liye yahi sabse important hai. Pehle se wali bimari 1–4 saal ke wait ke baad hi cover hoti hai, aur plans mein sabse bada farak yahin hai.",
          )
        : null,
  },
  {
    id: "conditionWho",
    ask: (p, l) => t(l, `Who has ${p.conditions?.length === 1 ? "it" : "them"}?`, "Yeh kisko hai?"),
    hint: (_, l) => t(l, "Why I'm asking: the waiting period applies to that person, and it changes whether separate policies make sense.", "Kyun pooch raha hoon: waiting period usi par lagta hai, aur isse alag policy ka faisla badalta hai."),
    chips: (p, l) =>
      [
        p.cover?.self ? { label: t(l, "Me", "Mujhe"), value: "self" } : null,
        p.cover?.partner ? { label: "Partner", value: "partner" } : null,
        p.cover?.parents ? { label: t(l, "My parent", "Mummy/Papa"), value: "parent" } : null,
      ].filter((c): c is Chip => !!c),
    // Only worth asking when more than one generation is covered
    skip: (p) => !p.conditions?.length || [p.cover?.self || p.cover?.partner, p.cover?.parents].filter(Boolean).length < 2,
    done: (p) => p.conditionWho !== undefined,
    apply: (p, [v]) => ({ ...p, conditionWho: v as Profile["conditionWho"] }),
  },
  {
    id: "upcoming",
    ask: (_, l) =>
      t(l, "A few quick ones so I get this exactly right. Is any treatment or surgery likely in the next 2 years?", "Kuch chhote sawaal, taaki sab sahi ho. Agle 2 saal mein koi treatment ya surgery hone ki sambhavna hai?"),
    hint: (_, l) => t(l, "Why I'm asking: planned surgeries have their own waiting periods and payout caps, and plans differ a lot here.", "Kyun pooch raha hoon: planned surgery ke alag waiting period aur limits hote hain, aur plans mein yahan bahut farak hai."),
    chips: (_, l) => [
      { label: t(l, "Nothing planned", "Kuch nahi"), value: "none" },
      { label: t(l, "Cataract", "Cataract (motiyabind)"), value: "cataract" },
      { label: t(l, "Knee or hip replacement", "Knee ya hip replacement"), value: "joint" },
      { label: t(l, "Heart procedure", "Heart procedure"), value: "heart" },
    ],
    multi: true,
    done: (p) => p.upcoming !== undefined,
    apply: (p, vals) => ({ ...p, upcoming: vals.filter((v) => v !== "none") as PlannedCare[] }),
    insight: (p, l) =>
      p.upcoming?.length
        ? t(
            l,
            "Good to know now, not later. Planned surgeries usually come with a 1–2 year wait, and some plans cap what they'll pay. I'll put the plans that cover it soonest, without caps, at the top.",
            "Achha hua abhi bata diya. Planned surgery par aksar 1–2 saal ka wait hota hai, aur kuch plans limit laga dete hain. Jo plan sabse jaldi aur bina limit cover kare, woh upar dikhaunga.",
          )
        : null,
  },
  {
    id: "city",
    ask: (_, l) => t(l, "Where would you usually get treated?", "Treatment usually kahan karwaoge?"),
    chips: (_, l) => [
      { label: t(l, "Metro (Mumbai, Delhi, Bengaluru…)", "Metro (Mumbai, Delhi, Bengaluru…)"), value: "metro" },
      { label: t(l, "Tier-2 city (Jaipur, Indore…)", "Tier-2 city (Jaipur, Indore…)"), value: "tier2" },
      { label: t(l, "Smaller town", "Chhota shehar"), value: "tier3" },
    ],
    done: (p) => !!p.city,
    apply: (p, [v]) => ({ ...p, city: v as Profile["city"] }),
    insight: (p, l) =>
      p.city === "metro"
        ? t(
            l,
            "A private room in a metro hospital is around ₹7,000 a day. Many budget plans cap rooms below that, and going over the cap shrinks your whole claim, not just the room charge.",
            "Dhyaan dena: metro hospital mein private room lagbhag ₹7,000 roz ka hota hai. Kaafi budget plans ki room limit isse kam hai, aur limit cross hui toh poora claim kat jaata hai, sirf room ka nahi.",
          )
        : null,
  },
  {
    id: "employer",
    ask: (_, l) => t(l, "Does your job give you health cover?", "Office se health cover milta hai?"),
    chips: (_, l) => [
      { label: t(l, "No", "Nahi"), value: "0" },
      { label: t(l, "Up to ₹3L", "₹3L tak"), value: "3" },
      { label: "₹3–5L", value: "5" },
      { label: t(l, "More than ₹5L", "₹5L se zyada"), value: "10" },
    ],
    skip: (p) => !p.cover?.self,
    done: (p) => p.employerCover !== undefined,
    apply: (p, [v]) => ({ ...p, employerCover: Number(v) }),
    insight: (p, l) =>
      (p.employerCover ?? 0) > 0
        ? t(
            l,
            "Nice, but it disappears the day you switch jobs. And waiting periods on your own policy only start once you buy, so starting early is the move.",
            "Badhiya, par job badli toh yeh cover bhi gaya. Aur apni policy ka waiting period tabhi shuru hota hai jab aap lete ho, toh jaldi lena hi smart move hai.",
          )
        : null,
  },
  {
    id: "existingCover",
    ask: (p, l) =>
      p.cover?.parents && !p.cover.self
        ? t(l, "Do your parents already have a health policy of their own?", "Kya Mummy-Papa ki pehle se koi apni health policy hai?")
        : t(l, "Do you already have a health policy of your own, apart from work?", "Office ke alawa, kya aapki pehle se koi apni health policy hai?"),
    hint: (_, l) => t(l, "Why I'm asking: topping up a policy you have keeps the waiting periods you've already served.", "Kyun pooch raha hoon: purani policy ko top up karne se jo waiting period poora ho chuka hai, woh bacha rehta hai."),
    chips: (_, l) => [
      { label: t(l, "No", "Nahi"), value: "0" },
      { label: t(l, "Yes, up to ₹5L", "Haan, ₹5L tak"), value: "5" },
      { label: t(l, "Yes, ₹5–10L", "Haan, ₹5–10L"), value: "10" },
      { label: t(l, "Yes, more than ₹10L", "Haan, ₹10L se zyada"), value: "15" },
    ],
    done: (p) => p.existingCover !== undefined,
    apply: (p, [v]) => ({ ...p, existingCover: Number(v) }),
    insight: (p, l) =>
      (p.existingCover ?? 0) > 0
        ? t(
            l,
            "Nice. I'll look at topping it up rather than replacing it. That's usually the cheapest way to more cover, and you keep the waiting periods you've already served.",
            "Badhiya. Main ise replace karne ke bajaye top up karne ka option dekhunga. Yeh aksar sabse sasta hai, aur poore hue waiting period bache rehte hain.",
          )
        : null,
  },
  {
    id: "savings",
    ask: (_, l) => t(l, "If a ₹5 lakh hospital bill came tomorrow, could your savings handle it?", "Agar kal ₹5 lakh ka hospital bill aa jaaye, kya savings se ho jaayega?"),
    hint: (_, l) => t(l, "Why I'm asking: it decides how much cover you need on top, and whether a cheaper top-up plan suits you.", "Kyun pooch raha hoon: isse tay hota hai kitna cover chahiye, aur sasta top-up plan aapke liye theek hai ya nahi."),
    chips: (_, l) => [
      { label: t(l, "Yes, comfortably", "Haan, aaram se"), value: "covered" },
      { label: t(l, "Partly", "Thoda bahut"), value: "partly" },
      { label: t(l, "Not really", "Nahi"), value: "no" },
    ],
    done: (p) => p.savings !== undefined,
    apply: (p, [v]) => ({ ...p, savings: v as Profile["savings"] }),
    insight: (p, l) =>
      p.savings === "no"
        ? t(l, "Then the right cover matters even more. I've added headroom so one big bill doesn't land on your savings.", "Tab sahi cover aur bhi zaroori hai. Maine extra cover joda hai taaki ek bada bill savings par na pade.")
        : null,
  },
  {
    id: "tobacco",
    ask: (_, l) => t(l, "Does anyone you're covering smoke or use tobacco?", "Jinhe cover kar rahe ho, unme koi smoke ya tobacco leta hai?"),
    hint: (_, l) =>
      t(l, "Why I'm asking: insurers usually charge a little more for tobacco. Always declare it, because hiding it is a top reason claims get rejected.", "Kyun pooch raha hoon: tobacco par premium thoda zyada hota hai. Hamesha batao, chhupane se claims reject hote hain."),
    chips: (_, l) => [
      { label: t(l, "No", "Nahi"), value: "no" },
      { label: t(l, "Yes", "Haan"), value: "yes" },
    ],
    done: (p) => p.tobacco !== undefined,
    apply: (p, [v]) => ({ ...p, tobacco: v === "yes" }),
    insight: (p, l) =>
      p.tobacco
        ? t(l, "Thanks for being upfront. I've priced every plan with that in mind, so there are no surprises later.", "Sach batane ke liye shukriya. Maine har plan ka premium isi hisaab se lagaya hai, taaki baad mein koi surprise na ho.")
        : null,
  },
  {
    id: "priorities",
    ask: (_, l) => t(l, "What matters most to you? Pick up to 3.", "Aapke liye sabse zaroori kya hai? 3 tak chuno."),
    chips: (_, l) => (Object.keys(PRIORITY_COPY) as Priority[]).map((k) => ({ label: PRIORITY_COPY[k][l][0], value: k, hint: PRIORITY_COPY[k][l][1] })),
    multi: true,
    max: 3,
    layout: "tiles",
    done: (p) => p.priorities !== undefined,
    apply: (p, vals) => ({ ...p, priorities: vals as Priority[] }),
  },
  {
    id: "budget",
    ask: (_, l) => t(l, "Last one, promise. What yearly premium feels okay?", "Bas last sawaal. Saal ka kitna premium theek lagega?"),
    chips: (_, l) => [
      { label: t(l, "Under ₹15k", "₹15k se kam"), value: "15000" },
      { label: "₹15–25k", value: "25000" },
      { label: "₹25–40k", value: "40000" },
      { label: "₹40–60k", value: "60000" },
      { label: "₹60k+", value: "100000" },
      { label: t(l, "Not sure, help me", "Pata nahi, aap batao"), value: "null" },
    ],
    done: (p) => p.budget !== undefined,
    apply: (p, [v]) => ({ ...p, budget: v === "null" ? null : Number(v) }),
  },
];

const PRIORITY_COPY: Record<Priority, Record<Lang, [string, string]>> = {
  private_room: { en: ["Private room", "Your own room, no deductions"], hi: ["Private room", "Apna room, koi katauti nahi"] },
  low_oop: { en: ["Pay less at claim time", "Keep money out of your pocket"], hi: ["Claim pe kam kharcha", "Jeb se kam se kam paisa"] },
  ped_fast: { en: ["Existing illness, covered fast", "Shorter wait for what you already have"], hi: ["Purani bimari jaldi cover", "Kam waiting period"] },
  low_premium: { en: ["Low premium", "Keep the yearly cost down"], hi: ["Kam premium", "Saal ka kharcha kam"] },
  maternity: { en: ["Maternity", "Delivery and newborn costs"], hi: ["Maternity", "Delivery aur newborn ka kharcha"] },
  restoration: { en: ["Cover that refills", "Resets if one claim uses it up"], hi: ["Cover refill ho", "Ek claim mein khatam ho toh wapas bhare"] },
  network: { en: ["Big hospital network", "More places with no upfront payment"], hi: ["Bada hospital network", "Zyada jagah cashless"] },
};

export const nextStep = (p: Profile) => STEPS.find((s) => !s.done(p) && !s.skip?.(p)) ?? null;

export const stepProgress = (p: Profile) => {
  const live = STEPS.filter((s) => !s.skip?.(p));
  return { done: live.filter((s) => s.done(p)).length, total: live.length };
};
