import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, FileText, ShieldCheck, AlertTriangle, CheckCircle2,
  BookOpen, ExternalLink, Link2Off, CalendarX2, FlaskConical, ListChecks,
} from 'lucide-react';
import { Card, Badge, LoadingSpinner, EmptyState } from '../components/UI';
import { api } from '../services/api';
import type { Evidence, Solution, Comparison, Analysis } from '../types';

function isDemo(ev: Evidence): boolean {
  return (ev.is_demo ?? 0) === 1;
}

function qualityOf(ev: Evidence): { label: string; score: number } {
  const score = ev.quality_score ?? ev.confidence ?? 0;
  const label = (ev.quality ?? '').toLowerCase();
  if (['high', 'medium', 'low', 'unassessed'].includes(label)) {
    return { label, score };
  }
  if (score >= 0.8) return { label: 'high', score };
  if (score >= 0.5) return { label: 'medium', score };
  if (score > 0) return { label: 'low', score };
  return { label: 'unassessed', score };
}

const QUALITY_STYLE: Record<string, string> = {
  high: 'text-emerald-400',
  medium: 'text-amber-400',
  low: 'text-slate-400',
  unassessed: 'text-slate-500',
};

const QUALITY_BAR: Record<string, string> = {
  high: 'bg-emerald-500',
  medium: 'bg-amber-500',
  low: 'bg-slate-500',
  unassessed: 'bg-slate-600',
};

