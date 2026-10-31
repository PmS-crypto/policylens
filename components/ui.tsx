"use client";

import { useEffect } from "react";
import type { Reason } from "@/lib/types";

export const inrShort = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

const TONE = {
  good: { glyph: "✓", cls: "bg-paid-soft text-paid" },
  caveat: { glyph: "!", cls: "bg-warn-soft text-warn" },
  bad: { glyph: "✕", cls: "bg-owe-soft text-owe" },
} as const;

export function ReasonRow({ r, onClause }: { r: Reason; onClause?: () => void }) {
  const t = TONE[r.kind];
  return (
    <li className="flex gap-3">
      <span aria-hidden className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-bold ${t.cls}`}>
        {t.glyph}
      </span>
      <div className="min-w-0">
        <p className="text-[15px] font-medium leading-snug">{r.title}</p>
        <p className="mt-0.5 text-[13px] leading-relaxed text-ink-soft">{r.detail}</p>
        {r.clauseId && onClause && (
          <button onClick={onClause} className="mt-1 text-[12px] font-medium text-pine underline decoration-mark decoration-2 underline-offset-2">
            Read the clause
          </button>
        )}
      </div>
    </li>
  );
}

export function Segmented<T extends string | number>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex rounded-xl bg-mist p-1">
      {options.map((o) => (
        <button
          key={String(o.value)}
          onClick={() => onChange(o.value)}
          className={`flex-1 rounded-lg py-2 text-[13px] transition ${value === o.value ? "bg-surface font-semibold shadow-sm" : "text-ink-soft"}`}
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
    <div className="absolute inset-0 z-40 flex flex-col justify-end">
      <button aria-label="Close" className="absolute inset-0 bg-pine/40" onClick={onClose} />
      <div className="sheet-up relative flex max-h-[90%] flex-col rounded-t-3xl bg-surface">
        <div className="flex items-start justify-between gap-3 px-5 pt-3">
          <div className="min-w-0 flex-1">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" />
            {title}
          </div>
        </div>
        <div className="no-scrollbar flex-1 overflow-y-auto px-5 pb-8 pt-2">{children}</div>
      </div>
    </div>
  );
}

export function Logo({ light }: { light?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className="relative grid h-7 w-7 place-items-center overflow-hidden rounded-lg bg-pine">
        <span className="absolute left-1 right-1 top-[55%] h-1.5 rounded-sm bg-mark" />
        <span className="relative h-3.5 w-3.5 rounded-full border-[2.5px] border-white" />
      </span>
      <span className={`font-display text-[17px] font-bold ${light ? "text-white" : "text-pine"}`}>PolicyLens</span>
    </div>
  );
}
