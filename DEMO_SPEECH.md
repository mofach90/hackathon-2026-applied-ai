# RentPilot AI — 2-Minute Demo Script

> **Total time:** ~110 seconds. Practice once before going live.
> **App URL:** http://localhost:3000

---

## PART 1 — THE PITCH (30 sec, NO screen needed)

> *Stand confident, no clicking yet.*

"Property managers today handle rent failures manually —
chasing tenants by phone, writing notices by hand, hoping they don't break any tenancy law.
It's slow, inconsistent, and biased.

**RentPilot AI changes that.**

Our platform deploys an autonomous AI agent that detects every missed payment,
reasons through the right action, checks it against German tenancy law,
audits for demographic bias — and executes — in seconds, not days.

Let me show you."

---

## PART 2 — DASHBOARD (15 sec)

> *Navigate to http://localhost:3000*

"This is the live dashboard.
Three active cases — three tenants, three different situations.
The agent already acted on each one autonomously."

---

## PART 3 — CASE DETAIL: MIKE SCHMIDT (40 sec)

> *Click on **Mike Schmidt** (formal notice case)*

"Mike Schmidt — 18 days overdue, third missed payment.

Look at the **reasoning chain** — the agent didn't just act.
It documented every step: why a soft reminder is no longer appropriate,
why a Level 1 Mahnung is legally required,
and how it verified the 14-day spacing rule before sending anything.

See the **Compliance badge** — green, all rules pass.
German tenancy law, contact hours, notice spacing — all checked automatically.

See the **Fairness badge** — bias-free.
The agent ran a counterfactual: *'Would it have acted differently for a different name or nationality?'*
Answer: No. Same outcome. Zero demographic bias."

---

## PART 4 — FAIRNESS AUDIT LIVE (15 sec)

> *Click "Run Fairness Audit" button in the Demographic Fairness section*

"Watch this — we're re-running the decision right now
with a swapped demographic profile.
Same financial situation, different name and language.
The AI returns the same action. **Proven fair.**"

---

## PART 5 — CLOSE (10 sec)

> *Step back from screen.*

"Every missed payment. Every tenant. Handled in seconds.
Legally compliant. Demographically audited. Fully explainable.

**This is RentPilot AI.**"

---

## SCENARIO CHEAT SHEET

| Step | Action | What to say |
|------|--------|-------------|
| 1 | Open http://localhost:3000 | "Live dashboard, 3 active cases" |
| 2 | Click **Mike Schmidt** | "18 days overdue, 3rd missed payment" |
| 3 | Point at Reasoning Chain | "Every decision is explainable, step by step" |
| 4 | Point at Compliance badge | "German tenancy law — automatically verified" |
| 5 | Point at Fairness badge | "Counterfactual bias check — passed" |
| 6 | Click Run Fairness Audit | "Same outcome for any demographic — proven fair" |

---

## BACKUP — if Fairness Audit is slow (Gemini rate limit)

> If the audit spinner runs > 10 sec, don't wait. Say:

*"The live audit is running in the background — you can see it already passed
in the fairness badge from the initial analysis. The real-time check
re-runs the full decision engine with a swapped demographic profile."*

Then move to the close.
