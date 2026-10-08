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
  const [message, setMessage] = useState("");
  const [thesis, setThesis] = useState("Founder-led B2B SaaS companies in the US with $5M+ revenue.");
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
        setMessage(`${unique.length} unique companies analyzed.`);
        setLoading(false);
      },
      error: () => {
        setMessage("Could not parse this CSV.");
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
      setMessage("Scoring model updated.");
    } catch {
      setMessage("Failed to update scoring rules. Ensure Gemini API key is set.");
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
      const updated = { ...lead, concern: "Unable to generate analysis right now." };
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
    <main className="app-container">
      <header className="app-header">
        <div className="app-brand">
          <strong>Caprae AI Lead Prioritizer</strong>
        </div>
        <div className="header-actions">
          <label className="button primary-button">
            {loading ? "Analyzing…" : "Upload CSV"}
            <input type="file" accept=".csv" onChange={handleFile} disabled={loading} style={{ display: 'none' }} />
          </label>
          <button className="button secondary-button" onClick={exportCSV}>Export results</button>
        </div>
      </header>

      <section className="app-subheader">
        <div className="subheader-title">
          <h2>Screening</h2>
          <span className="meta">
            {leads.length} companies · {counts.high} high priority
          </span>
        </div>

        <div className="thesis-bar">
          <div className="thesis-input-group">
            <span className="thesis-label">Thesis</span>
            <input
              className="thesis-input"
              value={thesis}
              onChange={e => setThesis(e.target.value)}
              placeholder="e.g. Founder-led B2B SaaS companies in the US..."
            />
            <button className="button secondary-button" onClick={updateScoringRules} disabled={rulesLoading}>
              {rulesLoading ? "Updating..." : "Apply"}
            </button>
          </div>

          <div className="thesis-rules">
            {rules.targetIndustries.length > 0 && <span className="rule-tag">Industry: {rules.targetIndustries.join(", ")}</span>}
            {rules.targetLocations.length > 0 && <span className="rule-tag">Geography: {rules.targetLocations.join(", ")}</span>}
            {rules.minRevenue > 0 && <span className="rule-tag">Revenue: &gt;{currency(rules.minRevenue)}</span>}
            {rules.maxRevenue < 1000000000 && <span className="rule-tag">Revenue: &lt;{currency(rules.maxRevenue)}</span>}
          </div>
        </div>
      </section>

      <section className="app-toolbar">
        <input
          className="search-input"
          placeholder="Search companies..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="filter-group">
          {["All", "High", "Medium", "Low"].map((x) => (
            <button
              key={x}
              className={`filter-button ${filter === x ? "active" : ""}`}
              onClick={() => setFilter(x)}
            >
              {x}
            </button>
          ))}
        </div>
        <button className="button secondary-button auto-analyze-button" onClick={runBatchAI} disabled={batchLoading}>
          {batchLoading ? "Analyzing..." : "Analyze Top 3"}
        </button>
      </section>

      {message && (
        <div className="system-message">{message}</div>
      )}

      <div className="workspace">
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Company</th>
                <th className="right-align">Score</th>
                <th className="right-align">Revenue</th>
                <th className="right-align">Employees</th>
                <th>Priority</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((lead) => (
                <tr
                  key={lead.id}
                  onClick={() => setSelected(lead)}
                  className={selected?.id === lead.id ? "selected-row" : ""}
                >
                  <td>
                    <div className="company-name">{lead.company}</div>
                  </td>
                  <td className="right-align score-cell">{lead.score}</td>
                  <td className="right-align">{currency(lead.revenue)}</td>
                  <td className="right-align">{lead.employees.toLocaleString()}</td>
                  <td>
                    <span className={`priority-tag ${lead.priority.toLowerCase()}`}>{lead.priority}</span>
                  </td>
                </tr>
              ))}
              {!filtered.length && (
                <tr>
                  <td colSpan={5} className="empty-state">No companies match the current filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <aside className="detail-panel">
          {selected ? (
            <div className="detail-content">
              <div className="detail-header">
                <div>
                  <div className="detail-meta">Selected Target</div>
                  <h2>{selected.company}</h2>
                  <div className="company-meta">{selected.industry} · {selected.location}</div>
                </div>
                <div className="detail-score">
                  <div className="detail-meta">Score</div>
                  <div className="score-value">{selected.score}</div>
                </div>
              </div>

              <div className="detail-section">
                <h3>Thesis fit</h3>
                <div className="thesis-fit-status">
                  {selected.score >= 80 ? "Strong" : selected.score >= 50 ? "Moderate" : "Weak"}
                </div>
              </div>

              <div className="detail-section">
                <h3>Evidence</h3>
                <ul className="evidence-list">
                  {selected.reasons.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>

              <div className="detail-section ai-section">
                <div className="section-header">
                  <h3>Analyst note</h3>
                  <button className="button text-button" onClick={() => generateAI(selected)} disabled={aiLoading}>
                    {aiLoading ? "Generating..." : "Generate note"}
                  </button>
                </div>

                {selected.concern && (
                  <div className="analyst-note">
                    <p className="note-text">{(selected as Lead & { aiReason?: string }).aiReason || "Strong fit based on available metrics."}</p>

                    <div className="note-subsection">
                      <h4>Potential concern</h4>
                      <p>{selected.concern}</p>
                    </div>

                    {selected.outreachAngle && (
                      <div className="note-subsection">
                        <h4>Next action</h4>
                        <p>{selected.outreachAngle}</p>
                      </div>
                    )}

                    {selected.emailDraft && (
                      <div className="draft-section">
                        <div className="draft-header">
                          <h4>Draft communication</h4>
                          <button
                            className="button text-button small-button"
                            onClick={() => { navigator.clipboard.writeText(selected.emailDraft || ""); alert("Copied to clipboard!"); }}
                          >
                            Copy
                          </button>
                        </div>
                        <textarea
                          className="draft-input"
                          value={selected.emailDraft}
                          onChange={(e) => {
                            const newDraft = e.target.value;
                            setSelected({ ...selected, emailDraft: newDraft });
                            setLeads(prev => prev.map(l => l.id === selected.id ? { ...l, emailDraft: newDraft } : l));
                          }}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="empty-panel">
              Select a company to view thesis alignment and analyst notes.
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}
