import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, AlertTriangle, CheckCircle2, XCircle,
  ShieldCheck, ListChecks, FileQuestion, ChevronDown,
} from 'lucide-react';
import { Card, LoadingSpinner } from '../components/UI';
import { api } from '../services/api';
import type { VerificationReport, VerificationCheck } from '../types';

const STATUS_STYLE: Record<string, { badge: string; icon: typeof CheckCircle2; text: string; bar: string }> = {
  pass: {
    badge: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
    icon: CheckCircle2, text: 'text-emerald-400', bar: 'bg-emerald-500',
  },
  warning: {
    badge: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
    icon: AlertTriangle, text: 'text-amber-400', bar: 'bg-amber-500',
  },
  fail: {
    badge: 'bg-red-500/10 text-red-300 border-red-500/30',
    icon: XCircle, text: 'text-red-400', bar: 'bg-red-500',
  },
};

function StatusPill({ status, label }: { status: string; label?: string }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.warning;
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${s.badge}`}>
      <Icon size={13} /> {label ?? status.toUpperCase()}
    </span>
  );
}

function CheckCard({ check }: { check: VerificationCheck }) {
  const s = STATUS_STYLE[check.status] ?? STATUS_STYLE.warning;
  const Icon = s.icon;
  return (
    <Card>
      <div className="flex items-start justify-between gap-2 mb-1">
        <h3 className="text-sm font-medium text-white flex items-center gap-2">
          <Icon size={15} className={s.text} /> {check.label}
        </h3>
        <StatusPill status={check.status} />
      </div>
      {!check.checked && (
        <p className="text-[11px] text-slate-500 mb-1">This check did not run (insufficient data).</p>
      )}
      <p className="text-xs text-slate-400 leading-relaxed mb-2">{check.summary}</p>

      {check.warnings.length > 0 && (
        <div className="mb-2">
          <p className="text-[11px] text-amber-400/90 uppercase tracking-wider mb-1">Warnings</p>
          <ul className="space-y-1">
            {check.warnings.map((w, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-slate-300">
                <AlertTriangle size={12} className="mt-0.5 shrink-0 text-amber-400" /> {w}
              </li>
            ))}
          </ul>
        </div>
      )}

      {check.missing.length > 0 && (
        <div className="mb-2">
          <p className="text-[11px] text-slate-500 uppercase tracking-wider mb-1">Missing information</p>
          <ul className="space-y-1">
            {check.missing.map((m, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-slate-400">
                <FileQuestion size={12} className="mt-0.5 shrink-0 text-slate-500" /> {m}
              </li>
            ))}
          </ul>
        </div>
      )}

      {check.details.length > 0 && (
        <details className="group mt-2">
          <summary className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-300 cursor-pointer list-none transition-colors">
            <ChevronDown size={12} className="transition-transform group-open:rotate-180" />
            Inspect check details ({check.details.length})
          </summary>
          <ul className="mt-1.5 space-y-1 pl-4 border-l border-slate-700/60">
            {check.details.map((d, i) => (
              <li key={i} className="text-[11px] text-slate-500 font-mono">{d}</li>
            ))}
          </ul>
        </details>
      )}
    </Card>
  );
}

export default function Verification() {
  const { id } = useParams<{ id: string }>();
  const analysisId = parseInt(id || '0');
  const [report, setReport] = useState<VerificationReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getVerification(analysisId)
      .then(setReport)
      .catch((e: any) => setError(e.message || 'Failed to load verification'))
      .finally(() => setLoading(false));
  }, [analysisId]);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size={24} label="Running verification checks..." />
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
        <Card>
          <div className="flex items-center gap-2 text-red-400 mb-2">
            <XCircle size={16} />
            <span className="text-sm font-medium">Verification unavailable</span>
          </div>
          <p className="text-sm text-slate-400 mb-4">{error || 'No verification report found.'}</p>
          <Link to={`/analysis/${analysisId}`} className="text-sm text-emerald-400 hover:text-emerald-300">
            ← Back to Mission Control
          </Link>
        </Card>
      </div>
    );
  }

  const attentionCount = report.all_warnings.length + report.all_missing.length;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link to={`/analysis/${analysisId}`} className="text-slate-500 hover:text-slate-300">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-white">Verification Dashboard</h1>
          <p className="text-sm text-slate-400">
            {report.engine.name} v{report.engine.version} · {report.scope.solutions} interventions,{' '}
            {report.scope.estimates} estimates, {report.scope.evidence} evidence items
          </p>
        </div>
      </div>

      <Card className="mb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <StatusPill status={report.overall} label={report.overall_label} />
            <div className="text-xs text-slate-400">
              <span className="text-emerald-400 font-medium">{report.counts.pass} pass</span>
              {' · '}
              <span className="text-amber-400 font-medium">{report.counts.warning} warnings</span>
              {' · '}
              <span className="text-red-400 font-medium">{report.counts.fail} fail</span>
            </div>
          </div>
          <span className="text-[11px] text-slate-600">Computed live from stored analysis data</span>
        </div>
        {report.overall !== 'pass' && (
          <p className="text-xs text-slate-500 mt-2">
            {report.overall === 'fail'
              ? 'One or more checks found contradictions. Resolve the failures below before treating any result as verified.'
              : 'All critical checks hold, but advisories and gaps remain. Review them before deciding.'}
          </p>
        )}
      </Card>

      {attentionCount > 0 && (
        <Card className="mb-4">
          <h2 className="text-sm font-medium text-slate-300 uppercase tracking-wider mb-3">
            <ListChecks size={13} className="inline mr-1" />
            Needs attention ({attentionCount})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {report.all_warnings.length > 0 && (
              <div>
                <p className="text-[11px] text-amber-400/90 uppercase tracking-wider mb-1.5">Warnings</p>
                <ul className="space-y-1">
                  {report.all_warnings.map((w, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs text-slate-300">
                      <AlertTriangle size={12} className="mt-0.5 shrink-0 text-amber-400" /> {w}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {report.all_missing.length > 0 && (
              <div>
                <p className="text-[11px] text-slate-500 uppercase tracking-wider mb-1.5">Missing information</p>
                <ul className="space-y-1">
                  {report.all_missing.map((m, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs text-slate-400">
                      <FileQuestion size={12} className="mt-0.5 shrink-0 text-slate-500" /> {m}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {report.checks.map((c) => (
          <CheckCard key={c.key} check={c} />
        ))}
      </div>

      <div className="flex items-start gap-2 p-3 rounded-lg bg-slate-800/40 border border-slate-700/50">
        <ShieldCheck size={14} className="text-slate-500 mt-0.5 shrink-0" />
        <p className="text-xs text-slate-500">{report.disclaimer}</p>
      </div>
    </div>
  );
}
