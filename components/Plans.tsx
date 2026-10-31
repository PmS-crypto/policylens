"use client";

import { useMemo, useRef, useState } from "react";
import { copayApplies } from "@/lib/match";
import { POLICIES } from "@/lib/policies";
import { PRIVATE_ROOM_RATE, effectivePriorities, eldestAge } from "@/lib/profile";
import type { Lang } from "@/lib/ai";
import { t } from "@/lib/flow";
import { headlineScenario, headlineSentence, simulate } from "@/lib/simulate";
import type { Inference } from "@/lib/infer";
import { budgetLevers, coverageStructures } from "@/lib/structure";
import { BudgetFix, OverBudgetFlag, StructureAdvice } from "./Structure";
import type { Excluded, Match, Priority, Profile } from "@/lib/types";
import { Aura, Icon, Money, PLAN_AURAS, ReasonRow, Seal, Segmented, inrShort } from "./ui";

interface Props {
  lang: Lang;
  profile: Profile;
  top: Match[];
  all: Match[];
  excluded: Excluded[];
  notes: Record<string, string>;
  onOpen: (id: string, clause?: string) => void;
  onChoose: (id: string) => void;
  onBill: (id: string) => void;
  onExplain: () => void;
  budgetSource: "you" | "income" | null;
  /** What the engine inferred from the answers, worth keeping visible next to the plans. */
  worked: Inference[];
  /** Planning one group at a time when no single policy fits everyone. */
  split: { current: "family" | "parents" | null; onSwitch: (g: "family" | "parents") => void };
}

