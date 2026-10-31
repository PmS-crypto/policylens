"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Awareness from "@/components/Awareness";
import Bill from "@/components/Bill";
import Chat, { type Citation, type Msg } from "@/components/Chat";
import Decide from "@/components/Decide";
import { FamilyBar, ProfileSheet } from "@/components/Family";
import Plans from "@/components/Plans";
import PolicySheet from "@/components/PolicySheet";
import { AURA, Aura, Icon, type IconName, LangToggle, Logo, Money, Orb, SlicedOrb, ThemeToggle, inrShort } from "@/components/ui";
import type { Lang } from "@/lib/ai";
import { STEPS, nextStep, t } from "@/lib/flow";
import { matchPolicies } from "@/lib/match";
import { POLICIES, getPolicy } from "@/lib/policies";
import { CITY_LABEL, CONDITION_LABEL, coverSummary, inr, isProfileComplete, recommendSumInsured } from "@/lib/profile";
import { SCENARIOS, simulate } from "@/lib/simulate";
import type { Priority, Profile } from "@/lib/types";

type View = "chat" | "plans" | "bill" | "decide";

const uid = () => Math.random().toString(36).slice(2);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const doneIds = (p: Profile) => STEPS.filter((s) => s.done(p)).map((s) => s.id);

const PERSONAS: Record<Lang, { who: string; what: string; text: string }[]> = {
  en: [
    { who: "Riya, 29", what: "Covering her diabetic dad", text: "I'm 29 and live in Bengaluru. I want to cover my parents. Dad is 62 and has diabetes and BP. Budget around 45k a year." },
    { who: "Arjun, 32", what: "Married, baby on the way", text: "I'm 32, want cover for me and my wife in Pune. We're planning a baby next year, no health issues. I'd like a private room. My company gives 3 lakh cover." },
    { who: "Kabir, 24", what: "First job, first policy", text: "I'm 24, just started my first job in Indore. Just me. Want something cheap but decent." },
  ],
  hi: [
    { who: "Riya, 29", what: "Papa ke liye, unko sugar hai", text: "Main 29 ki hoon, Bengaluru mein rehti hoon. Mummy-papa ko cover karna hai. Papa 62 ke hain, unko sugar aur BP hai. Budget 45k saal ka." },
    { who: "Arjun, 32", what: "Shaadi ho gayi, baby plan hai", text: "Main 32 ka hoon, Pune mein. Mujhe aur wife ko cover chahiye. Agle saal baby plan hai, koi health issue nahi. Private room chahiye. Company se 3 lakh cover hai." },
    { who: "Kabir, 24", what: "Pehli job, pehli policy", text: "Main 24 ka hoon, Indore mein pehli job lagi hai. Sirf mere liye. Kuch sasta par achha chahiye." },
  ],
};

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
    if (l === langRef.current) return;
    setLang(l);
    langRef.current = l;
    if (!started) return;
    if (stage === "qa") {
      loadNotes(profileRef.current, l);
      push({ role: "ai", text: t(l, "Switched to English. Ask me anything about your plans.", "Done, ab Hinglish mein baat karte hain. Plans ke baare mein kuch bhi poocho.") });
      return;
    }
    // Re-ask the open question in the new language so the switch is felt immediately.
    const s = nextStep(profileRef.current);
    if (s && !busy) push({ role: "ai", text: s.ask(profileRef.current, l) });
  };

  async function advance(p: Profile, fresh: string[]) {
    let shown = 0;
    for (const id of fresh) {
      const ins = STEPS.find((s) => s.id === id)?.insight?.(p, langRef.current);
      if (ins && !insightsShown.current.has(id) && shown++ < 2) {
        insightsShown.current.add(id);
        await aiSay(ins, { tone: "insight" });
      }
    }
    const s = nextStep(p);
    if (s) {
      await aiSay(s.ask(p, langRef.current));
      const h = s.hint?.(p, langRef.current);
      if (h) push({ role: "ai", text: h, tone: "hint" });
    } else {
      await aiSay(t(langRef.current, "That's everything I need. I've got a clear picture of your family now.", "Bas, itna kaafi hai. Aapki family ki poori picture clear hai."));
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
    const chip = step && !step.multi && step.chips(p, langRef.current).find((c) => c.label.toLowerCase() === text.toLowerCase());
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
      await aiSay(t(langRef.current, "Hmm, didn't quite get that. Say it another way, or just tap an option.", "Hmm, samajh nahi aaya. Thoda alag tareeke se bolo, ya koi option tap kar do."));
      return setBusy(false);
    }
    await aiSay(res.reply ?? summarize(p2, fresh, langRef.current));
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
    await aiSay(
      t(
        langRef.current,
        "Hey, I'm PolicyLens. Tell me about your family and I'll show you what each plan would actually pay, before you spend a rupee. Type, tap or just talk.",
        "Hey, main PolicyLens hoon. Apni family ke baare mein batao, main dikhaunga ki har plan asal mein kitna pay karega, ek rupaya kharch karne se pehle. Type karo, tap karo ya bol do.",
      ),
    );
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
      text: t(
        langRef.current,
        `Read all ${POLICIES.length} policies so you don't have to. Here are the 3 that fit. Ask me anything about them, right here.`,
        `${POLICIES.length} policies padh li, taaki aapko na padhni pade. Yeh rahe aapke 3 best plans. Kuch bhi poochna ho toh yahin poocho.`,
      ),
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
          profile.conditions?.length
            ? t(lang, `When does ${CONDITION_LABEL[profile.conditions[0]].toLowerCase()} get covered?`, `${CONDITION_LABEL[profile.conditions[0]]} kab se cover hoga?`)
            : t(lang, "What's not covered?", "Kya cover nahi hota?"),
          t(lang, "Best one for a private room?", "Private room ke liye best kaunsa?"),
          t(lang, "Which one would you pick for me?", "Aap mere liye kaunsa loge?"),
        ].map((q) => ({ label: q, value: q }))
      : [];
  const chips = busy ? [] : step ? step.chips(profile, lang) : qaChips;

  const sheetMatch = sheet && result?.matches.find((m) => m.policy.id === sheet.id);
  const chosenMatch = top.find((m) => m.policy.id === chosen) ?? top[0];

  const readyCard =
    stage === "discover" && result && !busy && !typing ? (
      <div className="space-y-5">
      {top[0] && <Awareness profile={profile} best={top[0]} lang={lang} />}
      <Aura colors={AURA.dusk} scrim className="rise relative rounded-[32px] p-6 text-white shadow-e2">
        <div className="absolute -right-20 -top-16 text-white opacity-70" aria-hidden>
          <SlicedOrb size={150} />
        </div>
        <p className="relative text-[13px] font-medium opacity-85">{t(lang, "Profile done", "Profile ready")}</p>
        <p className="title relative mt-2 max-w-[14ch] text-[24px] leading-tight">{t(lang, "Let's find your family's plan", "Chalo, family ka plan dhoondte hain")}</p>
        <div className="relative mt-8">
          <p className="text-[12.5px] opacity-80">{t(lang, "Cover we'd go for", "Itna cover sahi rahega")}</p>
          <p className="money mt-1 text-[64px]">₹{recommendSumInsured(profile).lakh}L</p>
        </div>
        <div className="relative mt-6 grid grid-cols-[auto_1fr] gap-2.5">
          <button onClick={() => setProfileOpen(true)} className="rounded-full bg-white/15 px-5 py-4 text-[14px] font-semibold backdrop-blur">
            {t(lang, "Review", "Check karo")}
          </button>
          <button onClick={showPlans} className="flex items-center justify-center gap-2 rounded-full bg-white py-4 text-[14.5px] font-semibold text-[#16131d] shadow-e2">
            {t(lang, "Show my plans", "Plans dikhao")}
            <Icon name="arrow" size={16} />
          </button>
        </div>
      </Aura>
      </div>
    ) : null;

  return (
    <div className="relative min-h-dvh overflow-hidden lg:flex lg:items-center lg:justify-center lg:gap-24 lg:p-6">
      {/* Desktop stage: an aura glows behind the phone */}
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 hidden h-[900px] w-[900px] -translate-x-1/4 -translate-y-1/2 rounded-full opacity-40 blur-3xl lg:block breathe" style={{ background: "radial-gradient(circle at 40% 40%, #b7a6ff, #f49ac1 40%, #ffc6a8 60%, transparent 70%)" }} />
      <aside className="relative hidden max-w-sm lg:block">
        <Logo />
        <p className="display mt-10 text-[56px]">See what you'd pay. Before you buy.</p>
        <p className="mt-6 max-w-[34ch] text-[16px] leading-relaxed text-ink-soft">PolicyLens is designed for your phone. Open this page on mobile and add it to your home screen.</p>
      </aside>

      <div className="relative mx-auto flex h-dvh w-full max-w-[440px] flex-col overflow-hidden bg-canvas lg:mx-0 lg:h-[900px] lg:max-h-[94vh] lg:rounded-[56px] lg:shadow-e3 lg:ring-[10px] lg:ring-[#15121c]">
        {!started ? (
          <Landing onStart={start} lang={lang} setLang={switchLang} />
        ) : (
          <>
            <header className="shrink-0 pb-3 pt-[max(env(safe-area-inset-top),14px)]">
              <div className="flex items-center justify-between px-5">
                <div className="flex items-center gap-2.5">
                  <Orb size={34} thinking={typing} />
                  <div>
                    <p className="title text-[16px] leading-none">PolicyLens</p>
                    <p className="mt-1 text-[12px] leading-none text-ink-soft">{typing ? t(lang, "Thinking…", "Soch raha hoon…") : stage === "qa" ? t(lang, "Ask me anything", "Kuch bhi poocho") : t(lang, "Your insurance bestie", "Aapka insurance dost")}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <LangToggle lang={lang} setLang={switchLang} />
                  <ThemeToggle />
                </div>
              </div>
              {view === "chat" && (
                <div className="mt-4">
                  <FamilyBar profile={profile} lang={lang} onOpen={() => setProfileOpen(true)} />
                </div>
              )}
            </header>

            <main className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
              {view === "chat" && (
                <Chat
                  messages={messages}
                  typing={typing}
                  chips={chips}
                  multi={step?.multi}
                  max={step?.max}
                  tiles={step?.layout === "tiles"}
                  preselected={step?.id === "priorities" ? prefill : undefined}
                  placeholder={stage === "qa" ? t(lang, "Ask about your plans", "Plans ke baare mein poocho") : t(lang, "Type or say it", "Type karo ya bolo")}
                  lang={lang}
                  footer={readyCard}
                  onChips={onChips}
                  onText={onText}
                  onCitation={(c: Citation) => setSheet({ id: c.policyId, clause: c.clauseId })}
                />
              )}
              {view === "plans" && result && (
                <Plans
                  lang={lang}
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
              {view === "bill" && <Bill key={billFocus} lang={lang} profile={profile} top={top} focusId={billFocus} onOpen={(id, clause) => setSheet({ id, clause })} />}
              {view === "decide" && chosenMatch && <Decide lang={lang} profile={profile} match={chosenMatch} top={top} onSwitch={setChosen} />}
            </main>

            {resultsReady && <TabBar view={view} setView={setView} lang={lang} />}

            {profileOpen && <ProfileSheet profile={profile} lang={lang} onEdit={onEdit} onClose={() => setProfileOpen(false)} />}
            {sheetMatch && (
              <PolicySheet match={sheetMatch} focusClause={sheet?.clause} profile={profile} lang={lang} onClose={() => setSheet(null)} onChoose={() => choose(sheetMatch.policy.id)} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

const TABS: { id: View; label: Record<Lang, string>; icon: IconName }[] = [
  { id: "chat", label: { en: "Ask", hi: "Poocho" }, icon: "chat" },
  { id: "plans", label: { en: "Plans", hi: "Plans" }, icon: "layers" },
  { id: "bill", label: { en: "Bill", hi: "Bill" }, icon: "receipt" },
  { id: "decide", label: { en: "Decide", hi: "Faisla" }, icon: "shield" },
];

/** Floating pill navigation: the active tab expands to show its label. */
function TabBar({ view, setView, lang }: { view: View; setView: (v: View) => void; lang: Lang }) {
  return (
    <div className="shrink-0 px-5 pb-[max(env(safe-area-inset-bottom),14px)] pt-2">
      <nav className="flex items-center justify-between rounded-full bg-primary p-1.5 shadow-e3" aria-label="Sections">
        {TABS.map((t) => {
          const on = view === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setView(t.id)}
              aria-current={on ? "page" : undefined}
              aria-label={t.label[lang]}
              className={`flex h-12 items-center justify-center gap-2 rounded-full transition-all duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${on ? "flex-[1.8] bg-accent px-4 text-white" : "flex-1 text-on-primary/60"}`}
            >
              <Icon name={t.icon} size={20} />
              {on && <span className="rise text-[14px] font-semibold">{t.label[lang]}</span>}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

function summarize(p: Profile, fresh: string[], l: Lang) {
  const hi = l === "hi";
  const bits: string[] = [];
  for (const id of fresh) {
    if (id === "goal") bits.push(hi ? `${coverSummary(p).replace(/ \(\d+\)/g, "")} ko cover karna hai` : `covering ${coverSummary(p).replace(/ \(\d+\)/g, "").toLowerCase()}`);
    if (id === "selfAge" && (p.cover?.self || p.cover?.partner)) bits.push(hi ? `aap ${p.selfAge} ke ho` : `you're ${p.selfAge}`);
    if (id === "parentAge") bits.push(hi ? `elder parent ${p.parentAge} ke hain` : `your elder parent is ${p.parentAge}`);
    if (id === "kids") bits.push(hi ? `${p.kidsCount} bachche` : `${p.kidsCount} kid${p.kidsCount === 1 ? "" : "s"}`);
    if (id === "baby") bits.push(p.planningBaby ? (hi ? "baby plan hai" : "a baby is on the cards") : hi ? "abhi baby plan nahi" : "no baby plans");
    if (id === "conditions") bits.push(p.conditions?.length ? p.conditions.map((c) => CONDITION_LABEL[c]).join(" & ") : hi ? "koi purani bimari nahi" : "no existing conditions");
    if (id === "city") bits.push(p.cityName ?? CITY_LABEL[p.city!].toLowerCase());
    if (id === "employer") bits.push(p.employerCover ? (hi ? `office se ₹${p.employerCover}L cover` : `₹${p.employerCover}L from work`) : hi ? "office cover nahi" : "no cover from work");
    if (id === "budget") bits.push(p.budget ? (hi ? `budget ${inr(p.budget)} tak` : `budget up to ${inr(p.budget)} a year`) : hi ? "budget open hai" : "budget's open");
  }
  if (!bits.length) return hi ? "Samajh gaya." : "Got it.";
  const and = hi ? " aur " : " and ";
  const list = bits.length > 1 ? bits.slice(0, -1).join(", ") + and + bits[bits.length - 1] : bits[0];
  if (hi) return `Samajh gaya: ${list}.${bits.length >= 3 ? " Kaafi sawaal bach gaye." : ""}`;
  return `Got it: ${list}.${bits.length >= 3 ? " That just saved us a few questions." : ""}`;
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

  const promises: { icon: IconName; title: string; body: string }[] = [
    {
      icon: "phoneOff",
      title: t(lang, "No phone number. No spam calls.", "Na phone number, na spam calls."),
      body: t(lang, "Look around all you want, no sign-up.", "Bina sign-up ke jitna marzi dekho."),
    },
    {
      icon: "lock",
      title: t(lang, "Your health stuff stays private", "Health details private rehti hain"),
      body: t(lang, "Never shared with an insurer unless you pick a plan.", "Jab tak aap plan nahi chunte, kisi insurer ko nahi jaati."),
    },
    {
      icon: "doc",
      title: t(lang, "Receipts for every answer", "Har jawaab ka proof"),
      body: t(lang, "Every recommendation links to the exact clause.", "Har suggestion exact clause se linked hai."),
    },
  ];

  return (
    <div className="no-scrollbar relative h-full overflow-y-auto overflow-x-hidden">
      {/* 1. Hero: the layers of your cover, breathing */}
      <section className="relative px-6 pb-4 pt-[max(env(safe-area-inset-top),18px)]">
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-20 h-96 w-96 rounded-full opacity-50 blur-3xl breathe" style={{ background: "radial-gradient(circle, #f49ac1, #ffc6a8 45%, transparent 70%)" }} />
        <div className="relative flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-2">
            <LangToggle lang={lang} setLang={setLang} />
            <ThemeToggle />
          </div>
        </div>
        <div className="relative mt-6 flex justify-center text-ink">
          <SlicedOrb size={250} />
        </div>
        <h1 className="display relative mt-4 text-[46px]">{t(lang, "See what you'd pay. Before you buy.", "Pehle dekho kitna doge. Phir lo.")}</h1>
        <p className="relative mt-5 max-w-[34ch] text-[16px] leading-relaxed text-ink-soft">
          {t(
            lang,
            "Tell us about your family. We run real hospital bills through every plan's fine print and show you the difference. No jargon.",
            "Apni family ke baare mein batao. Hum asli hospital bills ko har plan ke fine print se guzaarte hain aur farak dikhate hain. Bina jargon ke.",
          )}
        </p>
      </section>

      {/* 2. Proof: the same cover, two outcomes */}
      <section className="px-5 pt-8">
        <div className="rounded-[32px] bg-surface p-6 shadow-e2 ring-1 ring-line">
          <p className="text-[13.5px] leading-relaxed text-ink-soft">
            {t(lang, "Mum's knee replacement in Mumbai. Bill:", "Mumbai mein mummy ka knee replacement. Bill:")} <span className="font-semibold text-ink">{inrShort(demo[0].r.bill)}</span>.{" "}
            {t(lang, "Both plans say ₹10 lakh cover.", "Dono plans ₹10 lakh cover bolte hain.")}
          </p>
          <div className="mt-6 grid grid-cols-2 gap-3">
            {demo.map(({ pol, r }) => (
              <div key={pol.id} className={`rounded-[22px] p-4 ${r.youPay ? "bg-owe-soft" : "bg-paid-soft"}`}>
                <p className="text-[12.5px] font-medium">{pol.name}</p>
                <p className="mt-4 text-[11.5px] text-ink-soft">{t(lang, "You pay", "Aap doge")}</p>
                <Money value={r.youPay} className={`mt-1 block text-[30px] ${r.youPay ? "text-owe" : "text-paid"}`} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. Safety */}
      <section className="px-6 pt-10">
        <ul className="space-y-6">
          {promises.map((p) => (
            <li key={p.title} className="flex gap-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
                <Icon name={p.icon} size={19} />
              </span>
              <div>
                <p className="text-[15.5px] font-semibold">{p.title}</p>
                <p className="mt-1 text-[14px] text-ink-soft">{p.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* 4. Action */}
      <section className="px-5 pb-[max(env(safe-area-inset-bottom),28px)] pt-12">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onStart(text.trim() || undefined);
          }}
          className="rounded-[32px] bg-surface p-2.5 shadow-e2 ring-1 ring-line"
        >
          <label htmlFor="intro" className="block px-4 pt-3 text-[13px] font-medium text-ink-soft">
            {t(lang, "Describe your family your way, or skip", "Apne words mein family ke baare mein batao, ya skip karo")}
          </label>
          <textarea
            id="intro"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            placeholder={t(lang, "My mom's 60, has thyroid. Mumbai, budget 40k.", "Meri maa 60 ki hai, unko thyroid hai. Mumbai, budget 40k.")}
            className="w-full resize-none bg-transparent px-4 py-2 text-[16px] outline-none placeholder:text-ink-faint"
          />
          <button className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-[18px] text-[16px] font-semibold text-on-primary shadow-e2">
            {text.trim() ? t(lang, "Find my plans", "Mere plans dhoondo") : t(lang, "Let's go", "Chalo shuru karein")}
            <Icon name="arrow" size={18} />
          </button>
        </form>
        <p className="mt-8 text-center text-[13px] text-ink-faint">{t(lang, "Or try it with a sample family", "Ya kisi sample family ke saath try karo")}</p>
        <div className="no-scrollbar -mx-5 mt-3 flex gap-2.5 overflow-x-auto px-5">
          {PERSONAS[lang].map((p) => (
            <button key={p.who} onClick={() => onStart(p.text)} className="shrink-0 rounded-[22px] bg-surface px-4 py-3.5 text-left shadow-e1 ring-1 ring-line">
              <span className="block text-[14px] font-semibold">{p.who}</span>
              <span className="mt-0.5 block text-[12.5px] text-ink-soft">{p.what}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
