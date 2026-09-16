// Local dev: relative '/api' (Vite proxies to the backend).
// Production (Vercel): set VITE_API_URL to the backend URL + '/api'.
const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) || '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  createProblem: (data: { title: string; description: string; domain?: string }) =>
    request<import('../types').Problem>('/problems', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  listProblems: () => request<import('../types').Problem[]>('/problems'),

  getProblem: (id: number) => request<import('../types').Problem>(`/problems/${id}`),

  createAnalysis: (problemId: number) =>
    request<import('../types').Analysis>('/analyses', {
      method: 'POST',
      body: JSON.stringify({ problem_id: problemId }),
    }),

  getAnalysis: (id: number) => request<import('../types').Analysis>(`/analyses/${id}`),

  listAnalyses: () => request<import('../types').Analysis[]>('/analyses'),

  getSolutions: (analysisId: number) =>
    request<import('../types').Solution[]>(`/solutions/${analysisId}`),

  getSolutionEstimates: (solutionId: number) =>
    request<import('../types').ImpactEstimate[]>(`/solutions/${solutionId}/estimates`),

  getSolutionEvidence: (solutionId: number) =>
    request<import('../types').Evidence[]>(`/solutions/${solutionId}/evidence`),

  getComparison: (analysisId: number) =>
    request<import('../types').Comparison>(`/comparisons/${analysisId}`),

  getActionPlan: (analysisId: number) =>
    request<import('../types').ActionPlan>(`/action-plans/${analysisId}`),

  getActionPlanBySolution: (solutionId: number) =>
    request<import('../types').ActionPlan | null>(`/action-plans/by-solution/${solutionId}`),

  generateActionPlan: (analysisId: number, solutionId: number) =>
    request<import('../types').ActionPlan>('/action-plans/generate', {
      method: 'POST',
      body: JSON.stringify({ analysis_id: analysisId, solution_id: solutionId }),
    }),

  updateActionPlan: (planId: number, data: {
    timeline_months?: number | null;
    resources?: string[];
    phases?: import('../types').PlanPhase[];
    success_metrics?: string[];
    risk_register?: import('../types').PlanRisk[];
  }) =>
    request<import('../types').ActionPlan>(`/action-plans/${planId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  getReport: (analysisId: number) =>
    request<import('../types').ImpactReport>(`/reports/${analysisId}`),

  getMonitoring: (analysisId: number) =>
    request<import('../types').MonitoringEntry[]>(`/monitoring/${analysisId}`),

  createMonitoringEntry: (data: {
    action_plan_id: number;
    metric_name: string;
    predicted_value: number;
    actual_value?: number;
    unit: string;
    notes?: string;
  }) =>
    request<import('../types').MonitoringEntry>('/monitoring', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateMonitoringEntry: (entryId: number, data: { actual_value?: number | null; notes?: string }) =>
    request<import('../types').MonitoringEntry>(`/monitoring/${entryId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  getSimulation: (analysisId: number) =>
    request<import('../types').SimulationResult>(`/simulator/${analysisId}`),

  runSimulation: (data: import('../types').SimulateInput) =>
    request<import('../types').SimulateResponse>('/simulate', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getRippleImpact: (analysisId: number) =>
    request<import('../types').RippleImpact>(`/ripple/${analysisId}`),

  getRippleGraph: (data: import('../types').SimulateInput & { scenario_key: string }) =>
    request<import('../types').RippleGraph>('/ripple-graph', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  scoreImpact: (data: { scenarios: import('../types').ImpactScoreScenarioInput[]; weights?: Record<string, number> }) =>
    request<import('../types').ImpactScoreResponse>('/impact-score', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getVerification: (analysisId: number) =>
    request<import('../types').VerificationReport>(`/verification/${analysisId}`),

  getDemoStatus: () =>
    request<import('../types').DemoStatus>('/demo/status'),

  seedDemo: () =>
    request<import('../types').DemoSeedResult>('/demo/seed', { method: 'POST' }),
};
