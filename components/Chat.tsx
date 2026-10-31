"use client";

import { useEffect, useRef, useState } from "react";
import type { Lang } from "@/lib/ai";
import type { Chip } from "@/lib/flow";
import { t } from "@/lib/flow";
import { getPolicy } from "@/lib/policies";
import { Icon, Orb, type IconName } from "./ui";

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

const TILE_ICON: Record<string, IconName> = {
  self: "person",
  partner: "heart",
  kids: "child",
  parents: "elder",
  private_room: "bed",
  low_oop: "wallet",
  ped_fast: "clock",
  low_premium: "tag",
  maternity: "child",
  restoration: "refresh",
  network: "pin",
};

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

  // Voice input where supported (Chrome / Android); resolved after mount to avoid a hydration mismatch.
  const [SR, setSR] = useState<(new () => Rec) | undefined>();
  useEffect(() => {
    const w = window as unknown as Record<string, unknown>;
    setSR(() => (w.SpeechRecognition ?? w.webkitSpeechRecognition) as (new () => Rec) | undefined);
  }, []);
  const mic = () => {
    if (!SR) return;
    if (listening) return rec.current?.stop();
    const r = new SR();
    r.lang = "en-IN";
    r.interimResults = false;
    r.onresult = (e) => send(e.results[0][0].transcript);
    r.onend = () => setListening(false);
    rec.current = r;
    setListening(true);
    r.start();
  };

  return (
    <div className="flex h-full flex-col">
      <div className="no-scrollbar flex-1 space-y-6 overflow-y-auto px-6 pb-28 pt-6">
        {messages.map((m) => (
          <Bubble key={m.id} m={m} lang={lang} onCitation={onCitation} />
        ))}

        {typing && (
          <div className="flex items-center gap-3 text-[13px] text-ink-faint" aria-label="PolicyLens is thinking">
            <Orb size={26} thinking />
            {t(lang, "Reading the fine print…", "Fine print padh raha hoon…")}
          </div>
        )}

        {!typing && chips.length > 0 && (
          <div className={`rise ${tiles ? "grid grid-cols-2 gap-3" : "flex flex-wrap gap-2.5"}`}>
            {chips.map((c, i) => {
              const on = picked.includes(c.value);
              const click = () => (multi ? toggle(c.value) : onChips([c.value], [c.label]));
              const icon = TILE_ICON[c.value];
              return tiles ? (
                <button
                  key={c.value}
                  onClick={click}
                  aria-pressed={on}
                  style={{ animationDelay: `${i * 40}ms` }}
                  className={`rise relative flex min-h-[132px] flex-col justify-between rounded-[26px] p-4 text-left transition-all duration-300 ${
                    on ? "-translate-y-0.5 bg-primary text-on-primary shadow-e2" : "bg-surface text-ink shadow-e1 ring-1 ring-line"
                  }`}
                >
                  <span className="flex items-start justify-between">
                    <span className={`grid h-10 w-10 place-items-center rounded-full ${on ? "bg-accent text-white" : "bg-surface-2 text-ink"}`}>{icon && <Icon name={icon} size={19} />}</span>
                    <span className={`grid h-6 w-6 place-items-center rounded-full transition ${on ? "bg-accent text-white" : "ring-1 ring-line"}`}>{on && <Icon name="check" size={13} stroke={2.6} />}</span>
                  </span>
                  <span className="mt-4">
                    <span className="title block text-[16px] leading-tight">{c.label}</span>
                    {c.hint && <span className={`mt-1 block text-[12.5px] leading-snug ${on ? "opacity-70" : "text-ink-soft"}`}>{c.hint}</span>}
                  </span>
                </button>
              ) : (
                <button
                  key={c.value}
                  onClick={click}
                  aria-pressed={multi ? on : undefined}
                  className={`rounded-full px-5 py-3 text-[14.5px] transition-all duration-200 ${on ? "bg-primary text-on-primary shadow-e2" : "bg-surface text-ink shadow-e1 ring-1 ring-line active:scale-[0.97]"}`}
                >
                  {c.label}
                </button>
              );
            })}
            {multi && (
              <button
                disabled={!picked.length}
                onClick={() => onChips(picked, picked.map((v) => chips.find((c) => c.value === v)?.label ?? v))}
                className={`flex items-center justify-center gap-2 rounded-full bg-accent px-7 py-3 text-[14.5px] font-semibold text-white shadow-e2 transition disabled:bg-surface-2 disabled:text-ink-faint disabled:shadow-none ${tiles ? "col-span-2 mt-1 py-4" : ""}`}
              >
                {t(lang, "Continue", "Aage chalo")}
                <Icon name="arrow" size={16} />
              </button>
            )}
          </div>
        )}
        {footer}
        <div ref={end} className="h-px scroll-mb-28" />
      </div>

      {/* Floating input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
        }}
        className="absolute inset-x-4 bottom-[max(env(safe-area-inset-bottom),14px)] z-20 flex items-center gap-2 rounded-full bg-glass p-1.5 pl-5 shadow-e2 ring-1 ring-line backdrop-blur-xl"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={listening ? t(lang, "Listening…", "Sun raha hoon…") : placeholder}
          aria-label="Message"
          className="min-w-0 flex-1 bg-transparent py-2.5 text-[15.5px] outline-none placeholder:text-ink-faint"
        />
        {SR && !text ? (
          <button
            type="button"
            onClick={mic}
            aria-label={listening ? "Stop listening" : "Speak your answer"}
            className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${listening ? "recording bg-owe text-white" : "bg-primary text-on-primary"}`}
          >
            <Icon name="mic" size={18} />
          </button>
        ) : (
          <button type="submit" aria-label="Send" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent text-white">
            <Icon name="arrow" size={18} />
          </button>
        )}
      </form>
    </div>
  );
}

function Bubble({ m, lang, onCitation }: { m: Msg; lang: Lang; onCitation: (c: Citation) => void }) {
  if (m.role === "user")
    return (
      <div className="rise flex justify-end">
        <p className="max-w-[80%] rounded-[24px] rounded-br-[8px] bg-primary px-5 py-3 text-[15px] leading-snug text-on-primary">{m.text}</p>
      </div>
    );
  if (m.tone === "hint")
    return (
      <p className="rise flex items-start gap-2.5 text-[13px] leading-relaxed text-ink-soft">
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
          <Icon name="lock" size={13} />
        </span>
        {m.text}
      </p>
    );
  if (m.tone === "insight")
    return (
      <div className="rise relative overflow-hidden rounded-[26px] bg-surface p-5 shadow-e1 ring-1 ring-line">
        <div aria-hidden className="absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-60 blur-2xl" style={{ background: "radial-gradient(#ffb38a, #f49ac1 60%, transparent 70%)" }} />
        <p className="relative flex items-center gap-2 text-[13px] font-semibold text-accent">
          <Icon name="sparkle" size={15} />
          {t(lang, "Worth knowing", "Yeh jaan lo")}
        </p>
        <p className="relative mt-2 text-[15px] leading-relaxed">{m.text}</p>
      </div>
    );
  return (
    <div className="rise max-w-[94%] text-[17px] leading-[1.55] tracking-[-0.005em]">
      <RichText text={m.text} />
      {!!m.citations?.length && (
        <div className="mt-3 flex flex-wrap gap-2">
          {m.citations.map((c) => {
            const p = getPolicy(c.policyId);
            const cl = p?.clauses.find((x) => x.id === c.clauseId);
            if (!p || !cl) return null;
            return (
              <button key={c.policyId + c.clauseId} onClick={() => onCitation(c)} className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1.5 text-[12.5px] font-semibold text-accent">
                <Icon name="doc" size={13} />
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
          {line.split(/(\*\*[^*]+\*\*)/).map((seg, j) => (seg.startsWith("**") ? <strong key={j} className="font-semibold">{seg.slice(2, -2)}</strong> : <span key={j}>{seg}</span>))}
        </p>
      ))}
    </>
  );
}
