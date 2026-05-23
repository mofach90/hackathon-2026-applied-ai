# RentPilot AI

> **Autonomous payment operations for property management.**

> [!IMPORTANT]
> This is the source of truth for project scope, demo story, and architecture.
> Future Claude Code sessions and other agents should read this file **before**
> making any changes. The root `README.md` intentionally stays brief and points here.

---

## Status

| Field | Value |
|---|---|
| Committed scope | Full multi-party flow (tenant + vendor + landlord) |
| Stretch goal | ElevenLabs voice agent for silent tenants |
| Team | Mohamed Ayari, Aymen |
| Hackathon | hallo theo Applied AI Hackathon, Berlin |
| Track | Stripe — Autonomous Payment Operations |
| Track prize | $5,000 USD in Stripe fee credits |
| Submission deadline | Sunday 24 May 2026, 14:00 (Berlin) |
| Deliverables | 2-minute Loom demo video + public GitHub repo with README |

---

## Hackathon Context

The Stripe track challenges teams to build "set-and-forget" finance infrastructure
for property operations. Money moves between three parties: **tenants → platform →
landlords + vendors**.

The full track brief (verbatim) is in
`docs/brainstorm/2026-05-23-hackathon-brief.md`.

### Track bonus points — this project hits all three

1. AI-driven risk detection (late payer prediction, anomalies)
2. Dynamic payment plans or negotiation flows
3. Reconciliation automation across multiple parties

---

## Problem

Property management payments today are fragmented, manual, and error-prone:

- **Tenants** pay late or partially. Property managers chase via email, WhatsApp, phone, tickets.
- **Vendors** (plumbers, cleaners, electricians) need invoice verification and timely payouts.
- **Landlords** want net rent disbursed automatically — without doing fee math themselves.
- A single missed rent payment can eat **5+ hours of manual work** per property manager per month.

---

## Solution

**RentPilot AI** is an autonomous payment operations agent. It runs the full money
lifecycle for a property management business with **human-like judgment** that
operates **inside a hard frame of legal compliance and fairness guardrails**.

It does four things:

1. **Smart rent collection** — detects late payments, predicts risk, runs personalized multi-channel outreach.
2. **Dynamic plan negotiation** — when a tenant cannot pay full, the AI negotiates a plan based on the tenant's full context, not a static policy.
3. **Vendor payouts** — verifies invoices against open work orders, auto-pays via Stripe Connect.
4. **Landlord disbursement** — auto-transfers net rent (minus management fee) to landlord accounts.

Every decision shows its **chain of reasoning** in the UI, alongside its
**compliance check** and **fairness check** — so the property manager (and the
hackathon judges) can see *why* the agent did what it did, *and* that it didn't
break the law or discriminate.

---

## The Three Pillars of AI Value

This is the answer to the hallo theo team's (correct) challenge:
*"if it's just if-statements on metrics, where's the AI value?"*

A rules engine fundamentally cannot do these three things — only an LLM agent can.

### Pillar 1 — Reads unstructured data

A rules engine sees `days_late = 5, prior_late_count = 0`. That's it.

The agent **also** reads:
- Tenant's last 10 support chats (sentiment, tone, life events mentioned)
- Email threads with the landlord (relationship temperature, prior negotiations)
- WhatsApp / SMS history (cultural cues, language switching, urgency)
- Onboarding form free-text (what the tenant disclosed)
- Voice transcripts (stretch: via ElevenLabs)

No rules engine can extract *"this tenant mentioned losing their job in a support
chat 2 weeks ago"* and weight it against their otherwise-perfect history.

### Pillar 2 — Weighs conflicting multi-source signals

Rules engines collapse when signals conflict. The agent shines exactly there:

| Tenant | Days late | History | Support tone | Landlord relationship | Right action |
|---|---|---|---|---|---|
| A | 5 | perfect | grateful | warm | soft nudge |
| B | 5 | perfect | angry recent tickets | landlord complaints | escalate sooner |
| C | 5 | 1 prior late | mentioned job loss | cooperative | extended 4-installment plan |
| D | 5 | perfect | silent | none yet | friendly check-in |

