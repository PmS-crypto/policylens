"use client";

import { useMemo, useState } from "react";
import { POLICIES } from "@/lib/policies";
import { SCENARIOS, simulate } from "@/lib/simulate";
import type { Profile } from "@/lib/types";
import { Icon, Money, Segmented, inrShort } from "./ui";

type Who = "me" | "parent";

const EVENTS: Record<Who, string[]> = {
  me: ["dengue", "cardiac", "diabetes", "childbirth"],
  parent: ["knee", "cataract", "cardiac", "dengue", "diabetes"],
};
const SHORT: Record<string, string> = {
  dengue: "Dengue",
  cardiac: "Heart attack",
  knee: "Knee replacement",
  cataract: "Cataract",
  diabetes: "Diabetes complication",
  childbirth: "Baby's delivery",
};
const AGE = { me: { min: 18, max: 60, start: 30 }, parent: { min: 50, max: 80, start: 64 } };
const SI = 10;

/** What the explorer hands to the chat, so the questions start from what the person just tried. */
function handoff(who: Who, age: number, sid: string) {
  if (who === "parent") {
    const base = `I want to cover my parent, aged ${age}.`;
    if (sid === "knee") return `${base} They may need a knee replacement soon.`;
    if (sid === "cataract") return `${base} They may need cataract surgery soon.`;
    if (sid === "diabetes") return `${base} They have diabetes.`;
    return base;
  }
  if (sid === "childbirth") return `I'm ${age}, want cover for me and my partner. We're planning a baby.`;
  if (sid === "diabetes") return `I'm ${age} and want cover for myself. I have diabetes.`;
  return `I'm ${age} and want cover for myself.`;
}

/**
 * Discovery before any questions: pick a hospital trip and see what every plan would leave you to pay.
 * Same engine as the bill screen, run on a stand-in family, so people learn what to look for first.
 */
