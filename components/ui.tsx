"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { Lang } from "@/lib/ai";
import type { Reason } from "@/lib/types";

export const inrShort = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

/* ───────────── Aura palettes ───────────── */

export const AURA = {
  calm: ["#ff8a6b", "#ffc6a8", "#f49ac1", "#b7a6ff", "#8fe3c8"],
  dusk: ["#6a4cff", "#b7a6ff", "#ff8a6b", "#ffd2b8"],
  mint: ["#2bb98a", "#8fe3c8", "#9ad1ff", "#e8f7ff"],
  ember: ["#ff6b5a", "#ffb38a", "#f6c1d0", "#fff1e8"],
  // Sliced orb: warm light falling into a deep plum shadow, with a teal edge (like a lit sphere)
  orb: ["#ff7a59", "#ffd9b8", "#c4508f", "#2b2154", "#6fd3c4"],
} as const;

export const PLAN_AURAS = [AURA.dusk, AURA.mint, AURA.ember];

/** Grainy gradient field. The visual stand-in for protection. */
export function Aura({ colors = AURA.calm, className = "", breathe, scrim, children }: { colors?: readonly string[]; className?: string; breathe?: boolean; scrim?: boolean; children?: React.ReactNode }) {
  const [a, b, c, d, e] = colors;
  return (
    <div className={`grain overflow-hidden ${className}`}>
      <div
        aria-hidden
        className={`absolute -inset-[20%] ${breathe ? "breathe" : ""}`}
        style={{
          background: `radial-gradient(40% 50% at 22% 28%, ${a} 0%, transparent 70%),
            radial-gradient(45% 45% at 78% 22%, ${c ?? a} 0%, transparent 70%),
            radial-gradient(50% 50% at 70% 78%, ${d ?? b} 0%, transparent 70%),
            radial-gradient(45% 50% at 25% 80%, ${e ?? b} 0%, transparent 70%),
            ${b}`,
        }}
      />
      {scrim && <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-black/5 via-black/15 to-black/45" />}
      <div className="relative z-[2] h-full">{children}</div>
    </div>
  );
}

/** Hero illustration: a gradient sphere sliced into drifting bands, the layers of your cover. */
export function SlicedOrb({ size = 260, colors = AURA.orb }: { size?: number; colors?: readonly string[] }) {
  const id = useId().replace(/:/g, "");
  const bands = [
    { y: 0, h: 0.2, dx: 6 },
    { y: 0.23, h: 0.22, dx: -10 },
    { y: 0.48, h: 0.26, dx: 8 },
    { y: 0.77, h: 0.23, dx: -6 },
  ];
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden className="overflow-visible">
      <defs>
        <radialGradient id={`g${id}`} cx="32%" cy="26%" r="90%">
          <stop offset="0%" stopColor={colors[1]} />
          <stop offset="30%" stopColor={colors[0]} />
          <stop offset="58%" stopColor={colors[2]} />
          <stop offset="82%" stopColor={colors[3]} />
          <stop offset="100%" stopColor={colors[4] ?? colors[3]} />
        </radialGradient>
        <filter id={`n${id}`}>
          <feTurbulence type="fractalNoise" baseFrequency="1.8" numOctaves="2" result="t" />
          <feColorMatrix in="t" type="saturate" values="0" result="m" />
          <feBlend in="SourceGraphic" in2="m" mode="soft-light" />
          <feComposite in2="SourceGraphic" operator="in" />
        </filter>
        <clipPath id={`c${id}`}>
          <circle cx="50" cy="50" r="46" />
        </clipPath>
      </defs>
      <g clipPath={`url(#c${id})`} filter={`url(#n${id})`}>
        {bands.map((b, i) => (
          <g key={i} className="drift" style={{ ["--d" as string]: `${b.dx * 0.6}px`, animationDelay: `${i * -2.1}s` }}>
            <rect x={-10} y={4 + b.y * 92} width={120} height={b.h * 92} fill={`url(#g${id})`} />
          </g>
        ))}
      </g>
      <circle cx="88" cy="20" r="7" fill="none" stroke="currentColor" strokeWidth="0.6" opacity="0.7" />
      <line x1="58" y1="14" x2="104" y2="14" stroke="currentColor" strokeWidth="0.5" opacity="0.6" />
      <line x1="-6" y1="57" x2="40" y2="57" stroke="currentColor" strokeWidth="0.5" opacity="0.6" />
      <rect x="83" y="74" width="4" height="4" fill={colors[3]} />
      <g fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.7">
        <rect x="44" y="90" width="4" height="4" />
        <rect x="49" y="90" width="4" height="4" />
        <rect x="54" y="90" width="4" height="4" />
      </g>
    </svg>
  );
}

