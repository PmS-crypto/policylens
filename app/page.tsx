"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Bill from "@/components/Bill";
import Chat, { type Citation, type Msg } from "@/components/Chat";
import Decide from "@/components/Decide";
import { FamilyBar, ProfileSheet } from "@/components/Family";
import Plans from "@/components/Plans";
import PolicySheet from "@/components/PolicySheet";
import { Logo, inrShort } from "@/components/ui";
import type { Lang } from "@/lib/ai";
import { STEPS, nextStep } from "@/lib/flow";
import { matchPolicies } from "@/lib/match";
import { POLICIES, getPolicy } from "@/lib/policies";
import { CITY_LABEL, CONDITION_LABEL, coverSummary, inr, isProfileComplete } from "@/lib/profile";
import { SCENARIOS, simulate } from "@/lib/simulate";
import type { Priority, Profile } from "@/lib/types";

type View = "chat" | "plans" | "bill" | "decide";

const uid = () => Math.random().toString(36).slice(2);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const doneIds = (p: Profile) => STEPS.filter((s) => s.done(p)).map((s) => s.id);

const PERSONAS = [
  { who: "Riya, 29", what: "Covering her diabetic father", text: "I'm 29 and live in Bengaluru. I want to cover my parents. Dad is 62 and has diabetes and BP. Budget around 45k a year." },
  { who: "Arjun, 32", what: "Married, planning a baby", text: "I'm 32, want cover for me and my wife in Pune. We're planning a baby next year, no health issues. I'd like a private room. My company gives 3 lakh cover." },
  { who: "Kabir, 24", what: "First job, first policy", text: "I'm 24, just started my first job in Indore. Just me. Want something cheap but decent." },
];

