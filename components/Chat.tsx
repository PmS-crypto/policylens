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

export default function Chat(props: Props) {
  const { messages, typing, chips, multi, max, tiles, preselected, placeholder, lang, footer, onChips, onText, onCitation } = props;
  const [text, setText] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [voice, setVoice] = useState<"idle" | "recording" | "transcribing">("idle");
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  // Voice input: record in the browser, transcribe with Sarvam. Works in Chrome, Safari and iOS.
  // Needs a secure context (https or localhost); the mic button hides where recording isn't possible.
  const [canRecord, setCanRecord] = useState(false);
  useEffect(() => setCanRecord(typeof MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia), []);

  const stopRecording = () => {
    if (stopTimer.current) clearTimeout(stopTimer.current);
    if (recorder.current?.state === "recording") recorder.current.stop();
  };

  const mic = async () => {
    if (voice === "recording") return stopRecording();
    if (voice === "transcribing") return;
    setVoiceError(null);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setVoiceError("Mic access is blocked. Allow it in your browser settings, or just type instead.");
      return;
    }
    const type = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((t) => MediaRecorder.isTypeSupported(t));
    const rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
      if (blob.size < 1200) {
        setVoice("idle");
        setVoiceError("Didn't catch any audio. Tap the mic and try again.");
        return;
      }
      setVoice("transcribing");
      try {
        const body = new FormData();
        body.append("file", blob, blob.type.includes("mp4") ? "voice.m4a" : "voice.webm");
        const res = await fetch("/api/transcribe", { method: "POST", body });
        const data = await res.json();
        if (!res.ok || !data.text) throw new Error(data.error);
        send(data.text);
      } catch (e) {
        setVoiceError((e as Error).message || "Couldn't transcribe that. Try again, or type it.");
      } finally {
        setVoice("idle");
      }
    };
    recorder.current = rec;
    rec.start();
    setVoice("recording");
    stopTimer.current = setTimeout(stopRecording, 20000); // Sarvam's sync limit is 30s
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
      <div className="absolute inset-x-4 bottom-[max(env(safe-area-inset-bottom),14px)] z-20">
        {voiceError && (
          <p role="alert" className="rise mb-2 rounded-[18px] bg-surface px-4 py-2.5 text-[13px] leading-snug text-owe shadow-e1 ring-1 ring-line">
            {voiceError}
          </p>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(text);
          }}
          className={`flex items-center gap-2 rounded-full p-1.5 pl-5 shadow-e2 ring-1 backdrop-blur-xl transition-colors ${voice === "recording" ? "bg-owe-soft ring-owe/40" : "bg-glass ring-line"}`}
        >
          {voice === "idle" ? (
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={placeholder}
              aria-label="Message"
              enterKeyHint="send"
              className="min-w-0 flex-1 bg-transparent py-2.5 text-[16px] outline-none placeholder:text-ink-faint"
            />
          ) : (
            <p className="flex min-w-0 flex-1 items-center gap-2.5 py-2.5 text-[15px]" aria-live="polite">
              {voice === "recording" ? (
                <>
                  <span className="recording h-2.5 w-2.5 shrink-0 rounded-full bg-owe" />
                  <span className="font-medium text-owe">{t(lang, "Listening… tap to stop", "Sun raha hoon… rokne ke liye tap karo")}</span>
                </>
              ) : (
                <>
                  <Orb size={20} thinking />
                  <span className="text-ink-soft">{t(lang, "Turning that into text…", "Text bana raha hoon…")}</span>
                </>
              )}
            </p>
          )}
          {text.trim() || !canRecord ? (
            <button type="submit" aria-label="Send" disabled={!text.trim()} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent text-white transition disabled:opacity-40">
              <Icon name="arrow" size={18} />
            </button>
          ) : (
            <button
              type="button"
              onClick={mic}
              disabled={voice === "transcribing"}
              aria-label={voice === "recording" ? "Stop recording" : "Speak your answer"}
              className={`grid h-11 w-11 shrink-0 place-items-center rounded-full transition ${voice === "recording" ? "recording bg-owe text-white" : "bg-primary text-on-primary"} disabled:opacity-50`}
            >
              {voice === "recording" ? <span className="h-3.5 w-3.5 rounded-[3px] bg-white" /> : <Icon name="mic" size={18} />}
            </button>
          )}
        </form>
      </div>
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