/** The AI's presence: a small breathing aura. Breathes faster while thinking. */
export function Orb({ size = 36, thinking }: { size?: number; thinking?: boolean }) {
  return (
    <span className="relative inline-block shrink-0 overflow-hidden rounded-full" style={{ width: size, height: size }}>
      <span
        className={`absolute -inset-1 rounded-full ${thinking ? "breathe-fast" : "breathe"}`}
        style={{ background: "conic-gradient(from 200deg, #6a4cff, #f49ac1, #ff8a6b, #ffc6a8, #8fe3c8, #6a4cff)", filter: "blur(3px)" }}
      />
      <span className="absolute inset-[22%] rounded-full bg-white/35 blur-[2px]" />
    </span>
  );
}

/** Animate a number up to its value: money should arrive, not appear. */
export function useCountUp(value: number, ms = 700) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(value);
      from.current = value;
      return;
    }
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / ms);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(a + (value - a) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return shown;
}

export function Money({ value, className = "" }: { value: number; className?: string }) {
  const v = useCountUp(value);
  return <span className={`money ${className}`}>{inrShort(v)}</span>;
}

/* ───────────── Icons ───────────── */

const PATHS = {
  lock: "M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3",
  shield: "M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z",
  check: "M5 12.5l4.5 4.5L19 7.5",
  doc: "M7 3h7l4 4v14H7zM14 3v4h4M10 12h5M10 16h5",
  phoneOff: "M8 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM11 18h2M3.5 3.5l17 17",
  chat: "M4 5h16v11H9l-5 4z",
  layers: "M12 4l8 4-8 4-8-4zM4 12l8 4 8-4M4 16l8 4 8-4",
  receipt: "M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6",
  mic: "M9 3h6v11H9zM5 11a7 7 0 0 0 14 0M12 18v3",
  arrow: "M5 12h14M13 6l6 6-6 6",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 8h.01",
  sparkle: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z",
  sun: "M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4",
  moon: "M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z",
  person: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c.8-4 4-6 8-6s7.2 2 8 6",
  heart: "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z",
  child: "M12 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8 21v-6l-2-3 3-2h6l3 2-2 3v6",
  elder: "M11 7a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM7 22l2-8 2 2v6M15 22l-2-8M9 14l-1-4 4-1 3 4M17 22V12",
  bed: "M3 18V7M3 13h18v5M21 13a3 3 0 0 0-3-3h-7v3M7 11.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z",
  wallet: "M4 7h15a1 1 0 0 1 1 1v11H4a1 1 0 0 1-1-1V6a2 2 0 0 1 2-2h11v3M16 13h.01",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2",
  tag: "M3 12V4h8l10 10-8 8zM7.5 8.5h.01",
  refresh: "M20 11a8 8 0 0 0-14.7-4.3L4 8M4 4v4h4M4 13a8 8 0 0 0 14.7 4.3L20 16M20 20v-4h-4",
  pin: "M12 21s-6-5.6-6-11a6 6 0 0 1 12 0c0 5.4-6 11-6 11zM12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
  advisor: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c.8-4 4-6 8-6s7.2 2 8 6",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 18, className = "", stroke = 1.8 }: { name: IconName; size?: number; className?: string; stroke?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d={PATHS[name]} />
    </svg>
  );
}

