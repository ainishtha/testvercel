export interface Problem {
  id: number;
  title: string;
  description: string;
  domain: string;
  created_at: string;
}

export interface Analysis {
  id: number;
  problem_id: number;
  status: string;
  current_state: string | null;
  summary: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface RootCause {
  id: number;
  analysis_id: number;
  description: string;
  confidence: number;
  evidence: string[];
}

export interface Solution {
  id: number;
  analysis_id: number;
  name: string;
  description: string;
  solution_type: string;
  estimated_cost: number | null;
  estimated_timeline_months: number | null;
  confidence: number;
  difficulty?: string;
  expected_effect?: string | null;
  assumptions?: string[];
  risks?: string[];
}

export interface ImpactEstimate {
  id: number;
  solution_id: number;
  category: string;
  label: string;
  value: number;
  unit: string;
  is_estimate: number;
  assumptions: string[];
  low_bound: number | null;
  high_bound: number | null;
}

export interface Comparison {
  id: number;
  analysis_id: number;
  rankings: Ranking[];
  recommendation: string | null;
  rationale: string | null;
}

export interface Ranking {
  solution_id: number;
  name: string;
  cost_score: number;
  impact_score: number;
  feasibility_score: number;
  timeline_score: number;
  overall_score: number;
}

export interface Evidence {
  id: number;
  solution_id: number;
  source: string;
  claim: string;
  confidence: number;
  is_verified: number;
  url?: string | null;
  published_date?: string | null;
  summary?: string | null;
  quality?: string;
  quality_score?: number;
  gaps?: string[];
  is_demo?: number;
}

export interface PlanTask {
  id?: string;
  title: string;
  description: string;
  role: string;
  dependencies: string[];
  resources: string[];
  duration_weeks: number;
}

export interface PlanPhase {
  order: number;
  name: string;
  objective: string;
  duration_weeks: number;
  tasks: PlanTask[];
}

export interface PlanRisk {
  risk: string;
  mitigation: string;
}

export interface ActionPlan {
  id: number;
  analysis_id: number;
  solution_id: number;
  steps: ActionStep[];
  timeline_months: number | null;
  resources: string[];
  risks: string[];
  phases: PlanPhase[];
  success_metrics: string[];
  risk_register: PlanRisk[];
}

export interface ActionStep {
  order: number;
  title: string;
  description: string;
  duration_weeks: number;
}

export interface MonitoringEntry {
  id: number;
  action_plan_id: number;
  metric_name: string;
  predicted_value: number;
  actual_value: number | null;
  unit: string;
  recorded_at: string;
  notes: string | null;
}

export interface ImpactReport {
  problem: Problem;
  analysis: Analysis;
  root_causes: RootCause[];
  solutions: Solution[];
  impact_estimates: Record<number, ImpactEstimate[]>;
  comparison: Comparison | null;
  evidence: Record<number, Evidence[]>;
  action_plan: ActionPlan | null;
  monitoring: MonitoringEntry[];
}

export type AnalysisStatus =
  | 'pending'
  | 'discovering'
  | 'researching'
  | 'generating_solutions'
  | 'simulating'
  | 'comparing'
  | 'verifying'
  | 'planning'
  | 'reporting'
  | 'completed'
  | 'failed';

export interface SimulationResult {
  analysis_id: number;
  baseline_kwh: number;
  electricity_rate: number;
  emission_factor: number;
  problem_title: string;
  results: SimulationResultItem[];
}

export interface SimulationResultItem {
  solution_id: number;
  solution_name: string;
  description: string;
  solution_type: string;
  estimated_cost: number | null;
  estimated_timeline_months: number | null;
  confidence: number;
  energy_savings: { value: number; unit: string; low_bound: number; high_bound: number; assumptions: string[] };
  led_savings: { value: number; unit: string };
  hvac_savings: { value: number; unit: string };
  scheduling_savings: { value: number; unit: string };
  cost_savings: { value: number; unit: string; low_bound: number; high_bound: number; assumptions: string[] };
  co2_reduction: { value: number; unit: string; low_bound: number; high_bound: number; assumptions: string[] };
  payback: { value: number; unit: string; low_bound: number; high_bound: number; assumptions: string[] };
  roi: { value: number; unit: string; assumptions: string[] };
  scores: { cost_score: number; impact_score: number; feasibility_score: number; timeline_score: number; overall_score: number };
}

export interface SimulationInput {
  baseline_kwh: number;
  electricity_rate: number;
  emission_factor: number;
  led_reduction_pct: number;
  hvac_reduction_pct: number;
  scheduling_reduction_pct: number;
  solar_offset_kwh: number;
  total_investment: number;
}

export interface SimulateInput {
  baseline_kwh: number;
  budget: number;
  implementation_pct: number;
  reduction_factor: number;
  electricity_rate: number;
  project_years: number;
  emission_factor: number;
}

export interface SimulateMetric {
  value: number | null;
  unit: string;
  assumptions?: string[];
  low_bound?: number | null;
  high_bound?: number | null;
  is_estimate?: boolean;
}

export interface SimulateScenario {
  key: string;
  name: string;
  investment_cost: { value: number; unit: string; assumptions: string[] };
  energy_savings: SimulateMetric;
  financial_savings_annual: SimulateMetric;
  financial_savings_lifetime: SimulateMetric;
  co2_reduction: SimulateMetric;
  payback: SimulateMetric;
}

export interface SimulateTotals {
  investment_cost: { value: number; unit: string };
  energy_savings: { value: number; unit: string };
  financial_savings_annual: { value: number; unit: string };
  financial_savings_lifetime: { value: number; unit: string };
  co2_reduction: { value: number; unit: string };
  payback: SimulateMetric;
  within_budget: boolean;
  budget_gap: { value: number; unit: string };
}

export interface SimulateResponse {
  is_estimate: boolean;
  inputs: Record<string, { value: number; unit: string }>;
  units: { energy: string; money: string; co2: string; payback: string };
  scenarios: SimulateScenario[];
  totals: SimulateTotals;
  total_investment: number;
  total_annual_savings: number;
  sensitivity: {
    rate_sweep: { electricity_rate: number; annual_savings_usd: number; lifetime_savings_usd: number; payback_years: number | null }[];
    reduction_sweep: { reduction_factor: number; annual_savings_usd: number; lifetime_savings_usd: number; payback_years: number | null }[];
  };
  assumptions: string[];
}

export interface ImpactScoreFactor {
  key: string;
  label: string;
  score: number;
  weight: number;
  input_value: number | null;
  input_unit: string;
  explanation: string;
}

export interface ImpactScoreScenario {
  name: string;
  rank: number;
  overall: number;
  factors: ImpactScoreFactor[];
}

export interface ImpactScoreResponse {
  framework: { name: string; version: string; note: string };
  weights_used: Record<string, number>;
  scenarios: ImpactScoreScenario[];
  assumptions: string[];
}

export interface ImpactScoreScenarioInput {
  name: string;
  annual_kwh: number;
  annual_usd: number;
  co2_tons: number;
  people: number;
  cost_usd: number;
  timeline_months: number;
  confidence: number;
  evidence_quality: number;
  evidence_source: string;
}

export interface VerificationCheck {
  key: string;
  label: string;
  status: 'pass' | 'warning' | 'fail';
  checked: boolean;
  summary: string;
  details: string[];
  warnings: string[];
  missing: string[];
}

export interface VerificationReport {
  analysis_id: number;
  engine: { name: string; version: string };
  overall: 'pass' | 'warning' | 'fail';
  overall_label: string;
  counts: { pass: number; warning: number; fail: number };
  checks: VerificationCheck[];
  all_warnings: string[];
  all_missing: string[];
  scope: { solutions: number; estimates: number; evidence: number; comparison: boolean };
  disclaimer: string;
}

export interface RippleGraphNode {
  id: string;
  label: string;
  kind: string;
  metric: string;
  value: number | null;
  unit: string;
  low_bound?: number | null;
  high_bound?: number | null;
  assumptions: string[];
  calculation: string;
  is_estimate: boolean;
}

export interface RippleGraphEdge {
  from: string;
  to: string;
  formula: string;
  description: string;
}

export interface RippleGraph {
  is_estimate: boolean;
  scenario: string;
  scenario_key: string;
  nodes: RippleGraphNode[];
  edges: RippleGraphEdge[];
  assumptions: string[];
  inputs: Record<string, { value: number; unit: string }>;
  scenarios: { key: string; name: string }[];
}

export interface DemoStatus {
  demo_mode: boolean;
  llm_configured: boolean;
  research_provider: string;
  demo_available: boolean;
}

export interface DemoSeedResult {
  problem_id: number;
  analysis_id: number;
  created: boolean;
  demo_mode: boolean;
  llm_configured: boolean;
  research_provider: string;
  demo_available: boolean;
}

export interface RippleCategory {
  category: string;
  description: string;
  estimated_impact: string;
  timeframe: string;
  confidence: number;
  dependencies: string[];
}

export interface RippleImpact {
  analysis_id: number;
  problem_title: string;
  root_causes: { description: string; confidence: number }[];
  ripple_categories: RippleCategory[];
  financial_projection: {
    total_investment: number;
    annual_savings: number;
    '5_year_net_value': number;
    payback_period_months: number | null;
  };
  key_assumptions: string[];
}
