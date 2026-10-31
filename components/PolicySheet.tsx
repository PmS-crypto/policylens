"use client";

import { useEffect, useRef, useState } from "react";
import type { Lang } from "@/lib/ai";
import { redFlags } from "@/lib/match";
import type { Match, Profile } from "@/lib/types";
import { RichText } from "./Chat";
import { ReasonRow, Seal, Sheet } from "./ui";

interface Props {
  match: Match;
  focusClause?: string;
  profile: Profile;
  lang: Lang;
  onClose: () => void;
  onChoose: () => void;
}

export default function PolicySheet({ match, focusClause, profile, lang, onClose, onChoose }: Props) {
  const p = match.policy;
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState<{ q: string; a: string; cites: string[] } | null>(null);
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
    setAnswer({ q: question, a: data.answer, cites: (data.citations ?? []).map((c: { clauseId: string }) => c.clauseId) });
    setLoading(false);
  };

  const suggestions = [
    profile.conditions?.length ? `When is ${profile.conditions[0] === "bp" ? "BP" : profile.conditions[0]} covered?` : "What isn't covered?",
    "What if I pick a bigger room?",
    profile.cover?.parents ? "Is knee replacement covered?" : "Any hidden limits?",
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
              Policy wording {p.docVersion}, checked {new Date(p.lastVerified).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
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
          placeholder="Ask this policy anything"
          aria-label="Ask this policy"
          className="min-w-0 flex-1 bg-transparent py-2 text-[15px] outline-none placeholder:text-ink-faint"
        />
        <button className="rounded-full bg-accent px-5 text-[14px] font-semibold text-white">Ask</button>
      </form>
      <div className="no-scrollbar -mx-7 mt-3 flex gap-2 overflow-x-auto px-7">
        {suggestions.map((s) => (
          <button key={s} onClick={() => ask(s)} className="shrink-0 rounded-full px-4 py-2 text-[13px] ring-1 ring-line">
            {s}
          </button>
        ))}
      </div>
      {loading && <p className="mt-3 text-[14px] text-ink-soft">Reading the policy wording…</p>}
      {answer && !loading && (
        <div className="rise mt-4 rounded-[24px] bg-accent-soft p-5 text-[15px] leading-relaxed">
          <p className="mb-1.5 text-[12px] text-ink-soft">{answer.q}</p>
          <RichText text={answer.a} />
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

      <h3 className="title mt-10 text-[20px]">For your family</h3>
      <ul className="mt-5 space-y-6">
        {match.reasons.map((r) => (
          <ReasonRow key={r.title} r={r} onClause={() => jump(r.clauseId)} />
        ))}
      </ul>

      {flags.length > 0 && (
        <div className="mt-10 rounded-[24px] bg-owe-soft p-5">
          <h3 className="title text-[17px] text-owe">Catches in the fine print</h3>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[14px]">
            {flags.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
      )}

      <h3 className="title mt-10 text-[20px]">The policy wording</h3>
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
              {c.title}
            </p>
            <p className="mt-1 leading-relaxed">{highlight === c.id ? <span className="mark">{c.text}</span> : c.text}</p>
          </div>
        ))}
      </div>

      <button onClick={onChoose} className="sticky bottom-0 mt-8 w-full rounded-full bg-primary py-4 text-[15px] font-semibold text-on-primary shadow-e2">
        Choose {p.name}
      </button>
    </Sheet>
  );
}
