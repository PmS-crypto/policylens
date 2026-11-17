"use client";

import { useEffect, useRef, useState } from "react";
import type { Lang } from "@/lib/ai";
import { t } from "@/lib/flow";
import { redFlags } from "@/lib/match";
import type { Match, Profile } from "@/lib/types";
import { RichText } from "./Chat";
import { Icon, ReasonRow, Seal, Sheet } from "./ui";

interface Props {
  match: Match;
  focusClause?: string;
  profile: Profile;
  lang: Lang;
  onClose: () => void;
  onChoose: () => void;
}

/** Plain headings for the insurer's clause titles. The clause text below each stays word for word. */
const CLAUSE_LABEL: Record<string, string> = {
  room: "Room limit",
  copay: "Your share of the bill",
  ped: "Illnesses you already have",
  specific: "Wait for planned surgery",
  initial: "First 30 days",
  maternity: "Having a baby",
  restoration: "Cover refills",
  consumables: "Gloves, masks and needles",
  ncb: "Cover grows each year",
  sublimits: "Limits on treatments",
  exclusions: "What it won't pay for",
};

export default function PolicySheet({ match, focusClause, profile, lang, onClose, onChoose }: Props) {
  const p = match.policy;
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState<{ q: string; a: string; cites: string[]; checked?: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(focusClause);
  const refs = useRef<Record<string, HTMLDivElement | null>>({});

  const jump = (id?: string) => {
    if (!id) return;
    setHighlight(id);
    setTimeout(() => refs.current[id]?.scrollIntoView({ behavior: "smooth", block: "center" }), 60);
  };
  useEffect(() => jump(focusClause), [focusClause]);

  const ask = async (question: string) => {
    if (!question.trim()) return;
    setLoading(true);
    setQ("");
    const res = await fetch("/api/ask", { method: "POST", body: JSON.stringify({ question, policyIds: [p.id], profile, lang }) });
    const data = await res.json();
    setAnswer({ q: question, a: data.answer, cites: (data.citations ?? []).map((c: { clauseId: string }) => c.clauseId), checked: data.checked });
    setLoading(false);
  };

  const suggestions = [
    profile.conditions?.length
      ? t(lang, `When does it pay for ${profile.conditions[0] === "bp" ? "BP" : profile.conditions[0]}?`, `${profile.conditions[0] === "bp" ? "BP" : profile.conditions[0]} kab se cover hoga?`)
      : t(lang, "What won't it pay for?", "Kya cover nahi hota?"),
    t(lang, "What if I pick a bigger room?", "Bada room liya toh kya hoga?"),
    profile.cover?.parents ? t(lang, "Does it pay for a new knee?", "Knee replacement cover hai?") : t(lang, "Any hidden limits?", "Koi chhupi limit hai?"),
  ];
  const flags = redFlags(p);

  return (
    <Sheet
      onClose={onClose}
      title={
        <div>
          <p className="text-[13px] text-ink-soft">{p.insurer}</p>
          <h2 className="display mt-1 text-[34px]">{p.name}</h2>
          <div className="mt-3">
            <Seal>
              Plan papers {p.docVersion}, checked {new Date(p.lastVerified).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
            </Seal>
          </div>
        </div>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(q);
        }}
        className="mt-5 flex gap-2 rounded-full bg-surface-2 p-1.5 pl-5"
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t(lang, "Ask anything about this plan", "Is plan ke baare mein kuch bhi poocho")}
          aria-label="Ask about this plan"
          className="min-w-0 flex-1 bg-transparent py-2 text-[15px] outline-none placeholder:text-ink-faint"
        />
        <button className="rounded-full bg-accent px-5 text-[14px] font-semibold text-white">{t(lang, "Ask", "Poocho")}</button>
      </form>
      <div className="no-scrollbar -mx-7 mt-2 flex items-center gap-2 overflow-x-auto px-7 py-1.5">
        {suggestions.map((s) => (
          <button key={s} onClick={() => ask(s)} className="shrink-0 whitespace-nowrap rounded-full bg-surface px-4 py-2.5 text-[13px] leading-none ring-1 ring-inset ring-line">
            {s}
          </button>
        ))}
      </div>
      {loading && <p className="mt-3 text-[14px] text-ink-soft">{t(lang, "Reading the plan…", "Fine print padh raha hoon…")}</p>}
      {answer && !loading && (
        <div className="rise mt-4 rounded-[24px] bg-accent-soft p-5 text-[15px] leading-relaxed">
          <p className="mb-1.5 text-[12px] text-ink-soft">{answer.q}</p>
          <RichText text={answer.a} />
          {answer.checked && (
            <p className="mt-3 flex items-center gap-1.5 text-[12px] text-ink-soft">
              <Icon name="check" size={13} stroke={2.4} className="text-paid" />
              {t(lang, "Numbers checked against the plan's own words", "Numbers policy wording se check kiye gaye")}
            </p>
          )}
          {answer.cites.length > 0 && (
            <div className="mt-2 flex gap-2">
              {answer.cites.map((c) => (
                <button key={c} onClick={() => jump(c)} className="rounded-full bg-surface px-2.5 py-1 text-[12px] font-semibold text-accent">
                  §{p.clauses.find((x) => x.id === c)?.section}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <h3 className="title mt-10 text-[20px]">{t(lang, "What this means for your family", "Aapki family ke liye iska matlab")}</h3>
      <ul className="mt-5 space-y-6">
        {match.reasons.map((r) => (
          <ReasonRow key={r.title} r={r} onClause={() => jump(r.clauseId)} />
        ))}
      </ul>

      {flags.length > 0 && (
        <div className="mt-10 rounded-[24px] bg-owe-soft p-5">
          <h3 className="title text-[17px] text-owe">{t(lang, "Watch out for", "Dhyaan dena")}</h3>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[14px]">
            {flags.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
      )}

      <h3 className="title mt-10 text-[20px]">{t(lang, "The plan's exact words", "Policy ke exact shabd")}</h3>
      <div className="mt-4 space-y-2.5">
        {p.clauses.map((c) => (
          <div
            key={c.id}
            ref={(el) => {
              refs.current[c.id] = el;
            }}
            className={`rounded-[22px] p-5 text-[14px] transition-all duration-500 ${highlight === c.id ? "bg-accent-soft ring-2 ring-accent" : "bg-surface-2"}`}
          >
            <p className="font-semibold">
              <span className="mr-2 font-mono text-[12px] text-ink-soft">§{c.section}</span>
              {lang === "en" ? CLAUSE_LABEL[c.id] ?? c.title : c.title}
            </p>
            <p className="mt-1 leading-relaxed">{highlight === c.id ? <span className="mark">{c.text}</span> : c.text}</p>
          </div>
        ))}
      </div>

      <button onClick={onChoose} className="sticky bottom-0 mt-8 w-full rounded-full bg-primary py-4 text-[15px] font-semibold text-on-primary shadow-e2">
        {t(lang, `Pick ${p.name}`, `${p.name} lunga`)}
      </button>
    </Sheet>
  );
}
