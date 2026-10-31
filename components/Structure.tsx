"use client";

import { useState } from "react";
import type { Layer, Lever, Structure } from "@/lib/structure";
import { TOPUP } from "@/lib/structure";
import { Icon, Money, inrShort } from "./ui";

const LAYER_STYLE: Record<Layer["kind"], string> = {
  base: "bg-accent text-white",
  topup: "bg-[linear-gradient(110deg,#ff8a6b,#f49ac1_55%,#b7a6ff)] text-[#16131d]",
  work: "bg-surface-2 text-ink ring-1 ring-inset ring-line",
};

/** Cover drawn as stacked layers: the first layer pays first, the next takes over above it. */
function LayerBar({ layers }: { layers: Layer[] }) {
  const total = layers.reduce((s, l) => s + l.lakh, 0);
  return (
    <div className="space-y-2.5">
      <div className="flex h-12 overflow-hidden rounded-[14px]" role="img" aria-label={layers.map((l) => `${l.label}, ₹${l.lakh} lakh`).join(", then ")}>
        {layers.map((l) => (
          <div key={l.label} className={`grain flex min-w-[64px] items-center px-3 ${LAYER_STYLE[l.kind]}`} style={{ flex: l.lakh / total }}>
            <span className="money relative z-[2] text-[18px]">₹{l.lakh}L</span>
          </div>
        ))}
      </div>
      <ul className="space-y-1.5 text-[13px]">
        {layers.map((l) => (
          <li key={l.label} className="flex items-baseline justify-between gap-3">
            <span className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${LAYER_STYLE[l.kind]}`} />
              {l.label}
            </span>
            <span className="shrink-0 font-medium tabular-nums">{l.premium ? `${inrShort(l.premium)}/yr` : "Paid by employer"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function StructureAdvice({ structures }: { structures: Structure[] }) {
  const [open, setOpen] = useState(0);
  if (!structures.length) return null;
  return (
    <section className="mx-5 mt-10" aria-labelledby="structure-title">
      <p className="text-[13px] font-medium text-accent">What type of cover do I need?</p>
      <h2 id="structure-title" className="display mt-2 text-[30px]">Smarter ways to build your cover</h2>
      <p className="mt-3 max-w-[36ch] text-[15px] leading-relaxed text-ink-soft">One big plan is rarely the cheapest way to be well covered. Here's how advisors would layer it for your family.</p>

      <div className="mt-6 space-y-3">
        {structures.map((s, i) => {
          const isOpen = open === i;
          const saving = s.compare.premium - s.totalPremium;
          return (
            <article key={s.id} className="overflow-hidden rounded-[28px] bg-surface shadow-e1 ring-1 ring-line">
              <button onClick={() => setOpen(isOpen ? -1 : i)} aria-expanded={isOpen} className="flex w-full items-start justify-between gap-4 p-5 text-left">
                <span>
                  <span className="title block text-[17px] leading-tight">{s.title}</span>
                  <span className="mt-1.5 block text-[13.5px] leading-snug text-ink-soft">{s.summary}</span>
                </span>
                <span className={`mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-surface-2 transition-transform duration-300 ${isOpen ? "rotate-90" : ""}`}>
                  <Icon name="arrow" size={14} />
                </span>
              </button>
              {isOpen && (
                <div className="rise space-y-5 px-5 pb-6">
                  <LayerBar layers={s.layers} />
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="rounded-[20px] bg-accent-soft p-4">
                      <p className="text-[12px] text-ink-soft">This way</p>
                      <Money value={s.totalPremium} className="mt-1 block text-[26px]" />
                      <p className="mt-1 text-[12px] text-ink-soft">₹{s.totalCover}L total cover</p>
                    </div>
                    <div className="rounded-[20px] bg-surface-2 p-4">
                      <p className="text-[12px] text-ink-soft">{s.compare.label}</p>
                      <span className="money mt-1 block text-[26px]">{inrShort(s.compare.premium)}</span>
                      <p className="mt-1 text-[12px] text-ink-soft">₹{s.compare.cover}L cover</p>
                    </div>
                  </div>
                  {saving > 0 && (
                    <p className="rounded-[16px] bg-paid-soft px-4 py-3 text-[14px] font-medium text-paid">
                      Saves {inrShort(saving)} a year
                      {s.totalCover > s.compare.cover ? `, with ₹${s.totalCover - s.compare.cover}L more cover` : s.totalCover === s.compare.cover ? " for the same cover" : ` (₹${s.compare.cover - s.totalCover}L less cover)`}
                    </p>
                  )}
                  <ul className="space-y-2.5 text-[14px] leading-relaxed">
                    {s.pros.map((x) => (
                      <li key={x} className="flex gap-2.5">
                        <Icon name="check" size={16} className="mt-1 shrink-0 text-paid" stroke={2.4} />
                        {x}
                      </li>
                    ))}
                    {s.cons.map((x) => (
                      <li key={x} className="flex gap-2.5 text-ink-soft">
                        <Icon name="info" size={16} className="mt-1 shrink-0 text-warn" />
                        {x}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </article>
          );
        })}
      </div>
      <p className="mt-4 px-1 text-[12px] leading-relaxed text-ink-soft">
        A super top-up pays only after a year's hospital bills cross its deductible. {TOPUP.insurer} {TOPUP.name} ({TOPUP.docVersion}) is illustrative, priced with the same model as the plans above.
      </p>
    </section>
  );
}

/** Compact flag under the plans header that jumps to the levers. */
export function OverBudgetFlag({ over, budget, onSee }: { over: number; budget: number; onSee: () => void }) {
  return (
    <button onClick={onSee} className="mt-5 flex w-full items-center justify-between gap-3 rounded-[20px] bg-warn-soft px-4 py-3.5 text-left">
      <span className="text-[14px] leading-snug">
        <span className="font-semibold text-warn">{inrShort(over)} over your {inrShort(budget)} budget.</span> <span className="text-ink-soft">See ways to make it fit.</span>
      </span>
      <Icon name="arrow" size={16} className="shrink-0 rotate-90 text-warn" />
    </button>
  );
}

export function BudgetFix({ over, budget, levers, bestName, sentence }: { over: number; budget: number; levers: Lever[]; bestName: string; sentence: string }) {
  const anyFits = levers.some((l) => l.fits && !l.risky);
  return (
    <section id="fit" className="mx-5 mt-10 scroll-mt-4" aria-labelledby="fit-title">
      <p className="text-[13px] font-medium text-accent">Can I afford good cover?</p>
      <h2 id="fit-title" className="display mt-2 text-[30px]">Make it fit your budget</h2>
      <p className="mt-3 max-w-[36ch] text-[15px] leading-relaxed text-ink-soft">
        {bestName} is {inrShort(over)} over your {inrShort(budget)} budget.{" "}
        {anyFits ? "These options get you under it. Each one shows exactly what you'd give up." : "Nothing gets fully under it without big gaps, so here are the closest options and what each costs you."}
      </p>
      <ol className="mt-6 space-y-3">
        {levers.map((l) => (
          <li key={l.id} className={`rounded-[28px] p-5 shadow-e1 ring-1 ${l.risky ? "bg-surface ring-owe/30" : "bg-surface ring-line"}`}>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${l.fits ? "bg-paid-soft text-paid" : "bg-warn-soft text-warn"}`}>
                {l.fits ? "Fits your budget" : `${inrShort(l.premium - budget)} over`}
              </span>
              {l.risky && <span className="rounded-full bg-owe-soft px-2.5 py-1 text-[12px] font-semibold text-owe">Leaves a big gap</span>}
            </div>
            <h3 className="title mt-3 text-[17px] leading-tight">{l.title}</h3>
            <div className="mt-4 grid grid-cols-2 gap-2.5">
              <div>
                <Money value={l.premium} className="block text-[26px]" />
                <p className="mt-1 text-[12px] text-ink-soft">a year, saves {inrShort(Math.max(0, l.saving))}</p>
              </div>
              <div>
                <span className={`money block text-[26px] ${l.extraYouPay > 0 ? "text-owe" : "text-paid"}`}>
                  {l.extraYouPay > 0 ? `+${inrShort(l.extraYouPay)}` : "No change"}
                </span>
                <p className="mt-1 text-[12px] leading-snug text-ink-soft">out of pocket {sentence.replace(/^If /, "if ")}</p>
              </div>
            </div>
            <p className="mt-4 text-[13.5px] leading-relaxed text-ink-soft">
              <span className="font-semibold text-ink">What you give up: </span>
              {l.giveUp}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
