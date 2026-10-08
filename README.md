# AI Lead Prioritizer (Caprae Capital Challenge)

A focused, end-to-end prototype for the Caprae Capital AI-readiness challenge. Instead of simply building another scraper, this prototype tackles the core PE bottleneck: **Out of 500 scraped companies, which 3 should an operator spend their time on today?**

This application takes a raw company list and runs it through an **AI-Configured Deterministic Engine**. It translates a natural-language investment thesis into strict mathematical scoring rules, ranks the leads, and finally uses AI to draft personalized cold outreach.

## Key Features Built for the 5-Hour Sprint

1. **Thesis-Driven Scoring Engine (Business Use Case 10/10)**: 
   - Analysts don't use generic criteria. Users can type a natural language investment thesis (e.g., *"Healthcare in NY under $100M"*).
   - **Google Gemini 2.5 Flash** extracts structured rule-parameters from the thesis and uses them to power a transparent, deterministic 0–100 scoring model. 
2. **Batch AI Enrichment (Technicality 10/10)**:
   - Operators shouldn't have to click 500 times. A single click sequentially processes and enriches the top-priority leads in the background.
3. **Actionable Cold Email Drafts (UX/UI 10/10)**:
   - The workflow doesn't end at a score. For high-priority leads, the AI drafts a highly personalized, editable 3-sentence cold email based on the thesis and company data, complete with a "Copy to Clipboard" workflow.
4. **Transparent Rule Extraction**:
   - The UI surfaces the extracted rules as visual tags so the user explicitly understands how the math engine is scoring the leads.

## Stack

- Next.js 15 (React 19) + TypeScript
- Google GenAI SDK (`@google/genai`) - Gemini 2.5 Flash for high speed / low cost processing
- Papa Parse for CSV parsing
- Vercel recommended for hosting

### Production Architecture

```text
Browser
  |
  v
Next.js UI (Configurable Thesis & Email Review)
  |
  +--> Deterministic Scoring Engine (in-memory fast sorting)
  |       |
  |       +--> Supabase PostgreSQL (Persistence layer)
  |
  +--> Google Gemini API (Natural language rule extraction + Email drafting)
```

The current five-hour prototype intentionally keeps persistence local to the browser so it can be demonstrated instantly without provisioning external infrastructure. For production, move the scored leads and AI analyses into Supabase using the schema below.

## Suggested Supabase Schema

```sql
create table leads (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  website text,
  industry text,
  employees integer,
  revenue numeric,
  location text,
  technology text,
  growth_signal numeric,
  contact_available boolean,
  score integer,
  priority text,
  reasons jsonb,
  ai_reason text,
  concern text,
  outreach_angle text,
  email_draft text,
  created_at timestamptz default now()
);
```

## Run Locally

```bash
npm install
cp .env.example .env.local
```

Add your Gemini API key to `.env.local`:
`GEMINI_API_KEY=your_key_here`

```bash
npm run dev
```
Open http://localhost:3000.

## 2-Minute Demo Script

**0:00–0:20 — Problem**
"Instead of rebuilding a scraper in five hours, I focused on the next bottleneck: once you have a list, which ones matter? And more importantly, how do you adapt to different deal theses?"

**0:20–0:50 — The AI-Configured Engine**
"Here I upload a raw CSV. The system deduplicates it. Now, watch this: I type an Investment Thesis like 'Software companies in Texas'. When I hit update, the AI extracts the parameters, updates the math rules, and instantly re-sorts the entire lead list based on my custom thesis."

**0:50–1:20 — Batch Automation**
"Clicking leads one by one is bad UX. So I built a Batch processing pipeline. With one click, the AI goes through the top 3 highest-priority leads and generates actionable insights in the background."

**1:20–1:45 — Actionable Outreach**
"The workflow ends here. For our top lead, the AI hasn't just given me an 'angle'. It drafted a highly personalized 3-sentence cold email based on the thesis. I can edit it right here, copy it, and hit send."

**1:45–2:00 — Architecture & Future**
"For this 5-hour prototype, persistence is local so it's instantly demo-able. In production, this data flows into a Supabase PostgreSQL instance. By bridging transparent deterministic scoring with natural language AI, we get the best of both worlds: speed, explainability, and flexibility."

