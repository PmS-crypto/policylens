# PolicyLens: insurance that understands you

An AI health-insurance advisor that starts with the person, not the product. It finds policies that fit, explains why using the actual clauses, and shows what you would really pay when something goes wrong.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
```

**AI keys are optional.** Without a key, a deterministic rules engine handles extraction, Q&A and explanations, so the demo never breaks on stage. To turn on the LLM layer, create `.env.local` with either key:

```
SARVAM_API_KEY=...         # Sarvam AI, Indian LLM; uses sarvam-105b-conversations for speed (set SARVAM_MODEL=sarvam-105b for deeper reasoning)
ANTHROPIC_API_KEY=...      # uses claude-sonnet-5-5 (override with ANTHROPIC_MODEL)
OPENAI_API_KEY=...         # uses gpt-4o-mini (override with OPENAI_MODEL)
```

## The journey

| Step | What happens | Where |
|---|---|---|
| 1. Discover | You describe your situation in plain words, or tap through adaptive questions. The AI pulls out every fact it can and skips questions already answered. Short "Worth knowing" explainers appear right when they're relevant. | `app/page.tsx`, `lib/flow.ts`, `/api/extract` |
| 2. Profile | A live, editable profile plus a recommended sum insured, with the reasons for it. | `components/ProfilePanel.tsx` |
| 3. Match | 6 policies go through eligibility checks, then get scored against your priorities. You get a shortlist of 3 (best fit, budget pick, max protection). Every reason links to its source clause, and there's no made-up universal score. | `lib/match.ts`, `components/Matches.tsx` |
| 4. Understand | A clause-level comparison, a fine-print radar, and "Ask this policy" Q&A that cites clause numbers. | `components/Compare.tsx`, `PolicyDrawer.tsx`, `/api/ask` |
| 5. **Reality Check** ⭐ | Run a real-life scenario (dengue, knee replacement, a diabetes complication, C-section…) through each policy's rules: waiting periods, room-rent proportionate deduction, co-pay, sub-limits, consumables. You see exactly what you'd pay out of pocket, line by line. | `lib/simulate.ts`, `components/RealityCheck.tsx` |
| 6. Decide | What you're getting vs. what you're accepting, a personal coverage timeline ("Dad's diabetes covered from Oct 2027"), a pre-purchase checklist, and a hand-off to the insurer or an advisor. | `components/Decide.tsx` |

## Design principles

- **The AI never invents facts.** The LLM extracts the profile and rewrites engine output into plain language. Matching, pricing and claim simulation are deterministic and traceable to clauses.
- **Headline cover ≠ usable protection.** Reality Check makes that visible in rupees.
- **Trust is a feature.** Every claim shows its source (§ section, document version, verified date).

## Mobile app (PWA)

PolicyLens is a mobile-first progressive web app. On a phone, open the URL and choose **Add to Home Screen** to install it. On a laptop it renders inside a phone frame for demos.

- **Design language ("Aura"):** a grainy, breathing gradient is the AI's presence and the stand-in for protection. A sliced gradient orb (layers of cover) is the hero illustration. Archivo on its width axis: expanded for headlines, condensed for rupee amounts. Ultraviolet accent, mint for paid, coral for you pay.
- **Light and dark mode:** follows the phone's setting, with a toggle in the header. The bill stays printed paper in both.
- **Motion:** breathing orb (faster while thinking), messages rising in, amounts counting up, the bill printing out of a slot, a stamp thud, a floating pill tab bar. All of it is disabled under the reduced-motion setting.
- **Your bill (signature screen):** every plan rendered as an itemised hospital bill. Deductions are struck through and tagged with their clause, and each bill ends in a stamp: "Paid in full", "90% paid" or "Not covered yet".
- **Plans lead with what you'd pay**, not with the premium. The ranking includes that headline outcome.
- **People first:** the chat starts with family tiles, and you can speak your answers (voice input in Chrome/Android).
- **English / हिंदी toggle:** Sarvam answers, explanations and acknowledgements in Hindi.

## 3-minute demo script

1. Landing page: two bills, same ₹10L cover, ₹0 vs ₹2,90,000. That's the problem in one glance.
2. Tap **Riya, 29**. One sentence fills the profile, and "Fine print, decoded" warnings appear at the right moment.
3. Pick priorities, then **Show my plans**. Swipe the cards. Each leads with "If your parent is admitted for a diabetes complication next year, you'd pay ₹18,000".
4. Open **Your bill**. Switch plans and years and watch the stamp flip to "Not covered yet". Tap a highlighted § to read the clause.
5. Switch to **हिंदी** and ask "papa ki diabetes kab cover hogi?" in Ask.
6. **Decide**: coverage timeline, then the checklist.

## Prototype caveats

The insurers, clauses and premiums are fictional, modelled on typical Indian retail health policy wording. In production they would be replaced by parsed, versioned insurer documents. Nothing here is underwriting advice or a guarantee that a claim will be paid.
