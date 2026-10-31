"use client";

import { useEffect, useRef, useState } from "react";
import type { Inference } from "@/lib/infer";
import { Icon, Orb } from "./ui";

const DURATION = 5000;

/**
 * The working-out screen shown before plans: the engine's real inferences, revealed one at a time
 * over five seconds, so people can see that their answers were actually reasoned about.
 */
export default function Thinking({ steps, onDone }: { steps: Inference[]; onDone: () => void }) {
  const [shown, setShown] = useState(0);
  const per = DURATION / Math.max(1, steps.length);
  // Keep the latest callback without restarting the timer when the parent re-renders
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    if (shown < steps.length) {
      const id = setTimeout(() => setShown((n) => n + 1), shown === 0 ? 250 : per);
      return () => clearTimeout(id);
    }
    const id = setTimeout(() => done.current(), 700);
    return () => clearTimeout(id);
  }, [shown, steps.length, per]);

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-canvas" role="status" aria-live="polite" aria-label="Working out your plans">
      <div className="px-6 pt-[max(env(safe-area-inset-top),28px)]">
        <Orb size={56} thinking />
        <h2 className="display mt-5 text-[30px]">Working out what your family needs</h2>
        <div className="mt-4 h-1 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full rounded-full bg-accent" style={{ width: "100%", animation: `fill ${DURATION + 500}ms linear both` }} />
        </div>
      </div>

      <ol className="no-scrollbar mt-6 flex-1 space-y-4 overflow-y-auto px-6 pb-10">
        {steps.slice(0, shown).map((s, i) => {
          const done = i < shown - 1 || shown === steps.length;
          return (
            <li key={i} className="rise flex gap-3">
              <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full transition-colors duration-300 ${done ? "bg-paid-soft text-paid" : "bg-accent-soft text-accent"}`}>
                {done ? <Icon name="check" size={13} stroke={2.6} /> : <span className="dot h-1.5 w-1.5 rounded-full bg-current" />}
              </span>
              <div className="min-w-0">
                <p className="text-[14.5px] font-medium leading-snug">{s.noticed}</p>
                <p className="mt-0.5 text-[13px] leading-relaxed text-ink-soft">{s.did}</p>
              </div>
            </li>
          );
        })}
      </ol>
      <style>{`@keyframes fill { from { transform: translateX(-100%); } to { transform: none; } }`}</style>
    </div>
  );
}
