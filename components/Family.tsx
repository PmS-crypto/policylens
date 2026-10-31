"use client";

import type { Lang } from "@/lib/ai";
import { stepProgress, t } from "@/lib/flow";
import { CITY_LABEL, CONDITION_LABEL, PLANNED_LABEL, PRIORITY_LABEL, conditionHolder, coverSummary, effectivePriorities, inr, recommendSumInsured } from "@/lib/profile";
import type { Profile } from "@/lib/types";
import { AURA, Aura, Icon, type IconName, Sheet } from "./ui";

interface Member {
  key: string;
  icon: IconName;
  flagged?: boolean;
}

function members(p: Profile): Member[] {
  const c = p.cover;
  if (!c) return [];
  const holder = conditionHolder(p);
  const sick = !!p.conditions?.length;
  const m: Member[] = [];
  if (c.self) m.push({ key: "self", icon: "person", flagged: sick && holder === "self" });
  if (c.partner) m.push({ key: "partner", icon: "heart" });
  if (c.kids) for (let i = 0; i < (p.kidsCount ?? 1); i++) m.push({ key: "kid" + i, icon: "child" });
  if (c.parents) m.push({ key: "parents", icon: "elder", flagged: sick && holder === "parent" });
  return m;
}

/** The family assembling itself as the conversation goes. Tap to review. */
export function FamilyBar({ profile, lang, onOpen }: { profile: Profile; lang: Lang; onOpen: () => void }) {
  const ms = members(profile);
  const { done, total } = stepProgress(profile);
  return (
    <button onClick={onOpen} className="mx-5 flex w-[calc(100%-2.5rem)] items-center gap-3 rounded-full bg-surface p-1.5 pr-4 text-left shadow-e1 ring-1 ring-line" aria-label="Review your profile">
      <div className="flex -space-x-2.5">
        {ms.length === 0 && (
          <span className="grid h-9 w-9 place-items-center rounded-full border border-dashed border-line text-ink-faint">
            <Icon name="person" size={16} />
          </span>
        )}
        {ms.slice(0, 5).map((m, i) => (
          <span key={m.key} className="rise relative grid h-9 w-9 place-items-center rounded-full bg-surface-2 text-ink ring-2 ring-surface" style={{ animationDelay: `${i * 60}ms` }}>
            <Icon name={m.icon} size={16} />
            {m.flagged && <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-accent ring-2 ring-surface" />}
          </span>
        ))}
      </div>
      <p className="min-w-0 flex-1 truncate text-[13.5px] font-medium">{profile.cover ? coverSummary(profile) : t(lang, "Your people", "Aapki family")}</p>
      <span className="flex shrink-0 items-center gap-2" aria-label={`${done} of ${total} answered`}>
        <span className="h-1.5 w-12 overflow-hidden rounded-full bg-line">
          <span className="block h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
        </span>
        <span className="text-[11.5px] tabular-nums text-ink-soft">
          {done}/{total}
        </span>
      </span>
    </button>
  );
}

export function ProfileSheet({ profile: p, lang, onEdit, onClose }: { profile: Profile; lang: Lang; onEdit: (f: keyof Profile) => void; onClose: () => void }) {
  const si = recommendSumInsured(p);
  const rows: { label: string; value?: string; field: keyof Profile }[] = [
    { label: "Who's covered", value: p.cover ? coverSummary(p) : undefined, field: "cover" },
    { label: "Existing conditions", value: p.conditions ? (p.conditions.length ? p.conditions.map((c) => CONDITION_LABEL[c]).join(", ") : "None") : undefined, field: "conditions" },
    ...(p.conditions?.length && p.conditionWho ? [{ label: "Who has the condition", value: p.conditionWho === "parent" ? "Parent" : p.conditionWho === "partner" ? "Partner" : "You", field: "conditionWho" as const }] : []),
    { label: "Treatment expected soon", value: p.upcoming === undefined ? undefined : p.upcoming.length ? p.upcoming.map((u) => PLANNED_LABEL[u]).join(", ") : "None", field: "upcoming" },
    { label: "Where you'd get treated", value: p.city ? (p.cityName ?? CITY_LABEL[p.city]) : undefined, field: "city" },
    ...(p.cover?.self ? [{ label: "Employer cover", value: p.employerCover === undefined ? undefined : p.employerCover ? `₹${p.employerCover} lakh` : "None", field: "employerCover" as const }] : []),
    ...(p.planningBaby !== undefined ? [{ label: "Planning a baby", value: p.planningBaby ? "Within 3 years" : "No", field: "planningBaby" as const }] : []),
    { label: "Existing personal policy", value: p.existingCover === undefined ? undefined : p.existingCover ? `₹${p.existingCover} lakh` : "None", field: "existingCover" },
    { label: "Savings for a ₹5L bill", value: p.savings === undefined ? undefined : p.savings === "covered" ? "Yes" : p.savings === "partly" ? "Partly" : "Not really", field: "savings" },
    { label: "Tobacco", value: p.tobacco === undefined ? undefined : p.tobacco ? "Yes" : "No", field: "tobacco" },
    { label: "What matters most", value: p.priorities ? effectivePriorities(p).map((x) => PRIORITY_LABEL[x]).join(", ") || "Balanced" : undefined, field: "priorities" },
    { label: "Yearly budget", value: p.budget === undefined ? undefined : p.budget ? `Up to ${inr(p.budget)}` : "Open", field: "budget" },
  ];
  return (
    <Sheet onClose={onClose} title={<h2 className="display text-[30px]">{t(lang, "Here's what I've got", "Maine yeh samjha")}</h2>}>
      <p className="mt-3 flex items-start gap-2.5 text-[14px] leading-relaxed text-ink-soft">
        <Icon name="lock" size={16} className="mt-0.5 shrink-0 text-accent" />
        {t(lang, "Tap anything to change it. None of this goes to an insurer unless you pick a plan.", "Kuch bhi badalna ho toh tap karo. Jab tak plan nahi chunte, yeh kisi insurer ko nahi jaata.")}
      </p>
      <ul className="mt-6 divide-y divide-line">
        {rows.map((r) => (
          <li key={r.label}>
            <button disabled={!r.value} onClick={() => onEdit(r.field)} className="flex w-full items-center justify-between gap-4 py-4 text-left">
              <span className="text-[14px] text-ink-soft">{r.label}</span>
              <span className={`text-right text-[15px] font-medium ${r.value ? "" : "text-ink-faint"}`}>{r.value ?? t(lang, "Not yet", "Abhi nahi")}</span>
            </button>
          </li>
        ))}
      </ul>
      {p.cover && p.city && (
        <Aura colors={AURA.dusk} scrim className="relative mt-6 rounded-[28px] p-6 text-white">
          <p className="text-[13px] opacity-80">{t(lang, "Cover we'd go for", "Itna cover sahi rahega")}</p>
          <p className="money mt-2 text-[64px]">₹{si.lakh}L</p>
          <ul className="mt-4 space-y-2 text-[13.5px] leading-relaxed opacity-90">
            {si.why.map((w) => (
              <li key={w}>{w}.</li>
            ))}
          </ul>
        </Aura>
      )}
    </Sheet>
  );
}