/* ───────────── Building blocks ───────────── */

const TONE = {
  good: { icon: "check" as const, cls: "bg-paid-soft text-paid", sr: "Strength" },
  caveat: { icon: "info" as const, cls: "bg-warn-soft text-warn", sr: "Check this" },
  bad: { icon: "info" as const, cls: "bg-owe-soft text-owe", sr: "Trade-off" },
};

export function ReasonRow({ r, onClause }: { r: Reason; onClause?: () => void }) {
  const t = TONE[r.kind];
  return (
    <li className="flex gap-4">
      <span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full ${t.cls}`}>
        <Icon name={t.icon} size={15} stroke={2.2} />
        <span className="sr-only">{t.sr}</span>
      </span>
      <div className="min-w-0">
        <p className="text-[15.5px] font-semibold leading-snug">{r.title}</p>
        <p className="mt-1 text-[14px] leading-relaxed text-ink-soft">{r.detail}</p>
        {r.clauseId && onClause && (
          <button onClick={onClause} className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-semibold text-accent">
            <Icon name="doc" size={14} />
            Read the clause
          </button>
        )}
      </div>
    </li>
  );
}

export function Seal({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 text-[12.5px] text-ink-soft">
      <span className="grid h-[18px] w-[18px] place-items-center rounded-full bg-accent text-white">
        <Icon name="check" size={11} stroke={2.6} />
      </span>
      {children}
    </span>
  );
}

export function Segmented<T extends string | number>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label?: string }) {
  return (
    <div className="flex rounded-full bg-surface-2 p-1" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={`flex-1 rounded-full px-2 py-2.5 text-[13px] transition-all duration-300 ${value === o.value ? "bg-surface font-semibold text-ink shadow-e1" : "text-ink-soft"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Sheet({ onClose, children, title }: { onClose: () => void; children: React.ReactNode; title?: React.ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="absolute inset-0 z-40 flex flex-col justify-end" role="dialog" aria-modal="true">
      <button aria-label="Close" className="absolute inset-0 bg-black/40 backdrop-blur-[3px]" onClick={onClose} />
      <div className="sheet-up relative flex max-h-[92%] flex-col rounded-t-[36px] bg-surface shadow-e3">
        <div className="px-7 pt-3">
          <div className="mx-auto mb-5 h-1.5 w-11 rounded-full bg-line" />
          {title}
        </div>
        <div className="no-scrollbar flex-1 overflow-y-auto px-7 pb-10 pt-2">{children}</div>
      </div>
    </div>
  );
}

export function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <Orb size={30} />
      <span className="title text-[17px]">PolicyLens</span>
    </div>
  );
}

export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.dataset.theme === "dark"), []);
  const flip = () => {
    const next = dark ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("pl-theme", next);
    } catch {}
    setDark(!dark);
  };
  return (
    <button onClick={flip} aria-label={dark ? "Switch to light mode" : "Switch to dark mode"} className="grid h-9 w-9 place-items-center rounded-full bg-surface text-ink shadow-e1 ring-1 ring-line">
      <Icon name={dark ? "sun" : "moon"} size={16} />
    </button>
  );
}

export function LangToggle({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
  return (
    <div className="flex rounded-full bg-surface p-0.5 text-[12.5px] shadow-e1 ring-1 ring-line" role="group" aria-label="Answer language">
      {(["en", "hi"] as Lang[]).map((l) => (
        <button key={l} onClick={() => setLang(l)} aria-pressed={lang === l} className={`rounded-full px-3 py-1.5 transition-all ${lang === l ? "bg-primary font-semibold text-on-primary" : "text-ink-soft"}`}>
          {l === "en" ? "EN" : "हिं"}
        </button>
      ))}
    </div>
  );
}
