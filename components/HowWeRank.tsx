"use client";

import { useEffect, useRef } from "react";
import { CITY_COST_FACTOR, CITY_LABEL, PRIVATE_ROOM_RATE } from "@/lib/profile";
import { SCENARIOS } from "@/lib/simulate";
import type { Match, Profile } from "@/lib/types";
import { Icon, Sheet, inrShort } from "./ui";

/**
 * Transparency: how the ranking was computed (from the engine's own breakdown, not a description of it),
 * what is never used, and where every rupee estimate comes from.
 */
export default function HowWeRank({ profile, top, section, onClose }: { profile: Profile; top: Match[]; section: "rank" | "numbers"; onClose: () => void }) {
  const numbersRef = useRef<HTMLElement>(null);
  useEffect(() => {
    // Wait for the sheet's slide-up to finish, then jump straight to the numbers section.
    if (section === "numbers") {
      const id = setTimeout(() => numbersRef.current?.scrollIntoView({ block: "start" }), 500);
      return () => clearTimeout(id);
    }
  }, [section]);

  const [a, b] = top;
  const city = profile.city ?? "tier2";
  const factors = a?.breakdown ?? [];
  const scoreOf = (m: Match, key: string) => m.breakdown.find((f) => f.key === key)?.score ?? 0;

  // Why #1 beat #2: compare each factor's weighted contribution
  const diffs = a && b ? factors.map((f) => ({ ...f, delta: f.weight * (scoreOf(a, f.key) - scoreOf(b, f.key)) })) : [];
  const wins = diffs.filter((d) => d.delta > 0.05).sort((x, y) => y.delta - x.delta).slice(0, 2);
  const losses = diffs.filter((d) => d.delta < -0.05).sort((x, y) => x.delta - y.delta).slice(0, 1);

  return (
    <Sheet onClose={onClose} title={<h2 className="display text-[30px]">{section === "numbers" ? "How the numbers work" : "How we ranked your plans"}</h2>}>
      <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">The ranking is plain code, not AI. Here's exactly what it weighed for your family.</p>

      {/* What counts, and how much */}
      <section className="mt-7" aria-labelledby="factors">
        <h3 id="factors" className="title text-[19px]">What counts, and how much</h3>
        <div className="mt-2 flex gap-3 text-[12px] text-ink-soft">
          {top.map((m, i) => (
            <span key={m.policy.id} className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${["bg-accent", "bg-paid", "bg-warn"][i]}`} />
              0{i + 1} {m.policy.name}
            </span>
          ))}
        </div>
        <ul className="mt-4 space-y-4">
          {factors.map((f) => (
            <li key={f.key}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[14px] font-medium leading-snug">{f.label}</span>
                <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-[11.5px] font-semibold tabular-nums">counts {f.weight}×</span>
              </div>
              <div className="mt-2 space-y-1">
                {top.map((m, i) => (
                  <div key={m.policy.id} className="h-1.5 overflow-hidden rounded-full bg-surface-2" aria-label={`${m.policy.name}: ${Math.round(scoreOf(m, f.key) * 100)} out of 100`}>
                    <div className={`h-full rounded-full ${["bg-accent", "bg-paid", "bg-warn"][i]}`} style={{ width: `${Math.max(3, scoreOf(m, f.key) * 100)}%` }} />
                  </div>
                ))}
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-[12.5px] leading-relaxed text-ink-soft">
          Your likeliest hospital visit counts most. What you said matters counts 3×. Everything else counts once. Plans your family can't join are removed first.
        </p>
      </section>

      {/* Why #1 beat #2 */}
      {a && b && (
        <section className="mt-8 rounded-[24px] bg-accent-soft p-5" aria-labelledby="why1">
          <h3 id="why1" className="title text-[17px]">
            Why {a.policy.name} is #1, not {b.policy.name}
          </h3>
          <ul className="mt-3 space-y-2 text-[14px] leading-relaxed">
            {wins.map((w) => (
              <li key={w.key} className="flex gap-2">
                <Icon name="check" size={16} stroke={2.4} className="mt-1 shrink-0 text-paid" />
                <span>
                  <span className="font-medium">{w.label}:</span> {a.policy.name} does better{w.weight >= 3 ? ", and this counts heavily for you" : ""}.
                </span>
              </li>
            ))}
            {losses.map((l) => (
              <li key={l.key} className="flex gap-2 text-ink-soft">
                <Icon name="info" size={16} className="mt-1 shrink-0 text-warn" />
                <span>
                  <span className="font-medium text-ink">{l.label}:</span> {b.policy.name} is actually better here, but it matters less overall.
                </span>
              </li>
            ))}
            {!wins.length && <li>They're very close. {a.policy.name} edges ahead across several small factors.</li>}
          </ul>
        </section>
      )}

      {/* What we never use */}
      <section className="mt-8" aria-labelledby="never">
        <h3 id="never" className="title text-[19px]">What we never use</h3>
        <ul className="mt-3 space-y-3 text-[14px] leading-relaxed">
          {[
            "Commissions, insurer payments or sponsored placement. The ranking code has no such data in it.",
            "AI to rank or price plans. The AI only explains results the code has already worked out.",
            "Unchecked AI numbers. Every number in an AI answer is checked against the policy wording; if one can't be traced, you see the policy's own words instead.",
          ].map((x) => (
            <li key={x} className="flex gap-2.5">
              <Icon name="shield" size={17} className="mt-0.5 shrink-0 text-accent" />
              {x}
            </li>
          ))}
        </ul>
      </section>

      {/* Where the bill numbers come from */}
      <section ref={numbersRef} className="mt-8 scroll-mt-4" aria-labelledby="numbers">
        <h3 id="numbers" className="title text-[19px]">Where the bill numbers come from</h3>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">
          Typical treatment costs, adjusted for a {CITY_LABEL[city].toLowerCase()} (×{CITY_COST_FACTOR[city]}), then run through each plan's rules.
        </p>
        <div className="mt-4 overflow-hidden rounded-[20px] ring-1 ring-line">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-surface-2 text-left text-[12px] text-ink-soft">
                <th className="px-3 py-2 font-medium">Event</th>
                <th className="px-3 py-2 text-right font-medium">Your city</th>
              </tr>
            </thead>
            <tbody>
              {SCENARIOS.map((s) => (
                <tr key={s.id} className="border-t border-line">
                  <td className="px-3 py-2">{s.title}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{inrShort(Math.round((s.bill * CITY_COST_FACTOR[city]) / 1000) * 1000)}</td>
                </tr>
              ))}
              <tr className="border-t border-line">
                <td className="px-3 py-2">Private room, per day</td>
                <td className="px-3 py-2 text-right tabular-nums">{inrShort(PRIVATE_ROOM_RATE[city])}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-[13px] font-medium">Then each plan's rules, in this order:</p>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-[13.5px] leading-relaxed text-ink-soft">
          <li>Waiting periods: if one hasn't passed, nothing is paid.</li>
          <li>Room rent above the cap, plus the proportionate cut on doctor and nursing charges (we assume 55% of non-room charges are affected).</li>
          <li>Consumables like gloves and PPE, if the plan excludes them (we assume 6% of the bill).</li>
          <li>Caps on specific surgeries.</li>
          <li>Co-pay, for members old enough for it to apply.</li>
          <li>Your total cover limit.</li>
        </ol>
        <p className="mt-4 rounded-[16px] bg-warn-soft px-4 py-3 text-[13px] leading-relaxed text-warn">
          These are estimates, not quotes. Real bills vary by hospital, and the insurer assesses every claim. You can change the bill amount on the bill screen.
        </p>
      </section>

      {/* Where the policy data comes from */}
      <section className="mt-8" aria-labelledby="sources">
        <h3 id="sources" className="title text-[19px]">Where the policy data comes from</h3>
        <ul className="mt-3 divide-y divide-line text-[13.5px]">
          {top.map((m) => (
            <li key={m.policy.id} className="flex items-baseline justify-between gap-3 py-2.5">
              <span>
                {m.policy.insurer} {m.policy.name}
              </span>
              <span className="shrink-0 text-right text-[12px] text-ink-soft">
                {m.policy.docVersion}, checked {new Date(m.policy.lastVerified).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[12.5px] leading-relaxed text-ink-soft">In this prototype, plans and prices are illustrative, modelled on typical Indian policy wording. The insurer's own policy document always takes precedence.</p>
      </section>
    </Sheet>
  );
}
