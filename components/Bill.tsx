"use client";

import { useMemo, useState } from "react";
import { CITY_COST_FACTOR, CITY_LABEL } from "@/lib/profile";
import { SCENARIOS, YEAR_LABEL, headlineScenario, simulate, type RoomType } from "@/lib/simulate";
import type { Match, Profile } from "@/lib/types";
import { Segmented, inrShort } from "./ui";

interface Props {
  profile: Profile;
  top: Match[];
  focusId?: string;
  onOpen: (id: string, clause?: string) => void;
}

/** The signature screen: each plan rendered as the hospital bill you'd actually receive. */
export default function Bill({ profile, top, focusId, onOpen }: Props) {
  const head = useMemo(() => headlineScenario(profile), [profile]);
  const scenarios = useMemo(() => [...SCENARIOS].sort((a, b) => Number(b.relevant(profile)) - Number(a.relevant(profile))), [profile]);
  const [sid, setSid] = useState(head.scenario.id);
  const [year, setYear] = useState(head.year);
  const [room, setRoom] = useState<RoomType>("private");
  const [pid, setPid] = useState(focusId ?? top[0]?.policy.id);
  const [bills, setBills] = useState<Record<string, number>>({});
  const s = scenarios.find((x) => x.id === sid)!;
  const city = profile.city ?? "tier2";
  const bill = bills[sid] ?? Math.round((s.bill * CITY_COST_FACTOR[city]) / 5000) * 5000;

  const all = top.map((m) => ({ m, r: simulate(m.policy, m.sumInsured, profile, s, { year, room, bill }) }));
  const cur = all.find((x) => x.m.policy.id === pid) ?? all[0];
  const { m, r } = cur;
  const today = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <div className="pb-8">
      <div className="px-5 pt-5">
        <h1 className="font-display text-[28px] font-extrabold leading-[1.1]">Your bill, before it happens</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">Pick something that could happen. I'll run the hospital bill through each plan's rules and show you every rupee that comes back to you.</p>
      </div>

      <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto px-5">
        {scenarios.map((x) => (
          <button
            key={x.id}
            onClick={() => setSid(x.id)}
            className={`shrink-0 rounded-full px-4 py-2 text-[13px] ${sid === x.id ? "bg-pine font-semibold text-white" : "bg-surface"} ${x.relevant(profile) ? "" : "opacity-60"}`}
          >
            {x.title}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-2 px-5">
        <Segmented value={year} onChange={setYear} options={[1, 2, 3, 4].map((y) => ({ value: y, label: YEAR_LABEL[y] }))} />
        <Segmented value={room} onChange={setRoom} options={[{ value: "shared", label: "Shared room" }, { value: "private", label: "Private room" }, { value: "deluxe", label: "Deluxe room" }]} />
      </div>

      {/* Plan switcher doubles as the summary: what you pay on each */}
      <div className="mt-5 grid grid-cols-3 gap-2 px-5">
        {all.map(({ m: mm, r: rr }) => (
          <button
            key={mm.policy.id}
            onClick={() => setPid(mm.policy.id)}
            className={`rounded-2xl p-3 text-left transition ${mm.policy.id === m.policy.id ? "bg-pine text-white" : "bg-surface"}`}
          >
            <span className={`block truncate text-[12px] ${mm.policy.id === m.policy.id ? "text-white/70" : "text-ink-soft"}`}>{mm.policy.name}</span>
            <span className={`font-display block text-[18px] font-extrabold ${rr.youPay === 0 ? (mm.policy.id === m.policy.id ? "text-[#7fe0b5]" : "text-paid") : mm.policy.id === m.policy.id ? "text-[#ff9b9b]" : "text-owe"}`}>
              {inrShort(rr.youPay)}
            </span>
          </button>
        ))}
      </div>

      {/* The receipt */}
      <div className="relative mx-5 mt-4">
        <div className="receipt-edge bg-surface px-5 pb-10 pt-5 font-mono text-[12.5px] leading-relaxed text-ink">
          <div className="text-center">
            <p className="font-sans text-[15px] font-bold">Estimated hospital bill</p>
            <p className="text-ink-soft">
              {profile.cityName ?? CITY_LABEL[city]}, {today}
            </p>
            <p className="text-ink-soft">
              Claim under {m.policy.insurer} {m.policy.name}, ₹{m.sumInsured}L
            </p>
            <div
              key={`${m.policy.id}-${sid}-${year}-${room}-${r.youPay}`}
              className={`stamp stamp-in mx-auto mt-3 w-fit px-3 py-1 font-sans text-[15px] font-extrabold uppercase ${r.blocked ? "text-owe" : r.youPay === 0 ? "text-paid" : "text-warn"}`}
            >
              {r.blocked ? "Not covered yet" : r.youPay === 0 ? "Paid in full" : `${Math.round((r.insurerPays / r.bill) * 100)}% paid`}
            </div>
          </div>
          <div className="my-3 border-t border-dashed border-ink/30" />
          <Line label={s.title} amount={r.bill} />
          <p className="text-ink-soft">
            {s.days > 0 ? `${s.days} nights, ${room} room` : "Day-care procedure"}, {YEAR_LABEL[year].toLowerCase()}
          </p>

          <div className="my-3 border-t border-dashed border-ink/30" />
          <p className="mb-1 font-sans text-[12px] font-semibold text-ink-soft">Not paid by the insurer</p>
          {r.lines.length === 0 && <p className="text-paid">Nothing. Every rupee is admissible.</p>}
          {r.lines.map((l) => (
            <div key={l.label} className="py-1">
              <Line label={l.label} amount={-l.amount} owe />
              <p className="text-[11.5px] text-ink-soft">
                {l.note}{" "}
                {l.clauseId && (
                  <button onClick={() => onOpen(m.policy.id, l.clauseId)} className="mark font-semibold text-ink">
                    §{m.policy.clauses.find((c) => c.id === l.clauseId)?.section}
                  </button>
                )}
              </p>
            </div>
          ))}

          <div className="my-3 border-t border-dashed border-ink/30" />
          <Line label="Insurer pays" amount={r.insurerPays} />
          <div className="mt-2 flex items-end justify-between font-sans">
            <span className="text-[15px] font-bold">You pay</span>
            <span className={`font-display text-[34px] font-extrabold leading-none ${r.youPay === 0 ? "text-paid" : "text-owe"}`}>{inrShort(r.youPay)}</span>
          </div>
        </div>
      </div>

      <div className="mx-5 mt-5 rounded-2xl bg-surface p-4">
        <div className="flex items-center justify-between text-[13px]">
          <span className="font-medium">Change the bill amount</span>
          <span className="font-display font-bold">{inrShort(bill)}</span>
        </div>
        <input
          type="range"
          min={20000}
          max={1000000}
          step={5000}
          value={bill}
          aria-label="Hospital bill amount"
          onChange={(e) => setBills({ ...bills, [sid]: Number(e.target.value) })}
          className="mt-3 w-full accent-[#12312a]"
        />
      </div>
      <p className="mt-4 px-5 text-[12px] leading-relaxed text-ink-soft">
        An estimate from typical {CITY_LABEL[city].toLowerCase()} hospital costs and each plan's wording. The insurer assesses the real bill.
      </p>
    </div>
  );
}

function Line({ label, amount, owe }: { label: string; amount: number; owe?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className={owe ? "text-owe line-through decoration-owe/40" : ""}>{label}</span>
      <span className={`shrink-0 tabular-nums ${owe ? "text-owe" : ""}`}>
        {amount < 0 ? "−" : ""}
        {inrShort(Math.abs(amount))}
      </span>
    </div>
  );
}
