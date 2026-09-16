import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, DollarSign, Clock, Zap, Play, AlertTriangle,
  Gauge, ListChecks, ShieldAlert, BookOpen, FlaskConical,
} from 'lucide-react';
import { Card, LoadingSpinner, EmptyState } from '../components/UI';
import { api } from '../services/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend } from 'recharts';
import type { Solution, Comparison, Evidence } from '../types';

const DIFFICULTY_STYLE: Record<string, string> = {
  low: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  medium: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  high: 'bg-red-500/10 text-red-400 border-red-500/20',
};

function DifficultyBadge({ level }: { level?: string }) {
  const key = (level ?? 'medium').toLowerCase();
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border capitalize ${DIFFICULTY_STYLE[key] ?? DIFFICULTY_STYLE.medium}`}>
      <Gauge size={11} className="mr-1" /> {key}
    </span>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] text-slate-500 uppercase tracking-wider mb-1">{children}</p>;
}

function SolutionCard({ solution, evidence }: { solution: Solution; evidence: Evidence[] }) {
  const assumptions = solution.assumptions ?? [];
  const risks = solution.risks ?? [];
  return (
    <Card className="flex flex-col">
      <div className="flex items-start justify-between gap-2 mb-1">
        <h3 className="text-sm font-medium text-white">{solution.name}</h3>
        <DifficultyBadge level={solution.difficulty} />
      </div>
      <p className="text-xs text-slate-400 leading-relaxed mb-3">{solution.description}</p>

      <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
        <div className="p-2 rounded-lg bg-slate-800/50">
          <FieldLabel>Estimated cost</FieldLabel>
          <p className="flex items-center gap-1 text-sm font-semibold text-white">
            <DollarSign size={13} className="text-slate-500" />
            {(solution.estimated_cost ?? 0).toLocaleString()}
            <span className="text-[10px] font-normal text-slate-500">est.</span>
          </p>
        </div>
        <div className="p-2 rounded-lg bg-slate-800/50">
          <FieldLabel>Timeline</FieldLabel>
          <p className="flex items-center gap-1 text-sm font-semibold text-white">
            <Clock size={13} className="text-slate-500" />
            {solution.estimated_timeline_months ?? '—'}
            <span className="text-[10px] font-normal text-slate-500">mo est.</span>
          </p>
        </div>
      </div>

      <div className="mb-3">
        <FieldLabel>Expected effect (estimate)</FieldLabel>
        <p className="flex items-start gap-1.5 text-xs text-emerald-300/90">
          <Zap size={12} className="mt-0.5 shrink-0" />
          {solution.expected_effect || 'Effect not yet estimated — run a simulation.'}
        </p>
      </div>

      <div className="mb-3">
        <FieldLabel><ListChecks size={11} className="inline mr-1" />Assumptions</FieldLabel>
        {assumptions.length === 0 ? (
          <p className="text-xs text-slate-600">No assumptions recorded.</p>
        ) : (
          <ul className="space-y-1">
            {assumptions.map((a, i) => (
              <li key={i} className="text-xs text-slate-400">• {a}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="mb-3">
        <FieldLabel><BookOpen size={11} className="inline mr-1" />Evidence</FieldLabel>
        {evidence.length === 0 ? (
          <p className="text-xs text-slate-600">No linked evidence for this intervention.</p>
        ) : (
          <ul className="space-y-1.5">
            {evidence.slice(0, 3).map((e) => (
              <li key={e.id} className="text-xs text-slate-400">
                • {e.claim}{' '}
                <span className="text-slate-600">
                  ({e.source}
                  {(e.is_demo ?? 0) === 1 ? ', demo illustration' : ''})
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-auto">
        <FieldLabel><ShieldAlert size={11} className="inline mr-1" />Risks</FieldLabel>
        {risks.length === 0 ? (
          <p className="text-xs text-slate-600">No risks recorded.</p>
        ) : (
          <ul className="space-y-1">
            {risks.map((r, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-amber-200/80">
                <AlertTriangle size={12} className="mt-0.5 shrink-0" /> {r}
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-slate-500 mt-3">
          Confidence: <span className="text-slate-300 font-medium">{(solution.confidence * 100).toFixed(0)}%</span>
        </p>
      </div>
    </Card>
  );
}

export default function SolutionComparison() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const analysisId = parseInt(id || '0');
  const [solutions, setSolutions] = useState<Solution[]>([]);
  const [evidenceMap, setEvidenceMap] = useState<Record<number, Evidence[]>>({});
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const sols = await api.getSolutions(analysisId);
        setSolutions(sols);
        const evMap: Record<number, Evidence[]> = {};
        for (const sol of sols) {
          evMap[sol.id] = await api.getSolutionEvidence(sol.id);
        }
        setEvidenceMap(evMap);
        setComparison(await api.getComparison(analysisId));
      } catch (err: any) {
        setLoadError(err.message || 'Failed to load solutions');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [analysisId]);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size={24} label="Loading solutions..." />
      </div>
    );
  }

  const scoreByName = new Map(
    (comparison?.rankings ?? []).map((r) => [r.name, r.overall_score]),
  );

  const costData = solutions.map((s) => ({
    name: s.name.split(' ').slice(0, 2).join(' '),
    cost: s.estimated_cost || 0,
  }));

  const radarData = comparison?.rankings.map((r) => ({
    name: r.name.split(' ').slice(0, 2).join(' '),
    cost: r.cost_score,
    impact: r.impact_score,
    feasibility: r.feasibility_score,
    timeline: r.timeline_score,
  })) || [];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center gap-3 mb-2">
        <Link to={`/analysis/${analysisId}`} className="text-slate-500 hover:text-slate-300">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1 min-w-[200px]">
          <h1 className="text-xl font-semibold text-white">Solution Comparison</h1>
          <p className="text-sm text-slate-400">{solutions.length} candidate interventions evaluated</p>
        </div>
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-500/10 text-slate-300 border border-slate-500/20">
          <FlaskConical size={11} /> All figures are estimates
        </span>
      </div>

      {loadError && (
        <div className="flex items-center gap-2 p-3 my-4 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
          <AlertTriangle size={16} /> {loadError}
        </div>
      )}

      {solutions.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Zap size={32} />}
            title="No interventions yet"
            description="Candidate interventions will appear here once the solution agent completes."
            action={
              <Link
                to={`/analysis/${analysisId}`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm rounded-lg border border-slate-700 transition-colors"
              >
                Back to Mission Control
              </Link>
            }
          />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-6">
            {solutions.map((s) => (
              <SolutionCard key={s.id} solution={s} evidence={evidenceMap[s.id] ?? []} />
            ))}
          </div>

          <Card className="mb-6" padding={false}>
            <div className="p-5 pb-3">
              <h2 className="text-sm font-medium text-slate-300 uppercase tracking-wider">Comparison Table</h2>
              <p className="text-xs text-slate-500 mt-1">Side-by-side estimates. Costs and effects are planning estimates, not quotes or measurements.</p>
            </div>
            <div className="overflow-x-auto px-5 pb-5">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="border-b border-slate-800">
                    <th className="text-left py-2 pr-3 text-slate-500 font-medium">Metric</th>
                    {solutions.map((s) => (
                      <th key={s.id} className="text-left py-2 px-3 text-slate-200 font-medium align-top">
                        {s.name}
                        <div className="mt-2">
                          <button
                            onClick={() => navigate(`/analysis/${analysisId}/simulator`)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg transition-colors"
                          >
                            <Play size={12} /> Simulate
                          </button>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-slate-800/50">
                    <td className="py-2.5 pr-3 text-slate-500 text-xs">Est. upfront cost</td>
                    {solutions.map((s) => (
                      <td key={s.id} className="py-2.5 px-3 text-white font-medium">
                        ${(s.estimated_cost ?? 0).toLocaleString()} <span className="text-[10px] text-slate-500 font-normal">est.</span>
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-slate-800/50">
                    <td className="py-2.5 pr-3 text-slate-500 text-xs">Timeline</td>
                    {solutions.map((s) => (
                      <td key={s.id} className="py-2.5 px-3 text-slate-300">{s.estimated_timeline_months ?? '—'} mo <span className="text-[10px] text-slate-500">est.</span></td>
                    ))}
                  </tr>
                  <tr className="border-b border-slate-800/50">
                    <td className="py-2.5 pr-3 text-slate-500 text-xs">Difficulty</td>
                    {solutions.map((s) => (
                      <td key={s.id} className="py-2.5 px-3"><DifficultyBadge level={s.difficulty} /></td>
                    ))}
                  </tr>
                  <tr className="border-b border-slate-800/50">
                    <td className="py-2.5 pr-3 text-slate-500 text-xs">Expected effect</td>
                    {solutions.map((s) => (
                      <td key={s.id} className="py-2.5 px-3 text-xs text-emerald-300/90 max-w-[220px]">{s.expected_effect || '—'}</td>
                    ))}
                  </tr>
                  <tr className="border-b border-slate-800/50">
                    <td className="py-2.5 pr-3 text-slate-500 text-xs">Confidence</td>
                    {solutions.map((s) => (
                      <td key={s.id} className="py-2.5 px-3 text-slate-300">{(s.confidence * 100).toFixed(0)}%</td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-2.5 pr-3 text-slate-500 text-xs">Overall score</td>
                    {solutions.map((s) => (
                      <td key={s.id} className="py-2.5 px-3 text-slate-300">
                        {scoreByName.get(s.name) ?? '—'}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>

          {radarData.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <Card>
                <h2 className="text-sm font-medium text-slate-300 uppercase tracking-wider mb-4">Score Comparison</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#334155" />
                    <PolarAngleAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 10 }} />
                    <Radar name="Cost" dataKey="cost" stroke="#10b981" fill="#10b981" fillOpacity={0.15} />
                    <Radar name="Impact" dataKey="impact" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.15} />
                    <Radar name="Feasibility" dataKey="feasibility" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.15} />
                    <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
                  </RadarChart>
                </ResponsiveContainer>
              </Card>

              <Card>
                <h2 className="text-sm font-medium text-slate-300 uppercase tracking-wider mb-4">Cost Comparison (est.)</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={costData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                      formatter={(v: number) => [`$${v.toLocaleString()} (est.)`, 'Cost']}
                    />
                    <Bar dataKey="cost" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </div>
          )}

          {comparison && (
            <Card className="mb-6">
              <h2 className="text-sm font-medium text-slate-300 uppercase tracking-wider mb-3">Recommendation</h2>
              <p className="text-sm text-emerald-400 font-medium mb-1">{comparison.recommendation}</p>
              <p className="text-sm text-slate-400">{comparison.rationale}</p>
            </Card>
          )}

          <p className="text-xs text-slate-600 text-center pb-2">
            Decision support only — Impactus recommends, it does not decide. All costs, effects, and scores are
            estimates based on disclosed assumptions, not vendor quotes or measured results.
          </p>
        </>
      )}
    </div>
  );
}
