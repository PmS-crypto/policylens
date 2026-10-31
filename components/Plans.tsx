"use client";

import { useRef, useState } from "react";
import { copayApplies } from "@/lib/match";
import { POLICIES } from "@/lib/policies";
import { PRIVATE_ROOM_RATE, effectivePriorities, eldestAge } from "@/lib/profile";
import { headlineScenario, simulate } from "@/lib/simulate";
import type { Excluded, Match, Priority, Profile } from "@/lib/types";
import { Aura, Icon, Money, PLAN_AURAS, ReasonRow, Seal, Segmented, inrShort } from "./ui";

interface Props {
  profile: Profile;
  top: Match[];
  excluded: Excluded[];
  notes: Record<string, string>;
  onOpen: (id: string, clause?: string) => void;
  onChoose: (id: string) => void;
  onBill: (id: string) => void;
}

export default function Plans({ profile, top, excluded, notes, onOpen, onChoose, onBill }: Props) {
  const [active, setActive] = useState(0);
  const [mode, setMode] = useState<"cards" | "compare">("cards");
  const rail = useRef<HTMLDivElement>(null);
  const head = headlineScenario(profile);

  const onScroll = () => {
    const el = rail.current;
    if (el) setActive(Math.round(el.scrollLeft / (el.clientWidth * 0.88)));
  };

  return (
    <div className="pb-10">
      <header className="px-6 pt-6">
        <p className="text-[13px] font-medium text-accent">{POLICIES.length} policies read, clause by clause</p>
        <h1 className="display mt-2 text-[38px]">Your three plans</h1>
        <p className="mt-3 max-w-[36ch] text-[15px] leading-relaxed text-ink-soft">Ranked only on what you told me. Each one leads with what you'd actually pay.</p>
        <div className="mt-6">
          <Segmented
            label="Plan view"
            value={mode}
            onChange={setMode}
            options={[
              { value: "cards", label: "One at a time" },
              { value: "compare", label: "Side by side" },
            ]}
          />
        </div>
      </header>

      {mode === "cards" ? (
        <>
          <div ref={rail} onScroll={onScroll} className="no-scrollbar mt-6 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-6 px-6 pb-4">
            {top.map((m, i) => {
              const r = simulate(m.policy, m.sumInsured, profile, head.scenario, { year: head.year, room: "private" });
              const paidPct = r.bill ? (r.insurerPays / r.bill) * 100 : 0;
              return (
                <article key={m.policy.id} className="w-[88%] shrink-0 snap-start">
                  <div className="overflow-hidden rounded-[32px] bg-surface shadow-e2 ring-1 ring-line">
                    <Aura colors={PLAN_AURAS[i % 3]} scrim className="relative px-6 pb-6 pt-5 text-white">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <span className="money text-[22px] opacity-90">0{i + 1}</span>
                          <span className="rounded-full bg-white/20 px-3 py-1 text-[12px] font-semibold backdrop-blur">{m.label}</span>
                        </span>
                        <span className="text-[12px] opacity-80">
                          {m.prioritiesTotal > 0 ? `${m.prioritiesMet}/${m.prioritiesTotal} priorities` : m.fit}
                        </span>
                      </div>
                      <p className="mt-10 text-[13px] opacity-85">{m.policy.insurer}</p>
                      <h2 className="display text-[30px]">{m.policy.name}</h2>

                      <button onClick={() => onBill(m.policy.id)} className="mt-6 block w-full text-left">
                        <p className="max-w-[28ch] text-[13.5px] leading-snug opacity-90">{head.sentence}, you'd pay</p>
                        <Money value={r.youPay} className="mt-2 block text-[68px]" />
                        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/25">
                          <div className="h-full rounded-full bg-white transition-all duration-700" style={{ width: `${paidPct}%` }} />
                        </div>
                        <p className="mt-3 flex items-center justify-between text-[12.5px]">
                          <span className="opacity-85">
                            Insurer pays {Math.round(paidPct)}% of {inrShort(r.bill)}
                            {r.blocked ? ", not covered yet" : ""}
                          </span>
                          <span className="flex items-center gap-1 font-semibold">
                            See bill <Icon name="arrow" size={14} />
                          </span>
                        </p>
                      </button>
                    </Aura>

                    <div className="grid grid-cols-2 divide-x divide-line border-b border-line">
                      <div className="px-6 py-5">
                        <Money value={m.premium} className="text-[30px]" />
                        <p className="mt-1.5 text-[12.5px] text-ink-soft">a year, estimated</p>
                      </div>
                      <div className="px-6 py-5">
                        <span className="money text-[30px]">₹{m.sumInsured}L</span>
                        <p className="mt-1.5 text-[12.5px] text-ink-soft">cover</p>
                      </div>
                    </div>

                    <div className="px-6 pb-6 pt-6">
                      <h3 className="title text-[19px]">Why it fits you</h3>
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
                          Policy wording {m.policy.docVersion}, checked {new Date(m.policy.lastVerified).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}
                        </Seal>
                      </div>
                      <ul className="mt-6 space-y-6 border-t border-line pt-6">
                        {m.reasons.slice(0, 4).map((x) => (
                          <ReasonRow key={x.title} r={x} onClause={() => onOpen(m.policy.id, x.clauseId)} />
                        ))}
                      </ul>
                      <div className="mt-8 grid grid-cols-2 gap-2.5">
                        <button onClick={() => onOpen(m.policy.id)} className="rounded-full py-4 text-[14.5px] font-semibold ring-1 ring-line">
                          Fine print
                        </button>
                        <button onClick={() => onChoose(m.policy.id)} className="rounded-full bg-primary py-4 text-[14.5px] font-semibold text-on-primary shadow-e2">
                          Choose plan
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
          {excluded.length > 0 && (
            <details className="mx-6 mt-8 rounded-[24px] bg-surface p-5 text-[14px] shadow-e1 ring-1 ring-line">
              <summary className="cursor-pointer font-semibold">Why some plans aren't shown</summary>
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
        <Compare profile={profile} top={top} onOpen={onOpen} />
      )}
    </div>
  );
}

type Tone = "good" | "caveat" | "bad" | "neutral";
const TONE: Record<Tone, string> = { good: "text-paid", caveat: "text-warn", bad: "text-owe", neutral: "text-ink" };

function Compare({ profile, top, onOpen }: { profile: Profile; top: Match[]; onOpen: (id: string, clause?: string) => void }) {
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
        <div className="grid grid-cols-[1.1fr_repeat(3,1fr)] gap-1 border-b border-line px-4 py-4">
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
            <div key={r.label} className={`grid grid-cols-[1.1fr_repeat(3,1fr)] gap-1 px-4 py-4 ${matters(r) ? "bg-accent-soft/60" : ""}`}>
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
      <p className="mt-4 px-1 text-[12.5px] text-ink-soft">Highlighted rows are the ones you said matter. Tap any value to read the clause.</p>
    </div>
  );
}
