"use client";

import { useEffect, useRef, useState } from "react";
import type { Lang } from "@/lib/ai";
import type { Chip } from "@/lib/flow";
import { getPolicy } from "@/lib/policies";
import { Icon } from "./ui";

export interface Citation {
  policyId: string;
  clauseId: string;
}

export interface Msg {
  id: string;
  role: "ai" | "user";
  text: string;
  tone?: "insight" | "hint";
  citations?: Citation[];
}

interface Props {
  messages: Msg[];
  typing: boolean;
  chips: Chip[];
  multi?: boolean;
  max?: number;
  tiles?: boolean;
  preselected?: string[];
  placeholder: string;
  lang: Lang;
  footer?: React.ReactNode;
  onChips: (values: string[], labels: string[]) => void;
  onText: (text: string) => void;
  onCitation: (c: Citation) => void;
}

type Rec = { start: () => void; stop: () => void; lang: string; interimResults: boolean; onresult: (e: { results: { 0: { transcript: string } }[] }) => void; onend: () => void };

export default function Chat(props: Props) {
  const { messages, typing, chips, multi, max, tiles, preselected, placeholder, lang, footer, onChips, onText, onCitation } = props;
  const [text, setText] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [listening, setListening] = useState(false);
  const rec = useRef<Rec | null>(null);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, typing, chips, footer]);

  const chipKey = chips.map((c) => c.value).join("|");
  useEffect(() => setPicked(preselected ?? []), [chipKey, preselected]);

  const toggle = (v: string) => {
    if (v === "none") return setPicked(["none"]);
    setPicked((cur) => {
      const base = cur.filter((x) => x !== "none");
      if (base.includes(v)) return base.filter((x) => x !== v);
      if (max && base.length >= max) return base;
      return [...base, v];
    });
  };

  const send = (t: string) => {
    if (!t.trim()) return;
    onText(t.trim());
    setText("");
  };

  // Voice input where the browser supports it (Chrome / Android); resolved after mount to avoid hydration mismatch.
  const [SR, setSR] = useState<(new () => Rec) | undefined>();
  useEffect(() => {
    const w = window as unknown as Record<string, unknown>;
    setSR(() => (w.SpeechRecognition ?? w.webkitSpeechRecognition) as (new () => Rec) | undefined);
  }, []);
  const mic = () => {
    if (!SR) return;
    if (listening) return rec.current?.stop();
    const r = new SR();
    r.lang = lang === "hi" ? "hi-IN" : "en-IN";
    r.interimResults = false;
    r.onresult = (e) => send(e.results[0][0].transcript);
    r.onend = () => setListening(false);
    rec.current = r;
    setListening(true);
    r.start();
  };

  return (
    <div className="flex h-full flex-col">
      <div className="no-scrollbar flex-1 space-y-4 overflow-y-auto px-5 pb-5 pt-5">
        {messages.map((m) => (
          <Bubble key={m.id} m={m} onCitation={onCitation} />
        ))}
        {typing && (
          <div className="flex w-fit items-center gap-1 rounded-full bg-surface px-4 py-3 text-ink-faint shadow-e1" aria-label="PolicyLens is typing">
            <span className="dot h-1.5 w-1.5 rounded-full bg-current" />
            <span className="dot h-1.5 w-1.5 rounded-full bg-current" />
            <span className="dot h-1.5 w-1.5 rounded-full bg-current" />
          </div>
        )}
        {!typing && chips.length > 0 && (
          <div className={`msg-in ${tiles ? "grid grid-cols-2 gap-2.5" : "flex flex-wrap gap-2"}`}>
            {chips.map((c) => {
              const on = picked.includes(c.value);
              const click = () => (multi ? toggle(c.value) : onChips([c.value], [c.label]));
              return tiles ? (
                <button
                  key={c.value}
                  onClick={click}
                  aria-pressed={on}
                  className={`relative rounded-[18px] p-4 text-left transition ${on ? "bg-pine text-white shadow-e2" : "bg-surface text-ink shadow-e1 ring-1 ring-line"}`}
                >
                  <span className={`absolute right-3 top-3 grid h-5 w-5 place-items-center rounded-full ${on ? "bg-gold text-white" : "ring-1 ring-line"}`}>{on && <Icon name="check" size={12} />}</span>
                  <span className="font-display block pr-6 text-[17px] font-semibold leading-tight">{c.label}</span>
                  {c.hint && <span className={`mt-1 block text-[12.5px] leading-snug ${on ? "text-white/70" : "text-ink-soft"}`}>{c.hint}</span>}
                </button>
              ) : (
                <button
                  key={c.value}
                  onClick={click}
                  aria-pressed={multi ? on : undefined}
                  className={`rounded-full px-4 py-2.5 text-[14px] transition ${on ? "bg-pine text-white shadow-e2" : "bg-surface text-ink shadow-e1 ring-1 ring-line active:bg-mist"}`}
                >
                  {c.label}
                </button>
              );
            })}
            {multi && (
              <button
                disabled={!picked.length}
                onClick={() => onChips(picked, picked.map((v) => chips.find((c) => c.value === v)?.label ?? v))}
                className={`rounded-full bg-pine px-6 py-2.5 text-[14px] font-semibold text-white shadow-e2 disabled:bg-line disabled:text-ink-faint disabled:shadow-none ${tiles ? "col-span-2 mt-1 py-3.5" : ""}`}
              >
                Continue
              </button>
            )}
          </div>
        )}
        {footer}
        <div ref={end} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
        }}
        className="flex items-center gap-2 border-t border-line bg-surface/95 px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-3 backdrop-blur"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={listening ? "Listening…" : placeholder}
          aria-label="Message"
          className="min-w-0 flex-1 rounded-full bg-mist px-4 py-3 text-[15px] outline-none ring-1 ring-transparent transition placeholder:text-ink-faint focus:bg-surface focus:ring-line"
        />
        {SR && !text && (
          <button
            type="button"
            onClick={mic}
            aria-label={listening ? "Stop listening" : "Speak your answer"}
            className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${listening ? "recording bg-owe text-white" : "bg-pine text-white"}`}
          >
            <Icon name="mic" />
          </button>
        )}
        {(text || !SR) && (
          <button type="submit" aria-label="Send" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-pine text-white">
            <Icon name="arrow" />
          </button>
        )}
      </form>
    </div>
  );
}

function Bubble({ m, onCitation }: { m: Msg; onCitation: (c: Citation) => void }) {
  if (m.role === "user")
    return (
      <div className="msg-in flex justify-end">
        <p className="max-w-[80%] rounded-[20px] rounded-br-[6px] bg-pine px-4 py-2.5 text-[15px] leading-snug text-white shadow-e1">{m.text}</p>
      </div>
    );
  if (m.tone === "hint")
    return (
      <p className="msg-in flex items-start gap-2 rounded-[14px] bg-mist px-3.5 py-2.5 text-[12.5px] leading-relaxed text-ink-soft">
        <Icon name="lock" size={14} className="mt-0.5 shrink-0 text-pine" />
        {m.text}
      </p>
    );
  if (m.tone === "insight")
    return (
      <div className="msg-in rounded-[18px] bg-surface p-4 shadow-e1 ring-1 ring-line">
        <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-gold">
          <Icon name="info" size={14} />
          Worth knowing
        </p>
        <p className="mt-1.5 text-[14px] leading-relaxed text-ink">{m.text}</p>
      </div>
    );
  return (
    <div className="msg-in max-w-[92%] text-[15.5px] leading-[1.55] text-ink">
      <RichText text={m.text} />
      {!!m.citations?.length && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {m.citations.map((c) => {
            const p = getPolicy(c.policyId);
            const cl = p?.clauses.find((x) => x.id === c.clauseId);
            if (!p || !cl) return null;
            return (
              <button
                key={c.policyId + c.clauseId}
                onClick={() => onCitation(c)}
                className="inline-flex items-center gap-1 rounded-full bg-surface px-2.5 py-1 text-[12px] font-medium text-pine shadow-e1 ring-1 ring-line"
              >
                <Icon name="doc" size={12} />
                {p.name} §{cl.section}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function RichText({ text }: { text: string }) {
  return (
    <>
      {text.split("\n").map((line, i) => (
        <p key={i} className={line ? "" : "h-2"}>
          {line.split(/(\*\*[^*]+\*\*)/).map((seg, j) => (seg.startsWith("**") ? <strong key={j}>{seg.slice(2, -2)}</strong> : <span key={j}>{seg}</span>))}
        </p>
      ))}
    </>
  );
}
