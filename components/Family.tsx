"use client";

import { stepProgress } from "@/lib/flow";
import {
  CITY_LABEL,
  CONDITION_LABEL,
  PRIORITY_LABEL,
  conditionHolder,
  coverSummary,
  effectivePriorities,
  inr,
  recommendSumInsured,
} from "@/lib/profile";
import type { Profile } from "@/lib/types";
import { Sheet } from "./ui";

interface Member {
  key: string;
  label: string;
  age?: number;
  flagged?: boolean;
}

function members(p: Profile): Member[] {
  const c = p.cover;
  if (!c) return [];
  const holder = conditionHolder(p);
  const sick = !!p.conditions?.length;
  const m: Member[] = [];
  if (c.self) m.push({ key: "self", label: "You", age: p.selfAge, flagged: sick && holder === "self" });
  if (c.partner) m.push({ key: "partner", label: "Partner", age: p.selfAge });
  if (c.kids) for (let i = 0; i < (p.kidsCount ?? 1); i++) m.push({ key: "kid" + i, label: "Kid" });
  if (c.parents) m.push({ key: "parents", label: "Parents", age: p.parentAge, flagged: sick && holder === "parent" });
  return m;
}

/** The family, assembling itself as the conversation goes. Tap to review the profile. */
export function FamilyBar({ profile, onOpen }: { profile: Profile; onOpen: () => void }) {
  const ms = members(profile);
  const { done, total } = stepProgress(profile);
  const pct = total ? done / total : 0;
  return (
    <button onClick={onOpen} className="flex w-full items-center gap-3 px-4 py-3 text-left" aria-label="Review your profile">
      <div className="flex -space-x-2">
        {ms.length === 0 && <span className="grid h-10 w-10 place-items-center rounded-full border-2 border-dashed border-white/40 text-white/60">?</span>}
        {ms.slice(0, 5).map((m) => (
          <span key={m.key} className="relative grid h-10 w-10 place-items-center rounded-full border-2 border-pine bg-white text-[11px] font-bold text-pine">
            {m.label === "Parents" ? "M&D" : m.label === "Partner" ? "P" : m.label[0]}
            {m.flagged && <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-pine bg-mark" />}
          </span>
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-semibold text-white">{profile.cover ? coverSummary(profile) : "Your family"}</p>
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/15">
          <div className="h-full rounded-full bg-mark transition-all duration-500" style={{ width: `${pct * 100}%` }} />
        </div>
      </div>
      <span className="text-[12px] text-white/70">Profile</span>
    </button>
  );
}

export function ProfileSheet({ profile: p, onEdit, onClose }: { profile: Profile; onEdit: (f: keyof Profile) => void; onClose: () => void }) {
  const si = recommendSumInsured(p);
  const rows: { label: string; value?: string; field: keyof Profile }[] = [
    { label: "Who's covered", value: p.cover ? coverSummary(p) : undefined, field: "cover" },
    { label: "Existing conditions", value: p.conditions ? (p.conditions.length ? p.conditions.map((c) => CONDITION_LABEL[c]).join(", ") : "None") : undefined, field: "conditions" },
    { label: "Where you'd get treated", value: p.city ? (p.cityName ?? CITY_LABEL[p.city]) : undefined, field: "city" },
    ...(p.cover?.self ? [{ label: "Employer cover", value: p.employerCover === undefined ? undefined : p.employerCover ? `₹${p.employerCover} lakh` : "None", field: "employerCover" as const }] : []),
    ...(p.planningBaby !== undefined ? [{ label: "Planning a baby", value: p.planningBaby ? "Within 3 years" : "No", field: "planningBaby" as const }] : []),
    { label: "What matters most", value: p.priorities ? effectivePriorities(p).map((x) => PRIORITY_LABEL[x]).join(", ") || "Balanced" : undefined, field: "priorities" },
    { label: "Yearly budget", value: p.budget === undefined ? undefined : p.budget ? `Up to ${inr(p.budget)}` : "Open", field: "budget" },
  ];
  return (
    <Sheet onClose={onClose} title={<h2 className="font-display text-[24px] font-bold">What I know about you</h2>}>
      <p className="text-[14px] text-ink-soft">Tap anything to change it. None of this is shared with insurers.</p>
      <ul className="mt-4 divide-y divide-line">
        {rows.map((r) => (
          <li key={r.label}>
            <button disabled={!r.value} onClick={() => onEdit(r.field)} className="flex w-full items-center justify-between gap-4 py-3.5 text-left">
              <span className="text-[14px] text-ink-soft">{r.label}</span>
              <span className={`text-right text-[14px] font-medium ${r.value ? "" : "text-ink-soft/50"}`}>{r.value ?? "Not yet"}</span>
            </button>
          </li>
        ))}
      </ul>
      {p.cover && p.city && (
        <div className="mt-4 rounded-2xl bg-mist p-4">
          <p className="text-[14px] text-ink-soft">Cover we'd suggest</p>
          <p className="font-display text-[34px] font-extrabold leading-tight">₹{si.lakh} lakh</p>
          <ul className="mt-2 space-y-1.5 text-[13px] leading-relaxed text-ink-soft">
            {si.why.map((w) => (
              <li key={w}>{w}.</li>
            ))}
          </ul>
        </div>
      )}
    </Sheet>
  );
}
