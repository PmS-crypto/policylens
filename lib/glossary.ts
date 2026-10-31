// Plain-English answers to the questions people ask mid-conversation. Used when no LLM is available.
const TERMS: [RegExp, string][] = [
  [/co-?pay/, "Co-pay is the share of every hospital bill you pay yourself. With a 20% co-pay on a ₹2L bill, you pay ₹40,000 and the insurer pays the rest."],
  [/waiting period|wait/, "A waiting period is how long you must hold the policy before something is covered. Illnesses you already have usually wait 1–4 years; maternity 2–4 years."],
  [/pre-?existing|existing (illness|condition|disease)/, "A pre-existing condition is anything you've been diagnosed with before buying, like diabetes or BP. It's covered only after its waiting period, so declare it honestly."],
  [/room rent|room/, "Room rent is the daily room charge a plan will pay. If your room costs more than the cap, the plan cuts the whole bill proportionately, not just the room."],
  [/sum insured|cover amount|coverage amount|how much cover/, "Sum insured is the most the insurer pays in a year. For a family in a metro, ₹10–15 lakh is a sensible starting point."],
  [/premium/, "The premium is what you pay every year to keep the policy active. It rises with age and with how much cover you choose."],
  [/cashless/, "Cashless means the insurer pays a network hospital directly, so you don't pay upfront and claim later."],
  [/sub-?limit|cap/, "A sub-limit caps what's paid for a specific treatment, like cataract or knee surgery, no matter how big your cover is."],
  [/restor|refill/, "Restoration refills your cover if a claim uses it up, so the rest of the family stays protected that year."],
  [/no.?claim|bonus|ncb/, "No-claim bonus increases your cover for every year you don't claim, at no extra cost."],
  [/claim/, "A claim is asking the insurer to pay a hospital bill, either cashless at a network hospital or as a reimbursement later."],
  [/why|need|worth/, "Because one hospital stay can cost lakhs. Insurance turns that unpredictable cost into a fixed yearly premium."],
];

export function glossaryAnswer(question: string): string | null {
  const q = question.toLowerCase();
  return TERMS.find(([re]) => re.test(q))?.[1] ?? null;
}
