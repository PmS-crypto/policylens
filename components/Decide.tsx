"use client";

import { useState } from "react";
import { CONDITION_LABEL } from "@/lib/profile";
import type { Match, Profile } from "@/lib/types";
import { AURA, Aura, Icon, Money, ReasonRow, SlicedOrb } from "./ui";

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
    .map((t) => ({ ...t, when: t.m === 0 ? "Day one" : addMonths(t.m) }));

  // The checklist is a real sequence, so it's numbered.
  const checklist = [
    { title: "Declare honestly", body: conds.length ? `Mention ${conds.join(", ")} on the form. Hidden conditions are a top reason claims are rejected.` : "Answer every health question on the form, even small ones." },
    { title: "Check your hospital", body: `Make sure your nearest hospital${profile.cityName ? ` in ${profile.cityName}` : ""} is cashless.` },
    { title: "Confirm room rules", body: `Ask the insurer to confirm §${p.clauses.find((c) => c.id === "room")?.section} in writing.` },
    { title: "Note the free look", body: "You have 30 days to cancel for a refund." },
  ];
  const doneCount = checklist.filter((_, i) => checked[i]).length;
  const goods = match.reasons.filter((r) => r.kind === "good");
  const caveats = match.reasons.filter((r) => r.kind !== "good");

  return (
    <div className="pb-12">
      <header className="relative overflow-hidden px-6 pt-6">
        <div className="absolute -right-16 -top-6 text-ink opacity-90" aria-hidden>
          <SlicedOrb size={190} />
        </div>
        <p className="relative text-[13px] font-medium text-accent">Your choice</p>
        <h1 className="display relative mt-2 max-w-[9ch] text-[42px]">{p.name}</h1>
        <p className="relative mt-3 text-[15px] text-ink-soft">{p.insurer}</p>
        <div className="relative mt-6 flex gap-8">
          <div>
            <Money value={match.premium} className="text-[34px]" />
            <p className="mt-1 text-[12.5px] text-ink-soft">a year, estimated</p>
          </div>
          <div>
            <span className="money text-[34px]">₹{match.sumInsured}L</span>
            <p className="mt-1 text-[12.5px] text-ink-soft">cover</p>
          </div>
        </div>
        {top.length > 1 && (
          <div className="no-scrollbar relative mt-6 flex gap-2 overflow-x-auto">
            {top.map((m) => (
              <button key={m.policy.id} onClick={() => onSwitch(m.policy.id)} className={`shrink-0 rounded-full px-4 py-2.5 text-[13px] transition-all ${m.policy.id === p.id ? "bg-primary text-on-primary shadow-e2" : "bg-surface shadow-e1 ring-1 ring-line"}`}>
                {m.policy.name}
              </button>
            ))}
          </div>
        )}
      </header>

      <section className="mx-5 mt-8 rounded-[32px] bg-surface p-6 shadow-e1 ring-1 ring-line">
        <h2 className="title text-[20px]">What you get</h2>
        <ul className="mt-5 space-y-6">{goods.map((r) => <ReasonRow key={r.title} r={r} />)}</ul>
        <h2 className="title mt-10 text-[20px]">What you accept</h2>
        <ul className="mt-5 space-y-6">{caveats.length ? caveats.map((r) => <ReasonRow key={r.title} r={r} />) : <p className="text-[14px] text-ink-soft">Nothing significant for your family.</p>}</ul>
      </section>

      <Aura colors={AURA.calm} scrim className="relative mx-5 mt-5 rounded-[32px] p-6 text-white">
        <h2 className="title text-[20px]">If you buy today</h2>
        <ol className="mt-6 space-y-5">
          {timeline.map((t, i) => (
            <li key={i} className="grid grid-cols-[96px_1fr] items-baseline gap-3">
              <span className="money text-[22px]">{t.when}</span>
              <span className="text-[14px] leading-snug opacity-90">{t.what}</span>
            </li>
          ))}
        </ol>
        <p className="mt-6 text-[13px] leading-relaxed opacity-85">Waiting periods only start the day you buy. Every month you wait moves these dates back.</p>
      </Aura>

      <section className="mt-10 px-6">
        <div className="flex items-baseline justify-between">
          <h2 className="title text-[20px]">Before you pay</h2>
          <span className="text-[13px] text-ink-soft">
            {doneCount} of {checklist.length} done
          </span>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          {checklist.map((c, i) => {
            const on = !!checked[i];
            return (
              <button
                key={c.title}
                onClick={() => setChecked({ ...checked, [i]: !on })}
                aria-pressed={on}
                className={`flex min-h-[168px] flex-col rounded-[26px] p-4 text-left transition-all duration-300 ${on ? "bg-accent text-white shadow-e2" : "bg-surface shadow-e1 ring-1 ring-line"}`}
              >
                <span className="flex items-start justify-between">
                  <span className={`money text-[30px] ${on ? "" : "text-ink-faint"}`}>0{i + 1}</span>
                  <span className={`grid h-6 w-6 place-items-center rounded-full ${on ? "bg-white text-accent" : "ring-1 ring-line"}`}>{on && <Icon name="check" size={13} stroke={2.8} />}</span>
                </span>
                <span className="title mt-auto block text-[15px]">{c.title}</span>
                <span className={`mt-1 block text-[12.5px] leading-snug ${on ? "opacity-85" : "text-ink-soft"}`}>{c.body}</span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="mt-8 space-y-3 px-6">
        <button onClick={() => setHandoff(true)} className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-5 text-[16px] font-semibold text-on-primary shadow-e2">
          Continue to {p.insurer}
          <Icon name="arrow" size={18} />
        </button>
        {handoff && (
          <p className="rise rounded-[24px] bg-surface p-5 text-[14px] leading-relaxed shadow-e1 ring-1 ring-line">
            In the live product this opens {p.insurer}'s purchase page through an IRDAI-authorised partner, with your details filled in. You'd only complete the medical declaration and payment.
          </p>
        )}
        <button className="flex w-full items-center justify-center gap-2 rounded-full py-4 text-[14.5px] font-medium ring-1 ring-line">
          <Icon name="advisor" size={17} />
          Talk to a licensed advisor, free
        </button>
      </div>
      <p className="mt-8 px-6 text-[12.5px] leading-relaxed text-ink-soft">
        PolicyLens explains policy wording to help you decide. It is not underwriting advice or a promise that a claim will be paid. Plans and prices here are illustrative.
      </p>
    </div>
  );
}
