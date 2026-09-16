import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Plus, ArrowRight, ArrowUpRight, DollarSign, Leaf,
  FolderKanban, FlaskConical, FileText, BarChart3,
  Activity, Info,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { Card, Badge, LoadingSpinner, ProgressBar } from '../components/UI';
import { api } from '../services/api';
import type { Problem, Analysis } from '../types';

/* ------------------------------------------------------------------ */
/* Sample data — illustrative demo figures only. Not verified impact.  */
/* ------------------------------------------------------------------ */

const SAMPLE_STATS = {
  problems: 12,
  active: 4,
  savings: 214000,
  co2: 486,
};

const SAMPLE_PROJECTS = [
  { id: 101, title: 'Campus electricity consumption is too high', domain: 'Energy Management', status: 'completed', updated: '2 days ago' },
  { id: 102, title: 'Water waste in residence halls', domain: 'Water Conservation', status: 'verifying', updated: '5 hours ago' },
  { id: 103, title: 'Low recycling rate across campus', domain: 'Waste Reduction', status: 'simulating', updated: '1 hour ago' },
  { id: 104, title: 'Commuter transport emissions rising', domain: 'Transportation', status: 'researching', updated: '25 minutes ago' },
  { id: 105, title: 'Dining hall food waste audit', domain: 'Waste Reduction', status: 'pending', updated: '10 minutes ago' },
];

const SAMPLE_ACTIVITY = [
  { id: 1, agent: 'Verification', text: 'Validated assumptions for Water waste analysis', time: '12 min ago' },
  { id: 2, agent: 'Simulation', text: 'Estimated impact for 4 recycling interventions', time: '1 hr ago' },
  { id: 3, agent: 'Solutions', text: 'Generated 4 interventions for transport emissions', time: '3 hrs ago' },
  { id: 4, agent: 'Research', text: 'Gathered 6 evidence sources for dining hall audit', time: '5 hrs ago' },
  { id: 5, agent: 'Decision', text: 'Ranked LED Retrofit as top recommendation', time: 'Yesterday' },
];

const SAMPLE_SCORE = { overall: 84, cost: 78, impact: 88, feasibility: 86, timeline: 72 };

const SAMPLE_SCENARIOS = [
  { name: 'LED Retrofit', savings: 54000, co2: 180 },
  { name: 'HVAC Controls', savings: 42000, co2: 140 },
  { name: 'Smart Scheduling', savings: 18500, co2: 62 },
  { name: 'Solar Install', savings: 96000, co2: 320 },
];

const STATUS_TO_AGENT: Record<string, string> = {
  discovering: 'Discovery',
  researching: 'Research',
  generating_solutions: 'Solutions',
  simulating: 'Simulation',
  comparing: 'Decision',
  verifying: 'Verification',
  planning: 'Action Plan',
  reporting: 'Report',
  pending: 'Orchestrator',
  completed: 'Orchestrator',
  failed: 'Orchestrator',
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'Yesterday' : `${days} days ago`;
}

function SampleBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-500/10 text-slate-400 border border-slate-500/20">
      <Info size={11} /> Sample data
    </span>
  );
}

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  isSample: boolean;
}

function MetricCard({ icon, label, value, sub, isSample }: MetricCardProps) {
  return (
    <Card className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-xs text-slate-500 uppercase tracking-wider">
          {icon}{label}
        </span>
        {isSample && <SampleBadge />}
      </div>
      <span className="text-2xl font-semibold text-white mt-1">{value}</span>
      <span className="text-xs text-slate-500">{sub}</span>
    </Card>
  );
}

interface ScenarioRow {
  name: string;
  savings: number;
  co2: number;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [problems, setProblems] = useState<Problem[]>([]);
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [scenarios, setScenarios] = useState<ScenarioRow[] | null>(null);
  const [score, setScore] = useState<typeof SAMPLE_SCORE | null>(null);
  const [loading, setLoading] = useState(true);
  const [backendDown, setBackendDown] = useState(false);
  const [seedingDemo, setSeedingDemo] = useState(false);

  const handleLoadDemo = async () => {
    setSeedingDemo(true);
    try {
      const res = await api.seedDemo();
      navigate(`/analysis/${res.analysis_id}`);
    } catch (err) {
      console.error(err);
    } finally {
      setSeedingDemo(false);
    }
  };

