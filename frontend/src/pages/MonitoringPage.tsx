import { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Activity, Plus, TrendingUp, AlertTriangle,
  CheckCircle2, RefreshCw, FlaskConical, Factory,
} from 'lucide-react';
import { Card, Badge, LoadingSpinner, EmptyState } from '../components/UI';
import { api } from '../services/api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import type { MonitoringEntry, ActionPlan, Solution, Analysis } from '../types';

type VarianceStatus = 'pending' | 'on_track' | 'minor' | 'significant';

function varianceOf(predicted: number, actual: number | null): {
  status: VarianceStatus; abs: number | null; pct: number | null;
} {
  if (actual === null || actual === undefined) return { status: 'pending', abs: null, pct: null };
  const abs = actual - predicted;
  const pct = predicted !== 0 ? (abs / Math.abs(predicted)) * 100 : null;
  if (pct === null) return { status: 'pending', abs, pct };
  if (Math.abs(pct) <= 10) return { status: 'on_track', abs, pct };
  if (Math.abs(pct) <= 25) return { status: 'minor', abs, pct };
  return { status: 'significant', abs, pct };
}

const STATUS_META: Record<VarianceStatus, { label: string; badge: string; color: string }> = {
  pending: { label: 'Awaiting measurement', badge: 'pending', color: 'text-slate-500' },
  on_track: { label: 'On track (±10%)', badge: 'completed', color: 'text-emerald-400' },
  minor: { label: 'Minor variance (±25%)', badge: 'pending', color: 'text-amber-400' },
  significant: { label: 'Significant variance (>25%)', badge: 'failed', color: 'text-red-400' },
};

const fmtSigned = (v: number | null, unit: string, digits = 1) => {
  if (v === null || v === undefined) return '—';
  const sign = v > 0 ? '+' : '';
  return `${sign}${v.toLocaleString(undefined, { maximumFractionDigits: digits })} ${unit}`;
};

const tooltipStyle = { backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 };

