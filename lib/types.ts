export type Lead = {
  id: string;
  company: string;
  website?: string;
  industry?: string;
  employees: number;
  revenue: number;
  location?: string;
  technology?: string;
  growthSignal?: number;
  contactAvailable?: boolean;
  score: number;
  priority: "High" | "Medium" | "Low";
  reasons: string[];
  concern?: string;
  outreachAngle?: string;
  emailDraft?: string;
};

export type RawLead = Omit<Lead, "id" | "score" | "priority" | "reasons" | "concern" | "outreachAngle" | "emailDraft">;

export type ScoringRules = {
  targetIndustries: string[];
  targetLocations: string[];
  minRevenue: number;
  maxRevenue: number;
  minEmployees: number;
  maxEmployees: number;
};
