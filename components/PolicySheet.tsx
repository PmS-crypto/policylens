"use client";

import { useEffect, useRef, useState } from "react";
import type { Lang } from "@/lib/ai";
import { redFlags } from "@/lib/match";
import type { Match, Profile } from "@/lib/types";
import { RichText } from "./Chat";
import { ReasonRow, Sheet } from "./ui";

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
          <h2 className="font-display text-[26px] font-extrabold leading-tight">{p.name}</h2>
          <p className="mt-1 text-[12px] text-ink-soft">
            Policy wording {p.docVersion}, checked {new Date(p.lastVerified).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
          </p>
        </div>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(q);
        }}
        className="mt-3 flex gap-2"
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ask this policy anything"
          aria-label="Ask this policy"
          className="min-w-0 flex-1 rounded-full bg-mist px-4 py-3 text-[15px] outline-none"
        />
        <button className="rounded-full bg-pine px-5 text-[14px] font-semibold text-white">Ask</button>
      </form>
      <div className="no-scrollbar -mx-5 mt-2 flex gap-2 overflow-x-auto px-5">
        {suggestions.map((s) => (
          <button key={s} onClick={() => ask(s)} className="shrink-0 rounded-full border border-line px-3.5 py-1.5 text-[13px]">
            {s}
          </button>
        ))}
      </div>
      {loading && <p className="mt-3 text-[14px] text-ink-soft">Reading the policy wording…</p>}
      {answer && !loading && (
        <div className="mt-3 rounded-2xl bg-mist p-4 text-[14px] leading-relaxed">
          <p className="mb-1.5 text-[12px] text-ink-soft">{answer.q}</p>
          <RichText text={answer.a} />
          {answer.cites.length > 0 && (
            <div className="mt-2 flex gap-2">
              {answer.cites.map((c) => (
                <button key={c} onClick={() => jump(c)} className="mark text-[12px] font-semibold">
                  §{p.clauses.find((x) => x.id === c)?.section}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <h3 className="mt-6 text-[16px] font-bold">For your family</h3>
      <ul className="mt-3 space-y-4">
        {match.reasons.map((r) => (
          <ReasonRow key={r.title} r={r} onClause={() => jump(r.clauseId)} />
        ))}
      </ul>

      {flags.length > 0 && (
        <div className="mt-6 rounded-2xl bg-owe-soft p-4">
          <h3 className="text-[15px] font-bold text-owe">Catches in the fine print</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-[14px]">
            {flags.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
      )}

      <h3 className="mt-6 text-[16px] font-bold">The policy wording</h3>
      <div className="mt-3 space-y-2">
        {p.clauses.map((c) => (
          <div
            key={c.id}
            ref={(el) => {
              refs.current[c.id] = el;
            }}
            className={`rounded-2xl p-4 text-[14px] transition ${highlight === c.id ? "bg-mark/30" : "bg-mist"}`}
          >
            <p className="font-semibold">
              <span className="mr-2 font-mono text-[12px] text-ink-soft">§{c.section}</span>
              {c.title}
            </p>
            <p className="mt-1 leading-relaxed">{highlight === c.id ? <span className="mark">{c.text}</span> : c.text}</p>
          </div>
        ))}
      </div>

      <button onClick={onChoose} className="sticky bottom-0 mt-6 w-full rounded-2xl bg-pine py-4 text-[15px] font-semibold text-white shadow-lg">
        Choose {p.name}
      </button>
    </Sheet>
  );
}