export default function Plans({ lang, profile, top, all, excluded, notes, onOpen, onChoose, onBill, onExplain, budgetSource, worked, split }: Props) {
  const [active, setActive] = useState(0);
  const [mode, setMode] = useState<"cards" | "compare">("cards");
  const rail = useRef<HTMLDivElement>(null);
  const head = headlineScenario(profile);
  const sentence = headlineSentence(profile, lang);
  const structures = useMemo(() => coverageStructures(profile, top), [profile, top]);
  const fit = useMemo(() => budgetLevers(profile, top, all), [profile, top, all]);
  const seeFit = () => document.getElementById("fit")?.scrollIntoView({ behavior: "smooth", block: "start" });

  const onScroll = () => {
    const el = rail.current;
    if (el) setActive(Math.round(el.scrollLeft / (el.clientWidth * 0.88)));
  };

  return (
    <div className="pb-10">
      <header className="px-6 pt-6">
        {top.length === 0 ? (
          <>
            <p className="text-[13px] font-medium text-accent">What type of cover do I need?</p>
            <h1 className="display mt-2 text-[38px]">Two policies will work better</h1>
            <p className="mt-3 max-w-[36ch] text-[15px] leading-relaxed text-ink-soft">No single plan accepts everyone together. Here's why, and what to do instead.</p>
          </>
        ) : (
        <>
        <p className="text-[13px] font-medium text-accent">{mode === "cards" ? t(lang, "Which policy should I consider?", "Kaunsi policy dekhni chahiye?") : t(lang, "How do I compare these?", "Inhe compare kaise karun?")}</p>
        <h1 className="display mt-2 text-[38px]">{mode === "cards" ? t(lang, "Your top 3", "Aapke top 3") : t(lang, "What's actually different", "Asli farak kya hai")}</h1>
        <p className="mt-3 max-w-[36ch] text-[15px] leading-relaxed text-ink-soft">
          {mode === "cards"
            ? t(
                lang,
                `Went through ${POLICIES.length} policies clause by clause. Ranked only on what you told me, and each one leads with what you'd actually pay.`,
                `${POLICIES.length} policies clause by clause padhi. Ranking sirf aapki baaton pe hai, aur har card pe pehle wahi dikhta hai jo aap asal mein doge.`,
              )
            : t(lang, "Not features. The rules that decide how much of a bill actually gets paid.", "Features nahi. Woh rules jo decide karte hain ki bill ka kitna paisa milega.")}
        </p>
        <button onClick={onExplain} className="mt-3 inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-accent">
          <Icon name="info" size={15} />
          {t(lang, "How we ranked these", "Ranking kaise ki")}
        </button>
        </>
        )}
        {split.current && (
          <div className="mt-5 flex rounded-full bg-surface-2 p-1" role="group" aria-label="Whose cover">
            {(["family", "parents"] as const).map((g) => (
              <button
                key={g}
                onClick={() => g !== split.current && split.onSwitch(g)}
                aria-pressed={split.current === g}
                className={`flex-1 rounded-full py-2 text-[13px] transition ${split.current === g ? "bg-surface font-semibold shadow-e1" : "text-ink-soft"}`}
              >
                {g === "family" ? "Your family" : "Your parents"}
              </button>
            ))}
          </div>
        )}
        {worked.length > 0 && <WorkedOut items={worked} />}
        {top.length > 0 && (
        <div className="mt-6">
          <Segmented
            label="Plan view"
            value={mode}
            onChange={setMode}
            options={[
              { value: "cards", label: t(lang, "One at a time", "Ek-ek karke") },
              { value: "compare", label: t(lang, "Side by side", "Saath mein") },
            ]}
          />
        </div>
        )}
        {mode === "cards" && fit && profile.budget && <OverBudgetFlag over={fit.over} budget={profile.budget} source={budgetSource} onSee={seeFit} />}
      </header>

      {top.length === 0 ? (
        <section className="mx-5 mt-6 rounded-[28px] bg-surface p-6 shadow-e1 ring-1 ring-line">
          <h2 className="title text-[20px] leading-tight">No single policy covers everyone together</h2>
          <ul className="mt-3 space-y-1.5 text-[13.5px] leading-relaxed text-ink-soft">
            {excluded.slice(0, 3).map((e) => (
              <li key={e.policy.id}>
                <span className="font-medium text-ink">{e.policy.name}:</span> {e.why}
              </li>
            ))}
          </ul>
          {profile.cover?.parents && (profile.cover.self || profile.cover.partner || profile.cover.kids) && (
            <>
              <p className="mt-5 text-[14.5px] leading-relaxed">That's common when parents are much older. Two policies usually work out better anyway: their claims can't use up your cover.</p>
              <div className="mt-5 grid grid-cols-2 gap-2.5">
                <button onClick={() => split.onSwitch("family")} className="rounded-full py-3.5 text-[14px] font-semibold ring-1 ring-line">
                  Your family
                </button>
                <button onClick={() => split.onSwitch("parents")} className="rounded-full bg-primary py-3.5 text-[14px] font-semibold text-on-primary shadow-e2">
                  Your parents
                </button>
              </div>
            </>
          )}
        </section>
      ) : mode === "cards" ? (
        <>
          <div ref={rail} onScroll={onScroll} className="no-scrollbar mt-6 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-6 px-6 pb-4">
            {top.map((m, i) => {
              const r = simulate(m.policy, m.sumInsured, profile, head.scenario, { year: head.year, room: "private" });
              const paidPct = r.bill ? (r.insurerPays / r.bill) * 100 : 0;
              return (
                <article key={m.policy.id} className="w-[88%] shrink-0 snap-start">
                  <div className="overflow-hidden rounded-[32px] bg-surface shadow-e2 ring-1 ring-line">
                    <Aura colors={PLAN_AURAS[i % 3]} scrim className="relative px-6 pb-6 pt-5 text-white">
                      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                        <span className="flex items-center gap-2">
                          <span className="money text-[22px] opacity-90">0{i + 1}</span>
                          <span className="whitespace-nowrap rounded-full bg-white/20 px-3 py-1 text-[12px] font-semibold backdrop-blur">{lang === "hi" ? LABEL_HI[m.label ?? ""] ?? m.label : m.label}</span>
                        </span>
                        <span className="whitespace-nowrap text-[12px] opacity-80">
                          {m.prioritiesTotal > 0 ? `${m.prioritiesMet}/${m.prioritiesTotal} priorities` : m.fit}
                        </span>
                      </div>
                      <p className="mt-10 text-[13px] opacity-85">{m.policy.insurer}</p>
                      <h2 className="display text-[30px]">{m.policy.name}</h2>

                      <button onClick={() => onBill(m.policy.id)} className="mt-6 block w-full text-left">
                        {/* Lead with relief: what the plan pays. Your share sits right under it, never hidden. */}
                        <p className="max-w-[30ch] text-[13.5px] leading-snug opacity-90">
                          {sentence}, {r.blocked ? t(lang, "this plan doesn't pay yet", "yeh plan abhi nahi dega") : t(lang, "this plan pays", "yeh plan dega")}
                        </p>
                        {r.blocked ? (
                          <Money value={r.youPay} className="mt-2 block text-[56px]" />
                        ) : (
                          <Money value={r.insurerPays} className="mt-2 block text-[64px]" />
                        )}
                        <p className="mt-1 text-[14px] font-medium">
                          {r.blocked
                            ? t(lang, "is what you'd pay. It's still in the waiting period.", "aapko dena hoga. Waiting period abhi chal raha hai.")
                            : r.youPay === 0
                              ? t(lang, `of the ${inrShort(r.bill)} bill. You pay nothing.`, `${inrShort(r.bill)} ke bill mein se. Aapko kuch nahi dena.`)
                              : t(lang, `of the ${inrShort(r.bill)} bill. You pay ${inrShort(r.youPay)}.`, `${inrShort(r.bill)} ke bill mein se. Aap doge ${inrShort(r.youPay)}.`)}
                        </p>
                        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/25">
                          <div className="h-full rounded-full bg-white transition-all duration-700" style={{ width: `${paidPct}%` }} />
                        </div>
                        <p className="mt-3 flex items-center justify-end text-[12.5px]">
                          <span className="flex items-center gap-1 font-semibold">
                            {t(lang, "See the full bill", "Poora bill dekho")} <Icon name="arrow" size={14} />
                          </span>
                        </p>
                      </button>
                    </Aura>

                    <div className="grid grid-cols-2 divide-x divide-line border-b border-line">
                      <div className="px-6 py-5">
                        <Money value={m.premium} className="text-[30px]" />
                        <p className="mt-1.5 text-[12.5px] text-ink-soft">{t(lang, "a year, roughly", "saal ka, lagbhag")}</p>
                      </div>
                      <div className="px-6 py-5">
                        <span className="money text-[30px]">₹{m.sumInsured}L</span>
                        <p className="mt-1.5 text-[12.5px] text-ink-soft">{t(lang, "cover", "cover")}</p>
                      </div>
                    </div>

                    <div className="px-6 pb-6 pt-6">
                      <h3 className="title text-[19px]">{t(lang, "Why it fits you", "Yeh aapke liye kyun")}</h3>
                      {notes[m.policy.id] ? (
                        <p className="rise mt-2.5 text-[15px] leading-relaxed">{notes[m.policy.id]}</p>
                      ) : (
                        <div className="mt-3 space-y-2.5" aria-label="Writing explanation">
                          <div className="h-3 animate-pulse rounded-full bg-surface-2" />
                          <div className="h-3 w-4/5 animate-pulse rounded-full bg-surface-2" />
                        </div>
                      )}
                      <div className="mt-4">
                        <Seal>
                          {t(lang, "Policy wording", "Policy wording")} {m.policy.docVersion}, {t(lang, "checked", "checked")} {new Date(m.policy.lastVerified).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}
                        </Seal>
                      </div>
                      <ul className="mt-6 space-y-6 border-t border-line pt-6">
                        {m.reasons.slice(0, 4).map((x) => (
                          <ReasonRow key={x.title} r={x} onClause={() => onOpen(m.policy.id, x.clauseId)} />
                        ))}
                      </ul>
                      <div className="mt-8 grid grid-cols-2 gap-2.5">
                        <button onClick={() => onOpen(m.policy.id)} className="rounded-full py-4 text-[14.5px] font-semibold ring-1 ring-line">
                          {t(lang, "What's covered?", "Kya cover hai?")}
                        </button>
                        <button onClick={() => onChoose(m.policy.id)} className="rounded-full bg-primary py-4 text-[14.5px] font-semibold text-on-primary shadow-e2">
                          {t(lang, "Pick this one", "Yahi lunga")}
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
          <div className="mt-2 flex justify-center gap-2" aria-hidden>
            {top.map((m, i) => (
              <span key={m.policy.id} className={`h-1.5 rounded-full transition-all duration-500 ${i === active ? "w-8 bg-accent" : "w-1.5 bg-line"}`} />
            ))}
          </div>
          {/* Next step in the journey: check the shortlist against real hospital bills before picking */}
          <button onClick={() => onBill(top[active]?.policy.id ?? top[0].policy.id)} className="mx-5 mt-8 flex w-[calc(100%-2.5rem)] items-center justify-between gap-4 rounded-[28px] bg-primary p-5 text-left text-on-primary shadow-e2">
            <span>
              <span className="block text-[12.5px] opacity-70">{t(lang, "Next step", "Agla step")}</span>
              <span className="title mt-1 block text-[18px] leading-tight">{t(lang, "Will these plans actually cover you?", "Kya yeh plans sach mein cover karenge?")}</span>
              <span className="mt-1 block text-[13px] opacity-75">{t(lang, "See real hospital bills for your family, plan by plan.", "Apni family ke asli hospital bills dekho, har plan ke saath.")}</span>
            </span>
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent text-white">
              <Icon name="arrow" size={18} />
            </span>
          </button>

          {fit && profile.budget && fit.levers.length > 0 && (
            <BudgetFix over={fit.over} budget={profile.budget} source={budgetSource} levers={fit.levers} bestName={top[0].policy.name} sentence={head.sentence} />
          )}
          <StructureAdvice structures={structures} />
          {excluded.length > 0 && (
            <details className="mx-6 mt-8 rounded-[24px] bg-surface p-5 text-[14px] shadow-e1 ring-1 ring-line">
              <summary className="cursor-pointer font-semibold">{t(lang, "Why some plans didn't make the cut", "Kuch plans kyun nahi dikhe")}</summary>
              <ul className="mt-3 space-y-2 text-ink-soft">
                {excluded.map((e) => (
                  <li key={e.policy.id}>
                    <span className="font-medium text-ink">{e.policy.name}:</span> {e.why}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      ) : (
        <Compare lang={lang} profile={profile} top={top} onOpen={onOpen} />
      )}
    </div>
  );
}

const LABEL_HI: Record<string, string> = {
  "Best fit for you": "Aapke liye best",
  "Budget pick": "Budget wala",
  "Maximum protection": "Full protection",
  "Strong alternative": "Solid option",
  "Lower premium": "Kam premium",
};

type Tone = "good" | "caveat" | "bad" | "neutral";
const TONE: Record<Tone, string> = { good: "text-paid", caveat: "text-warn", bad: "text-owe", neutral: "text-ink" };

function Compare({ lang, profile, top, onOpen }: { lang: Lang; profile: Profile; top: Match[]; onOpen: (id: string, clause?: string) => void }) {
  const pri = new Set(effectivePriorities(profile));
  const age = eldestAge(profile);
  const rate = PRIVATE_ROOM_RATE[profile.city ?? "tier2"];
  const rows: { label: string; why: string; matters?: Priority | true; clause?: string; cell: (m: Match) => [string, Tone] }[] = [
    { label: "Yearly premium", why: "Estimated", matters: "low_premium", cell: (m) => [inrShort(m.premium), profile.budget && m.premium > profile.budget ? "bad" : "neutral"] },
    { label: "Room rent", why: "Going over a cap shrinks your whole claim", matters: "private_room", clause: "room", cell: ({ policy: p, sumInsured }) => (p.roomRent.kind === "none" ? ["No cap", "good"] : p.roomRent.kind === "single" ? ["Private room", "good"] : [`${inrShort(((p.roomRent.percent ?? 1) / 100) * sumInsured * 1e5)}/day`, ((p.roomRent.percent ?? 1) / 100) * sumInsured * 1e5 >= rate ? "caveat" : "bad"]) },
    { label: "Co-pay", why: "Your share of every bill", matters: "low_oop", clause: "copay", cell: ({ policy: p }) => (!p.copay.percent ? ["None", "good"] : copayApplies(p, age) ? [`${p.copay.percent}% always`, "bad"] : [`${p.copay.percent}% at ${p.copay.fromAge}+`, "caveat"]) },
    { label: "Existing illness", why: "Wait before it's covered", matters: "ped_fast", clause: "ped", cell: ({ policy: p }) => [`${p.pedWaitYears} yr`, p.pedWaitYears <= 1 ? "good" : p.pedWaitYears === 2 ? "caveat" : "bad"] },
    { label: "Surgery caps", why: "Limits regardless of cover", matters: true, clause: "sublimits", cell: ({ policy: p }) => (Object.keys(p.sublimits).length ? ["Yes", "bad"] : ["None", "good"]) },
    { label: "Maternity", why: "Delivery and newborn", matters: "maternity", clause: "maternity", cell: ({ policy: p }) => (p.maternity.covered ? [`After ${p.maternity.waitYears} yr`, "good"] : ["No", pri.has("maternity") ? "bad" : "neutral"]) },
    { label: "Cover refills", why: "If one claim uses it up", matters: "restoration", clause: "restoration", cell: ({ policy: p }) => (p.restoration === "unlimited" ? ["Always", "good"] : p.restoration === "once" ? ["Once", "caveat"] : ["Never", "bad"]) },
    { label: "Consumables", why: "Gloves, PPE, 5–10% of a bill", clause: "consumables", cell: ({ policy: p }) => (p.consumablesCovered ? ["Paid", "good"] : ["Not paid", "caveat"]) },
  ];
  const matters = (r: (typeof rows)[number]) => r.matters === true || (!!r.matters && pri.has(r.matters));
  return (
    <div className="mt-6 px-5">
      <div className="overflow-hidden rounded-[28px] bg-surface shadow-e1 ring-1 ring-line">
        <div className="grid grid-cols-[minmax(0,1.1fr)_repeat(3,minmax(0,1fr))] gap-1 border-b border-line px-4 py-4">
          <span />
          {top.map((m, i) => (
            <span key={m.policy.id} className="text-[12.5px] font-semibold leading-tight">
              <span className="money mb-1 block text-[18px] text-accent">0{i + 1}</span>
              {m.policy.name}
            </span>
          ))}
        </div>
        <div className="divide-y divide-line">
          {rows.map((r) => (
            <div key={r.label} className={`grid grid-cols-[minmax(0,1.1fr)_repeat(3,minmax(0,1fr))] gap-1 px-4 py-4 ${matters(r) ? "bg-accent-soft/60" : ""}`}>
              <div>
                <p className="text-[13.5px] font-semibold leading-tight">{r.label}</p>
                <p className="mt-1 text-[11.5px] leading-snug text-ink-soft">{r.why}</p>
              </div>
              {top.map((m) => {
                const [t, tone] = r.cell(m);
                return (
                  <button key={m.policy.id} disabled={!r.clause} onClick={() => onOpen(m.policy.id, r.clause)} className={`text-left text-[13.5px] font-semibold leading-tight ${TONE[tone]}`}>
                    {t}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <p className="mt-4 px-1 text-[12.5px] text-ink-soft">{t(lang, "Highlighted rows are the ones you said matter. Tap any value to read the clause.", "Highlighted rows woh hain jo aapne important bataye. Clause padhne ke liye kisi bhi value pe tap karo.")}</p>
    </div>
  );
}

/** What PolicyLens inferred from the answers, kept beside the plans so the reasoning stays visible. */
function WorkedOut({ items }: { items: Inference[] }) {
  const [open, setOpen] = useState(false);
  const list = open ? items : items.slice(0, 2);
  return (
    <section className="mt-5 rounded-[24px] bg-accent-soft p-5" aria-labelledby="worked-title">
      <h2 id="worked-title" className="flex items-center gap-2 text-[14px] font-semibold text-accent">
        <Icon name="sparkle" size={15} />
        What I worked out from your answers
      </h2>
      <ul className="mt-3 space-y-3">
        {list.map((i) => (
          <li key={i.noticed} className="text-[14px] leading-relaxed">
            <span className="font-medium">{i.noticed}</span> <span className="text-ink-soft">{i.did}</span>
          </li>
        ))}
      </ul>
      {items.length > 2 && (
        <button onClick={() => setOpen(!open)} className="mt-3 text-[13px] font-semibold text-accent">
          {open ? "Show less" : `Show all ${items.length}`}
        </button>
      )}
    </section>
  );
}
