# 2-Minute Walkthrough Script

## 0:00–0:20 — Problem

"Once you have a large sourced company list, the next problem is deciding which companies deserve attention first. I built AI Lead Prioritizer around that screening step."

## 0:20–0:50 — Screening

"Here I'm working with a company list. The system deduplicates it and scores every company against a transparent business-fit model. The queue is ranked, searchable and filterable, so the analyst can work from the highest-priority targets instead of scanning a raw list."

## 0:50–1:15 — Investment thesis

"The thesis is configurable in plain English. AI extracts the relevant industry, geography, revenue and employee constraints into explicit rules. The final score is still deterministic, so the analyst can understand why a target ranked where it did."

## 1:15–1:45 — Optional AI review

"For a target that deserves deeper attention, I can generate an AI review. It adds a concise readout, a potential concern, an outreach angle and an editable email draft. AI is optional and sits after the screening step rather than replacing the ranking logic."

## 1:45–2:00 — Architecture

"The prototype uses Next.js and TypeScript, with client-side CSV processing and deterministic scoring. Gemini handles thesis extraction and optional target analysis. For production, I would add server-side persistence, authentication, rate limiting and audit logging."
