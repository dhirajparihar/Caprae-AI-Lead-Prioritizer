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
  const [filter, setFilter] = useState<"All" | "High" | "Medium" | "Low">("All");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [message, setMessage] = useState("Demo data loaded · 8 companies");
  const [thesis, setThesis] = useState("Looking for founder-led B2B SaaS companies in the US with $5M+ revenue.");
  const [batchLoading, setBatchLoading] = useState(false);
  const [rules, setRules] = useState<ScoringRules>(defaultRules);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [showThesis, setShowThesis] = useState(false);

  const filtered = useMemo(
    () =>
      leads
        .filter((l) => filter === "All" || l.priority === filter)
        .filter((l) => `${l.company} ${l.industry} ${l.location}`.toLowerCase().includes(search.toLowerCase()))
        .sort((a, b) => b.score - a.score),
    [leads, filter, search]
  );

  const counts = useMemo(
    () => ({
      high: leads.filter((l) => l.priority === "High").length,
      medium: leads.filter((l) => l.priority === "Medium").length,
      low: leads.filter((l) => l.priority === "Low").length
    }),
    [leads]
  );

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setMessage(`Reading ${file.name}…`);

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
        setMessage(`${unique.length} companies ranked`);
        setLoading(false);
      },
      error: () => {
        setMessage("Could not read that CSV. Check the required columns and try again.");
        setLoading(false);
      }
    });
  }

  async function updateScoringRules() {
    setRulesLoading(true);
    try {
      const res = await fetch("/api/extract-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thesis })
      });
      if (!res.ok) throw new Error("Failed");
      const newRules = await res.json();
      setRules(newRules);
      setLeads((prev) => prev.map((l, i) => scoreLead(l, i, newRules) as Lead));
      if (selected) setSelected((curr) => (curr ? (scoreLead(curr, 0, newRules) as Lead) : null));
      setMessage("Scoring rules updated");
      setShowThesis(false);
    } catch {
      setMessage("Could not update the scoring rules. Check your AI configuration.");
    } finally {
      setRulesLoading(false);
    }
  }

  async function analyzeLead(lead: Lead, currentThesis: string) {
    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lead, thesis: currentThesis })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "AI request failed");
    return { ...lead, concern: data.concern, outreachAngle: data.outreachAngle, emailDraft: data.emailDraft, reasons: lead.reasons, aiReason: data.reason } as Lead & {
      aiReason?: string;
    };
  }

  async function generateAI(lead: Lead) {
    setSelected({ ...lead });
    setAiLoading(true);
    try {
      const updated = await analyzeLead(lead, thesis);
      setSelected(updated);
      setLeads((prev) => prev.map((l) => (l.id === lead.id ? updated : l)));
    } catch {
      const updated = { ...lead, concern: "Unable to generate AI analysis right now." };
      setSelected(updated);
      setLeads((prev) => prev.map((l) => (l.id === lead.id ? updated : l)));
    } finally {
      setAiLoading(false);
    }
  }

  async function runBatchAI() {
    setBatchLoading(true);
    const topLeads = filtered.filter((l) => !(l as Lead & { aiReason?: string }).aiReason).slice(0, 3);
    for (const lead of topLeads) {
      try {
        const updated = await analyzeLead(lead, thesis);
        setLeads((prev) => prev.map((l) => (l.id === lead.id ? updated : l)));
        setSelected((curr) => (curr?.id === lead.id ? updated : curr));
      } catch {
        // keep the queue usable even if one AI call fails
      }
    }
    setBatchLoading(false);
  }

  function exportCSV() {
    const csv = Papa.unparse(
      filtered.map(({ id, ...l }) => ({ ...l, reasons: l.reasons.join(" | ") }))
    );
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "prioritized-leads.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const selectedWithAI = selected as (Lead & { aiReason?: string }) | null;

  return (
    <main className="appShell">
      <header className="topbar">
        <div className="brand">
          <span className="brandMark">AI</span>
          <div>
            <strong>AI Lead Prioritizer</strong>
            <small>Acquisition screening desk</small>
          </div>
        </div>

        <div className="topbarActions">
          <span className="dataStatus"><span className="statusDot" /> Local session</span>
          <label className="uploadButton">
            <span>{loading ? "Importing…" : "Import CSV"}</span>
            <input type="file" accept=".csv" onChange={handleFile} disabled={loading} />
          </label>
        </div>
      </header>

      <section className="workspace">
        <div className="pageIntro">
          <div>
            <p className="eyebrow">AI SCREENING WORKFLOW</p>
            <h1>Prioritize the companies worth a closer look.</h1>
            <p className="introText">
              Rank a company list against a clear investment thesis, then use AI only where human review benefits from context.
            </p>
          </div>

          <div className="introActions">
            <button className="button secondaryButton" onClick={() => setShowThesis((v) => !v)}>
              {showThesis ? "Close thesis" : "Edit thesis"}
            </button>
            <button className="button secondaryButton" onClick={exportCSV}>Export CSV</button>
          </div>
        </div>

        <div className="controlBar">
          <div className="thesisSummary">
            <span className="controlLabel">Current thesis</span>
            <span className="thesisText">{thesis}</span>
          </div>
          <button className="textButton" onClick={() => setShowThesis((v) => !v)}>
            {showThesis ? "Hide" : "Change"}
          </button>
        </div>

        {showThesis && (
          <section className="thesisPanel">
            <div className="panelHeading">
              <div>
                <span className="controlLabel">Investment thesis</span>
                <h2>Tell the screening engine what matters.</h2>
              </div>
              <span className="panelHint">AI converts this into explicit, inspectable rules.</span>
            </div>
            <textarea
              className="thesisInput"
              value={thesis}
              onChange={(e) => setThesis(e.target.value)}
              placeholder="e.g. Founder-led B2B SaaS companies in Texas with $5M–$100M revenue."
            />
            <div className="thesisFooter">
              <div className="ruleList">
                {rules.targetIndustries.length > 0 && <span>{rules.targetIndustries.join(", ")}</span>}
                {rules.targetLocations.length > 0 && <span>{rules.targetLocations.join(", ")}</span>}
                {rules.minRevenue > 0 && <span>Revenue ≥ {currency(rules.minRevenue)}</span>}
                {rules.maxRevenue < 1000000000 && <span>Revenue ≤ {currency(rules.maxRevenue)}</span>}
                {rules.minEmployees > 0 && <span>Employees ≥ {rules.minEmployees}</span>}
                {rules.maxEmployees < 100000 && <span>Employees ≤ {rules.maxEmployees}</span>}
              </div>
              <button className="button primaryButton" onClick={updateScoringRules} disabled={rulesLoading}>
                {rulesLoading ? "Updating…" : "Update scoring"}
              </button>
            </div>
          </section>
        )}

        <section className="summaryGrid">
          <div className="summaryCell">
            <span>Companies</span>
            <strong>{leads.length}</strong>
            <small>in current list</small>
          </div>
          <div className="summaryCell">
            <span>High priority</span>
            <strong>{counts.high}</strong>
            <small>80+ score</small>
          </div>
          <div className="summaryCell">
            <span>Median fit</span>
            <strong>{leads.length ? Math.round([...leads].sort((a,b) => a.score-b.score)[Math.floor(leads.length/2)].score) : 0}</strong>
            <small>out of 100</small>
          </div>
          <div className="summaryCell">
            <span>AI coverage</span>
            <strong>{leads.filter((l) => (l as Lead & { aiReason?: string }).aiReason).length}</strong>
            <small>analyses generated</small>
          </div>
        </section>

        <section className="listSection">
          <div className="sectionHeader">
            <div>
              <p className="eyebrow">SCREENING QUEUE</p>
              <h2>Ranked targets</h2>
            </div>
            <div className="queueMeta">{message}</div>
          </div>

          <div className="toolbar">
            <div className="searchBox">
              <span className="searchIcon" aria-hidden="true">⌕</span>
              <input
                aria-label="Search companies"
                placeholder="Search companies, industries or locations"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="filterGroup" aria-label="Priority filters">
              {(["All", "High", "Medium", "Low"] as const).map((x) => (
                <button
                  key={x}
                  className={filter === x ? "filterButton active" : "filterButton"}
                  onClick={() => setFilter(x)}
                >
                  {x}
                </button>
              ))}
            </div>

            <button className="button aiButton" onClick={runBatchAI} disabled={batchLoading || !filtered.length}>
              {batchLoading ? "Analyzing…" : "AI analyze top 3"}
            </button>
          </div>

          <div className="queueTable">
            <div className="queueHeader" aria-hidden="true">
              <span>Company</span>
              <span>Fit</span>
              <span>Revenue</span>
              <span>Employees</span>
              <span>Priority</span>
            </div>

            {filtered.map((lead, index) => (
              <button
                className={selected?.id === lead.id ? "queueRow selected" : "queueRow"}
                key={lead.id}
                onClick={() => setSelected(lead)}
              >
                <div className="companyCell">
                  <span className="rank">{String(index + 1).padStart(2, "0")}</span>
                  <span>
                    <strong>{lead.company}</strong>
                    <small>{lead.industry || "Unknown industry"} · {lead.location || "Unknown location"}</small>
                  </span>
                </div>
                <span className="fitScore">{lead.score}</span>
                <span>{currency(lead.revenue)}</span>
                <span>{lead.employees.toLocaleString()}</span>
                <span className={`priorityText ${lead.priority.toLowerCase()}`}>{lead.priority}</span>
              </button>
            ))}

            {!filtered.length && (
              <div className="emptyState">
                <strong>No companies match the current filter.</strong>
                <span>Try another priority or clear the search.</span>
              </div>
            )}
          </div>
        </section>

        <section className="detailPanel">
          {selected ? (
            <>
              <div className="detailHeader">
                <div>
                  <p className="eyebrow">AI TARGET REVIEW</p>
                  <h2>{selected.company}</h2>
                  <p className="detailMeta">{selected.industry} · {selected.location}</p>
                </div>
                <div className="detailScore">
                  <span>{selected.score}</span>
                  <small>/100</small>
                </div>
              </div>

              <div className="detailGrid">
                <div>
                  <span className="controlLabel">Business fit</span>
                  <ul className="reasonList">
                    {selected.reasons.map((reason) => <li key={reason}>{reason}</li>)}
                  </ul>
                </div>

                <div className="facts">
                  <div><span>Revenue</span><strong>{currency(selected.revenue)}</strong></div>
                  <div><span>Employees</span><strong>{selected.employees.toLocaleString()}</strong></div>
                  <div><span>Technology</span><strong>{selected.technology || "Not provided"}</strong></div>
                  <div><span>Contact</span><strong>{selected.contactAvailable ? "Available" : "Not provided"}</strong></div>
                </div>
              </div>

              <div className="aiReview">
                <div className="aiReviewHeader">
                  <div>
                    <span className="controlLabel">AI analysis</span>
                    <p>Use AI to add context. The underlying score remains deterministic.</p>
                  </div>
                  <button className="button primaryButton compact" onClick={() => generateAI(selected)} disabled={aiLoading}>
                    {aiLoading ? "Generating…" : selectedWithAI?.aiReason ? "Regenerate" : "Generate"}
                  </button>
                </div>

                {selectedWithAI?.aiReason ? (
                  <div className="aiReviewGrid">
                    <div><span>Readout</span><p>{selectedWithAI.aiReason}</p></div>
                    <div><span>Potential concern</span><p>{selected.concern || "Review the underlying company data before outreach."}</p></div>
                    <div><span>Outreach angle</span><p>{selected.outreachAngle || "Lead with the strongest verified fit signal."}</p></div>
                    {selected.emailDraft && (
                      <div className="emailDraft">
                        <div className="emailDraftHeader">
                          <span>Draft email</span>
                          <button
                            className="textButton"
                            onClick={() => void navigator.clipboard.writeText(selected.emailDraft || "")}
                          >
                            Copy
                          </button>
                        </div>
                        <textarea
                          value={selected.emailDraft}
                          onChange={(e) => {
                            const newDraft = e.target.value;
                            setSelected({ ...selected, emailDraft: newDraft });
                            setLeads((prev) => prev.map((l) => l.id === selected.id ? { ...l, emailDraft: newDraft } : l));
                          }}
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="aiEmpty">
                    <span>Optional</span>
                    <p>Generate an AI readout when you need reasoning, a concern check, or an outreach angle.</p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="detailEmpty">
              <span className="eyebrow">AI TARGET REVIEW</span>
              <strong>Select a company from the screening queue.</strong>
              <span>Its fit signals, financial profile and AI analysis will appear here.</span>
            </div>
          )}
        </section>
      </section>

      <footer className="footer">AI Lead Prioritizer · deterministic screening with optional AI review</footer>
    </main>
  );
}
