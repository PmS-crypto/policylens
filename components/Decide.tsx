"use client";

import { useState } from "react";
import { coverStartsAfterDays, coverStartsAfterMonths } from "@/lib/dates";
import { CONDITION_LABEL, inr, parentsShort } from "@/lib/profile";
import type { Lang } from "@/lib/ai";
import { t } from "@/lib/flow";
import { headlineScenario, headlineSentence, simulate } from "@/lib/simulate";
import type { Match, Profile } from "@/lib/types";
import { AURA, Aura, Icon, Money, ReasonRow, SlicedOrb, inrShort } from "./ui";

// Waits measured in days (the 30-day initial wait) vs months (everything else).
const addMonths = (months: number) => (months === 1 ? coverStartsAfterDays(30) : coverStartsAfterMonths(months));

export default function Decide({ lang, profile, match, top, onSwitch }: { lang: Lang; profile: Profile; match: Match; top: Match[]; onSwitch: (id: string) => void }) {
  const p = match.policy;
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const [handoff, setHandoff] = useState(false);
  const conds = (profile.conditions ?? []).map((c) => CONDITION_LABEL[c]);

  const timeline = [
    { m: 0, what: t(lang, "Accidents covered", "Accident cover") },
    { m: 1, what: t(lang, "New illnesses covered", "Nayi bimariyan cover") },
    ...(conds.length ? [{ m: p.pedWaitYears * 12, what: t(lang, `${conds.join(" & ")} covered`, `${conds.join(" & ")} cover`) }] : []),
    { m: p.specificWaitYears * 12, what: t(lang, "Planned surgeries like cataract or knee", "Cataract, knee jaisi planned surgery") },
    ...(p.maternity.covered && (profile.planningBaby || profile.cover?.partner) ? [{ m: (p.maternity.waitYears ?? 0) * 12, what: t(lang, "Maternity covered", "Maternity cover") }] : []),
  ]
    .sort((a, b) => a.m - b.m)
    .map((x) => ({ ...x, when: x.m === 0 ? t(lang, "Day one", "Pehle din se") : addMonths(x.m) }));

  // The checklist is a real sequence, so it's numbered.
  const checklist = [
    {
      title: t(lang, "Be honest on the form", "Form pe sach batao"),
      body: conds.length
        ? t(lang, `Mention ${conds.join(", ")}. Hiding it is a top reason claims get rejected.`, `${conds.join(", ")} zaroor likho. Chhupane se claims reject hote hain.`)
        : t(lang, "Answer every health question, even the small ones.", "Har health sawaal ka jawaab do, chhote wale bhi."),
    },
    {
      title: t(lang, "Check your hospital", "Apna hospital check karo"),
      body: t(lang, `Make sure your go-to hospital${profile.cityName ? ` in ${profile.cityName}` : ""} is cashless.`, `Dekh lo ki aapka hospital${profile.cityName ? ` ${profile.cityName} mein` : ""} cashless hai.`),
    },
    {
      title: t(lang, "Get room rules in writing", "Room rules likhwa lo"),
      body: t(lang, `Ask the insurer to confirm §${p.clauses.find((c) => c.id === "room")?.section} in writing.`, `Insurer se §${p.clauses.find((c) => c.id === "room")?.section} likhit mein confirm karwa lo.`),
    },
    { title: t(lang, "Know your free look", "Free look yaad rakho"), body: t(lang, "You get 30 days to cancel for a full refund.", "30 din mein cancel karke poora refund le sakte ho.") },
  ];
  const doneCount = checklist.filter((_, i) => checked[i]).length;

  // Job 5, "Am I making the right decision?": the choice argued against each alternative, in rupees.
  const head = headlineScenario(profile);
  const payOn = (m: Match) => simulate(m.policy, m.sumInsured, profile, head.scenario, { year: head.year, room: "private" }).youPay;
  const mine = payOn(match);
  const versus = top
    .filter((o) => o.policy.id !== p.id)
    .map((o) => {
      const dPremium = match.premium - o.premium;
      const dClaim = payOn(o) - mine;
      let verdict: string;
      if (dPremium <= 0 && dClaim >= 0) verdict = t(lang, "Costs less and pays more on that trip. Easy win.", "Sasta bhi, aur us trip pe zyada bhi deta hai. Seedha jeet.");
      else if (dPremium > 0 && dClaim > 0) {
        const ratio = dClaim / dPremium; // years of extra premium that one such stay saves
        verdict =
          ratio >= 1
            ? t(lang, `One trip like this covers ${ratio.toFixed(1)} years of the extra premium.`, `Aisa ek trip extra premium ke ${ratio.toFixed(1)} saal cover kar deta hai.`)
            : t(lang, `The extra premium only pays off if this happens about ${Math.max(2, Math.round(1 / ratio))} times a year.`, `Extra premium tabhi vasool hoga jab yeh saal mein lagbhag ${Math.max(2, Math.round(1 / ratio))} baar ho.`);
      } else if (dPremium < 0 && dClaim < 0) verdict = t(lang, `Cheaper premium, but you'd pay ${inrShort(-dClaim)} more if that trip happens.`, `Premium sasta hai, par woh trip hua toh ${inrShort(-dClaim)} zyada doge.`);
      else verdict = t(lang, "Costs more and pays less on that trip. Only pick it for its other perks.", "Mehenga bhi, aur us trip pe kam bhi deta hai. Sirf baaki fayde ke liye lo.");
      return { o, dPremium, dClaim, verdict };
    });
  // The proud moment: what the user has now secured, in their family's words.
  const forParents = !!profile.cover?.parents;
  const who = forParents ? parentsShort(profile) : "Your";
  const pedDate = conds.length ? addMonths(p.pedWaitYears * 12) : null;
  const headPay = simulate(match.policy, match.sumInsured, profile, head.scenario, { year: head.year, room: "private" });
  const proudLine = pedDate
    ? `${who === "Your" ? "Your" : `${who}'s`} ${conds.join(" and ").toLowerCase().replace(/\bbp\b/, "BP")} covered from ${pedDate}.`
    : "You now understand this plan better than most people understand their own.";

  const [shared, setShared] = useState<string | null>(null);
  const share = async () => {
    const text = t(
      lang,
      `Found a plan for ${forParents ? "Mum and Dad" : "us"}: ${p.insurer} ${p.name}, ₹${match.sumInsured} lakh cover for about ${inr(match.premium)} a year. ${pedDate ? proudLine + " " : ""}${headlineSentence(profile, "en")}, it pays ${inr(headPay.insurerPays)} of the ${inr(headPay.bill)} bill. Compared clause by clause on PolicyLens. What do you think?`,
      `${p.insurer} ${p.name} soch raha hoon apne liye: ₹${match.sumInsured} lakh cover, lagbhag ${inr(match.premium)} saal ka. ${headlineSentence(profile, "hi")}, toh hum ${inr(mine)} denge. PolicyLens pe compare kiya. Kya bolte ho?`,
    );
    try {
      if (navigator.share) await navigator.share({ title: "Our health insurance choice", text });
      else {
        await navigator.clipboard.writeText(text);
        setShared(t(lang, "Copied. Drop it in the family group.", "Copy ho gaya. Family group mein daal do."));
      }
    } catch {
      /* the user closed the share sheet */
    }
  };
  const goods = match.reasons.filter((r) => r.kind === "good");
  const caveats = match.reasons.filter((r) => r.kind !== "good");

  return (
    <div className="pb-12">
      <header className="relative overflow-hidden px-6 pt-6">
        <div className="absolute -right-16 -top-6 text-ink opacity-90" aria-hidden>
          <SlicedOrb size={190} />
        </div>
        <p className="relative text-[13px] font-medium text-accent">{t(lang, "Am I making the right call?", "Kya main sahi decision le raha hoon?")}</p>
        <h1 className="display relative mt-2 max-w-[9ch] text-[42px]">{p.name}</h1>
        <p className="relative mt-3 text-[15px] text-ink-soft">{p.insurer}</p>
        <div className="relative mt-6 flex gap-8">
          <div>
            <Money value={match.premium} className="text-[34px]" />
            <p className="mt-1 text-[12.5px] text-ink-soft">{t(lang, "a year, roughly", "saal ka, lagbhag")}</p>
          </div>
          <div>
            <span className="money text-[34px]">₹{match.sumInsured}L</span>
            <p className="mt-1 text-[12.5px] text-ink-soft">cover</p>
          </div>
        </div>
        {top.length > 1 && (
          <div className="no-scrollbar relative mt-6 flex gap-2 overflow-x-auto">
            {top.map((m) => (
              <button key={m.policy.id} onClick={() => onSwitch(m.policy.id)} className={`shrink-0 rounded-full px-4 py-2.5 text-[13px] transition-all ${m.policy.id === p.id ? "bg-primary text-on-primary shadow-e2" : "bg-surface shadow-e1 ring-1 ring-line"}`}>
                {m.policy.name}
              </button>
            ))}
          </div>
        )}
      </header>

      <Aura colors={AURA.mint} scrim className="rise relative mx-5 mt-8 rounded-[32px] p-6 text-white shadow-e2">
        <p className="text-[13px] font-medium opacity-85">{t(lang, "You've done the hard part", "Mushkil kaam ho gaya")}</p>
        <p className="title mt-2 text-[24px] leading-tight">{proudLine}</p>
        <p className="mt-3 text-[14px] leading-relaxed opacity-90">
          {headlineSentence(profile, "en")}, {p.name} pays {inrShort(headPay.insurerPays)} of the {inrShort(headPay.bill)} bill.
        </p>
      </Aura>

      {versus.length > 0 && (
        <section className="mx-5 mt-8 rounded-[32px] bg-surface p-6 shadow-e1 ring-1 ring-line">
          <h2 className="title text-[20px]">{t(lang, "Why this one, not the others", "Yahi kyun, baaki kyun nahi")}</h2>
          <p className="mt-2 text-[13.5px] leading-relaxed text-ink-soft">
            {headlineSentence(profile, lang)}, {t(lang, `you'd pay ${inrShort(mine)} on ${p.name}.`, `toh ${p.name} pe aap ${inrShort(mine)} doge.`)}
          </p>
          <ul className="mt-5 space-y-3">
            {versus.map(({ o, dPremium, dClaim, verdict }) => (
              <li key={o.policy.id} className="rounded-[22px] bg-surface-2 p-4">
                <p className="text-[13px] text-ink-soft">{t(lang, "vs", "vs")} {o.policy.name}</p>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <div>
                    <Money value={Math.abs(dPremium)} text={`${dPremium > 0 ? "+" : "−"}${inrShort(Math.abs(dPremium))}`} className={`block text-[24px] ${dPremium > 0 ? "text-owe" : "text-paid"}`} />
                    <p className="text-[12px] text-ink-soft">{dPremium > 0 ? t(lang, "more a year", "saal ka zyada") : t(lang, "less a year", "saal ka kam")}</p>
                  </div>
                  <div>
                    <Money value={Math.abs(dClaim)} text={`${dClaim >= 0 ? "−" : "+"}${inrShort(Math.abs(dClaim))}`} className={`block text-[24px] ${dClaim >= 0 ? "text-paid" : "text-owe"}`} />
                    <p className="text-[12px] text-ink-soft">{dClaim >= 0 ? t(lang, "less on that hospital trip", "us hospital trip pe kam") : t(lang, "more on that hospital trip", "us hospital trip pe zyada")}</p>
                  </div>
                </div>
                <p className="mt-3 text-[13px] leading-relaxed">{verdict}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mx-5 mt-5 rounded-[32px] bg-surface p-6 shadow-e1 ring-1 ring-line">
        <h2 className="title text-[20px]">{t(lang, "What you get", "Kya milega")}</h2>
        <ul className="mt-5 space-y-6">{goods.map((r) => <ReasonRow key={r.title} r={r} />)}</ul>
        <h2 className="title mt-10 text-[20px]">{t(lang, "What you're signing up for", "Kya compromise hai")}</h2>
        <ul className="mt-5 space-y-6">{caveats.length ? caveats.map((r) => <ReasonRow key={r.title} r={r} />) : <p className="text-[14px] text-ink-soft">{t(lang, "Nothing big for your family.", "Aapki family ke liye kuch bada nahi.")}</p>}</ul>
      </section>

      <Aura colors={AURA.calm} scrim className="relative mx-5 mt-5 rounded-[32px] p-6 text-white">
        <h2 className="title text-[20px]">{t(lang, "If you buy today", "Agar aaj lete ho")}</h2>
        <ol className="mt-6 space-y-5">
          {timeline.map((t, i) => (
            <li key={i} className="grid grid-cols-[96px_minmax(0,1fr)] items-baseline gap-3">
              <span className="money text-[22px]">{t.when}</span>
              <span className="text-[14px] leading-snug opacity-90">{t.what}</span>
            </li>
          ))}
        </ol>
        <p className="mt-6 text-[13px] leading-relaxed opacity-85">{t(lang, "Waiting periods only start the day you buy. Every month you wait moves these dates back.", "Waiting period usi din se shuru hota hai jis din policy lete ho. Har mahina late matlab yeh dates aage khisak jaati hain.")}</p>
      </Aura>

      <section className="mt-10 px-6">
        <div className="flex items-baseline justify-between">
          <h2 className="title text-[20px]">{t(lang, "Before you pay", "Pay karne se pehle")}</h2>
          <span className="text-[13px] text-ink-soft">
            {doneCount === checklist.length ? t(lang, "All set", "Sab ready") : `${doneCount}/${checklist.length} ${t(lang, "done", "ho gaya")}`}
          </span>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          {checklist.map((c, i) => {
            const on = !!checked[i];
            return (
              <button
                key={c.title}
                onClick={() => setChecked({ ...checked, [i]: !on })}
                aria-pressed={on}
                className={`flex min-h-[168px] flex-col rounded-[26px] p-4 text-left transition-all duration-300 ${on ? "bg-accent text-white shadow-e2" : "bg-surface shadow-e1 ring-1 ring-line"}`}
              >
                <span className="flex items-start justify-between">
                  <span className={`money text-[30px] ${on ? "" : "text-ink-faint"}`}>0{i + 1}</span>
                  <span className={`grid h-6 w-6 place-items-center rounded-full ${on ? "bg-white text-accent" : "ring-1 ring-line"}`}>{on && <Icon name="check" size={13} stroke={2.8} />}</span>
                </span>
                <span className="title mt-auto block text-[15px]">{c.title}</span>
                <span className={`mt-1 block text-[12.5px] leading-snug ${on ? "opacity-85" : "text-ink-soft"}`}>{c.body}</span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="mt-8 space-y-3 px-6">
        {doneCount === checklist.length && (
          <p className="rise rounded-[22px] bg-paid-soft px-5 py-4 text-center text-[15px] font-medium text-paid">
            {forParents ? "You're ready. Go get Mum and Dad covered." : "You're ready. Go get your family covered."}
          </p>
        )}
        <button onClick={() => setHandoff(true)} className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-5 text-[16px] font-semibold text-on-primary shadow-e2">
          {t(lang, `Continue to ${p.insurer}`, `${p.insurer} pe chalo`)}
          <Icon name="arrow" size={18} />
        </button>
        {handoff && (
          <p className="rise rounded-[24px] bg-surface p-5 text-[14px] leading-relaxed shadow-e1 ring-1 ring-line">
            {t(
              lang,
              `In the live app this opens ${p.insurer}'s buy page through an IRDAI-authorised partner, details pre-filled. You just do the medical declaration and pay.`,
              `Live app mein yeh IRDAI-authorised partner ke through ${p.insurer} ka buy page kholega, details pehle se bhari hongi. Aapko bas medical declaration aur payment karna hai.`,
            )}
          </p>
        )}
        <button onClick={share} className="flex w-full items-center justify-center gap-2 rounded-full py-4 text-[14.5px] font-medium ring-1 ring-line">
          <Icon name="people" size={17} />
          {t(lang, "Tell the family", "Family ko batao")}
        </button>
        {shared && <p className="text-center text-[13px] text-ink-soft">{shared}</p>}
        <button className="flex w-full items-center justify-center gap-2 rounded-full py-4 text-[14.5px] font-medium ring-1 ring-line">
          <Icon name="advisor" size={17} />
          {t(lang, "Talk to a real advisor, free", "Asli advisor se baat karo, free")}
        </button>
      </div>
      <p className="mt-8 px-6 text-[12.5px] leading-relaxed text-ink-soft">
        {t(
          lang,
          "PolicyLens explains policy wording to help you decide. It isn't underwriting advice or a promise that a claim will be paid. Plans and prices here are illustrative.",
          "PolicyLens policy wording samjhata hai taaki aap decide kar sako. Yeh underwriting advice ya claim ki guarantee nahi hai. Yahan ke plans aur prices sirf example hain.",
        )}
      </p>
    </div>
  );
}
