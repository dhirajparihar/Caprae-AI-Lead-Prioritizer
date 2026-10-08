"use client";

import { ChangeEvent, useMemo, useState } from "react";
import Papa from "papaparse";
import { dedupeLeads, scoreLead, defaultRules } from "../lib/scoring";
import { Lead, RawLead, ScoringRules } from "../lib/types";

const demoRows: RawLead[] = [
  { company: "Atlas Industrial", website: "atlasindustrial.com", industry: "Manufacturing", employees: 420, revenue: 32000000, location: "Texas", technology: "Shopify", growthSignal: 88, contactAvailable: true },
  { company: "Northstar Services", website: "northstarservices.com", industry: "Business Services", employees: 180, revenue: 18500000, location: "Florida", technology: "HubSpot", growthSignal: 72, contactAvailable: true },
  { company: "BluePeak Software", website: "bluepeak.io", industry: "Software", employees: 65, revenue: 6200000, location: "California", technology: "React", growthSignal: 68, contactAvailable: true },
  { company: "Delta Distribution", website: "deltadist.com", industry: "Distribution", employees: 620, revenue: 54000000, location: "Georgia", technology: "Salesforce", growthSignal: 81, contactAvailable: true },
  { company: "Acme Retail Group", website: "acmeretail.com", industry: "Retail", employees: 35, revenue: 1800000, location: "Ohio", technology: "WordPress", growthSignal: 35, contactAvailable: false },
  { company: "Greenfield Health", website: "greenfieldhealth.com", industry: "Healthcare Services", employees: 260, revenue: 27500000, location: "New York", technology: "Salesforce", growthSignal: 77, contactAvailable: true },
  { company: "Summit Logistics", website: "summitlogistics.com", industry: "Logistics", employees: 510, revenue: 47000000, location: "Illinois", technology: "Oracle", growthSignal: 91, contactAvailable: true },
  { company: "Coastal Media", website: "coastalmedia.com", industry: "Media", employees: 90, revenue: 7200000, location: "Florida", technology: "Webflow", growthSignal: 40, contactAvailable: true }
];