Same `days_late`. Four different right answers. This is what LLM judgment is for.

### Pillar 3 — Operates within a hard compliance frame

The agent is **constrained** by two policy layers it cannot bypass:

- **Legal compliance** — German rental law (BGB §286, Mahnverfahren rules, late-fee caps, contact-hour limits). Detail: `docs/brainstorm/2026-05-23-compliance-and-audit.md`.
- **Fairness compliance** — 5-layer bias defense (input redaction, reasoning constraints, output guardrails, counterfactual checks, audit). Detail: `docs/brainstorm/2026-05-23-bias-and-fairness.md`.

Every proposed action passes through both layers. If either fails, the action is
blocked and the agent must pick an alternative. The system is **safe by
construction**.

---

## The Personas (the demo cast)

| Tenant | Context | Agent reasoning | Action |
|---|---|---|---|
| **Amina** | 18-month perfect history, never late before; warm landlord emails; cooperative chats | "Trustworthy. Soft signals reinforce good faith. Soft nudge." | Warm bilingual nudge. If asked, generous plan. |
| **Mike** | Chronic late payer, ghosted 2 prior reminders; angry support tickets; broken prior plan | "Pattern → enforcement time within Mahnverfahren rules." | Late fee, formal notice, escalate to human. |
| **Sara** | 1st-month tenant, no signal yet; polite onboarding | "Low signal → benefit of the doubt." | Friendly check-in, offer help with payment setup. |

These three drive the demo. A 4th persona (TBD) covers the conflicting-signals case.

---

## The Responsibility Frame

Two commitments that distinguish us from naive AI-action systems.

### Legal compliance

The agent's actions are validated against German rental law before execution:

- **Mahnverfahren rules** (BGB §286) — order, timing, and content of formal reminders
- **Late-fee caps** (typically ≤5% of monthly rent)
- **Permitted contact hours** (08:00–20:00 local)
- **Required content** for formal notices (amount, deadline, consequences)
- **Mandatory language match** to tenant's lease language (defensibility)

Full detail in `docs/brainstorm/2026-05-23-compliance-and-audit.md`.

### Fairness compliance

We explicitly do **NOT** claim the AI is bias-free. We **DO** claim a multi-layer defense:

1. **Input redaction** — agent never sees name, ethnicity, language, neighborhood, religion. Only behavioral signals and PII-redacted excerpts.
2. **Reasoning constraints** — decisions must be justified by behavioral signals only; reasoning that references protected attributes is rejected.
3. **Output guardrails** — eviction-class actions always go to human review.
4. **Counterfactual checks** — name-swap test: swap Amina → Anna, the decision and reasoning chain must be byte-identical.
5. **Audit + HITL** — every decision logged; escalations require human review.

Full detail in `docs/brainstorm/2026-05-23-bias-and-fairness.md`.

**Honest framing for the pitch:** we have multiple layers of defense, not a guaranteed bias-free system. The honesty is itself credibility.

---

## Demo Flow (target: 2-minute Loom + 5-minute live pitch)

1. **Landlord dashboard opens.** Headline: *"12 tenants late this month. Agent recovered €4,200 this week. 1 anomaly needs your eyes. Every action compliance-checked and audit-trailed."*
2. **Tenant Amina (cooperative case).** Click in. Reasoning chain shows the agent reading:
   - *Support ticket #4729 — tenant asked about lease renewal. Strong retention signal.*
   - *Email thread with landlord — warm, thank-you note from March.*
   - *Decision:* `soft_nudge` via email in French.
   - *Compliance check:* ✅ within send hours · ✅ first reminder this cycle · ✅ language matches preference.
   - *Fairness check:* ✅ counterfactual passes (Amina decision ≡ Anna baseline).
   Agent sends warm bilingual nudge. Amina replies *"€600 today, €600 next Friday."* Agent negotiates the plan. **Stripe Billing creates 2 invoices.** First installment paid via Checkout.
