import { Lead, RawLead, ScoringRules } from "./types";

export const defaultRules: ScoringRules = {
  targetIndustries: [
    "manufacturing",
    "business services",
    "industrial",
    "healthcare services",
    "software",
    "logistics",
    "distribution"
  ],
  targetLocations: ["texas", "florida", "california", "new york", "illinois", "georgia"],
  minRevenue: 5000000,
  maxRevenue: 100000000,
  minEmployees: 50,
  maxEmployees: 1000
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function normalize(value = "") {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "").trim();
}

export function dedupeLeads(rows: RawLead[]) {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const domain = normalize(row.website);
    const key = `${normalize(row.company)}|${domain}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function scoreLead(row: RawLead | Partial<Lead>, index: number, rules: ScoringRules = defaultRules): Lead {
  const reasons: string[] = [];
  let score = 0;

  const industry = (row.industry ?? "").toLowerCase();
  const location = (row.location ?? "").toLowerCase();

  if (rules.targetIndustries.length > 0) {
    if (rules.targetIndustries.some((x) => industry.includes(x))) {
      score += 20;
      reasons.push("Target-industry fit");
    } else {
      reasons.push("Industry fit is weaker");
    }
  } else {
    score += 10;
    reasons.push("No specific industry target required");
  }

  const rev = row.revenue || 0;
  if (rev >= rules.minRevenue && rev <= rules.maxRevenue) {
    score += 15;
    reasons.push("Revenue is in the target range");
  } else if (rev > 0) {
    score += 7;
    reasons.push("Revenue is outside the ideal range");
  }

  const emp = row.employees || 0;
  if (emp >= rules.minEmployees && emp <= rules.maxEmployees) {
    score += 10;
    reasons.push("Company size is in the target range");
  } else {
    score += 4;
  }

  if (rules.targetLocations.length > 0) {
    if (rules.targetLocations.some((x) => location.includes(x))) {
      score += 10;
      reasons.push("Target geography");
    }
  } else {
    score += 5;
  }

  if (row.technology) {
    score += 10;
    reasons.push("Technology information is available");
  }

  const growth = clamp(Number(row.growthSignal ?? 0));
  score += Math.round(growth * 0.15);
  if (growth >= 60) reasons.push("Strong growth signal");

  if (row.contactAvailable) {
    score += 10;
    reasons.push("Contact information is available");
  }

  const dataPoints = [row.website, row.industry, row.location, row.technology].filter(Boolean).length;
  const dataQuality = Math.round((dataPoints / 4) * 10);
  score += dataQuality;
  if (dataQuality >= 8) reasons.push("Company data is well populated");

  const finalScore = clamp(Math.round(score));
  const priority = finalScore >= 80 ? "High" : finalScore >= 50 ? "Medium" : "Low";

  return {
    ...row,
    company: row.company || "Unknown Company",
    employees: row.employees || 0,
    revenue: row.revenue || 0,
    id: (row as Partial<Lead>).id || `${Date.now()}-${index}`,
    score: finalScore,
    priority,
    reasons: reasons.slice(0, 4)
  } as Lead;
}
