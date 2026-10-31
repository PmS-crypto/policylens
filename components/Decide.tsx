"use client";

import { useState } from "react";
import { CONDITION_LABEL } from "@/lib/profile";
import type { Match, Profile } from "@/lib/types";
import { ReasonRow, inrShort } from "./ui";

function addMonths(months: number) {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

export default function Decide({ profile, match, top, onSwitch }: { profile: Profile; match: Match; top: Match[]; onSwitch: (id: string) => void }) {
  const p = match.policy;
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const [handoff, setHandoff] = useState(false);
  const conds = (profile.conditions ?? []).map((c) => CONDITION_LABEL[c]);

  const timeline = [
    { m: 0, what: "Accidents covered" },
    { m: 1, what: "New illnesses covered" },
    ...(conds.length ? [{ m: p.pedWaitYears * 12, what: `${conds.join(" & ")} covered` }] : []),
    { m: p.specificWaitYears * 12, what: "Planned surgeries like cataract or knee" },
    ...(p.maternity.covered && (profile.planningBaby || profile.cover?.partner) ? [{ m: (p.maternity.waitYears ?? 0) * 12, what: "Maternity covered" }] : []),
  ]
    .sort((a, b) => a.m - b.m)
    .map((t) => ({ ...t, when: t.m === 0 ? "From day 1" : addMonths(t.m) }));

  const checklist = [
    conds.length ? `Declare ${conds.join(", ")} on the proposal form. Hidden conditions are a top reason claims get rejected.` : "Answer every health question on the proposal form honestly, even small ones.",
    `Check your nearest hospital${profile.cityName ? ` in ${profile.cityName}` : ""} is in the cashless network.`,
    `Ask the insurer to confirm the room-rent rule (§${p.clauses.find((c) => c.id === "room")?.section}) in writing.`,
    "Note the 30-day free-look period. You can cancel for a refund if it isn't what you expected.",
  ];
  const goods = match.reasons.filter((r) => r.kind === "good");
  const caveats = match.reasons.filter((r) => r.kind !== "good");
  const ready = checklist.every((_, i) => checked[i]);

  return (
    <div className="space-y-4 px-5 pb-10 pt-6">
      <div className="px-1">
        <p className="text-[13px] text-ink-soft">{p.insurer}</p>
        <h1 className="font-display text-[30px] font-semibold leading-tight">{p.name}</h1>
        <p className="mt-1 text-[14px] text-ink-soft">
          ₹{match.sumInsured} lakh cover for about {inrShort(match.premium)} a year
        </p>
        {top.length > 1 && (
          <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto">
            {top.map((m) => (
              <button
                key={m.policy.id}
                onClick={() => onSwitch(m.policy.id)}
                className={`shrink-0 rounded-full px-3.5 py-2 text-[13px] ${m.policy.id === p.id ? "bg-pine text-white shadow-e2" : "bg-surface shadow-e1 ring-1 ring-line"}`}
              >
                {m.policy.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <section className="rounded-[24px] bg-surface shadow-e1 ring-1 ring-line p-5">
        <h2 className="font-display text-[18px] font-semibold">What you get</h2>
        <ul className="mt-3 space-y-4">{goods.map((r) => <ReasonRow key={r.title} r={r} />)}</ul>
        <h2 className="font-display mt-7 text-[18px] font-semibold">What you accept</h2>
        <ul className="mt-3 space-y-4">
          {caveats.length ? caveats.map((r) => <ReasonRow key={r.title} r={r} />) : <p className="text-[14px] text-ink-soft">Nothing significant for your family.</p>}
        </ul>
      </section>

      <section className="rounded-[24px] bg-pine p-5 text-white shadow-e2">
        <h2 className="font-display text-[18px] font-semibold">If you buy today</h2>
        <ol className="relative mt-4 space-y-4 border-l-2 border-white/20 pl-5">
          {timeline.map((t, i) => (
            <li key={i} className="relative">
              <span className={`absolute -left-[27px] top-1 h-3 w-3 rounded-full ${t.m <= 1 ? "bg-[#8fd6b4]" : "bg-gold"}`} />
              <p className="num text-[17px] font-semibold">{t.when}</p>
              <p className="text-[13px] text-white/75">{t.what}</p>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-[13px] text-white/70">Waiting periods only start the day you buy. Every month you wait moves these dates back.</p>
      </section>

      <section className="rounded-[24px] bg-surface shadow-e1 ring-1 ring-line p-5">
        <h2 className="font-display text-[18px] font-semibold">Before you pay</h2>
        <ul className="mt-3 space-y-3">
          {checklist.map((c, i) => (
            <li key={i}>
              <label className="flex cursor-pointer gap-3 text-[14px] leading-relaxed">
                <input type="checkbox" checked={!!checked[i]} onChange={(e) => setChecked({ ...checked, [i]: e.target.checked })} className="mt-1 h-5 w-5 shrink-0 accent-[#12312a]" />
                <span className={checked[i] ? "text-ink-soft line-through" : ""}>{c}</span>
              </label>
            </li>
          ))}
        </ul>
      </section>

      <p className="text-center text-[12.5px] text-ink-soft">
        {ready ? "All checks done. You're ready." : `${checklist.filter((_, i) => checked[i]).length} of ${checklist.length} checks done`}
      </p>
      <button onClick={() => setHandoff(true)} className="flex w-full items-center justify-center gap-2 rounded-[16px] bg-pine py-4 text-[15px] font-semibold text-white shadow-e2">
        Continue to {p.insurer}
      </button>
      {handoff && (
        <p className="rounded-[20px] bg-surface shadow-e1 ring-1 ring-line p-4 text-[14px] leading-relaxed">
          In the live product this opens {p.insurer}'s purchase page through an IRDAI-authorised partner, with your details filled in. You'd only complete the medical declaration and payment.
        </p>
      )}
      <button className="w-full rounded-[16px] py-3.5 text-[14px] font-medium text-pine ring-1 ring-line">Talk to a licensed advisor, free</button>
      <p className="px-1 text-[12px] leading-relaxed text-ink-soft">
        PolicyLens explains policy wording to help you decide. It is not underwriting advice or a promise that a claim will be paid. Plans and prices here are illustrative.
      </p>
    </div>
  );
}