3. **Tenant Mike (enforcement case).** Same event. Reasoning chain reads chronic patterns + ignored reminders + angry support ticket. Decision: `late_fee_warning` + `formal_notice` + `escalate_human`. Compliance check: ✅ 8 days past Verzug · ✅ prior reminder 14 days ago · ✅ fee within BGB cap. Fairness check: ✅.
4. **Fairness counterfactual moment.** Click "Run fairness check on all 3 personas." Names swap (Amina → Anna, Mike → Mehmet, Sara → Sarah). Decisions and reasoning chains remain identical. **30-second wow moment.**
5. **Vendor flow.** Invoice from "Berlin Plumbing GmbH" arrives. Agent verifies against work order. **Auto-pays via Stripe Connect Transfer.**
6. **Landlord disbursement.** End-of-week sweep. Agent auto-transfers net rent minus 8% management fee via Stripe Connect.
7. **Closing shot.** All on one screen. All autonomous. All audit-trailed. The property manager has touched nothing.

---

## Stripe Products Used

| Product | What we use it for |
|---|---|
| **Stripe Payments** | Tenant rent collection (Checkout, Payment Links) |
| **Stripe Billing** | Recurring rent invoices + dynamic payment plans |
| **Stripe Connect** | Landlords + vendors as Connect Express accounts |
| **Stripe Payouts / Transfers** | Vendor payouts, landlord disbursements |
| **Stripe Webhooks** | Event-driven agent triggers |
| **Stripe Sigma** *(optional)* | Analytics dashboard. Can be faked on a slide if time-tight. |

Charge pattern: **separate charges & transfers** (platform holds, then disburses). Details in `docs/brainstorm/2026-05-23-stripe-data-model.md`.

---

## Architecture Sketch (high level)

```
┌──────────────────┐       ┌──────────────────┐
│  Tenant UI       │       │  Landlord        │
│  (pay + plan)    │       │  Dashboard       │
└────────┬─────────┘       └────────┬─────────┘
         │                          │
         ▼                          ▼
┌────────────────────────────────────────────┐
│             RentPilot Backend              │
│                                            │
│  ┌─────────────────────────────────────┐   │
│  │  Context Builder + PII Redactor     │   │
│  │  - pulls structured + unstructured  │   │
│  │  - redacts protected attributes     │   │
│  └────────────────┬────────────────────┘   │
│                   ▼                        │
│  ┌─────────────────────────────────────┐   │
│  │  Agent Orchestrator (Claude API)    │   │
│  │  - reasons over context             │   │
│  │  - picks action + reasoning chain   │   │
│  └────────────────┬────────────────────┘   │
│                   ▼                        │
│  ┌─────────────────────────────────────┐   │
│  │  Compliance + Fairness Policy Layer │   │
│  │  (German rental law + bias defense) │   │
│  │  - validates; blocks if violation   │   │
│  └────────────────┬────────────────────┘   │
│                   ▼                        │
│  ┌─────────────────────────────────────┐   │
│  │  Action Dispatcher                  │   │
│  │  - Stripe Adapter                   │   │
│  │  - Channel Adapter (Resend / SMS)   │   │
│  └─────────────────────────────────────┘   │
│                                            │
│  ┌─────────────────────────────────────┐   │
│  │  Audit Log (agent_case table)       │   │
│  │  - every step persisted as JSONB    │   │
│  └─────────────────────────────────────┘   │
└────────────────────────────────────────────┘
         │
         ▼
┌──────────────────┐
│  Stripe (sandbox)│
└──────────────────┘
```

### Proposed stack