function currency(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

export default function Home() {
  const [leads, setLeads] = useState<Lead[]>(() => dedupeLeads(demoRows).map((r, i) => scoreLead(r, i, defaultRules)));
  const [selected, setSelected] = useState<Lead | null>(null);
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [message, setMessage] = useState("Demo data loaded. Upload a CSV to replace it.");
  const [thesis, setThesis] = useState("Looking for founder-led B2B SaaS companies in the US with $5M+ revenue.");
  const [batchLoading, setBatchLoading] = useState(false);
  const [rules, setRules] = useState<ScoringRules>(defaultRules);
  const [rulesLoading, setRulesLoading] = useState(false);

  const filtered = useMemo(() => leads
    .filter((l) => filter === "All" || l.priority === filter)
    .filter((l) => `${l.company} ${l.industry} ${l.location}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => b.score - a.score), [leads, filter, search]);

  const counts = useMemo(() => ({
    high: leads.filter((l) => l.priority === "High").length,
    medium: leads.filter((l) => l.priority === "Medium").length,
    low: leads.filter((l) => l.priority === "Low").length
  }), [leads]);

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setMessage("Parsing, validating and scoring leads...");
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const rows: RawLead[] = (result.data as Record<string, string>[]).map((r) => ({
          company: r.company?.trim() || "Unknown Company",
          website: r.website?.trim(),
          industry: r.industry?.trim(),
          employees: Number(r.employees || 0),
          revenue: Number(r.revenue || 0),
          location: r.location?.trim(),
          technology: r.technology?.trim(),
          growthSignal: Number(r.growthSignal || 0),
          contactAvailable: String(r.contactAvailable).toLowerCase() === "true"
        }));
        const unique = dedupeLeads(rows).map((r, i) => scoreLead(r, i, rules));
        setLeads(unique);
        setSelected(null);
        setFilter("All");
        setSearch("");
        setMessage(`${unique.length} unique leads analyzed successfully.`);
        setLoading(false);
      },
      error: () => {
        setMessage("Could not parse this CSV. Check the required columns.");
        setLoading(false);
      }
    });
  }

  async function updateScoringRules() {
    setRulesLoading(true);
    try {
      const res = await fetch("/api/extract-rules", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ thesis }) });
      if (!res.ok) throw new Error("Failed");
      const newRules = await res.json();
      setRules(newRules);
      setLeads(prev => prev.map((l, i) => scoreLead(l, i, newRules) as Lead));
      if (selected) {
        setSelected(curr => curr ? scoreLead(curr, 0, newRules) as Lead : null);
      }
      setMessage("Scoring model updated based on thesis!");
    } catch {
      setMessage("Failed to update scoring rules. Ensure API key is set.");
    } finally {
      setRulesLoading(false);
    }
  }

  async function analyzeLead(lead: Lead, currentThesis: string) {
    const res = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lead, thesis: currentThesis }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "AI request failed");
    return { ...lead, concern: data.concern, outreachAngle: data.outreachAngle, emailDraft: data.emailDraft, reasons: lead.reasons, aiReason: data.reason } as Lead & { aiReason?: string };
  }

  async function generateAI(lead: Lead) {
    setSelected({ ...lead });
    setAiLoading(true);
    try {
      const updated = await analyzeLead(lead, thesis);
      setSelected(updated);
      setLeads(prev => prev.map(l => l.id === lead.id ? updated : l));
    } catch {
      const updated = { ...lead, concern: "Unable to generate AI analysis right now." };
      setSelected(updated);
      setLeads(prev => prev.map(l => l.id === lead.id ? updated : l));
    } finally {
      setAiLoading(false);
    }
  }

  async function runBatchAI() {
    setBatchLoading(true);
    const topLeads = filtered.filter(l => !(l as any).aiReason).slice(0, 3);
    for (const lead of topLeads) {
      try {
        const updated = await analyzeLead(lead, thesis);
        setLeads(prev => prev.map(l => l.id === lead.id ? updated : l));
        setSelected(curr => curr?.id === lead.id ? updated : curr);
      } catch {
        // silently fail for batch
      }
    }
    setBatchLoading(false);
  }

  function exportCSV() {
    const csv = Papa.unparse(filtered.map(({ id, ...l }) => ({ ...l, reasons: l.reasons.join(" | ") })));
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "prioritized-leads.csv"; a.click(); URL.revokeObjectURL(url);
  }

  return (
    <main>
      <header className="topbar">
        <div className="brand"><span className="brandMark">AI</span><div><strong>AI Lead Prioritizer</strong><small>Acquisition target intelligence</small></div></div>
        <label className="uploadButton">{loading ? "Analyzing…" : "Upload CSV"}<input type="file" accept=".csv" onChange={handleFile} disabled={loading} /></label>
      </header>

      <section className="hero">
        <div><p className="eyebrow">AI SCREENING WORKFLOW</p><h1>Find the targets worth your time.</h1><p>Turn a raw company list into an explainable acquisition-priority queue in seconds.</p></div>
        <button className="secondary" onClick={exportCSV}>Export results</button>
      </section>

      <section className="thesis-section" style={{ padding: "0 2rem 1rem", maxWidth: 1200, margin: "0 auto" }}>
        <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, fontSize: "0.875rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--foreground)" }}>Investment Thesis (AI Context)</label>
        <textarea 
          style={{ width: "100%", padding: "0.75rem", borderRadius: "6px", border: "1px solid var(--border)", minHeight: "80px", fontFamily: "inherit", background: "var(--background)", color: "var(--foreground)" }}
          value={thesis} 
          onChange={e => setThesis(e.target.value)}
          placeholder="e.g. We are looking for founder-led B2B SaaS companies with $5M+ revenue..."
        />
        
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "1rem" }}>
          {rules.targetIndustries.length > 0 && <span className="pill medium" style={{ background: "#eef2ff", color: "#4f46e5", border: "1px solid #c7d2fe" }}>🎯 {rules.targetIndustries.join(", ")}</span>}
          {rules.targetLocations.length > 0 && <span className="pill medium" style={{ background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0" }}>📍 {rules.targetLocations.join(", ")}</span>}
          {rules.minRevenue > 0 && <span className="pill medium" style={{ background: "#fdf4ff", color: "#c026d3", border: "1px solid #fae8ff" }}>💰 &gt;{currency(rules.minRevenue)}</span>}
          {rules.maxRevenue < 1000000000 && <span className="pill medium" style={{ background: "#fdf4ff", color: "#c026d3", border: "1px solid #fae8ff" }}>💰 &lt;{currency(rules.maxRevenue)}</span>}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1rem" }}>
          <button className="primary" onClick={updateScoringRules} disabled={rulesLoading}>
            {rulesLoading ? "Updating Rules..." : "Update Scoring Engine"}
          </button>
        </div>
      </section>

      <section className="stats">
        <div className="stat"><span>Total analyzed</span><b>{leads.length}</b></div>
        <div className="stat"><span>High priority</span><b>{counts.high}</b></div>
        <div className="stat"><span>Medium priority</span><b>{counts.medium}</b></div>
        <div className="stat"><span>Low priority</span><b>{counts.low}</b></div>
      </section>

      <section className="toolbar">
        <input placeholder="Search company, industry or location…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="filters">
          {["All", "High", "Medium", "Low"].map((x) => <button key={x} className={filter === x ? "active" : ""} onClick={() => setFilter(x)}>{x}</button>)}
          <button className="secondary" onClick={runBatchAI} disabled={batchLoading} style={{ marginLeft: "auto", background: "var(--background)" }}>
            {batchLoading ? "Analyzing Top 3..." : "✨ Auto-Analyze Top 3"}
          </button>
        </div>
      </section>

      <p className="message">{message}</p>

      <section className="content">
        <div className="tableCard">
          <div className="tableHeader"><span>Company</span><span>Fit</span><span>Revenue</span><span>Employees</span><span>Priority</span></div>
          {filtered.map((lead) => <button className="row" key={lead.id} onClick={() => setSelected(lead)}>
            <div><strong>{lead.company}</strong><small>{lead.industry || "Unknown industry"} · {lead.location || "Unknown location"}</small></div>
            <strong>{lead.score}/100</strong><span>{currency(lead.revenue)}</span><span>{lead.employees.toLocaleString()}</span><span className={`pill ${lead.priority.toLowerCase()}`}>{lead.priority}</span>
          </button>)}
          {!filtered.length && <div className="empty">No leads match your filters.</div>}
        </div>

        <aside className="detail">
          {selected ? <>
            <div className="detailTop"><div><p className="eyebrow">AI TARGET REVIEW</p><h2>{selected.company}</h2><p>{selected.industry} · {selected.location}</p></div><div className="score">{selected.score}<small>/100</small></div></div>
            <h3>Why this target?</h3>
            <ul>{selected.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
            <button className="primary" onClick={() => generateAI(selected)} disabled={aiLoading}>{aiLoading ? "Generating…" : "Generate AI analysis"}</button>
            {selected.concern && <div className="aiBox">
              <b>AI view</b><p>{(selected as Lead & { aiReason?: string }).aiReason || "The lead has multiple verified fit signals."}</p>
              <b>Potential concern</b><p>{selected.concern}</p>
              {selected.outreachAngle && <><b>Outreach angle</b><p>{selected.outreachAngle}</p></>}
              {selected.emailDraft && (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1rem" }}>
                    <b>Cold Email Draft</b>
                    <button 
                      className="secondary" 
                      style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem", background: "var(--background)" }}
                      onClick={() => { navigator.clipboard.writeText(selected.emailDraft || ""); alert("Copied to clipboard!"); }}
                    >
                      Copy
                    </button>
                  </div>
                  <textarea 
                    style={{ width: "100%", minHeight: "120px", background: "var(--background)", padding: "1rem", borderRadius: "6px", border: "1px solid var(--border)", marginTop: "0.5rem", fontSize: "0.875rem", lineHeight: 1.5, fontFamily: "inherit", resize: "vertical" }}
                    value={selected.emailDraft}
                    onChange={(e) => {
                      const newDraft = e.target.value;
                      setSelected({ ...selected, emailDraft: newDraft });
                      setLeads(prev => prev.map(l => l.id === selected.id ? { ...l, emailDraft: newDraft } : l));
                    }}
                  />
                </>
              )}
            </div>}
          </> : <div className="empty detailEmpty">Select a lead to inspect its business-fit signals.</div>}
        </aside>
      </section>

      <footer>Prototype built for the Caprae Capital AI-readiness challenge · deterministic scoring + optional AI analysis</footer>
    </main>
  );
}