export default function Home() {
  const [started, setStarted] = useState(false);
  const [lang, setLang] = useState<Lang>("en");
  const langRef = useRef<Lang>("en");
  const [profile, setProfile] = useState<Profile>({});
  const profileRef = useRef<Profile>({});
  const [messages, setMessages] = useState<Msg[]>([]);
  const [typing, setTyping] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<"discover" | "qa">("discover");
  const [view, setView] = useState<View>("chat");
  const [sheet, setSheet] = useState<{ id: string; clause?: string } | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [chosen, setChosen] = useState<string | null>(null);
  const [billFocus, setBillFocus] = useState<string | undefined>();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [prefill, setPrefill] = useState<Priority[]>([]);
  const insightsShown = useRef(new Set<string>());

  useEffect(() => {
    if ("serviceWorker" in navigator && location.hostname !== "localhost") navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  const result = useMemo(() => (isProfileComplete(profile) ? matchPolicies(profile) : null), [profile]);
  const top = result?.matches.slice(0, 3) ?? [];
  const resultsReady = stage === "qa" && top.length > 0;

  const push = (m: Omit<Msg, "id">) => setMessages((ms) => [...ms, { ...m, id: uid() }]);
  const aiSay = async (text: string, extra?: Partial<Msg>) => {
    setTyping(true);
    await sleep(300 + Math.min(text.length * 5, 600));
    setTyping(false);
    push({ role: "ai", text, ...extra });
  };
  const update = (p: Profile) => {
    profileRef.current = p;
    setProfile(p);
  };

  const loadNotes = (p: Profile, l: Lang) => {
    setNotes({});
    fetch("/api/explain", { method: "POST", body: JSON.stringify({ profile: p, lang: l }) })
      .then((r) => r.json())
      .then((d) => setNotes(Object.fromEntries(d.notes.map((n: { policyId: string; note: string }) => [n.policyId, n.note]))));
  };

  const switchLang = (l: Lang) => {
    setLang(l);
    langRef.current = l;
    if (stage === "qa") loadNotes(profileRef.current, l);
  };

  async function advance(p: Profile, fresh: string[]) {
    let shown = 0;
    for (const id of fresh) {
      const ins = STEPS.find((s) => s.id === id)?.insight?.(p);
      if (ins && !insightsShown.current.has(id) && shown++ < 2) {
        insightsShown.current.add(id);
        await aiSay(ins, { tone: "insight" });
      }
    }
    const s = nextStep(p);
    if (s) {
      await aiSay(s.ask(p));
      const h = s.hint?.(p);
      if (h) push({ role: "ai", text: h, tone: "hint" });
    } else {
      await aiSay("That's everything I need. I've got a clear picture of your family.");
    }
  }

  async function onChips(values: string[], labels: string[]) {
    if (stage === "qa") return askAll(labels[0]);
    const p = profileRef.current;
    const step = nextStep(p);
    if (!step) return;
    setBusy(true);
    push({ role: "user", text: labels.join(", ") });
    const p2 = step.apply(p, values);
    update(p2);
    await advance(p2, [step.id]);
    setBusy(false);
  }

  async function onText(text: string) {
    if (stage === "qa") return askAll(text);
    setBusy(true);
    push({ role: "user", text });
    const p = profileRef.current;
    const step = nextStep(p);
    const chip = step && !step.multi && step.chips(p).find((c) => c.label.toLowerCase() === text.toLowerCase());
    if (step && chip) {
      const p2 = step.apply(p, [chip.value]);
      update(p2);
      await advance(p2, [step.id]);
      return setBusy(false);
    }

    setTyping(true);
    const res = await fetch("/api/extract", { method: "POST", body: JSON.stringify({ text, profile: p, stepId: step?.id, lang: langRef.current }) }).then((r) => r.json());
    setTyping(false);
    const patch = Object.fromEntries(Object.entries(res.patch ?? {}).filter(([, v]) => v !== undefined)) as Partial<Profile>;
    if (patch.priorities && step?.id !== "priorities") {
      setPrefill(patch.priorities);
      delete patch.priorities;
    }
    const p2 = { ...p, ...patch };
    const before = new Set(doneIds(p));
    const fresh = doneIds(p2).filter((id) => !before.has(id));
    if (!fresh.length) {
      await aiSay("I didn't catch that. Try saying it another way, or tap one of the options.");
      return setBusy(false);
    }
    await aiSay(res.reply ?? summarize(p2, fresh));
    update(p2);
    await advance(p2, fresh);
    setBusy(false);
  }

  async function askAll(q: string) {
    push({ role: "user", text: q });
    setBusy(true);
    setTyping(true);
    const res = await fetch("/api/ask", {
      method: "POST",
      body: JSON.stringify({ question: q, policyIds: top.map((m) => m.policy.id), profile: profileRef.current, lang: langRef.current }),
    }).then((r) => r.json());
    setTyping(false);
    push({ role: "ai", text: res.answer, citations: res.citations });
    setBusy(false);
  }

  async function start(text?: string) {
    setStarted(true);
    setBusy(true);
    await aiSay("Hi, I'm PolicyLens. Tell me about your family and I'll show you what each plan would really pay, before you buy. Type, tap or just speak.");
    if (text) {
      setBusy(false);
      await onText(text);
    } else {
      await advance({}, []);
      setBusy(false);
    }
  }

  async function showPlans() {
    if (!result) return;
    setStage("qa");
    setView("plans");
    loadNotes(profile, langRef.current);
    push({
      role: "ai",
      text: `I read ${POLICIES.length} policies and picked 3 for your family. Ask me anything about them here, in English or Hindi.`,
    });
  }

  function onEdit(field: keyof Profile) {
    const p = { ...profileRef.current };
    delete p[field];
    update(p);
    setProfileOpen(false);
    setStage("discover");
    setView("chat");
    setBusy(true);
    advance(p, []).then(() => setBusy(false));
  }

  const choose = (id: string) => {
    setChosen(id);
    setSheet(null);
    setView("decide");
  };

  const step = stage === "discover" ? nextStep(profile) : null;
  const qaChips =
    resultsReady && !busy
      ? [
          profile.conditions?.length ? `When is ${CONDITION_LABEL[profile.conditions[0]].toLowerCase()} covered?` : "What's not covered?",
          "Which is best for a private room?",
          lang === "hi" ? "इनमें सबसे अच्छा कौन सा है?" : "Which one would you pick for me?",
        ].map((q) => ({ label: q, value: q }))
      : [];
  const chips = busy ? [] : step ? step.chips(profile) : qaChips;

  const sheetMatch = sheet && result?.matches.find((m) => m.policy.id === sheet.id);
  const chosenMatch = top.find((m) => m.policy.id === chosen) ?? top[0];

  const readyCard =
    stage === "discover" && result && !busy && !typing ? (
      <div className="rounded-3xl bg-pine p-5 text-white">
        <p className="font-display text-[20px] font-bold leading-tight">Your profile is ready</p>
        <p className="mt-1 text-[14px] text-white/75">{coverSummary(profile)}</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button onClick={() => setProfileOpen(true)} className="rounded-2xl bg-white/10 py-3 text-[14px] font-semibold">
            Review it
          </button>
          <button onClick={showPlans} className="rounded-2xl bg-mark py-3 text-[14px] font-bold text-pine">
            Show my plans
          </button>
        </div>
      </div>
    ) : null;

  return (
    <div className="min-h-dvh lg:flex lg:items-center lg:justify-center lg:gap-20 lg:p-6">
      <aside className="hidden max-w-xs lg:block">
        <Logo />
        <p className="font-display mt-6 text-[34px] font-extrabold leading-[1.05]">Know what you'll pay before you buy.</p>
        <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">PolicyLens is made for your phone. Open this page on mobile and add it to your home screen.</p>
      </aside>

      <div className="relative mx-auto flex h-dvh w-full max-w-[440px] flex-col overflow-hidden bg-sage lg:mx-0 lg:h-[880px] lg:max-h-[94vh] lg:rounded-[48px] lg:border-[12px] lg:border-[#0c2420] lg:shadow-[0_40px_80px_-30px_rgba(18,49,42,0.55)]">
        {!started ? (
          <Landing onStart={start} lang={lang} setLang={switchLang} />
        ) : (
          <>
            <header className="shrink-0 bg-pine pt-[env(safe-area-inset-top)]">
              <div className="flex items-center justify-between px-4 pt-3">
                <Logo light />
                <LangToggle lang={lang} setLang={switchLang} />
              </div>
              {view === "chat" ? <FamilyBar profile={profile} onOpen={() => setProfileOpen(true)} /> : <div className="h-3" />}
            </header>

            <main className="relative min-h-0 flex-1 overflow-y-auto">
              {view === "chat" && (
                <Chat
                  messages={messages}
                  typing={typing}
                  chips={chips}
                  multi={step?.multi}
                  max={step?.max}
                  tiles={step?.layout === "tiles"}
                  preselected={step?.id === "priorities" ? prefill : undefined}
                  placeholder={stage === "qa" ? "Ask about your plans" : "Type or speak your answer"}
                  lang={lang}
                  footer={readyCard}
                  onChips={onChips}
                  onText={onText}
                  onCitation={(c: Citation) => setSheet({ id: c.policyId, clause: c.clauseId })}
                />
              )}
              {view === "plans" && result && (
                <Plans
                  profile={profile}
                  top={top}
                  excluded={result.excluded}
                  notes={notes}
                  onOpen={(id, clause) => setSheet({ id, clause })}
                  onChoose={choose}
                  onBill={(id) => {
                    setBillFocus(id);
                    setView("bill");
                  }}
                />
              )}
              {view === "bill" && <Bill key={billFocus} profile={profile} top={top} focusId={billFocus} onOpen={(id, clause) => setSheet({ id, clause })} />}
              {view === "decide" && chosenMatch && <Decide profile={profile} match={chosenMatch} top={top} onSwitch={setChosen} />}
            </main>

            {resultsReady && <TabBar view={view} setView={setView} />}

            {profileOpen && <ProfileSheet profile={profile} onEdit={onEdit} onClose={() => setProfileOpen(false)} />}
            {sheetMatch && (
              <PolicySheet match={sheetMatch} focusClause={sheet?.clause} profile={profile} lang={lang} onClose={() => setSheet(null)} onChoose={() => choose(sheetMatch.policy.id)} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function LangToggle({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
  return (
    <div className="flex rounded-full bg-white/10 p-0.5 text-[12px]" role="group" aria-label="Answer language">
      {(["en", "hi"] as Lang[]).map((l) => (
        <button key={l} onClick={() => setLang(l)} aria-pressed={lang === l} className={`rounded-full px-3 py-1 ${lang === l ? "bg-white font-semibold text-pine" : "text-white/80"}`}>
          {l === "en" ? "English" : "हिंदी"}
        </button>
      ))}
    </div>
  );
}

const TABS: { id: View; label: string; icon: React.ReactNode }[] = [
  { id: "chat", label: "Ask", icon: <path d="M4 5h16v11H9l-5 4z" /> },
  { id: "plans", label: "Plans", icon: <path d="M4 4h7v16H4zM13 4h7v9h-7z" /> },
  { id: "bill", label: "Your bill", icon: <path d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6" /> },
  { id: "decide", label: "Decide", icon: <path d="M5 12l4 4 10-10" /> },
];

function TabBar({ view, setView }: { view: View; setView: (v: View) => void }) {
  return (
    <nav className="grid shrink-0 grid-cols-4 border-t border-line bg-surface pb-[max(env(safe-area-inset-bottom),6px)] pt-1.5">
      {TABS.map((t) => (
        <button key={t.id} onClick={() => setView(t.id)} aria-current={view === t.id ? "page" : undefined} className={`flex flex-col items-center gap-0.5 py-1 text-[11px] ${view === t.id ? "font-semibold text-pine" : "text-ink-soft"}`}>
          <span className={`grid h-7 w-12 place-items-center rounded-full ${view === t.id ? "bg-mark" : ""}`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {t.icon}
            </svg>
          </span>
          {t.label}
        </button>
      ))}
    </nav>
  );
}

function summarize(p: Profile, fresh: string[]) {
  const bits: string[] = [];
  for (const id of fresh) {
    if (id === "goal") bits.push(`covering ${coverSummary(p).replace(/ \(\d+\)/g, "").toLowerCase()}`);
    if (id === "selfAge" && (p.cover?.self || p.cover?.partner)) bits.push(`you're ${p.selfAge}`);
    if (id === "parentAge") bits.push(`your elder parent is ${p.parentAge}`);
    if (id === "kids") bits.push(`${p.kidsCount} kid${p.kidsCount === 1 ? "" : "s"}`);
    if (id === "baby") bits.push(p.planningBaby ? "a baby is planned soon" : "no baby plans");
    if (id === "conditions") bits.push(p.conditions?.length ? p.conditions.map((c) => CONDITION_LABEL[c]).join(" & ") : "no existing conditions");
    if (id === "city") bits.push(p.cityName ?? CITY_LABEL[p.city!].toLowerCase());
    if (id === "employer") bits.push(p.employerCover ? `₹${p.employerCover}L employer cover` : "no employer cover");
    if (id === "budget") bits.push(p.budget ? `budget up to ${inr(p.budget)} a year` : "open budget");
  }
  if (!bits.length) return "Got it.";
  const list = bits.length > 1 ? bits.slice(0, -1).join(", ") + " and " + bits[bits.length - 1] : bits[0];
  return `Got it: ${list}.${bits.length >= 3 ? " That saves us a few questions." : ""}`;
}

function Landing({ onStart, lang, setLang }: { onStart: (text?: string) => void; lang: Lang; setLang: (l: Lang) => void }) {
  const [text, setText] = useState("");
  const demo = useMemo(() => {
    const p: Profile = { cover: { self: false, partner: false, kids: false, parents: true }, parentAge: 63, city: "metro", conditions: [] };
    const s = SCENARIOS.find((x) => x.id === "knee")!;
    return ["suraksha-complete", "pratham-saver"].map((id) => {
      const pol = getPolicy(id)!;
      return { pol, r: simulate(pol, 10, p, s, { year: 3, room: "private" }) };
    });
  }, []);

  return (
    <div className="no-scrollbar flex h-full flex-col overflow-y-auto bg-pine text-white">
      <div className="flex items-center justify-between px-5 pt-[max(env(safe-area-inset-top),16px)]">
        <Logo light />
        <LangToggle lang={lang} setLang={setLang} />
      </div>

      <div className="px-5 pt-8">
        <h1 className="font-display text-[40px] font-extrabold leading-[1.02]">Know what you'll pay before you buy.</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-white/75">
          Two plans can both say ₹10 lakh cover. Here's what each one pays when your mother needs a knee replacement in Mumbai.
        </p>
      </div>

      {/* Hero: the same bill, two very different outcomes */}
      <div className="mx-5 mt-6 space-y-2">
        {demo.map(({ pol, r }) => (
          <div key={pol.id} className="relative overflow-hidden rounded-2xl bg-surface p-4 font-mono text-[12px] text-ink">
            <div className="flex justify-between">
              <span className="font-sans text-[13px] font-semibold">{pol.name}</span>
              <span>{inrShort(r.bill)}</span>
            </div>
            <p className="mt-1 truncate text-ink-soft">{r.lines.length ? r.lines.map((l) => l.label.toLowerCase()).join(", ") : "no deductions"}</p>
            <div className="mt-2 flex items-end justify-between font-sans">
              <span className="text-[13px] font-semibold">You pay</span>
              <span className={`font-display text-[28px] font-extrabold leading-none ${r.youPay ? "text-owe" : "text-paid"}`}>{inrShort(r.youPay)}</span>
            </div>
            <span className={`stamp absolute bottom-4 left-24 px-2 py-0.5 font-sans text-[11px] font-extrabold uppercase ${r.youPay ? "text-owe" : "text-paid"}`}>
              {r.youPay ? "Capped" : "Paid in full"}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-auto px-5 pb-[max(env(safe-area-inset-bottom),20px)] pt-8">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onStart(text.trim() || undefined);
          }}
          className="rounded-3xl bg-white/10 p-2"
        >
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            aria-label="Describe who you want to cover"
            placeholder="Who do you want to cover? e.g. Meri maa 60 ki hai, unko thyroid hai. Mumbai, budget 40k."
            className="w-full resize-none bg-transparent px-3 py-2 text-[15px] text-white outline-none placeholder:text-white/45"
          />
          <button className="w-full rounded-2xl bg-mark py-3.5 text-[15px] font-bold text-pine">{text.trim() ? "Find my plans" : "Start with a few questions"}</button>
        </form>
        <p className="mt-5 text-[13px] text-white/60">Or try a family</p>
        <div className="no-scrollbar -mx-5 mt-2 flex gap-2 overflow-x-auto px-5">
          {PERSONAS.map((p) => (
            <button key={p.who} onClick={() => onStart(p.text)} className="shrink-0 rounded-2xl bg-white/8 px-4 py-3 text-left ring-1 ring-white/15">
              <span className="block text-[14px] font-semibold">{p.who}</span>
              <span className="block text-[12px] text-white/65">{p.what}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
