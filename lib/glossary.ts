// Plain-English answers to the questions people ask mid-conversation. Used when no LLM is available.
const TERMS: [RegExp, string][] = [
  [/co-?pay/, "Co-pay means you pay part of every hospital bill. With 20% co-pay on a ₹2L bill, you pay ₹40,000. The plan pays the rest."],
  [/waiting period|wait/, "A waiting period is how long you wait before the plan pays. For an illness you already have, it's often 1–4 years. For having a baby, 2–4 years."],
  [/pre-?existing|existing (illness|condition|disease)/, "A pre-existing illness is one you have before you buy, like diabetes or BP. The plan pays for it only after a wait. Always tell the insurance company about it."],
  [/room rent|room/, "Room rent is what the plan pays for your room each day. If your room costs more, the plan cuts your whole bill, not just the room."],
  [/sum insured|cover amount|coverage amount|how much cover/, "Sum insured is the most the plan pays in a year. For a family in a big city, ₹10–15 lakh is a good start."],
  [/premium/, "The premium is what you pay each year to keep the plan. It goes up as you get older and as you pick more cover."],
  [/cashless/, "Cashless means the plan pays the hospital for you. You don't pay first and ask for money back later. It works at the plan's listed hospitals."],
  [/sub-?limit|cap/, "A sub-limit is the most the plan pays for one treatment, like knee or eye surgery. Big cover doesn't change it."],
  [/restor|refill/, "Restoration means your cover refills if you use it all up. Then the rest of your family is still covered that year."],
  [/no.?claim|bonus|ncb/, "No-claim bonus means your cover grows each year you don't use it. It costs nothing extra."],
  [/claim/, "A claim is asking the plan to pay a hospital bill. It can pay the hospital directly, or pay you back later."],
  [/why|need|worth/, "One hospital stay can cost lakhs. Insurance swaps that big shock for a small cost each year."],
];

export function glossaryAnswer(question: string): string | null {
  const q = question.toLowerCase();
  return TERMS.find(([re]) => re.test(q))?.[1] ?? null;
}
