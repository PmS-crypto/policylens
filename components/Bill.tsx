"use client";

import { useMemo, useRef, useState } from "react";
import { coverageMap } from "@/lib/awareness";
import { CITY_COST_FACTOR, CITY_LABEL } from "@/lib/profile";
import type { Lang } from "@/lib/ai";
import { t } from "@/lib/flow";
import { SCENARIOS, headlineScenario, scenarioTitle, simulate, yearLabel, type RoomType } from "@/lib/simulate";
import type { Match, Profile } from "@/lib/types";
import { Icon, Money, Segmented, inrShort } from "./ui";

interface Props {
  lang: Lang;
  onChoose: (id: string) => void;
  profile: Profile;
  top: Match[];
  focusId?: string;
  onOpen: (id: string, clause?: string) => void;
}

/** The signature screen: each plan rendered as the hospital bill you'd actually receive. */
export default function Bill({ lang, profile, top, focusId, onOpen, onChoose }: Props) {
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
  const map = useMemo(() => coverageMap(profile, top), [profile, top]);
  const receiptRef = useRef<HTMLDivElement>(null);
  const jump = (scenarioId: string, policyId: string, y: number) => {
    setSid(scenarioId);
    setPid(policyId);
    setYear(Math.min(4, y));
    setTimeout(() => receiptRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  return (
    <div className="pb-12">
      <header className="px-6 pt-6">
        <p className="text-[13px] font-medium text-accent">{t(lang, "Will this actually cover me?", "Kya yeh sach mein cover karega?")}</p>
        <h1 className="display mt-2 text-[38px]">{t(lang, "Your bill, before it happens", "Bill, hone se pehle")}</h1>
        <p className="mt-3 max-w-[36ch] text-[15px] leading-relaxed text-ink-soft">{t(lang, "Every likely hospital trip for your family, run through each plan's rules. Tap any box for the full bill.", "Aapki family ke har possible hospital trip ko har plan ke rules se check kiya. Poora bill dekhne ke liye kisi bhi box pe tap karo.")}</p>
      </header>

      {/* Coverage map: every likely event × every plan. On a phone, the event name gets its own line
          and the three plan boxes share the full width below it, so nothing has to break mid-word. */}
      <section className="mx-5 mt-6 overflow-hidden rounded-[28px] bg-surface shadow-e1 ring-1 ring-line" aria-label="Coverage map">
        <div className="border-b border-line px-4 pb-3 pt-3.5">
          <p className="text-[12px] font-medium text-ink-soft">{t(lang, "If it happens this year", "Agar is saal hua")}</p>
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            {top.map((t, i) => (
              <span key={t.policy.id} className="min-w-0 text-[12px] font-semibold leading-tight">
                <span className="money mr-1 text-accent">0{i + 1}</span>
                {t.policy.name}
              </span>
            ))}
          </div>
        </div>
        <div className="divide-y divide-line">
          {map.map(({ scenario, cells }) => (
            <div key={scenario.id} className="px-4 py-3.5">
              <p className="text-[13.5px] font-medium leading-snug">{scenarioTitle(scenario, lang)}</p>
              <div className="mt-2 grid grid-cols-3 gap-1.5">
                {cells.map((c, i) => (
                  <button
                    key={top[i].policy.id}
                    onClick={() => jump(scenario.id, top[i].policy.id, c.year)}
                    aria-label={`${top[i].policy.name}: ${c.kind === "waiting" ? `covered from ${c.from}` : c.youPay === 0 ? "covered" : `you pay ${inrShort(c.youPay)}`}`}
                    className={`min-w-0 rounded-[12px] px-2.5 py-2 text-left leading-tight transition active:scale-95 ${
                      c.kind === "waiting" ? "bg-warn-soft text-warn" : c.kind === "partial" ? "bg-owe-soft text-owe" : "bg-paid-soft text-paid"
                    }`}
                  >
                    <span className="block text-[10.5px] font-medium opacity-75">
                      {c.kind === "waiting" ? (c.from === "Not covered" ? t(lang, "Never", "Kabhi nahi") : t(lang, "From", "Se")) : c.youPay === 0 ? t(lang, "Fully", "Poora") : t(lang, "You pay", "Aap doge")}
                    </span>
                    <span className="block whitespace-nowrap text-[12.5px] font-semibold">
                      {c.kind === "waiting" ? (c.from === "Not covered" ? t(lang, "Not covered", "Cover nahi") : c.from) : c.youPay === 0 ? t(lang, "Covered", "Cover hai") : inrShort(c.youPay)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <h2 ref={receiptRef} className="title mt-12 scroll-mt-4 px-6 text-[20px]">{t(lang, "The full bill", "Poora bill")}</h2>
      <div className="no-scrollbar mt-4 flex gap-2.5 overflow-x-auto px-6 pb-2">
        {scenarios.map((x) => (
          <button
            key={x.id}
            onClick={() => setSid(x.id)}
            className={`shrink-0 rounded-full px-5 py-3 text-[14px] transition-all duration-300 ${sid === x.id ? "bg-primary font-semibold text-on-primary shadow-e2" : "bg-surface shadow-e1 ring-1 ring-line"} ${x.relevant(profile) ? "" : "opacity-50"}`}
          >
            {scenarioTitle(x, lang)}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-2.5 px-6">
        <Segmented label="When it happens" value={year} onChange={setYear} options={[1, 2, 3, 4].map((y) => ({ value: y, label: yearLabel(y, lang) }))} />
        <Segmented label="Room type" value={room} onChange={setRoom} options={[{ value: "shared", label: t(lang, "Shared", "Shared") }, { value: "private", label: "Private" }, { value: "deluxe", label: "Deluxe" }]} />
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
              <p className="font-sans text-[16px] font-bold">{t(lang, "Estimated hospital bill", "Hospital bill (estimate)")}</p>
              <p className="text-[#6b6577]">
                {profile.cityName ?? CITY_LABEL[city]}, {today}
              </p>
              <p className="text-[#6b6577]">
                {m.policy.insurer} {m.policy.name}, ₹{m.sumInsured}L
              </p>
              <div className={`stamp stamp-in mx-auto mt-4 w-fit px-3.5 py-1 font-sans text-[15px] font-extrabold uppercase ${r.blocked ? "text-[#d23a46]" : r.youPay === 0 ? "text-[#11845a]" : "text-[#a8640c]"}`}>
                {r.blocked ? t(lang, "Not covered yet", "Abhi cover nahi") : r.youPay === 0 ? t(lang, "Paid in full", "Poora paid") : `${Math.round((r.insurerPays / r.bill) * 100)}% paid`}
              </div>
              <p className="mt-3 font-sans text-[13px] font-medium text-[#1b1722]">
                {r.blocked
                  ? t(lang, "Still in the waiting period. Try a later year to see when it's covered.", "Waiting period abhi chal raha hai. Baad ka saal chuno, dekho kab cover hoga.")
                  : r.youPay === 0
                    ? t(lang, "Nothing out of your pocket.", "Jeb se ek rupaya nahi.")
                    : t(lang, `The plan pays ${inrShort(r.insurerPays)}. You pay ${inrShort(r.youPay)}.`, `Plan dega ${inrShort(r.insurerPays)}. Aap doge ${inrShort(r.youPay)}.`)}
              </p>
            </div>
            <div className="my-4 border-t border-dashed border-[#1b1722]/25" />
            <Line label={scenarioTitle(s, lang)} amount={r.bill} />
            <p className="text-[#6b6577]">
              {s.days > 0 ? t(lang, `${s.days} nights, ${room} room`, `${s.days} raat, ${room} room`) : t(lang, "Day-care procedure", "Day-care procedure")}, {yearLabel(year, lang).toLowerCase()}
            </p>
            <div className="my-4 border-t border-dashed border-[#1b1722]/25" />
            <p className="mb-1 font-sans text-[12px] font-semibold text-[#6b6577]">{t(lang, "Not paid by the insurer", "Jo insurer nahi dega")}</p>
            {r.lines.length === 0 && <p className="text-[#11845a]">{t(lang, "Nothing. Every rupee is covered.", "Kuch nahi. Har rupaya cover hai.")}</p>}
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
            <Line label={t(lang, "Insurer pays", "Insurer dega")} amount={r.insurerPays} />
            <div className="mt-3 flex items-end justify-between font-sans">
              <span className="text-[16px] font-bold">{t(lang, "You pay", "Aap doge")}</span>
              <Money value={r.youPay} className={`text-[48px] ${r.youPay === 0 ? "text-[#11845a]" : "text-[#d23a46]"}`} />
            </div>
          </div>
        </div>
      </div>

      <div className="mx-6 mt-8 rounded-[24px] bg-surface p-5 shadow-e1 ring-1 ring-line">
        <div className="flex items-baseline justify-between">
          <span className="text-[14px] font-medium">{t(lang, "Play with the bill amount", "Bill amount badal ke dekho")}</span>
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
        {t(
          lang,
          `An estimate from typical ${CITY_LABEL[city].toLowerCase()} hospital costs and each plan's wording. The insurer checks the real bill.`,
          `Yeh ${CITY_LABEL[city].toLowerCase()} ke typical hospital costs aur har plan ki wording pe based estimate hai. Asli bill insurer check karta hai.`,
        )}
      </p>
      {/* Next step in the journey: pick a plan */}
      <div className="mx-6 mt-8 space-y-3">
        <p className="text-[13px] text-ink-soft">{t(lang, "Seen enough?", "Samajh aa gaya?")}</p>
        <button onClick={() => onChoose(m.policy.id)} className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-[18px] text-[16px] font-semibold text-on-primary shadow-e2">
          {t(lang, `Go with ${m.policy.name}`, `${m.policy.name} lo`)}
          <Icon name="arrow" size={18} />
        </button>
      </div>
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
