# AI Lead Prioritizer (Caprae Capital Challenge)

A focused, end-to-end prototype for the Caprae Capital AI-readiness challenge. Instead of simply building another scraper, this prototype tackles the core PE bottleneck: **Out of 500 scraped companies, which 3 should an operator spend their time on today?**

This application takes a raw company list and runs it through a **thesis-driven scoring** engine. It translates a natural-language investment thesis into strict mathematical scoring rules, ranks the leads, and finally uses AI to draft personalized cold outreach.

flowchart LR
    A["500-Company CSV"]
    B["Next.js 15"]
    C["Gemini<br/>Thesis → Rules"]
    D["Deterministic<br/>0–100 Scoring"]
    E["Ranked Leads"]
    F["Gemini<br/>AI Enrichment"]
    G["Personalized<br/>Cold Email"]

    A --> B
    B --> C
    C --> D
    A --> D
    D --> E
    E --> F
    F --> G

## Key Features Built for the 5-Hour Sprint

1. **Thesis-Driven Scoring Engine**: 
   - Analysts don't use generic criteria. Users can type a natural language investment thesis (e.g., *"Healthcare in NY under $100M"*).
   - **Google Gemini** extracts structured rule-parameters from the thesis and uses them to power a transparent, deterministic 0–100 scoring model. 
2. **Batch AI Enrichment**:
   - Operators shouldn't have to click 500 times. A single click sequentially processes and enriches the top-priority leads in the background.
3. **Actionable Cold Email Drafts**:
   - The workflow doesn't end at a score. For high-priority leads, the AI drafts a highly personalized, editable 3-sentence cold email based on the thesis and company data, complete with a "Copy to Clipboard" workflow.
4. **Transparent Rule Extraction**:
   - The UI surfaces the extracted rules as visual tags so the user explicitly understands how the math engine is scoring the leads.

## Stack

- Next.js 15 (React 19) + TypeScript
- Google GenAI SDK (`@google/genai`) - Gemini 2.5 Flash for high speed / low cost processing
- Papa Parse for CSV parsing
- Vercel recommended for hosting

### Current prototype architecture

```text
Browser
  |
  v
Next.js UI (Configurable Thesis & Email Review)
  |
  +--> Deterministic Scoring Engine (in-memory fast sorting)
  |
  +--> Google Gemini API (Natural language rule extraction + Email drafting)
```

The current five-hour prototype intentionally keeps persistence local to the browser so it can be demonstrated instantly without provisioning external infrastructure.


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