export default function TryBill({ onStart }: { onStart: (text: string) => void }) {
  const [who, setWho] = useState<Who>("parent");
  const [age, setAge] = useState(AGE.parent.start);
  const [sid, setSid] = useState("knee");
  const [year, setYear] = useState(2);

  const pickWho = (w: Who) => {
    setWho(w);
    setAge(AGE[w].start);
    if (!EVENTS[w].includes(sid)) setSid(EVENTS[w][0]);
  };

  const rows = useMemo(() => {
    const s = SCENARIOS.find((x) => x.id === sid)!;
    const p: Profile =
      who === "parent"
        ? { cover: { self: false, partner: false, kids: false, parents: true }, parentAge: age, city: "metro", conditions: sid === "diabetes" ? ["diabetes"] : [] }
        : { cover: { self: true, partner: sid === "childbirth", kids: false, parents: false }, selfAge: age, partnerAge: sid === "childbirth" ? age : undefined, city: "metro", conditions: sid === "diabetes" ? ["diabetes"] : [], conditionWho: "self" };
    return POLICIES.filter((pol) => age <= pol.maxEntryAge && (!pol.minEntryAge || age >= pol.minEntryAge))
      .map((pol) => {
        const r = simulate(pol, SI, p, s, { year, room: "private" });
        const biggest = [...r.lines].sort((a, b) => b.amount - a.amount)[0];
        return { pol, r, why: r.youPay > 0 ? biggest?.label : undefined };
      })
      .sort((a, b) => a.r.youPay - b.r.youPay);
  }, [who, age, sid, year]);

  const bill = rows[0]?.r.bill ?? 0;
  const lo = rows[0]?.r.youPay ?? 0;
  const hi = rows[rows.length - 1]?.r.youPay ?? 0;

  return (
    <div className="rounded-[32px] bg-surface p-5 shadow-e2 ring-1 ring-line">
      <h2 className="title text-[19px]">Try a hospital bill</h2>
      <p className="mt-1 text-[13.5px] leading-relaxed text-ink-soft">Same ₹{SI} lakh cover on every plan. Pick what happens and see who pays.</p>

      <div className="mt-4 space-y-3">
        <Segmented<Who> label="Who's in hospital" value={who} onChange={pickWho} options={[{ value: "parent", label: "A parent" }, { value: "me", label: "Me" }]} />

        <div className="flex items-center justify-between gap-3">
          <span className="text-[13.5px] text-ink-soft">{who === "parent" ? "Their age" : "Your age"}</span>
          <div className="flex items-center gap-1 rounded-full bg-surface-2 p-1">
            <button aria-label="Younger" onClick={() => setAge((a) => Math.max(AGE[who].min, a - 1))} className="grid h-8 w-8 place-items-center rounded-full text-[18px] font-semibold disabled:opacity-30" disabled={age <= AGE[who].min}>
              −
            </button>
            <span className="money w-8 text-center text-[15px] font-semibold tabular-nums" aria-live="polite">{age}</span>
            <button aria-label="Older" onClick={() => setAge((a) => Math.min(AGE[who].max, a + 1))} className="grid h-8 w-8 place-items-center rounded-full text-[18px] font-semibold disabled:opacity-30" disabled={age >= AGE[who].max}>
              +
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2" role="group" aria-label="What happens">
          {EVENTS[who].map((id) => (
            <button
              key={id}
              onClick={() => setSid(id)}
              aria-pressed={sid === id}
              className={`rounded-full px-3.5 py-2 text-[13px] transition-colors ${sid === id ? "bg-primary font-semibold text-on-primary" : "bg-surface-2 text-ink"}`}
            >
              {SHORT[id]}
            </button>
          ))}
        </div>

        <Segmented<number> label="When" value={year} onChange={setYear} options={[{ value: 1, label: "This year" }, { value: 2, label: "Next year" }, { value: 4, label: "In 3 years" }]} />
      </div>

      <div className="mt-5 rounded-[22px] bg-surface-2 px-4 py-3.5">
        <p className="text-[13px] text-ink-soft">Bill in a big-city hospital: {inrShort(bill)}</p>
        <p className="mt-1 text-[15px] font-semibold leading-snug">
          {rows.length < 2 ? "Only one plan accepts this age." : lo === hi ? `Every plan leaves you ${inrShort(lo)} to pay.` : `You'd pay anywhere from ${inrShort(lo)} to ${inrShort(hi)}.`}
        </p>
      </div>

      <ul className="mt-3 divide-y divide-line" aria-label="What each plan leaves you to pay">
        {rows.map(({ pol, r, why }) => {
          const share = r.bill ? r.insurerPays / r.bill : 0;
          return (
            <li key={pol.id} className="py-3">
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-[14px] font-medium">{pol.name}</span>
                <span className={`shrink-0 text-[12px] font-medium ${r.youPay ? "text-owe" : "text-paid"}`}>{r.youPay ? "You pay" : "Fully paid"}</span>
              </div>
              <div className="mt-1.5 flex items-center gap-3">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-owe-soft" aria-hidden>
                  <div className="h-full rounded-full bg-paid transition-[width] duration-500" style={{ width: `${share * 100}%` }} />
                </div>
                <span className="w-24 shrink-0 text-right">
                  <Money value={r.youPay} className={`text-[17px] ${r.youPay ? "text-owe" : "text-paid"}`} />
                </span>
              </div>
              {why && <p className="mt-1 text-[12.5px] leading-snug text-ink-soft">{r.blocked ? why : `Mostly: ${why.toLowerCase()}`}</p>}
            </li>
          );
        })}
      </ul>
      {rows.length < POLICIES.length && <p className="mt-1 text-[12px] text-ink-faint">{POLICIES.length - rows.length === 1 ? "1 plan doesn't" : `${POLICIES.length - rows.length} plans don't`} accept someone aged {age}.</p>}

      <button onClick={() => onStart(handoff(who, age, sid))} className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-surface-2 py-3.5 text-[14.5px] font-semibold text-ink ring-1 ring-line">
        Find plans that cover this
        <Icon name="arrow" size={16} />
      </button>
    </div>
  );
}