function EvidenceCard({ ev }: { ev: Evidence }) {
  const demo = isDemo(ev);
  const q = qualityOf(ev);
  const gaps = ev.gaps ?? [];

  return (
    <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700/50 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-white">{ev.source}</p>
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            {demo ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-500/10 text-slate-300 border border-slate-500/30">
                <FlaskConical size={11} className="mr-1" /> Demo evidence — not a real citation
              </span>
            ) : (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-500/10 text-blue-300 border border-blue-500/20">
                Sourced
              </span>
            )}
            {ev.is_verified === 1 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                <CheckCircle2 size={11} className="mr-1" /> Verified
              </span>
            )}
          </div>
        </div>
        <span className={`text-xs font-medium shrink-0 ${QUALITY_STYLE[q.label]}`}>
          {q.label} · {Math.round(q.score * 100)}%
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
        <div className="flex items-start gap-1.5">
          {ev.url ? (
            <a
              href={ev.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-blue-300 hover:text-blue-200 break-all"
            >
              <ExternalLink size={12} className="shrink-0" />
              <span className="break-all">{ev.url}</span>
            </a>
          ) : (
            <span className="inline-flex items-center gap-1 text-slate-500">
              <Link2Off size={12} /> No URL provided — not independently verifiable
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-slate-400">
          {ev.published_date ? (
            <span>Published: {ev.published_date}</span>
          ) : (
            <span className="inline-flex items-center gap-1 text-slate-500">
              <CalendarX2 size={12} /> Publication date not provided
            </span>
          )}
        </div>
      </div>

      {ev.summary && (
        <div>
          <p className="text-[11px] text-slate-500 uppercase tracking-wider mb-1">Summary</p>
          <p className="text-xs text-slate-400 leading-relaxed">{ev.summary}</p>
        </div>
      )}

      <div className="p-2.5 rounded-lg bg-slate-900/70 border border-slate-700/50">
        <p className="text-[11px] text-slate-500 uppercase tracking-wider mb-1">Relevant claim</p>
        <p className="text-sm text-slate-200">{ev.claim}</p>
      </div>

      <div>
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="text-slate-500">Evidence quality</span>
          <span className={`font-medium capitalize ${QUALITY_STYLE[q.label]}`}>{q.label}</span>
        </div>
        <div className="w-full bg-slate-800 rounded-full h-1.5">
          <div
            className={`h-1.5 rounded-full transition-all ${QUALITY_BAR[q.label]}`}
            style={{ width: `${Math.round(q.score * 100)}%` }}
          />
        </div>
      </div>

      {gaps.length > 0 && (
        <div>
          <p className="text-[11px] text-slate-500 uppercase tracking-wider mb-1">Evidence gaps</p>
          <ul className="space-y-1">
            {gaps.map((g, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-amber-200/80">
                <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                {g}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function EvidenceAssumptions() {
  const { id } = useParams<{ id: string }>();
  const analysisId = parseInt(id || '0');
  const [solutions, setSolutions] = useState<Solution[]>([]);
  const [evidenceMap, setEvidenceMap] = useState<Record<number, Evidence[]>>({});
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const [sols, a] = await Promise.all([
          api.getSolutions(analysisId),
          api.getAnalysis(analysisId),
        ]);
        setSolutions(sols);
        setAnalysis(a);
        const evMap: Record<number, Evidence[]> = {};
        for (const sol of sols) {
          evMap[sol.id] = await api.getSolutionEvidence(sol.id);
        }
        setEvidenceMap(evMap);
        setComparison(await api.getComparison(analysisId));
      } catch (err: any) {
        setLoadError(err.message || 'Failed to load evidence');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [analysisId]);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size={24} label="Loading evidence..." />
      </div>
    );
  }

  const allEvidence = Object.values(evidenceMap).flat();
  const sourced = allEvidence.filter((e) => !isDemo(e));
  const demo = allEvidence.filter((e) => isDemo(e));
  const openGaps = allEvidence.reduce((n, e) => n + (e.gaps?.length ?? 0), 0);
  const researchRunning = analysis && !['completed', 'failed'].includes(analysis.status);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link to={`/analysis/${analysisId}`} className="text-slate-500 hover:text-slate-300">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-white">Evidence & Assumptions</h1>
          <p className="text-sm text-slate-400">Sourced facts are shown separately from assumptions. Demo items are never real citations.</p>
        </div>
      </div>

      {loadError && (
        <div className="flex items-center gap-2 p-3 mb-4 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
          <AlertTriangle size={16} /> {loadError}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="flex items-center gap-3">
          <BookOpen size={18} className="text-blue-400 shrink-0" />
          <div>
            <p className="text-xs text-slate-500">Total Evidence</p>
            <p className="text-lg font-semibold text-white">{allEvidence.length}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
          <div>
            <p className="text-xs text-slate-500">Sourced Facts</p>
            <p className="text-lg font-semibold text-white">{sourced.length}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <FlaskConical size={18} className="text-slate-400 shrink-0" />
          <div>
            <p className="text-xs text-slate-500">Demo Items</p>
            <p className="text-lg font-semibold text-white">{demo.length}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <ListChecks size={18} className="text-amber-400 shrink-0" />
          <div>
            <p className="text-xs text-slate-500">Open Gaps</p>
            <p className="text-lg font-semibold text-white">{openGaps}</p>
          </div>
        </Card>
      </div>

      {allEvidence.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FileText size={32} />}
            title={researchRunning ? 'Research still running' : 'Live research unavailable'}
            description={
              researchRunning
                ? 'The research agent has not finished yet. Evidence will appear here once collection completes.'
                : 'No evidence was collected for this analysis. Live web research is not configured — set RESEARCH_PROVIDER (e.g. tavily) and SEARCH_API_KEY on the backend to enable sourced evidence. Demo evidence appears only for analyses run while the demo provider is active.'
            }
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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <Card className="lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-medium text-slate-300 uppercase tracking-wider">Evidence Items</h2>
                <Badge status={sourced.length > 0 ? 'completed' : 'pending'} />
              </div>
              <div className="space-y-3">
                {allEvidence.map((ev) => (
                  <EvidenceCard key={ev.id} ev={ev} />
                ))}
              </div>
            </Card>

            <div className="space-y-6">
              <Card>
                <h2 className="text-sm font-medium text-slate-300 uppercase tracking-wider mb-4">Solution Confidence</h2>
                {solutions.length === 0 ? (
                  <p className="text-xs text-slate-500">No solutions yet for this analysis.</p>
                ) : (
                  <div className="space-y-3">
                    {solutions.map((sol) => (
                      <div key={sol.id} className="p-3 bg-slate-800/50 rounded-lg">
                        <p className="text-sm font-medium text-white mb-1">{sol.name}</p>
                        <div className="flex items-center justify-between text-xs mb-2">
                          <span className="text-slate-500">Confidence</span>
                          <span className="text-emerald-400">{(sol.confidence * 100).toFixed(0)}%</span>
                        </div>
                        <div className="w-full bg-slate-800 rounded-full h-2">
                          <div
                            className="bg-emerald-500 h-2 rounded-full transition-all"
                            style={{ width: `${sol.confidence * 100}%` }}
                          />
                        </div>
                        <p className="text-xs text-slate-500 mt-2 line-clamp-2">{sol.description}</p>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card>
                <h2 className="text-sm font-medium text-slate-300 uppercase tracking-wider mb-3">
                  Sourced Facts vs Assumptions
                </h2>
                <p className="text-[11px] text-slate-500 uppercase tracking-wider mb-1.5">Sourced facts</p>
                {sourced.length === 0 ? (
                  <p className="text-xs text-slate-500 mb-3">None — no externally sourced evidence for this analysis.</p>
                ) : (
                  <ul className="space-y-1.5 mb-3">
                    {sourced.map((e) => (
                      <li key={e.id} className="text-xs text-slate-300">
                        <span className="text-emerald-400 mr-1">•</span>
                        {e.claim}{' '}
                        <span className="text-slate-500">({e.source})</span>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="text-[11px] text-slate-500 uppercase tracking-wider mb-1.5">Assumptions (not evidence)</p>
                <ul className="space-y-1.5">
                  {demo.map((e) => (
                    <li key={e.id} className="text-xs text-slate-400">
                      <span className="text-slate-500 mr-1">•</span>
                      {e.claim}{' '}
                      <span className="text-slate-600">(demo illustration)</span>
                    </li>
                  ))}
                  <li className="text-xs text-slate-400">
                    <span className="text-slate-500 mr-1">•</span>
                    All financial and environmental projections are estimates with stated low/high bounds.
                  </li>
                  <li className="text-xs text-slate-400">
                    <span className="text-slate-500 mr-1">•</span>
                    Rankings reflect modeled trade-offs, not measured outcomes.
                  </li>
                </ul>
              </Card>
            </div>
          </div>

          {comparison && (
            <Card className="mb-6">
              <h2 className="text-sm font-medium text-slate-300 uppercase tracking-wider mb-3">Rankings & Rationale</h2>
              <div className="space-y-2 mb-4">
                {comparison.rankings
                  .slice()
                  .sort((a, b) => b.overall_score - a.overall_score)
                  .map((rank, i) => (
                    <div key={rank.solution_id} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-slate-500 w-6">#{i + 1}</span>
                        <span className="text-sm text-white">{rank.name}</span>
                      </div>
                      <div className="flex items-center gap-4 text-xs">
                        <span className="text-slate-400">Overall: <span className="text-emerald-400">{rank.overall_score}</span></span>
                        <span className="text-slate-400">Impact: <span className="text-blue-400">{rank.impact_score}</span></span>
                      </div>
                    </div>
                  ))}
              </div>
              {comparison.recommendation && (
                <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-lg">
                  <p className="text-sm text-emerald-400 font-medium">{comparison.recommendation}</p>
                  {comparison.rationale && (
                    <p className="text-sm text-slate-400 mt-1">{comparison.rationale}</p>
                  )}
                </div>
              )}
            </Card>
          )}

          <div className="flex items-start gap-2 p-3 rounded-lg bg-slate-800/40 border border-slate-700/50">
            <ShieldCheck size={14} className="text-slate-500 mt-0.5 shrink-0" />
            <p className="text-xs text-slate-500">
              Provenance rule: only items with a retrievable URL count as sourced facts. Items without a URL —
              including all demo items — are planning illustrations or assumptions and must not be cited externally.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