  useEffect(() => {
    const load = async () => {
      try {
        const [p, a] = await Promise.all([api.listProblems(), api.listAnalyses()]);
        setProblems(p);
        setAnalyses(a);

        const completed = a.filter((x) => x.status === 'completed');
        if (completed.length > 0) {
          const latest = completed[0];
          try {
            const [sim, comp] = await Promise.all([
              api.getSimulation(latest.id),
              api.getComparison(latest.id),
            ]);
            if (sim.results.length > 0) {
              const topName = comp?.rankings?.slice().sort((x, y) => y.overall_score - x.overall_score)[0]?.name;
              const top = sim.results.find((r) => r.solution_name === topName) ?? sim.results[0];
              setScenarios(sim.results.map((r) => ({
                name: r.solution_name,
                savings: Math.round(r.cost_savings.value),
                co2: Math.round(r.co2_reduction.value * 10) / 10,
              })));
              const ranked = comp?.rankings?.slice().sort((x, y) => y.overall_score - x.overall_score)[0];
              setScore(ranked ? {
                overall: ranked.overall_score,
                cost: ranked.cost_score,
                impact: ranked.impact_score,
                feasibility: ranked.feasibility_score,
                timeline: ranked.timeline_score,
              } : {
                overall: Math.round(top.scores.overall_score),
                cost: Math.round(top.scores.cost_score),
                impact: Math.round(top.scores.impact_score),
                feasibility: Math.round(top.scores.feasibility_score),
                timeline: Math.round(top.scores.timeline_score),
              });
            }
          } catch {
            /* simulation/comparison unavailable — fall back to sample */
          }
        }
      } catch {
        setBackendDown(true);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const hasLiveData = problems.length > 0 || analyses.length > 0;
  const isSample = !hasLiveData;
  const showSampleNotice = isSample || backendDown;

  const activeAnalyses = analyses.filter((a) => !['completed', 'failed'].includes(a.status));
  const latestAnalysis = analyses[0];

  const statProblems = isSample ? SAMPLE_STATS.problems : problems.length;
  const statActive = isSample ? SAMPLE_STATS.active : activeAnalyses.length;
  const topScenario = (scenarios ?? SAMPLE_SCENARIOS).slice().sort((a, b) => b.savings - a.savings)[0];
  const statSavings = isSample ? SAMPLE_STATS.savings : topScenario.savings;
  const statCo2 = isSample ? SAMPLE_STATS.co2 : topScenario.co2;

  const recentProjects = isSample
    ? SAMPLE_PROJECTS
    : analyses.slice(0, 5).map((a) => ({
        id: a.id,
        title: problems.find((p) => p.id === a.problem_id)?.title ?? `Analysis #${a.id}`,
        domain: (problems.find((p) => p.id === a.problem_id)?.domain ?? 'campus sustainability').replace(/_/g, ' '),
        status: a.status,
        updated: timeAgo(a.created_at),
      }));

  const activityFeed = isSample
    ? SAMPLE_ACTIVITY
    : analyses.slice(0, 5).map((a, i) => ({
        id: a.id,
        agent: STATUS_TO_AGENT[a.status] ?? 'Orchestrator',
        text: `${a.status === 'completed' ? 'Completed' : 'Running ' + (STATUS_TO_AGENT[a.status] ?? a.status)} — Analysis #${a.id}`,
        time: timeAgo(a.created_at),
      })).concat([]).slice(0, 5).map((e, i) => ({ ...e, id: e.id * 1000 + i }));

  const displayScore = score ?? SAMPLE_SCORE;
  const scoreIsSample = score === null;
  const displayScenarios = scenarios ?? SAMPLE_SCENARIOS;
  const scenariosAreSample = scenarios === null;

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size={24} label="Loading dashboard..." />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-white">Dashboard</h1>
            {showSampleNotice && <SampleBadge />}
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Campus sustainability impact at a glance. All projections are estimates.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleLoadDemo}
            disabled={seedingDemo}
            title="Load the predefined synthetic campus-electricity scenario (no live APIs needed)"
            className="inline-flex items-center gap-2 px-4 py-2 bg-transparent hover:bg-amber-500/10 disabled:text-slate-500 text-amber-300 text-sm font-medium rounded-lg border border-amber-500/30 transition-colors"
          >
            <FlaskConical size={14} /> {seedingDemo ? 'Loading demo...' : 'Load demo'}
          </button>
          <Link
            to="/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus size={14} /> New Analysis
          </Link>
        </div>
      </div>

      {/* 4 key metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard
          icon={<FolderKanban size={13} />}
          label="Total Problems Analyzed"
          value={String(statProblems)}
          sub={isSample ? 'Sample count for illustration' : 'Problems submitted to date'}
          isSample={isSample}
        />
        <MetricCard
          icon={<FlaskConical size={13} />}
          label="Active Impact Projects"
          value={String(statActive)}
          sub={isSample ? 'Sample count for illustration' : 'Analyses currently in progress'}
          isSample={isSample}
        />
        <MetricCard
          icon={<DollarSign size={13} />}
          label="Estimated Financial Savings"
          value={`$${statSavings.toLocaleString()}`}
          sub="Est. annual savings · top scenario"
          isSample={isSample}
        />
        <MetricCard
          icon={<Leaf size={13} />}
          label="Estimated Environmental Impact"
          value={`${statCo2.toLocaleString()} t`}
          sub="Est. CO₂ reduction / year · top scenario"
          isSample={isSample}
        />
      </div>

      {/* Recent projects + Quick actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-medium text-slate-300 uppercase tracking-wider">Recent Projects</h2>
              {isSample && <SampleBadge />}
            </div>
            <Link to="/analyses" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
              View all
            </Link>
          </div>
          <div className="space-y-2">
            {recentProjects.map((p) => (
              <Link
                key={p.id}
                to={isSample ? '/new' : `/analysis/${p.id}`}
                className="flex items-center justify-between gap-3 p-3 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition-colors group"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-200 group-hover:text-white truncate">{p.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5 capitalize">{p.domain} · {p.updated}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge status={p.status} />
                  <ArrowRight size={14} className="text-slate-600 group-hover:text-slate-400" />
                </div>
              </Link>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="text-sm font-medium text-slate-300 uppercase tracking-wider mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 gap-2">
            <Link
              to="/new"
              className="flex items-center justify-between p-3 rounded-lg bg-emerald-600/10 border border-emerald-500/20 hover:bg-emerald-600/20 transition-colors group"
            >
              <span className="flex items-center gap-2 text-sm text-emerald-300"><Plus size={14} /> Start new analysis</span>
              <ArrowUpRight size={14} className="text-emerald-500" />
            </Link>
            <Link
              to="/analyses"
              className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition-colors group"
            >
              <span className="flex items-center gap-2 text-sm text-slate-300"><Activity size={14} /> View mission control</span>
              <ArrowUpRight size={14} className="text-slate-500" />
            </Link>
            <Link
              to={latestAnalysis ? `/analysis/${latestAnalysis.id}/simulator` : '/analyses'}
              className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition-colors group"
            >
              <span className="flex items-center gap-2 text-sm text-slate-300"><BarChart3 size={14} /> Open impact simulator</span>
              <ArrowUpRight size={14} className="text-slate-500" />
            </Link>
            <Link
              to={latestAnalysis ? `/analysis/${latestAnalysis.id}/report` : '/analyses'}
              className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition-colors group"
            >
              <span className="flex items-center gap-2 text-sm text-slate-300"><FileText size={14} /> View latest impact report</span>
              <ArrowUpRight size={14} className="text-slate-500" />
            </Link>
          </div>
        </Card>
      </div>

      {/* Agent activity + Impact score */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-sm font-medium text-slate-300 uppercase tracking-wider">Agent Activity</h2>
            {isSample && <SampleBadge />}
          </div>
          <div className="space-y-1">
            {activityFeed.map((e) => (
              <div key={e.id} className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-slate-800/50 transition-colors">
                <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm text-slate-300">
                    <span className="font-medium text-slate-200">{e.agent}</span>
                    {' — '}{e.text}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">{e.time}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-medium text-slate-300 uppercase tracking-wider">Impact Score Summary</h2>
              {scoreIsSample && <SampleBadge />}
            </div>
            <span className="text-2xl font-semibold text-white">{displayScore.overall}<span className="text-sm text-slate-500">/100</span></span>
          </div>
          <div className="space-y-3">
            {[
              { label: 'Cost efficiency', value: displayScore.cost },
              { label: 'Impact magnitude', value: displayScore.impact },
              { label: 'Feasibility', value: displayScore.feasibility },
              { label: 'Timeline', value: displayScore.timeline },
            ].map((row) => (
              <div key={row.label}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-slate-400">{row.label}</span>
                  <span className="text-slate-300 font-medium">{row.value}</span>
                </div>
                <ProgressBar value={row.value} />
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-4">
            Weighted score of the top-ranked intervention. Estimates only — not a guarantee of outcomes.
          </p>
        </Card>
      </div>

      {/* Scenario comparison preview */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-medium text-slate-300 uppercase tracking-wider">Scenario Comparison Preview</h2>
            {scenariosAreSample && <SampleBadge />}
          </div>
          <Link
            to={latestAnalysis ? `/analysis/${latestAnalysis.id}/solutions` : '/analyses'}
            className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            Open full comparison →
          </Link>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={displayScenarios} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} interval={0} />
            <YAxis
              tick={{ fill: '#64748b', fontSize: 10 }}
              tickFormatter={(v: number) => `$${Math.round(v / 1000)}k`}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
              labelStyle={{ color: '#e2e8f0' }}
              formatter={(v: number, name: string) => {
                if (name === 'savings') return [`$${Number(v).toLocaleString()}/yr (est.)`, 'Annual savings'];
                return [`${v} t CO₂/yr (est.)`, 'CO₂ reduction'];
              }}
            />
            <Bar dataKey="savings" fill="#10b981" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
          {displayScenarios.map((s) => (
            <div key={s.name} className="p-2.5 rounded-lg bg-slate-800/50 text-center">
              <p className="text-xs font-medium text-slate-300 truncate">{s.name}</p>
              <p className="text-sm font-semibold text-emerald-400 mt-0.5">${s.savings.toLocaleString()}<span className="text-[11px] text-slate-500">/yr</span></p>
              <p className="text-[11px] text-slate-500">{s.co2} t CO₂/yr · est.</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Disclaimer */}
      <p className="text-xs text-slate-600 text-center pb-2">
        Figures labeled “Sample data” are illustrative demo figures for product evaluation only and do not
        represent verified real-world impact. All projections on this page are estimates subject to stated assumptions.
      </p>
    </div>
  );
}
