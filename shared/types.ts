export const CATEGORIES = [
  { id: 'business_registration', label: 'Business registration' },
  { id: 'operating_licence', label: 'Operating licences' },
  { id: 'tax_registration', label: 'Tax & employer registrations' },
  { id: 'premises_and_safety', label: 'Premises & safety' },
  { id: 'sector_specific', label: 'Activity specific requirements' },
  { id: 'renewals_and_filings', label: 'Renewals & ongoing filings' },
] as const;
export type Category = typeof CATEGORIES[number]['id'];
export type Priority = 'balanced' | 'cost' | 'speed' | 'certainty';
export interface ComparisonInput { activity: string; places: string[]; context: string; priority: Priority; }
export interface SourceEvidence {
  id: string; url: string; title: string; authority: string;
  checkedAt: string | null; quote: string; official: boolean;
  verification: 'matched' | 'reachable' | 'unavailable' | 'rejected';
  verificationNote: string; finalUrl?: string; contentHash?: string;
}
export interface Requirement {
  id: string; category: Category; title: string; description: string; authority: string;
  jurisdictionLevel: 'national' | 'state' | 'local' | 'unknown';
  status: 'required' | 'conditional' | 'not_required' | 'unknown';
  condition: string | null;
  cost: { status: 'known' | 'free' | 'variable' | 'unknown' | 'not_applicable'; amountMin: number | null; amountMax: number | null; currency: string | null; basis: string };
  time: { status: 'published' | 'unknown' | 'not_applicable'; minDays: number | null; maxDays: number | null; note: string };
  renewal: string; ongoingFiling: string; steps: string[]; dependencies: string[];
  sourceIds: string[]; confidence: 'confirmed' | 'needs_confirmation' | 'gap';
}
export interface PlaceReport {
  name: string; currency: string | null; summary: string; requirements: Requirement[]; gaps: string[];
  timeline: { status: 'published' | 'unknown'; minDays: number | null; maxDays: number | null; note: string; sourceIds: string[] };
  totals: { knownInitialCost: number | null; currency: string | null; unknownCostCount: number; conditionalCostCount: number; isComplete: boolean; note: string };
  coverage: { confirmed: number; needsConfirmation: number; gaps: number; categoriesCovered: number };
}
export interface ComparisonReport {
  id: string; activity: string; context: string; priority: Priority; generatedAt: string;
  assumptions: string[]; places: PlaceReport[]; sources: SourceEvidence[];
  recommendation: { place: string | null; headline: string; reasoning: string; tradeoffs: string[]; provisional: boolean; method: string; evidenceSourceIds?: string[]; ranking: { place: string; score: number | null; reasons: string[] }[] };
  warnings: string[];
  methodology: { endpoints: string[]; researchRunId: string; terminationReason: string | null; sourceCount: number; verifiedSourceCount: number; notes: string[] };
  rawReport?: string;
}
export type JobStatus = 'queued' | 'discovering' | 'researching' | 'verifying' | 'complete' | 'failed';
export interface ComparisonJob {
  id: string; status: JobStatus; input: ComparisonInput; createdAt: string; updatedAt: string;
  progress: { label: string; completed?: number; total?: number };
  report?: ComparisonReport; error?: string; researchRunId?: string; savedExample?: boolean;
}
export interface ExampleSummary { id: string; title: string; activity: string; places: string[]; checkedAt: string; description: string; }
export interface HealthResponse { status: string; configured: boolean; service: string; endpoints?: string[]; }