export default function MonitoringPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const analysisId = parseInt(id || '0');
  const [monitoring, setMonitoring] = useState<MonitoringEntry[]>([]);
  const [actionPlan, setActionPlan] = useState<ActionPlan | null>(null);
  const [solutions, setSolutions] = useState<Solution[]>([]);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [recordingId, setRecordingId] = useState<number | null>(null);
  const [recordValue, setRecordValue] = useState('');
  const [reanalyzing, setReanalyzing] = useState(false);
  const [newMetric, setNewMetric] = useState({ metric_name: '', predicted_value: 0, actual_value: 0, unit: '', notes: '' });

  useEffect(() => {
    const load = async () => {
      try {
        const [entries, plan, sols, a] = await Promise.all([
          api.getMonitoring(analysisId),
          api.getActionPlan(analysisId),
          api.getSolutions(analysisId),
          api.getAnalysis(analysisId),
        ]);
        setMonitoring(entries);
        setActionPlan(plan);
        setSolutions(sols);
        setAnalysis(a);
      } catch (err: any) {
        setError(err.message || 'Failed to load monitoring data');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [analysisId]);

  const withVariance = useMemo(
    () => monitoring.map((m) => ({ entry: m, v: varianceOf(m.predicted_value, m.actual_value) })),
    [monitoring],
  );
  const measured = withVariance.filter((x) => x.entry.actual_value !== null);
  const onTrack = measured.filter((x) => x.v.status === 'on_track').length;
  const needsReanalysis = withVariance.some((x) => x.v.status === 'significant');

  const chartGroups = useMemo(() => {
    const groups = new Map<string, { name: string; predicted: number; actual: number }[]>();
    for (const { entry } of measured) {
      const arr = groups.get(entry.unit) ?? [];
      arr.push({
        name: entry.metric_name.length > 18 ? entry.metric_name.slice(0, 17) + '…' : entry.metric_name,
        predicted: entry.predicted_value,
        actual: entry.actual_value ?? 0,
      });
      groups.set(entry.unit, arr);
    }
    return [...groups.entries()];
  }, [measured]);

  const handleAddEntry = async () => {
    if (!actionPlan || !newMetric.metric_name.trim() || !newMetric.unit.trim()) {
      setError('Metric name and unit are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const entry = await api.createMonitoringEntry({
        action_plan_id: actionPlan.id,
        metric_name: newMetric.metric_name.trim(),
        predicted_value: newMetric.predicted_value,
        actual_value: newMetric.actual_value || undefined,
        unit: newMetric.unit.trim(),
        notes: newMetric.notes || undefined,
      });
      setMonitoring([...monitoring, entry]);
      setShowAddForm(false);
      setNewMetric({ metric_name: '', predicted_value: 0, actual_value: 0, unit: '', notes: '' });
    } catch (err: any) {
      setError(err.message || 'Failed to save entry');
    } finally {
      setSaving(false);
    }
  };

  const handleRecordActual = async (entryId: number) => {
    const value = parseFloat(recordValue);
    if (Number.isNaN(value)) {
      setError('Enter a numeric measured value.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const updated = await api.updateMonitoringEntry(entryId, { actual_value: value });
      setMonitoring(monitoring.map((m) => (m.id === entryId ? updated : m)));
      setRecordingId(null);
      setRecordValue('');
    } catch (err: any) {
      setError(err.message || 'Failed to record measurement');
    } finally {
      setSaving(false);
    }
  };

  const handleReanalyze = async () => {
    if (!analysis) return;
    setReanalyzing(true);
    setError('');
    try {
      const next = await api.createAnalysis(analysis.problem_id);
      navigate(`/analysis/${next.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to start reanalysis');
      setReanalyzing(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size={24} label="Loading monitoring data..." />
      </div>
    );
  }

  const actionPlanEntries = actionPlan?.steps || [];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Link to={`/analysis/${analysisId}`} className="text-slate-500 hover:text-slate-300">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1 min-w-[200px]">
          <h1 className="text-xl font-semibold text-white">Monitoring Dashboard</h1>
          <p className="text-sm text-slate-400">Simulated predictions checked against real measurements</p>
        </div>
        {needsReanalysis && (
          <button
            onClick={handleReanalyze}
            disabled={reanalyzing}
            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-700 text-white text-sm font-medium rounded-lg transition-colors"
            title="Results differ from projections — run the analysis again with what was learned"
          >
            <RefreshCw size={14} className={reanalyzing ? 'animate-spin' : ''} />
            {reanalyzing ? 'Starting...' : 'Reanalyze'}
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 mb-4 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="flex items-center gap-3">
          <Activity size={18} className="text-emerald-400 shrink-0" />
          <div>
            <p className="text-xs text-slate-500">Metrics Tracked</p>
            <p className="text-lg font-semibold text-white">{monitoring.length}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <CheckCircle2 size={18} className="text-blue-400 shrink-0" />
          <div>
            <p className="text-xs text-slate-500">On Track</p>
            <p className="text-lg font-semibold text-white">{onTrack}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <AlertTriangle size={18} className="text-amber-400 shrink-0" />
          <div>
            <p className="text-xs text-slate-500">Off Track</p>
            <p className="text-lg font-semibold text-white">{measured.length - onTrack}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <TrendingUp size={18} className="text-purple-400 shrink-0" />
          <div>
            <p className="text-xs text-slate-500">Prediction Accuracy</p>
            <p className="text-lg font-semibold text-white">
              {measured.length > 0 ? `${Math.round((onTrack / measured.length) * 100)}%` : '—'}
            </p>
          </div>
        </Card>
      </div>

      {chartGroups.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          {chartGroups.map(([unit, rows]) => (
            <Card key={unit}>
              <h2 className="text-sm font-medium text-slate-300 uppercase tracking-wider mb-1">
                Predicted vs Actual <span className="text-slate-600 normal-case">({unit})</span>
              </h2>
              <p className="text-xs text-slate-500 mb-3">
                <span className="text-blue-300">Blue = simulated prediction</span>
                {' · '}
                <span className="text-emerald-300">Green = real measurement</span>
              </p>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={rows}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} interval={0} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
                  <Bar dataKey="predicted" fill="#3b82f6" name="Predicted (simulated)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="actual" fill="#10b981" name="Actual (measured)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          ))}
        </div>
      )}

      {actionPlan && actionPlanEntries.length > 0 && (
        <Card className="mb-6">
          <h2 className="text-sm font-medium text-slate-300 uppercase tracking-wider mb-4">Implementation Progress</h2>
          <div className="space-y-2">
            {actionPlanEntries.map((step: any) => (
              <div key={step.order} className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                  step.order <= 2 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-500'
                }`}>
                  {step.order}
                </div>
                <div className="flex-1">
                  <p className="text-sm text-white">{step.title}</p>
                  <p className="text-xs text-slate-500">{step.description} · {step.duration_weeks} weeks</p>
                </div>
                {step.order <= 2 && <Badge status="completed" />}
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="mb-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-medium text-slate-300 uppercase tracking-wider">Tracked Metrics</h2>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs rounded-lg transition-colors"
          >
            <Plus size={12} /> Add Metric
          </button>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          <span className="inline-flex items-center gap-1 mr-3"><FlaskConical size={11} className="text-blue-400" /> Predicted = simulated estimate</span>
          <span className="inline-flex items-center gap-1"><Factory size={11} className="text-emerald-400" /> Actual = real measurement</span>
        </p>

        {showAddForm && (
          <div className="p-4 bg-slate-800/50 rounded-lg mb-4 border border-slate-700/50">
            {!actionPlan && (
              <p className="text-xs text-amber-400 mb-3">No action plan exists for this analysis yet — metrics need a plan to attach to.</p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="Metric name (e.g. Monthly kWh)"
                value={newMetric.metric_name}
                onChange={(e) => setNewMetric({ ...newMetric, metric_name: e.target.value })}
                className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50"
              />
              <input
                type="text"
                placeholder="Unit (e.g. kWh, USD, tons)"
                value={newMetric.unit}
                onChange={(e) => setNewMetric({ ...newMetric, unit: e.target.value })}
                className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50"
              />
              <input
                type="number"
                placeholder="Predicted value (simulated estimate)"
                value={newMetric.predicted_value || ''}
                onChange={(e) => setNewMetric({ ...newMetric, predicted_value: parseFloat(e.target.value) || 0 })}
                className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50"
              />
              <input
                type="number"
                placeholder="Actual value (optional — real measurement)"
                value={newMetric.actual_value || ''}
                onChange={(e) => setNewMetric({ ...newMetric, actual_value: parseFloat(e.target.value) || 0 })}
                className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50"
              />
              <input
                type="text"
                placeholder="Notes (optional)"
                value={newMetric.notes}
                onChange={(e) => setNewMetric({ ...newMetric, notes: e.target.value })}
                className="sm:col-span-2 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50"
              />
              <div className="sm:col-span-2 flex gap-2">
                <button
                  onClick={handleAddEntry}
                  disabled={saving || !actionPlan}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-400 text-white text-sm rounded-lg transition-colors"
                >
                  {saving ? 'Saving...' : 'Save Entry'}
                </button>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {monitoring.length === 0 ? (
          <EmptyState
            icon={<Activity size={32} />}
            title="No metrics tracked yet"
            description="Add a metric with its predicted (simulated) value, then record real measurements as they come in."
          />
        ) : (
          <div className="space-y-3">
            {withVariance.map(({ entry, v }) => {
              const meta = STATUS_META[v.status];
              return (
                <div key={entry.id} className="p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <span className="text-sm font-medium text-white">{entry.metric_name}</span>
                    <Badge status={meta.badge} />
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-sm">
                    <div>
                      <span className="text-slate-500 text-xs">Predicted</span>
                      <p className="text-blue-300">{entry.predicted_value.toLocaleString()} {entry.unit}</p>
                      <p className="text-[10px] text-slate-600">simulated estimate</p>
                    </div>
                    <div>
                      <span className="text-slate-500 text-xs">Actual</span>
                      {entry.actual_value !== null ? (
                        <>
                          <p className="text-emerald-300">{entry.actual_value.toLocaleString()} {entry.unit}</p>
                          <p className="text-[10px] text-slate-600">real measurement</p>
                        </>
                      ) : (
                        <p className="text-slate-500">Not recorded</p>
                      )}
                    </div>
                    <div>
                      <span className="text-slate-500 text-xs">Abs. variance</span>
                      <p className={meta.color}>{fmtSigned(v.abs, entry.unit, 1)}</p>
                      <p className="text-[10px] text-slate-600">actual − predicted</p>
                    </div>
                    <div>
                      <span className="text-slate-500 text-xs">% variance</span>
                      <p className={meta.color}>
                        {v.pct === null ? '—' : `${v.pct > 0 ? '+' : ''}${v.pct.toFixed(1)}%`}
                      </p>
                      <p className="text-[10px] text-slate-600">vs predicted</p>
                    </div>
                    <div>
                      <span className="text-slate-500 text-xs">Status</span>
                      <p className={`text-xs ${meta.color}`}>{meta.label}</p>
                    </div>
                    <div>
                      <span className="text-slate-500 text-xs">Date</span>
                      <p className="text-slate-400 text-xs">{new Date(entry.recorded_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  {entry.notes && (
                    <p className="text-xs text-slate-500 mt-2">{entry.notes}</p>
                  )}
                  {entry.actual_value === null && (
                    recordingId === entry.id ? (
                      <div className="flex flex-wrap items-center gap-2 mt-3">
                        <input
                          type="number"
                          autoFocus
                          placeholder={`Measured value (${entry.unit})`}
                          value={recordValue}
                          onChange={(e) => setRecordValue(e.target.value)}
                          className="flex-1 min-w-[160px] px-3 py-1.5 bg-slate-800 border border-emerald-500/40 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                        />
                        <button
                          onClick={() => handleRecordActual(entry.id)}
                          disabled={saving}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white text-xs rounded-lg transition-colors"
                        >
                          {saving ? 'Saving...' : 'Save measurement'}
                        </button>
                        <button
                          onClick={() => { setRecordingId(null); setRecordValue(''); }}
                          className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs rounded-lg transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setRecordingId(entry.id); setRecordValue(''); }}
                        className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs rounded-lg transition-colors"
                      >
                        <Plus size={12} /> Record actual measurement
                      </button>
                    )
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <div className="flex items-start gap-2 p-3 rounded-lg bg-slate-800/40 border border-slate-700/50">
        <FlaskConical size={14} className="text-slate-500 mt-0.5 shrink-0" />
        <p className="text-xs text-slate-500">
          Predicted values are simulated estimates from the impact model; actual values are real measurements you record.
          On track means within ±10% of prediction, minor variance within ±25%, significant beyond that —
          significant drift offers the Reanalyze action above to re-run the analysis with what was learned.
        </p>
      </div>

      {solutions.length > 0 && (
        <p className="text-[11px] text-slate-600 text-center pt-3 pb-2">
          Monitoring {solutions.length} intervention{solutions.length === 1 ? '' : 's'} in this analysis.
        </p>
      )}
    </div>
  );
}
