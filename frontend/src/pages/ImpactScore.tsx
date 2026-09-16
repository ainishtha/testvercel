import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, FlaskConical, Info, Users, ShieldCheck } from 'lucide-react';
import { Card, LoadingSpinner, EmptyState, ProgressBar } from '../components/UI';
import { api } from '../services/api';
import type {
  ImpactScoreResponse, ImpactScoreScenarioInput, SimulateScenario, Solution,
} from '../types';

const FACTOR_ORDER = [
  { key: 'environmental', label: 'Environmental Benefit' },
  { key: 'financial', label: 'Financial Benefit' },
  { key: 'people', label: 'People Benefited' },
  { key: 'feasibility', label: 'Feasibility' },
  { key: 'cost_efficiency', label: 'Cost Efficiency' },
  { key: 'evidence_quality', label: 'Evidence Quality' },
];

const DEFAULT_WEIGHTS: Record<string, number> = {
  environmental: 20, financial: 20, people: 15,
  feasibility: 15, cost_efficiency: 15, evidence_quality: 15,
};
const DEFAULT_TIMELINE: Record<string, number> = { led: 6, hvac: 8, scheduling: 3, solar: 18 };
const MATCH: Record<string, string> = { led: 'LED', hvac: 'HVAC', scheduling: 'Schedul', solar: 'Solar' };
const DEFAULT_PEOPLE = 5000;

