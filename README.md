# AI Lead Prioritizer

A focused full-stack prototype for the Caprae Capital AI-readiness challenge.

The product addresses a practical screening problem: after sourcing a large company list, which targets deserve a closer look first?

## What it does

- Imports a CSV of company leads
- Deduplicates the input
- Scores each company against an explicit 0–100 screening model
- Ranks the queue by business fit
- Lets the user describe an investment thesis in plain English
- Uses Gemini to turn the thesis into inspectable scoring rules
- Keeps the underlying score deterministic and explainable
- Uses AI only for optional target-level context and outreach drafting
- Exports the current ranked queue as CSV

## Product principles

The UI is intentionally designed as an operator workflow rather than an AI marketing page:

- The screening queue is the primary surface.
- AI is visible in the product name and workflow, but it does not dominate every interaction.
- Scores are deterministic; AI adds context rather than silently changing the score.
- Empty, loading, error, and mobile states are handled explicitly.
- Demo assumptions are kept visible instead of being presented as Caprae facts.

## Stack

- Next.js 15
- React 19
- TypeScript
- Google GenAI SDK
- Papa Parse
- CSS with a small application-specific design system

## Local setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000.

Set the following environment variables for AI features:

```text
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-2.5-flash
```

Without a Gemini key, CSV import, deterministic scoring, filtering and export still work. AI thesis extraction and target analysis require the key.

## CSV columns

The importer accepts:

```text
company
website
industry
employees
revenue
location
technology
growthSignal
contactAvailable
```

## Architecture

```text
CSV
 |
 v
Client-side validation + deduplication
 |
 v
Deterministic 0–100 scoring engine
 |
 +----------------------+
 |                      |
 v                      v
Ranked queue        Export CSV
 |
 v
Optional Gemini analysis
```

The current challenge build intentionally keeps the working data in the browser session to keep the five-hour prototype fast to demonstrate. A production deployment should move persistence, authentication, rate limiting and audit logging to a server-side data layer.

## Scoring model

The score combines:

- Industry fit
- Revenue fit
- Employee-count fit
- Geography
- Technology/data availability
- Growth signal
- Contact availability
- Data completeness

The score is calculated locally and remains deterministic even when AI features are enabled.

## Submission artifacts

- `README.md` — setup and architecture
- `VIDEO_SCRIPT.md` — 2-minute walkthrough script
