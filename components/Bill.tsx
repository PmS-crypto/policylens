"use client";

import { useMemo, useState } from "react";
import { CITY_COST_FACTOR, CITY_LABEL } from "@/lib/profile";
import { SCENARIOS, YEAR_LABEL, headlineScenario, simulate, type RoomType } from "@/lib/simulate";
import type { Match, Profile } from "@/lib/types";
import { Money, Segmented, inrShort } from "./ui";

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
  const printKey = `${m.policy.id}-${sid}-${year}-${room}`;

  return (
    <div className="pb-12">
      <header className="px-6 pt-6">
        <p className="text-[13px] font-medium text-accent">Reality check</p>
        <h1 className="display mt-2 text-[38px]">Your bill, before it happens</h1>
        <p className="mt-3 max-w-[36ch] text-[15px] leading-relaxed text-ink-soft">Pick a moment. I'll run the hospital bill through each plan's rules and show every rupee that comes back to you.</p>
      </header>

      <div className="no-scrollbar mt-6 flex gap-2.5 overflow-x-auto px-6 pb-2">
        {scenarios.map((x) => (
          <button
            key={x.id}
            onClick={() => setSid(x.id)}
            className={`shrink-0 rounded-full px-5 py-3 text-[14px] transition-all duration-300 ${sid === x.id ? "bg-primary font-semibold text-on-primary shadow-e2" : "bg-surface shadow-e1 ring-1 ring-line"} ${x.relevant(profile) ? "" : "opacity-50"}`}
          >
            {x.title}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-2.5 px-6">
        <Segmented label="When it happens" value={year} onChange={setYear} options={[1, 2, 3, 4].map((y) => ({ value: y, label: YEAR_LABEL[y] }))} />
        <Segmented label="Room type" value={room} onChange={setRoom} options={[{ value: "shared", label: "Shared" }, { value: "private", label: "Private" }, { value: "deluxe", label: "Deluxe" }]} />
      </div>

      {/* Switcher doubles as the summary of what you'd pay on each plan */}
      <div className="mt-8 grid grid-cols-3 gap-2.5 px-6">
        {all.map(({ m: mm, r: rr }, i) => {
          const on = mm.policy.id === m.policy.id;
          return (
            <button key={mm.policy.id} onClick={() => setPid(mm.policy.id)} className={`rounded-[22px] p-3.5 text-left transition-all duration-300 ${on ? "bg-primary text-on-primary shadow-e2" : "bg-surface shadow-e1 ring-1 ring-line"}`}>
              <span className="money block text-[14px] opacity-60">0{i + 1}</span>
              <span className="mt-1 block truncate text-[12.5px] font-medium">{mm.policy.name}</span>
              <Money value={rr.youPay} className={`mt-2 block text-[24px] ${on ? "" : rr.youPay === 0 ? "text-paid" : "text-owe"}`} />
            </button>
          );
        })}
      </div>

      {/* The printer slot and the receipt that comes out of it */}
      <div className="mx-6 mt-8">
        <div className="relative z-10 h-3 rounded-full bg-primary/90 shadow-e2" aria-hidden />
        <div key={printKey} className="print relative -mt-1.5 mx-2 drop-shadow-[0_18px_24px_rgba(20,10,40,0.18)]">
          <div className="receipt-edge bg-[#fbfaf7] px-6 pb-12 pt-7 font-mono text-[12.5px] leading-relaxed text-[#1b1722]">
            <div className="text-center">
              <p className="font-sans text-[16px] font-bold">Estimated hospital bill</p>
              <p className="text-[#6b6577]">
                {profile.cityName ?? CITY_LABEL[city]}, {today}
              </p>
              <p className="text-[#6b6577]">
                {m.policy.insurer} {m.policy.name}, ₹{m.sumInsured}L
              </p>
              <div className={`stamp stamp-in mx-auto mt-4 w-fit px-3.5 py-1 font-sans text-[15px] font-extrabold uppercase ${r.blocked ? "text-[#d23a46]" : r.youPay === 0 ? "text-[#11845a]" : "text-[#a8640c]"}`}>
                {r.blocked ? "Not covered yet" : r.youPay === 0 ? "Paid in full" : `${Math.round((r.insurerPays / r.bill) * 100)}% paid`}
              </div>
            </div>
            <div className="my-4 border-t border-dashed border-[#1b1722]/25" />
            <Line label={s.title} amount={r.bill} />
            <p className="text-[#6b6577]">
              {s.days > 0 ? `${s.days} nights, ${room} room` : "Day-care procedure"}, {YEAR_LABEL[year].toLowerCase()}
            </p>
            <div className="my-4 border-t border-dashed border-[#1b1722]/25" />
            <p className="mb-1 font-sans text-[12px] font-semibold text-[#6b6577]">Not paid by the insurer</p>
            {r.lines.length === 0 && <p className="text-[#11845a]">Nothing. Every rupee is admissible.</p>}
            {r.lines.map((l) => (
              <div key={l.label} className="py-1.5">
                <Line label={l.label} amount={-l.amount} owe />
                <p className="text-[11.5px] text-[#6b6577]">
                  {l.note}{" "}
                  {l.clauseId && (
                    <button onClick={() => onOpen(m.policy.id, l.clauseId)} className="rounded bg-[#e4dcff] px-1 font-semibold text-[#3b2bb0]">
                      §{m.policy.clauses.find((c) => c.id === l.clauseId)?.section}
                    </button>
                  )}
                </p>
              </div>
            ))}
            <div className="my-4 border-t border-dashed border-[#1b1722]/25" />
            <Line label="Insurer pays" amount={r.insurerPays} />
            <div className="mt-3 flex items-end justify-between font-sans">
              <span className="text-[16px] font-bold">You pay</span>
              <Money value={r.youPay} className={`text-[48px] ${r.youPay === 0 ? "text-[#11845a]" : "text-[#d23a46]"}`} />
            </div>
          </div>
        </div>
      </div>

      <div className="mx-6 mt-8 rounded-[24px] bg-surface p-5 shadow-e1 ring-1 ring-line">
        <div className="flex items-baseline justify-between">
          <span className="text-[14px] font-medium">Change the bill amount</span>
          <Money value={bill} className="text-[22px]" />
        </div>
        <input
          type="range"
          min={20000}
          max={1000000}
          step={5000}
          value={bill}
          aria-label="Hospital bill amount"
          onChange={(e) => setBills({ ...bills, [sid]: Number(e.target.value) })}
          className="mt-4 w-full accent-[var(--accent)]"
        />
      </div>
      <p className="mt-5 px-6 text-[12.5px] leading-relaxed text-ink-soft">
        An estimate from typical {CITY_LABEL[city].toLowerCase()} hospital costs and each plan's wording. The insurer assesses the real bill.
      </p>
    </div>
  );
}

function Line({ label, amount, owe }: { label: string; amount: number; owe?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className={owe ? "text-[#d23a46] line-through decoration-[#d23a46]/40" : ""}>{label}</span>
      <span className={`shrink-0 tabular-nums ${owe ? "text-[#d23a46]" : ""}`}>
        {amount < 0 ? "−" : ""}
        {inrShort(Math.abs(amount))}
      </span>
    </div>
  );
}
