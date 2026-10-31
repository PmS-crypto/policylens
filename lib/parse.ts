import type { Condition, Priority, Profile } from "./types";

const METROS = ["mumbai", "delhi", "new delhi", "bengaluru", "bangalore", "chennai", "kolkata", "hyderabad", "pune", "gurgaon", "gurugram", "noida", "navi mumbai", "thane"];
const TIER2 = ["jaipur", "lucknow", "indore", "bhopal", "nagpur", "surat", "ahmedabad", "chandigarh", "kochi", "coimbatore", "vadodara", "patna", "bhubaneswar", "visakhapatnam", "vizag", "mysuru", "mysore", "nashik", "dehradun", "ludhiana", "kanpur", "goa", "mangalore", "trivandrum", "thiruvananthapuram", "raipur", "ranchi", "guwahati"];
const WORD_NUM: Record<string, number> = { one: 1, two: 2, three: 3, a: 1, an: 1 };

/**
 * Rule-based extraction used when no LLM key is configured, and as a safety net
 * alongside the LLM. Pulls whatever profile fields it can find in free text.
 */
export function parseFreeText(text: string, stepId?: string): Partial<Profile> {
  const t = " " + text.toLowerCase().replace(/[,₹]/g, " ") + " ";
  const out: Partial<Profile> = {};

  const babyPlan = /(plan|planning|expecting|pregnan|trying for|want)[^.]{0,20}(baby|child|kid)|pregnan/.test(t);
  if (babyPlan) out.planningBaby = true;

  const partner = /\b(wife|husband|spouse|partner|patni|biwi|pati)\b/.test(t);
  const kids = !babyPlan && /\b(kids?|child|children|sons?|daughters?)\b/.test(t) || /\b(my|our) (baby|son|daughter)\b/.test(t);
  const parents = /\b(parents?|mom|mum|mother|dad|father|in-?laws|papa|mummy|maa|mata|pitaji|ammi|abbu)\b/.test(t);
  const selfish = /\b(me|myself|us|we|we're|our family|whole family)\b/.test(t);
  if (partner || kids || parents || /\b(just me|only me|myself)\b/.test(t)) {
    out.cover = { self: selfish || partner || kids || !parents, partner, kids, parents };
  }

  // Name the person: "Dad is 62" lets the app say "your dad" instead of "the insured member".
  const dad = /\b(dad|daddy|papa|father|pitaji|abbu)\b/.test(t);
  const mum = /\b(mom|mum|mummy|mother|maa|mata|ammi)\b/.test(t);
  // The parent named specifically (with an age or illness) is the one the copy should talk about.
  if (dad || mum) out.parentWho = dad && mum ? "both" : dad ? "dad" : "mum";

  const kc = t.match(/\b(\d|one|two|three|a|an)\s+(kids?|children|sons?|daughters?|child)\b/);
  if (kc) out.kidsCount = Number(kc[1]) || WORD_NUM[kc[1]] || 1;

  const pa = t.match(/\b(?:parents?|mom|mum|mother|dad|father|papa|mummy|maa|mata|pitaji)\b[^.\d]{0,30}(\d{2})\b/) ?? t.match(/\b(\d{2})\s*(?:-|year)[^.]{0,12}\b(?:old )?(?:mom|mum|mother|dad|father|parents?)\b/);
  if (pa) out.parentAge = Number(pa[1]);
  const sa = t.match(/\b(?:i'm|i am|im|age|aged|myself)\s*(\d{2})\b/) ?? t.match(/\b(\d{2})\s*(?:yo|y\/o|years? old|yrs)\b(?![^.]{0,20}(?:mom|mother|dad|father|parent))/);
  if (sa && Number(sa[1]) !== out.parentAge) out.selfAge = Number(sa[1]);

  const conds: Condition[] = [];
  if (/diabet|sugar|madhumeh/.test(t)) conds.push("diabetes");
  if (/\bbp\b|blood pressure|hypertension/.test(t)) conds.push("bp");
  if (/thyroid/.test(t)) conds.push("thyroid");
  if (/heart|cardiac|stent|bypass/.test(t)) conds.push("heart");
  if (/asthma/.test(t)) conds.push("asthma");
  if (conds.length) out.conditions = conds;
  else if (/\b(no (existing |health |medical )?(issues?|conditions?|problems?|illness)|healthy|nothing|none)\b/.test(t) && (stepId === "conditions" || /healthy|no (health|medical)/.test(t))) out.conditions = [];

  const metro = METROS.find((c) => t.includes(" " + c));
  const t2 = TIER2.find((c) => t.includes(" " + c));
  if (metro) Object.assign(out, { city: "metro", cityName: cap(metro) });
  else if (t2) Object.assign(out, { city: "tier2", cityName: cap(t2) });
  else if (/small town|village|tier[- ]?3/.test(t)) out.city = "tier3";

  const money = (n: string, unit?: string) => {
    const v = parseFloat(n);
    if (!unit) return v < 1000 ? v * 1000 : v;
    return /^l/.test(unit) ? v * 100000 : v * 1000;
  };
  const b = t.match(/(?:budget|premium|afford|spend|pay)[^.\d]{0,25}(\d+(?:\.\d+)?)\s*(k|thousand|hazaar|hazar|l|lakh|lac)?/) ?? t.match(/(\d+(?:\.\d+)?)\s*(k|thousand)?\s*(?:a|per|\/)\s*(?:year|yr|annum)/);
  if (b) out.budget = money(b[1], b[2]);
  else if (stepId === "budget") {
    const n = t.match(/(\d+(?:\.\d+)?)\s*(k|thousand|l|lakh|lac)?/);
    if (n) out.budget = money(n[1], n[2]);
    else if (/not sure|no idea|don't know|guide/.test(t)) out.budget = null;
  }

  const emp = t.match(/(?:company|office|employer|corporate|work)[^.]{0,30}?(\d+(?:\.\d+)?)\s*(l|lakh|lac)/);
  if (emp) out.employerCover = parseFloat(emp[1]);
  else if (/no (company|employer|corporate|office)|self[- ]employed|freelanc|business owner/.test(t)) out.employerCover = 0;

  const pr: Priority[] = [];
  if (/private room|own room|single room/.test(t)) pr.push("private_room");
  if (/out of pocket|full(y)? cover|no deduction|pay nothing|no co-?pay/.test(t)) pr.push("low_oop");
  if (/cheap|low(est)? premium|affordable|budget friendly/.test(t)) pr.push("low_premium");
  if (/maternity|delivery/.test(t)) pr.push("maternity");
  if (/network|cashless|near(by)? hospital/.test(t)) pr.push("network");
  if (pr.length) out.priorities = pr;

  // Partner's age: "my wife is 30", "husband 34"
  const pa2 = t.match(/\b(?:wife|husband|partner|spouse|patni|pati)\b[^.\d]{0,20}(\d{2})\b/);
  if (pa2) out.partnerAge = Number(pa2[1]);

  // Treatment expected soon
  const planned: ("cataract" | "joint" | "heart")[] = [];
  if (/cataract|motiyabind/.test(t)) planned.push("cataract");
  if (/knee|hip|joint replacement/.test(t)) planned.push("joint");
  if (/bypass|angioplasty|stent|heart surgery|heart procedure/.test(t)) planned.push("heart");
  if (planned.length) out.upcoming = planned;
  else if (stepId === "upcoming" && /\b(no|none|nothing|nahi)\b/.test(t)) out.upcoming = [];

  // Tobacco
  if (/\b(non-?smoker|don'?t smoke|doesn'?t smoke|no (smoking|tobacco))\b/.test(t)) out.tobacco = false;
  else if (/smok|tobacco|cigarette|gutka|bidi/.test(t)) out.tobacco = true;
  else if (stepId === "tobacco") out.tobacco = /\b(yes|haan|yeah)\b/.test(t) ? true : /\b(no|nahi|nope)\b/.test(t) ? false : undefined;

  // A personal policy already held
  const own = t.match(/(?:own|personal|existing|already have|current)[^.]{0,30}?(\d+(?:\.\d+)?)\s*(?:l|lakh|lac)\b/);
  if (own) out.existingCover = parseFloat(own[1]);
  else if (stepId === "existingCover" && /\b(no|none|nahi|don'?t)\b/.test(t)) out.existingCover = 0;

  // Savings buffer
  if (stepId === "savings") {
    if (/comfortabl|easily|yes|haan|sure/.test(t)) out.savings = "covered";
    else if (/partly|some|half|thoda/.test(t)) out.savings = "partly";
    else if (/\b(no|not really|nahi|can'?t|cannot)\b/.test(t)) out.savings = "no";
  }

  // Who has the condition
  if (stepId === "conditionWho") {
    if (/\b(mom|mum|mother|dad|father|parent|maa|papa)\b/.test(t)) out.conditionWho = "parent";
    else if (/\b(wife|husband|partner|spouse)\b/.test(t)) out.conditionWho = "partner";
    else if (/\b(me|myself|i have|mujhe)\b/.test(t)) out.conditionWho = "self";
  }

  // Step-aware fallbacks for bare answers like "32" or "2"
  const bare = t.trim().match(/^(\d{1,2})$/);
  if (bare) {
    const n = Number(bare[1]);
    if (stepId === "selfAge") out.selfAge = n;
    if (stepId === "partnerAge") out.partnerAge = n;
    if (stepId === "parentAge") out.parentAge = n;
    if (stepId === "kids") out.kidsCount = n;
  }
  if (stepId === "baby" && /\b(no|nope|not)\b/.test(t)) out.planningBaby = false;
  if (stepId === "baby" && /\b(yes|yeah|maybe|soon)\b/.test(t)) out.planningBaby = true;
  if (stepId === "employer" && /\b(no|none|nope)\b/.test(t) && out.employerCover === undefined) out.employerCover = 0;

  return out;
}

const cap = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());
