"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Bill from "@/components/Bill";
import Chat, { type Citation, type Msg } from "@/components/Chat";
import Decide from "@/components/Decide";
import { FamilyBar, ProfileSheet } from "@/components/Family";
import Plans from "@/components/Plans";
import PolicySheet from "@/components/PolicySheet";
import { Icon, Logo, Seal, inrShort } from "@/components/ui";
import type { Lang } from "@/lib/ai";
import { STEPS, nextStep } from "@/lib/flow";
import { matchPolicies } from "@/lib/match";
import { POLICIES, getPolicy } from "@/lib/policies";
import { CITY_LABEL, CONDITION_LABEL, coverSummary, inr, isProfileComplete, recommendSumInsured } from "@/lib/profile";
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
      <div className="msg-in rounded-[24px] bg-surface p-5 shadow-e2 ring-1 ring-line">
        <Seal>Profile complete</Seal>
        <p className="font-display mt-3 text-[22px] font-semibold leading-tight">Ready to compare plans for your family</p>
        <div className="mt-4 flex items-end justify-between border-t border-line pt-4">
          <div>
            <p className="text-[12.5px] text-ink-soft">Suggested cover</p>
            <p className="num text-[28px] font-semibold leading-none text-pine">₹{recommendSumInsured(profile).lakh} lakh</p>
          </div>
          <p className="max-w-[48%] text-right text-[12.5px] leading-snug text-ink-soft">{coverSummary(profile)}</p>
        </div>
        <div className="mt-5 grid grid-cols-[auto_1fr] gap-2">
          <button onClick={() => setProfileOpen(true)} className="rounded-[14px] px-4 py-3.5 text-[14px] font-medium text-pine ring-1 ring-line">
            Review
          </button>
          <button onClick={showPlans} className="flex items-center justify-center gap-2 rounded-[14px] bg-pine py-3.5 text-[14px] font-semibold text-white shadow-e2">
            See my plans
            <Icon name="arrow" size={16} />
          </button>
        </div>
      </div>
    ) : null;

  return (
    <div className="min-h-dvh lg:flex lg:items-center lg:justify-center lg:gap-20 lg:p-6">
      <aside className="hidden max-w-xs lg:block">
        <Logo />
        <p className="font-display mt-8 text-[36px] font-semibold leading-[1.08]">Health insurance, explained before you buy.</p>
        <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">PolicyLens is designed for your phone. Open this page on mobile and add it to your home screen.</p>
      </aside>

      <div className="relative mx-auto flex h-dvh w-full max-w-[440px] flex-col overflow-hidden bg-sage lg:mx-0 lg:h-[880px] lg:max-h-[94vh] lg:rounded-[48px] lg:border-[10px] lg:border-[#0a1f1a] lg:shadow-e3">
        {!started ? (
          <Landing onStart={start} lang={lang} setLang={switchLang} />
        ) : (
          <>
            <header className="shrink-0 bg-pine pt-[env(safe-area-inset-top)]">
              <div className="flex items-center justify-between px-5 pt-3.5">
                <Logo light />
                <LangToggle lang={lang} setLang={switchLang} />
              </div>
              {view === "chat" ? <FamilyBar profile={profile} onOpen={() => setProfileOpen(true)} /> : <div className="h-3.5" />}
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
    <div className="flex rounded-full bg-white/8 p-0.5 text-[12px] ring-1 ring-white/12" role="group" aria-label="Answer language">
      {(["en", "hi"] as Lang[]).map((l) => (
        <button key={l} onClick={() => setLang(l)} aria-pressed={lang === l} className={`font-display rounded-full px-3 py-1 ${lang === l ? "bg-white font-semibold text-pine" : "text-white/75"}`}>
          {l === "en" ? "English" : "हिंदी"}
        </button>
      ))}
    </div>
  );
}

const TABS: { id: View; label: string; icon: Parameters<typeof Icon>[0]["name"] }[] = [
  { id: "chat", label: "Ask", icon: "chat" },
  { id: "plans", label: "Plans", icon: "layers" },
  { id: "bill", label: "Your bill", icon: "receipt" },
  { id: "decide", label: "Decide", icon: "shield" },
];

function TabBar({ view, setView }: { view: View; setView: (v: View) => void }) {
  return (
    <nav className="grid shrink-0 grid-cols-4 border-t border-line bg-surface/95 pb-[max(env(safe-area-inset-bottom),8px)] pt-2 backdrop-blur" aria-label="Sections">
      {TABS.map((t) => {
        const on = view === t.id;
        return (
          <button key={t.id} onClick={() => setView(t.id)} aria-current={on ? "page" : undefined} className={`relative flex flex-col items-center gap-1 py-1 text-[11px] ${on ? "font-semibold text-pine" : "text-ink-faint"}`}>
            {on && <span className="absolute -top-2 h-[3px] w-6 rounded-full bg-gold" />}
            <Icon name={t.icon} size={21} />
            {t.label}
          </button>
        );
      })}
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

  const promises: { icon: Parameters<typeof Icon>[0]["name"]; title: string; body: string }[] = [
    { icon: "phoneOff", title: "No phone number. No sales calls.", body: "Explore every plan without signing up." },
    { icon: "lock", title: "Your health details stay private", body: "Never shared with an insurer unless you choose a plan." },
    { icon: "doc", title: "Every answer shows its source", body: "Each recommendation links to the exact policy clause." },
  ];

  return (
    <div className="no-scrollbar h-full overflow-y-auto bg-sage">
      {/* 1. Promise: one sentence, on forest */}
      <section className="rounded-b-[32px] bg-pine px-6 pb-24 pt-[max(env(safe-area-inset-top),18px)] text-white">
        <div className="flex items-center justify-between">
          <Logo light />
          <LangToggle lang={lang} setLang={setLang} />
        </div>
        <h1 className="font-display mt-10 text-[36px] font-semibold leading-[1.08]">Health insurance, explained before you buy.</h1>
        <p className="mt-4 max-w-[34ch] text-[15px] leading-relaxed text-white/70">
          Tell us about your family. We'll show what each plan would actually pay, line by line, from the policy's own wording.
        </p>
      </section>

      {/* 2. Proof: the same cover, two different outcomes */}
      <section className="relative -mt-16 px-5">
        <div className="rounded-[24px] bg-surface p-5 shadow-e2 ring-1 ring-line">
          <p className="text-[13px] leading-snug text-ink-soft">
            Two plans, both ₹10 lakh cover. A knee replacement for a 63-year-old in Mumbai costs <span className="num font-semibold text-ink">{inrShort(demo[0].r.bill)}</span>.
          </p>
          <div className="mt-4 space-y-4">
            {demo.map(({ pol, r }) => (
              <div key={pol.id}>
                <div className="flex items-baseline justify-between">
                  <span className="text-[14px] font-medium">{pol.name}</span>
                  <span className={`num text-[22px] font-semibold ${r.youPay ? "text-owe" : "text-paid"}`}>
                    {r.youPay ? `You pay ${inrShort(r.youPay)}` : "You pay ₹0"}
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-owe-soft">
                  <div className="h-full rounded-full bg-paid" style={{ width: `${(r.insurerPays / r.bill) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 border-t border-line pt-3">
            <Seal>Calculated from each policy's wording</Seal>
          </div>
        </div>
      </section>

      {/* 3. Safety: what we promise */}
      <section className="px-6 pt-8">
        <ul className="space-y-5">
          {promises.map((p) => (
            <li key={p.title} className="flex gap-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface text-pine shadow-e1 ring-1 ring-line">
                <Icon name={p.icon} size={18} />
              </span>
              <div>
                <p className="text-[15px] font-medium">{p.title}</p>
                <p className="mt-0.5 text-[13.5px] text-ink-soft">{p.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* 4. Action: in the thumb zone */}
      <section className="px-5 pb-[max(env(safe-area-inset-bottom),24px)] pt-9">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onStart(text.trim() || undefined);
          }}
          className="rounded-[24px] bg-surface p-2 shadow-e2 ring-1 ring-line"
        >
          <label htmlFor="intro" className="block px-3 pt-2 text-[13px] font-medium text-ink-soft">
            Describe your family in your own words, or skip
          </label>
          <textarea
            id="intro"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            placeholder="Meri maa 60 ki hai, unko thyroid hai. Mumbai, budget 40k."
            className="w-full resize-none bg-transparent px-3 py-2 text-[15px] outline-none placeholder:text-ink-faint"
          />
          <button className="flex w-full items-center justify-center gap-2 rounded-[16px] bg-pine py-4 text-[15px] font-semibold text-white shadow-e2">
            {text.trim() ? "Find my plans" : "Get started"}
            <Icon name="arrow" size={17} />
          </button>
        </form>
        <p className="mt-6 text-center text-[12.5px] text-ink-faint">Or see how it works for a sample family</p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {PERSONAS.map((p) => (
            <button key={p.who} onClick={() => onStart(p.text)} className="rounded-[16px] bg-surface p-3 text-left shadow-e1 ring-1 ring-line">
              <span className="block text-[13px] font-semibold">{p.who}</span>
              <span className="mt-0.5 block text-[11.5px] leading-snug text-ink-soft">{p.what}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
