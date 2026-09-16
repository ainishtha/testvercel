import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Search, BookOpen, Lightbulb, BarChart3, GitCompare,
  ShieldCheck, ClipboardList, FileText, CheckCircle2,
  AlertCircle, ArrowRight, RefreshCw
} from 'lucide-react';
import { Card, Badge, ProgressBar, LoadingSpinner } from '../components/UI';
import { api } from '../services/api';
import type { Analysis, Problem } from '../types';

const agentPipeline = [
  { key: 'discovering', label: 'Discovery', icon: Search, desc: 'Identifying root causes' },
  { key: 'researching', label: 'Research', icon: BookOpen, desc: 'Gathering evidence' },
  { key: 'generating_solutions', label: 'Solutions', icon: Lightbulb, desc: 'Generating interventions' },
  { key: 'simulating', label: 'Simulation', icon: BarChart3, desc: 'Estimating impact' },
  { key: 'comparing', label: 'Comparison', icon: GitCompare, desc: 'Ranking alternatives' },
  { key: 'verifying', label: 'Verification', icon: ShieldCheck, desc: 'Validating assumptions' },
  { key: 'planning', label: 'Action Plan', icon: ClipboardList, desc: 'Creating implementation plan' },
  { key: 'reporting', label: 'Report', icon: FileText, desc: 'Building impact report' },
];

export default function AgentMissionControl() {
  const { id } = useParams<{ id: string }>();
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(false);

  const analysisId = parseInt(id || '0');

  const fetchData = async () => {
    try {
      const a = await api.getAnalysis(analysisId);
      setAnalysis(a);
      if (a.problem_id) {
        const p = await api.getProblem(a.problem_id);
        setProblem(p);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [analysisId]);

  useEffect(() => {
    if (!analysis || ['completed', 'failed'].includes(analysis.status)) return;
    setPolling(true);
    const interval = setInterval(fetchData, 3000);
    return () => { clearInterval(interval); setPolling(false); };
  }, [analysis?.status]);

  const getStatusIndex = (status: string) =>
    agentPipeline.findIndex((s) => s.key === status);

  const currentIdx = analysis ? getStatusIndex(analysis.status) : -1;
  const isComplete = analysis?.status === 'completed';
  const isFailed = analysis?.status === 'failed';

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size={24} label="Loading analysis..." />
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="p-8 text-center">
        <AlertCircle className="mx-auto mb-4 text-slate-600" size={40} />
        <p className="text-slate-400">Analysis not found</p>
        <Link to="/" className="text-sm text-emerald-400 hover:text-emerald-300 mt-2 inline-block">
          Return to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Mission Control</p>
          <h1 className="text-xl font-semibold text-white">{problem?.title || `Analysis #${analysis.id}`}</h1>
          <p className="text-sm text-slate-400 mt-1">{problem?.description?.slice(0, 120)}...</p>
        </div>
        <Badge status={analysis.status} />
      </div>

      <Card className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-slate-500 uppercase tracking-wider">Pipeline Progress</span>
          <span className="text-xs text-slate-500">
            {isComplete ? 'Complete' : isFailed ? 'Failed' : `Step ${currentIdx + 1} of ${agentPipeline.length}`}
          </span>
        </div>
        <ProgressBar value={isComplete ? 100 : Math.max(0, ((currentIdx + 1) / agentPipeline.length) * 100)} />
      </Card>

      <div className="grid grid-cols-4 gap-3 mb-6">
        {agentPipeline.map((step, i) => {
          const isDone = i < currentIdx || isComplete;
          const isActive = i === currentIdx && !isComplete && !isFailed;

          return (
            <Card
              key={step.key}
              className={`transition-colors ${
                isActive ? 'border-emerald-500/50 bg-emerald-500/5' :
                isDone ? 'border-slate-700' : 'border-slate-800/50'
              }`}
              padding={false}
            >
              <div className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  {isDone ? (
                    <CheckCircle2 size={16} className="text-emerald-400" />
                  ) : isActive ? (
                    <svg width={16} height={16} viewBox="0 0 24 24" className="animate-spin text-emerald-400">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" opacity="0.25" />
                      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" />
                    </svg>
                  ) : (
                    <step.icon size={16} className="text-slate-600" />
                  )}
                  <span className={`text-xs font-medium ${
                    isActive ? 'text-emerald-400' : isDone ? 'text-slate-300' : 'text-slate-500'
                  }`}>
                    {step.label}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600">{step.desc}</p>
              </div>
            </Card>
          );
        })}
      </div>

      {analysis.summary && (
        <Card className="mb-6">
          <h2 className="text-sm font-medium text-slate-300 uppercase tracking-wider mb-2">Summary</h2>
          <p className="text-sm text-slate-300">{analysis.summary}</p>
        </Card>
      )}

      {isComplete && (
        <div className="flex gap-3">
          <Link
            to={`/analysis/${analysis.id}/report`}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm rounded-lg transition-colors"
          >
            <FileText size={14} />
            View Impact Report
          </Link>
          <Link
            to={`/analysis/${analysis.id}/solutions`}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-sm rounded-lg border border-slate-700 transition-colors"
          >
            <BarChart3 size={14} />
            Compare Solutions
          </Link>
        </div>
      )}

      {isFailed && (
        <Card className="border-red-500/20 bg-red-500/5">
          <div className="flex items-center gap-2 text-red-400 mb-2">
            <AlertCircle size={16} />
            <span className="text-sm font-medium">Analysis Failed</span>
          </div>
          <p className="text-sm text-slate-400">{analysis.current_state || 'An error occurred during analysis.'}</p>
        </Card>
      )}
    </div>
  );
}
