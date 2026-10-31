"use client";

import type { Lang } from "@/lib/ai";
import { riskSnapshot } from "@/lib/awareness";
import { t } from "@/lib/flow";
import type { Match, Profile } from "@/lib/types";
import { Icon, Money, inrShort } from "./ui";

/** Job 1, "Do I even need insurance?", answered with the family's own numbers before any plan is shown. */
export default function Awareness({ profile, best, lang }: { profile: Profile; best: Match; lang: Lang }) {
  const r = riskSnapshot(profile, best, lang);
  const years = r.premiumYears;
  return (
    <section className="rise rounded-[32px] bg-surface p-6 shadow-e1 ring-1 ring-line">
      <p className="text-[13px] font-medium text-accent">{t(lang, "Do I even need insurance?", "Kya mujhe insurance chahiye bhi?")}</p>
      <h2 className="title mt-2 text-[22px] leading-tight">{t(lang, "What one hospital trip could cost you, with no cover", "Bina cover ke, ek hospital trip kitne ki padegi")}</h2>

      <div className="mt-6 rounded-[24px] bg-owe-soft p-5">
        <p className="text-[13px] leading-snug text-ink-soft">{t(lang, "Most likely:", "Sabse zyada chance:")} {r.likely.sentence}</p>
        <Money value={r.likely.bill} className="mt-2 block text-[52px] text-owe" />
        <p className="mt-1 text-[12.5px] text-ink-soft">{t(lang, "straight from your savings", "seedha aapki savings se")}</p>
      </div>
      {r.serious && (
        <div className="mt-3 flex items-baseline justify-between rounded-[20px] bg-surface-2 px-5 py-4">
          <span className="text-[13.5px] text-ink-soft">{t(lang, "Worst case:", "Sabse serious:")} {r.serious.title.toLowerCase()}</span>
          <Money value={r.serious.bill} className="text-[24px]" />
        </div>
      )}

      <ul className="mt-6 space-y-4 text-[14px] leading-relaxed">
        <li className="flex gap-3">
          <Icon name="wallet" size={18} className="mt-0.5 shrink-0 text-accent" />
          <span>
            {lang === "hi"
              ? `Best plan ka premium lagbhag ${inrShort(r.bestPremium)} saal ka hai. Aisa ek hospital trip ${years >= 1 ? `${years.toFixed(1)} saal ke premium ke barabar hai` : "aadhe saal ke premium se zyada hai"}.`
              : `The best-fit plan is about ${inrShort(r.bestPremium)} a year. One trip like this ${years >= 1 ? `equals ${years.toFixed(1)} years of premiums` : "costs more than half a year's premium"}.`}
          </span>
        </li>
        {r.employerLine && (
          <li className="flex gap-3">
            <Icon name="shield" size={18} className="mt-0.5 shrink-0 text-accent" />
            <span>{r.employerLine}</span>
          </li>
        )}
        <li className="flex gap-3">
          <Icon name="clock" size={18} className="mt-0.5 shrink-0 text-accent" />
          <span>{r.waitLine}</span>
        </li>
      </ul>
    </section>
  );
}
