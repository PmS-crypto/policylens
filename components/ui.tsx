"use client";

import { useEffect } from "react";
import type { Reason } from "@/lib/types";

export const inrShort = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

/* A small, consistent stroke icon set (24px grid, 1.8 stroke) */
const PATHS = {
  lock: "M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3",
  shield: "M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z",
  check: "M5 12.5l4.5 4.5L19 7.5",
  doc: "M7 3h7l4 4v14H7zM14 3v4h4M10 12h5M10 16h5",
  phoneOff: "M8 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM11 18h2M3.5 3.5l17 17",
  people: "M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3.5 19c.5-3 2.7-5 5.5-5s5 2 5.5 5M16 11a2.5 2.5 0 1 0 0-5M17.5 14c2 .5 3 2.4 3.3 5",
  chat: "M4 5h16v11H9l-5 4z",
  layers: "M12 4l8 4-8 4-8-4zM4 12l8 4 8-4M4 16l8 4 8-4",
  receipt: "M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6",
  compass: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM15.5 8.5l-2 5-5 2 2-5z",
  mic: "M9 3h6v11H9zM5 11a7 7 0 0 0 14 0M12 18v3",
  arrow: "M5 12h14M13 6l6 6-6 6",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 8h.01",
  advisor: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c.8-4 4-6 8-6s7.2 2 8 6",
} as const;

export function Icon({ name, size = 18, className = "" }: { name: keyof typeof PATHS; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d={PATHS[name]} />
    </svg>
  );
}

const TONE = {
  good: { icon: "check" as const, cls: "bg-paid-soft text-paid" },
  caveat: { icon: "info" as const, cls: "bg-warn-soft text-warn" },
  bad: { icon: "info" as const, cls: "bg-owe-soft text-owe" },
};

export function ReasonRow({ r, onClause }: { r: Reason; onClause?: () => void }) {
  const t = TONE[r.kind];
  return (
    <li className="flex gap-3.5">
      <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full ${t.cls}`}>
        <Icon name={t.icon} size={14} />
        <span className="sr-only">{r.kind === "good" ? "Strength" : r.kind === "caveat" ? "Check this" : "Trade-off"}</span>
      </span>
      <div className="min-w-0">
        <p className="text-[15px] font-medium leading-snug text-ink">{r.title}</p>
        <p className="mt-1 text-[13.5px] leading-relaxed text-ink-soft">{r.detail}</p>
        {r.clauseId && onClause && (
          <button onClick={onClause} className="mt-1.5 inline-flex items-center gap-1 text-[12.5px] font-medium text-pine">
            <Icon name="doc" size={13} />
            Read the clause
          </button>
        )}
      </div>
    </li>
  );
}

/** Verification seal: where a fact came from and when it was checked. */
export function Seal({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-soft">
      <span className="grid h-4 w-4 place-items-center rounded-full bg-gold text-white">
        <Icon name="check" size={10} />
      </span>
      {children}
    </span>
  );
}

export function Segmented<T extends string | number>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label?: string }) {
  return (
    <div className="flex rounded-[14px] bg-mist p-1" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={`flex-1 rounded-[10px] py-2 text-[13px] transition ${value === o.value ? "bg-surface font-semibold text-ink shadow-e1" : "text-ink-soft"}`}
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
      <button aria-label="Close" className="absolute inset-0 bg-pine/35 backdrop-blur-[2px]" onClick={onClose} />
      <div className="sheet-up relative flex max-h-[92%] flex-col rounded-t-[28px] bg-surface shadow-e3">
        <div className="px-6 pt-3">
          <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-line" />
          {title}
        </div>
        <div className="no-scrollbar flex-1 overflow-y-auto px-6 pb-8 pt-2">{children}</div>
      </div>
    </div>
  );
}

export function Logo({ light }: { light?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className={`relative grid h-8 w-8 place-items-center rounded-[10px] ${light ? "bg-white/10 ring-1 ring-white/15" : "bg-pine"}`}>
        <span className="h-4 w-4 rounded-full border-[2.5px] border-white" />
        <span className="absolute bottom-[7px] right-[7px] h-2 w-2 rounded-full bg-gold" />
      </span>
      <span className={`font-display text-[18px] font-semibold tracking-tight ${light ? "text-white" : "text-pine"}`}>PolicyLens</span>
    </div>
  );
}