export default function ImpactScore() {
  const { id } = useParams<{ id: string }>();
  const analysisId = parseInt(id || '0');
  const [simScenarios, setSimScenarios] = useState<SimulateScenario[]>([]);
  const [solutions, setSolutions] = useState<Solution[]>([]);
  const [weights, setWeights] = useState<Record<string, number>>(DEFAULT_WEIGHTS);
  const [people, setPeople] = useState<Record<string, number>>({});
  const [evQuality, setEvQuality] = useState<Record<string, number>>({});
  const [result, setResult] = useState<ImpactScoreResponse | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const [sols, sim] = await Promise.all([
          api.getSolutions(analysisId),
          api.runSimulation({
            baseline_kwh: 2_000_000, budget: 1_280_000, implementation_pct: 100,
            reduction_factor: 1.0, electricity_rate: 0.12, project_years: 10,
            emission_factor: 0.4,
          }),
        ]);
        setSolutions(sols);
        setSimScenarios(sim.scenarios);
      } catch (e: any) {
        setError(e.message || 'Failed to load scoring inputs');
        setLoading(false);
      }
    };
    load();
  }, [analysisId]);

  const scenarioInputs: ImpactScoreScenarioInput[] = useMemo(() => {
    return simScenarios.map((s) => {
      const needle = MATCH[s.key] ?? s.name;
      const stored = solutions.find((sol) => sol.name.includes(needle));
      return {
        name: s.name,
        annual_kwh: s.energy_savings.value ?? 0,
        annual_usd: s.financial_savings_annual.value ?? 0,
        co2_tons: s.co2_reduction.value ?? 0,
        people: people[s.key] ?? DEFAULT_PEOPLE,
        cost_usd: stored?.estimated_cost ?? s.investment_cost.value,
        timeline_months: stored?.estimated_timeline_months ?? DEFAULT_TIMELINE[s.key] ?? 12,
        confidence: stored?.confidence ?? 0.5,
        evidence_quality: (evQuality[s.key] ?? 50) / 100,
        evidence_source: stored
          ? 'stored solution + simulation estimates'
          : 'catalog defaults (no stored solution matched)',
      };
    });
  }, [simScenarios, solutions, people, evQuality]);

  useEffect(() => {
    if (scenarioInputs.length === 0) return;
    setRunning(true);
    setError('');
    const t = setTimeout(() => {
      api.scoreImpact({ scenarios: scenarioInputs, weights })
        .then((r) => {
          setResult(r);
          setSelected((prev) => prev ?? r.scenarios[0]?.name ?? null);
        })
        .catch((e: any) => setError(e.message || 'Scoring failed'))
        .finally(() => { setLoading(false); setRunning(false); });
    }, 400);
    return () => clearTimeout(t);
  }, [scenarioInputs, weights]);

  const weightTotal = Object.values(weights).reduce((a, b) => a + b, 0) || 1;
  const selectedScenario = result?.scenarios.find((s) => s.name === selected) ?? result?.scenarios[0];

  if (loading && !result) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size={24} label="Computing impact scores..." />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Link to={`/analysis/${analysisId}`} className="text-slate-500 hover:text-slate-300">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1 min-w-[200px]">
          <h1 className="text-xl font-semibold text-white">Impact Score</h1>
          <p className="text-sm text-slate-400">Transparent, inspectable ranking framework — not a scientific truth</p>
        </div>
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-500/10 text-slate-300 border border-slate-500/20">
          <FlaskConical size={11} /> Decision support only
        </span>
        {running && <span className="text-xs text-slate-500">Recalculating…</span>}
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 mb-4 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {!result ? (
        <Card>
          <EmptyState
            icon={<ShieldCheck size={32} />}
            title="No scores yet"
            description="Run an analysis with solutions first, then return here to score the interventions."
          />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
            <Card>
              <h2 className="text-sm font-medium text-slate-300 uppercase tracking-wider mb-1">Weights</h2>
              <p className="text-xs text-slate-500 mb-4">Configurable — normalized to 100%</p>
              <div className="space-y-3">
                {FACTOR_ORDER.map((f) => (
                  <div key={f.key}>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs text-slate-400">{f.label}</label>
                      <span className="text-xs text-slate-300 font-medium">
                        {weights[f.key] ?? 0} <span className="text-slate-600">({Math.round(((weights[f.key] ?? 0) / weightTotal) * 100)}%)</span>
                      </span>
                    </div>
                    <input
                      type="range" min={0} max={50} step={1}
                      value={weights[f.key] ?? 0}
                      onChange={(e) => setWeights((w) => ({ ...w, [f.key]: parseInt(e.target.value) }))}
                      className="w-full accent-emerald-500"
                    />
                  </div>
                ))}
              </div>
              <button
                onClick={() => setWeights(DEFAULT_WEIGHTS)}
                className="mt-4 text-xs text-slate-500 hover:text-slate-300 transition-colors"
              >
                Reset to defaults
              </button>
            </Card>

            <Card className="lg:col-span-2">
              <h2 className="text-sm font-medium text-slate-300 uppercase tracking-wider mb-1">Overall ranking</h2>
              <p className="text-xs text-slate-500 mb-4">Weighted overall score, 0–100 · {result.framework.name} v{result.framework.version}</p>
              <div className="space-y-2">
                {result.scenarios.map((s) => (
                  <button
                    key={s.name}
                    onClick={() => setSelected(s.name)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${
                      selectedScenario?.name === s.name
                        ? 'bg-emerald-500/5 border-emerald-500/30'
                        : 'bg-slate-800/50 border-slate-700/50 hover:border-slate-600'
                    }`}
                  >
                    <span className="text-sm font-bold text-slate-500 w-7">#{s.rank}</span>
                    <span className="flex-1 text-sm font-medium text-white">{s.name}</span>
                    <span className="w-32 hidden sm:block"><ProgressBar value={s.overall} /></span>
                    <span className="text-lg font-semibold text-white w-14 text-right">{s.overall}</span>
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-slate-600 mt-3">Select a scenario to inspect its factor-level calculation below.</p>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
            <Card className="lg:col-span-2">
              <h2 className="text-sm font-medium text-slate-300 uppercase tracking-wider mb-1">
                Factor scores — {selectedScenario?.name}
              </h2>
              <p className="text-xs text-slate-500 mb-4">Each factor shows its input, weight, and exactly how the score was derived</p>
              <div className="space-y-4">
                {selectedScenario?.factors.map((f) => (
                  <div key={f.key} className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-slate-200">{f.label}</span>
                      <span className="text-xs text-slate-400">
                        <span className="text-white font-semibold">{f.score}</span> / 100 · weight {f.weight}%
                        {f.input_value !== null && f.input_value !== undefined && (
                          <span className="text-slate-500"> · input {f.input_value.toLocaleString()} {f.input_unit}</span>
                        )}
                      </span>
                    </div>
                    <ProgressBar value={f.score} className="mb-2" />
                    <p className="text-xs text-slate-500">{f.explanation}</p>
                  </div>
                ))}
              </div>
            </Card>

            <div className="space-y-4">
              <Card>
                <h2 className="text-sm font-medium text-slate-300 uppercase tracking-wider mb-3">Weight distribution</h2>
                <div className="space-y-2">
                  {FACTOR_ORDER.map((f) => {
                    const pct = result.weights_used[f.key] ?? 0;
                    return (
                      <div key={f.key}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-slate-400">{f.label}</span>
                          <span className="text-slate-300">{pct}%</span>
                        </div>
                        <ProgressBar value={pct} />
                      </div>
                    );
                  })}
                </div>
              </Card>

              <Card>
                <h2 className="text-sm font-medium text-slate-300 uppercase tracking-wider mb-3">
                  <Users size={13} className="inline mr-1" /> Scenario inputs
                </h2>
                <p className="text-[11px] text-slate-600 mb-3">People reached and evidence quality are your assessed inputs — adjust them, scores update.</p>
                <div className="space-y-4">
                  {simScenarios.map((s) => (
                    <div key={s.key} className="p-2.5 rounded-lg bg-slate-800/50">
                      <p className="text-xs font-medium text-slate-200 mb-2">{s.name}</p>
                      <label className="text-[11px] text-slate-500">People benefited (est.)</label>
                      <input
                        type="number" min={0} max={1000000000}
                        value={people[s.key] ?? DEFAULT_PEOPLE}
                        onChange={(e) => setPeople((p) => ({ ...p, [s.key]: Math.max(0, parseInt(e.target.value) || 0) }))}
                        className="w-full mt-1 px-2 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500/50"
                      />
                      <div className="flex justify-between mt-2 mb-1">
                        <label className="text-[11px] text-slate-500">Evidence quality</label>
                        <span className="text-[11px] text-slate-300">{evQuality[s.key] ?? 50}/100</span>
                      </div>
                      <input
                        type="range" min={0} max={100} step={5}
                        value={evQuality[s.key] ?? 50}
                        onChange={(e) => setEvQuality((q) => ({ ...q, [s.key]: parseInt(e.target.value) }))}
                        className="w-full accent-emerald-500"
                      />
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>

          <Card className="mb-4">
            <h2 className="text-sm font-medium text-slate-300 uppercase tracking-wider mb-3">
              <Info size={13} className="inline mr-1" /> How this score is calculated
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed mb-2">{result.framework.note}</p>
            <ul className="space-y-1.5">
              {result.assumptions.map((a, i) => (
                <li key={i} className="text-xs text-slate-400">• {a}</li>
              ))}
            </ul>
          </Card>

          <p className="text-xs text-slate-600 text-center pb-2">
            Scores rank only the interventions in this run. Change the set, inputs, or weights and the ranking can change — inspect each factor above before deciding.
          </p>
        </>
      )}
    </div>
  );
}
