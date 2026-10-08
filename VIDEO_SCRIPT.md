# 2-Minute Video Script

## 0:00–0:20
SaaSquatch helps identify and enrich potential leads. I focused on the next bottleneck: once you have a list of companies, which ones should an operator spend time on first?

## 0:20–0:50
This is AI Lead Prioritizer. I upload a company CSV, the system validates it, removes duplicates, scores every company, and creates a high, medium, and low priority queue. The score is explainable rather than being a black box.

## 0:50–1:20
When I open a target, I can see the exact business-fit signals behind its score. I can then use the AI analysis to generate a concise reason, a potential concern, and an outreach angle. AI is deliberately used for qualitative reasoning, while the core score stays deterministic.

## 1:20–1:45
The frontend uses Next.js, React, and TypeScript. For production I would persist the leads and analyses in Supabase PostgreSQL, call OpenAI only for qualitative analysis, and deploy the application on Vercel.

## 1:45–2:00
The goal is not simply to generate more leads. It is to help the team spend limited time on the targets most likely to matter.
