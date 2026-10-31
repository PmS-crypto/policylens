export type Condition = "diabetes" | "bp" | "thyroid" | "heart" | "asthma";
export type CityTier = "metro" | "tier2" | "tier3";
export type Priority =
  | "private_room"
  | "low_oop"
  | "ped_fast"
  | "low_premium"
  | "maternity"
  | "restoration"
  | "network";

export interface Cover {
  self: boolean;
  partner: boolean;
  kids: boolean;
  parents: boolean;
}

export interface Profile {
  name?: string;
  cover?: Cover;
  selfAge?: number;
  parentAge?: number;
  kidsCount?: number;
  planningBaby?: boolean;
  conditions?: Condition[];
  city?: CityTier;
  cityName?: string;
  employerCover?: number; // lakh, 0 = none
  priorities?: Priority[];
  budget?: number | null; // max annual premium in ₹, null = "not sure"
}

export interface Clause {
  id: string;
  section: string;
  title: string;
  text: string;
}

export interface Policy {
  id: string;
  name: string;
  insurer: string;
  tagline: string;
  accent: string;
  basePremium: number; // ₹10L SI, one adult aged 30, tier-2 city
  ageSlope: number; // yearly premium growth factor
  siOptions: number[]; // lakh
  minEntryAge?: number;
  maxEntryAge: number;
  roomRent: { kind: "none" | "single" | "percent"; percent?: number };
  copay: { percent: number; fromAge?: number };
  pedWaitYears: number;
  specificWaitYears: number;
  maternity: { covered: boolean; waitYears?: number; limit?: number };
  restoration: "unlimited" | "once" | "none";
  ncb: string;
  network: number;
  sublimits: { cataract?: number; knee?: number; cardiac?: number };
  consumablesCovered: boolean;
  opd?: number;
  prePostDays: [number, number];
  docVersion: string;
  lastVerified: string;
  clauses: Clause[];
}

export type ReasonKind = "good" | "caveat" | "bad";

export interface Reason {
  kind: ReasonKind;
  title: string;
  detail: string;
  clauseId?: string;
  priority?: Priority;
}

export interface Match {
  policy: Policy;
  sumInsured: number; // lakh
  premium: number; // ₹ / year
  score: number;
  fit: "Strong fit" | "Good fit" | "Partial fit";
  prioritiesMet: number;
  prioritiesTotal: number;
  reasons: Reason[];
  label?: string;
}

export interface Excluded {
  policy: Policy;
  why: string;
}