- **Frontend:** Next.js (App Router) + Tailwind + shadcn/ui
- **Backend:** Next.js API routes (consolidates infra for hackathon timeline)
- **Database:** Supabase (Postgres). Fallback to JSON seed data for the demo.
- **AI:** Claude API via Anthropic SDK
- **Payments:** Stripe SDK (Node), `stripe` CLI for webhook tunneling
- **Email:** Resend (free tier)

Decisions about the stack belong in `docs/adr/` as ADRs.

---

## MVP Scope

### In scope (must-have for submission)

- [ ] Tenant payment page (incl. "I can't pay full rent" entry)
- [ ] Live agent reasoning UI (chain-of-thought visible to user/judges)
- [ ] **Live compliance check display** (BGB §286 check, send-hours check, etc.)
- [ ] **Live fairness check + counterfactual demo** (name-swap moment)
- [ ] **PII redaction step** before context reaches the agent
- [ ] 3 seeded tenant personas (Amina, Mike, Sara) with structured + unstructured data (chat logs, email threads)
- [ ] Late-detection trigger + multi-channel outreach (email; SMS optional)
- [ ] Dynamic plan negotiation flow (LLM, not rules)
- [ ] Stripe Billing plan creation + first installment via Checkout
- [ ] Vendor invoice verification + auto-payout via Stripe Connect Transfer
- [ ] Landlord dashboard (recent activity, money flow, anomalies, audit trail)
- [ ] Auto-disbursement to landlord (net of fee)
- [ ] 2-min Loom video demo
- [ ] Public GitHub repo + comprehensive README

### Out of scope (explicitly cut)

- Real-world legal/Mietrecht compliance beyond the 5 high-impact rules we hard-code
- Stripe Tax / VAT
- Multi-tenant SaaS infrastructure (single demo tenant only)
- Production-grade auth (mock if needed)
- Mobile-responsive polish (desktop demo only)
- Real bank verification / KYC
- Production-grade PII redaction (regex + Claude redaction is enough for demo)
- Live disparity detection at scale (we ship the counterfactual moment only)

---

## Stretch Goals (only after MVP locks ~Sunday 09:00)

- **ElevenLabs voice agent** — voice calls to silent tenants who don't respond to email/SMS. If we ship this, we also compete for the ElevenLabs track and the overall winner.
- Real Stripe Sigma analytics queries (not faked on slide)
- Predictive risk-scoring model (lightweight, Claude-based)
- WhatsApp channel adapter
- Cohort-level disparity report (post-hoc fairness audit)

---

## Open Questions

- Branding: keep "RentPlan AI" or rename to "RentPilot AI" — or something else?
- Outreach demo: email only, or email + SMS?
- Hosting: localhost only for demo, or deploy to Vercel for the Loom?
- Recording: Sunday-morning final cut, or dry-run record on Saturday night?
- Do we add a 4th persona for the conflicting-signals case?

---

## How this repo is organized (for future agents)

```
.
├── README.md           # Brief entry point. Points here.
├── docs/
│   ├── project.md      # THIS FILE — source of truth.
│   ├── adr/            # Architecture Decision Records.
│   └── brainstorm/     # Brainstorm sessions, raw notes, exploration.
└── (code dirs added as the build progresses)
```

Brainstorm docs to read alongside this file:

- `docs/brainstorm/2026-05-23-hackathon-brief.md` — verbatim track brief
- `docs/brainstorm/2026-05-23-decision-space.md` — 8 agent actions + Stripe mapping
- `docs/brainstorm/2026-05-23-stripe-data-model.md` — money flow + DB schema
- `docs/brainstorm/2026-05-23-compliance-and-audit.md` — legal compliance layer
- `docs/brainstorm/2026-05-23-bias-and-fairness.md` — 5-layer bias defense

When you (a future agent) start a session on this repo:

1. **Read `docs/project.md` first** — it is up-to-date and load-bearing.
2. Skim `docs/adr/` for any locked-in architectural choices.
3. Check `docs/brainstorm/` for context on rejected ideas / open threads.
4. Only then start coding.
