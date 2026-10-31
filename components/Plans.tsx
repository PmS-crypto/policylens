"use client";

import { useRef, useState } from "react";
import { copayApplies } from "@/lib/match";
import { POLICIES } from "@/lib/policies";
import { PRIVATE_ROOM_RATE, effectivePriorities, eldestAge } from "@/lib/profile";
import { headlineScenario, simulate } from "@/lib/simulate";
import type { Excluded, Match, Priority, Profile } from "@/lib/types";
import { Icon, ReasonRow, Seal, Segmented, inrShort } from "./ui";

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
      <div className="px-6 pt-6">
        <h1 className="font-display text-[28px] font-semibold leading-[1.1]">Three plans that fit your family</h1>
        <p className="mt-2.5 text-[14px] leading-relaxed text-ink-soft">
          I read {POLICIES.length} policies clause by clause and ranked them only on what you told me. Each leads with what you'd actually pay.
        </p>
        <div className="mt-5">
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
      </div>

      {mode === "cards" ? (
        <>
          <div ref={rail} onScroll={onScroll} className="no-scrollbar mt-4 flex snap-x snap-mandatory overflow-x-auto">
            {top.map((m) => {
              const r = simulate(m.policy, m.sumInsured, profile, head.scenario, { year: head.year, room: "private" });
              const paidPct = r.bill ? (r.insurerPays / r.bill) * 100 : 0;
              return (
                <article key={m.policy.id} className="w-full shrink-0 snap-center px-5">
                  <div className="overflow-hidden rounded-[24px] bg-surface shadow-e2 ring-1 ring-line">
                    <div className="bg-pine px-5 pb-5 pt-5 text-white">
                      <div className="flex items-center justify-between">
                        <span className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${m === top[0] ? "bg-gold text-white" : "bg-white/12 text-white"}`}>{m.label}</span>
                        <span className="text-[12px] text-white/60">{m.fit}{m.prioritiesTotal > 0 ? `, ${m.prioritiesMet} of ${m.prioritiesTotal} priorities` : ""}</span>
                      </div>
                      <p className="mt-5 text-[13px] text-white/60">{m.policy.insurer}</p>
                      <h2 className="font-display text-[26px] font-semibold leading-tight">{m.policy.name}</h2>

                      <button onClick={() => onBill(m.policy.id)} className="mt-5 w-full rounded-[18px] bg-white/[0.06] p-4 text-left ring-1 ring-white/12">
                        <p className="text-[13px] leading-snug text-white/70">{head.sentence}, you'd pay</p>
                        <p className={`num mt-2 text-[42px] font-semibold leading-none ${r.youPay === 0 ? "text-[#8fd6b4]" : "text-[#f2a59c]"}`}>{inrShort(r.youPay)}</p>
                        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#f2a59c]/25">
                          <div className="h-full rounded-full bg-[#8fd6b4]" style={{ width: `${paidPct}%` }} />
                        </div>
                        <p className="mt-2.5 flex items-center justify-between text-[12px] text-white/60">
                          <span>of a {inrShort(r.bill)} bill{r.blocked ? ", not covered yet" : ""}</span>
                          <span className="flex items-center gap-1 font-medium text-white/85">
                            Itemised bill <Icon name="arrow" size={13} />
                          </span>
                        </p>
                      </button>
                    </div>

                    <div className="grid grid-cols-2 divide-x divide-line border-b border-line">
                      <div className="p-4">
                        <p className="num text-[22px] font-semibold">{inrShort(m.premium)}</p>
                        <p className="text-[12px] text-ink-soft">a year, estimated</p>
                      </div>
                      <div className="p-4">
                        <p className="num text-[22px] font-semibold">₹{m.sumInsured} lakh</p>
                        <p className="text-[12px] text-ink-soft">cover</p>
                      </div>
                    </div>

                    <div className="p-5">
                      <h3 className="font-display text-[17px] font-semibold">Why it fits you</h3>
                      {notes[m.policy.id] ? (
                        <p className="mt-1.5 text-[14px] leading-relaxed text-ink">{notes[m.policy.id]}</p>
                      ) : (
                        <div className="mt-2 space-y-2" aria-label="Writing explanation">
                          <div className="h-3 animate-pulse rounded bg-mist" />
                          <div className="h-3 w-4/5 animate-pulse rounded bg-mist" />
                        </div>
                      )}
                      <div className="mt-3">
                        <Seal>
                          From policy wording {m.policy.docVersion}, checked {new Date(m.policy.lastVerified).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}
                        </Seal>
                      </div>
                      <ul className="mt-5 space-y-5 border-t border-line pt-5">
                        {m.reasons.slice(0, 4).map((x) => (
                          <ReasonRow key={x.title} r={x} onClause={() => onOpen(m.policy.id, x.clauseId)} />
                        ))}
                      </ul>
                      <div className="mt-6 grid grid-cols-2 gap-2">
                        <button onClick={() => onOpen(m.policy.id)} className="rounded-[14px] py-3.5 text-[14px] font-medium text-pine ring-1 ring-line">
                          Read fine print
                        </button>
                        <button onClick={() => onChoose(m.policy.id)} className="rounded-[14px] bg-pine py-3.5 text-[14px] font-semibold text-white shadow-e2">
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
            <details className="mx-5 mt-6 rounded-[20px] bg-surface p-4 text-[13px] shadow-e1 ring-1 ring-line">
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
    <div className="mt-5 px-5">
      <div className="sticky top-0 z-10 grid grid-cols-[1.1fr_repeat(3,1fr)] gap-1 rounded-t-[20px] bg-pine px-3.5 py-3.5 text-white">
        <span />
        {top.map((m) => (
          <span key={m.policy.id} className="text-[12px] font-semibold leading-tight">
            {m.policy.name}
          </span>
        ))}
      </div>
      <div className="divide-y divide-line overflow-hidden rounded-b-[20px] bg-surface shadow-e1 ring-1 ring-line">
        {rows.map((r) => (
          <div key={r.label} className={`grid grid-cols-[1.1fr_repeat(3,1fr)] gap-1 px-3 py-3 ${matters(r) ? "bg-mark/40" : ""}`}>
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
