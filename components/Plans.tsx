"use client";

import { useRef, useState } from "react";
import { copayApplies } from "@/lib/match";
import { POLICIES } from "@/lib/policies";
import { PRIVATE_ROOM_RATE, effectivePriorities, eldestAge } from "@/lib/profile";
import { headlineScenario, simulate } from "@/lib/simulate";
import type { Excluded, Match, Priority, Profile } from "@/lib/types";
import { ReasonRow, inrShort } from "./ui";

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
    if (el) setActive(Math.round(el.scrollLeft / el.clientWidth));
  };

  return (
    <div className="pb-6">
      <div className="px-5 pt-5">
        <h1 className="font-display text-[28px] font-extrabold leading-[1.1]">Three plans that fit your family</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">
          I read {POLICIES.length} policies clause by clause. Each plan below leads with what you'd actually pay, not the price tag.
          {excluded.length > 0 && ` ${excluded.length} ${excluded.length === 1 ? "plan doesn't" : "plans don't"} accept your family.`}
        </p>
        <div className="mt-4 flex rounded-xl bg-surface p-1">
          {(["cards", "compare"] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)} className={`flex-1 rounded-lg py-2 text-[13px] ${mode === m ? "bg-pine font-semibold text-white" : "text-ink-soft"}`}>
              {m === "cards" ? "One at a time" : "Side by side"}
            </button>
          ))}
        </div>
      </div>

      {mode === "cards" ? (
        <>
          <div ref={rail} onScroll={onScroll} className="no-scrollbar mt-4 flex snap-x snap-mandatory overflow-x-auto">
            {top.map((m) => {
              const r = simulate(m.policy, m.sumInsured, profile, head.scenario, { year: head.year, room: "private" });
              const paidPct = r.bill ? (r.insurerPays / r.bill) * 100 : 0;
              return (
                <article key={m.policy.id} className="w-full shrink-0 snap-center px-4">
                  <div className="overflow-hidden rounded-3xl bg-surface">
                    <div className="bg-pine px-5 pb-5 pt-4 text-white">
                      <div className="flex items-center justify-between">
                        <span className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${m === top[0] ? "bg-mark text-pine" : "bg-white/12 text-white"}`}>{m.label}</span>
                        <span className="text-[12px] text-white/70">{m.fit}</span>
                      </div>
                      <p className="mt-4 text-[13px] text-white/70">{m.policy.insurer}</p>
                      <h2 className="font-display text-[26px] font-extrabold leading-tight">{m.policy.name}</h2>

                      <button onClick={() => onBill(m.policy.id)} className="mt-4 w-full rounded-2xl bg-white/8 p-4 text-left ring-1 ring-white/15">
                        <p className="text-[13px] leading-snug text-white/80">{head.sentence}, you'd pay</p>
                        <p className={`font-display mt-1 text-[40px] font-extrabold leading-none ${r.youPay === 0 ? "text-[#7fe0b5]" : "text-[#ff9b9b]"}`}>{inrShort(r.youPay)}</p>
                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#ff9b9b]/30">
                          <div className="h-full rounded-full bg-[#7fe0b5]" style={{ width: `${paidPct}%` }} />
                        </div>
                        <p className="mt-2 text-[12px] text-white/70">
                          of a {inrShort(r.bill)} bill. {r.blocked ? "Not covered yet." : "See the itemised bill."}
                        </p>
                      </button>
                    </div>

                    <div className="grid grid-cols-2 divide-x divide-line border-b border-line">
                      <div className="p-4">
                        <p className="font-display text-[22px] font-bold">{inrShort(m.premium)}</p>
                        <p className="text-[12px] text-ink-soft">a year, estimated</p>
                      </div>
                      <div className="p-4">
                        <p className="font-display text-[22px] font-bold">₹{m.sumInsured} lakh</p>
                        <p className="text-[12px] text-ink-soft">cover</p>
                      </div>
                    </div>

                    <div className="p-5">
                      <h3 className="text-[15px] font-semibold">Why it fits you</h3>
                      {notes[m.policy.id] ? (
                        <p className="mt-1.5 text-[14px] leading-relaxed text-ink">{notes[m.policy.id]}</p>
                      ) : (
                        <div className="mt-2 space-y-2" aria-label="Writing explanation">
                          <div className="h-3 animate-pulse rounded bg-mist" />
                          <div className="h-3 w-4/5 animate-pulse rounded bg-mist" />
                        </div>
                      )}
                      <ul className="mt-5 space-y-4">
                        {m.reasons.slice(0, 4).map((x) => (
                          <ReasonRow key={x.title} r={x} onClause={() => onOpen(m.policy.id, x.clauseId)} />
                        ))}
                      </ul>
                      <div className="mt-6 grid grid-cols-2 gap-2">
                        <button onClick={() => onOpen(m.policy.id)} className="rounded-2xl bg-mist py-3.5 text-[14px] font-semibold">
                          Read fine print
                        </button>
                        <button onClick={() => onChoose(m.policy.id)} className="rounded-2xl bg-pine py-3.5 text-[14px] font-semibold text-white">
                          Choose plan
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
          <div className="mt-4 flex justify-center gap-1.5" aria-hidden>
            {top.map((m, i) => (
              <span key={m.policy.id} className={`h-1.5 rounded-full transition-all ${i === active ? "w-6 bg-pine" : "w-1.5 bg-pine/25"}`} />
            ))}
          </div>
          {excluded.length > 0 && (
            <details className="mx-5 mt-5 rounded-2xl bg-surface p-4 text-[13px]">
              <summary className="cursor-pointer font-medium">Why some plans aren't shown</summary>
              <ul className="mt-2 space-y-1.5 text-ink-soft">
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
    <div className="mt-4 px-4">
      <div className="sticky top-0 z-10 grid grid-cols-[1.1fr_repeat(3,1fr)] gap-1 rounded-t-2xl bg-pine px-3 py-3 text-white">
        <span />
        {top.map((m) => (
          <span key={m.policy.id} className="text-[12px] font-semibold leading-tight">
            {m.policy.name}
          </span>
        ))}
      </div>
      <div className="divide-y divide-line rounded-b-2xl bg-surface">
        {rows.map((r) => (
          <div key={r.label} className={`grid grid-cols-[1.1fr_repeat(3,1fr)] gap-1 px-3 py-3 ${matters(r) ? "bg-mark/15" : ""}`}>
            <div>
              <p className="text-[13px] font-semibold leading-tight">{r.label}</p>
              <p className="mt-0.5 text-[11px] leading-snug text-ink-soft">{r.why}</p>
            </div>
            {top.map((m) => {
              const [t, tone] = r.cell(m);
              return (
                <button key={m.policy.id} disabled={!r.clause} onClick={() => onOpen(m.policy.id, r.clause)} className={`text-left text-[13px] font-semibold leading-tight ${TONE[tone]}`}>
                  {t}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <p className="mt-3 px-1 text-[12px] text-ink-soft">Highlighted rows are the ones you said matter. Tap any value to read the clause.</p>
    </div>
  );
}
