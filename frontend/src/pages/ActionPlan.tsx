import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, AlertTriangle, Pencil, Save, X, Plus, Trash2,
  Users, ListChecks, ShieldAlert, Target, Sparkles, Clock,
} from 'lucide-react';
import { Card, LoadingSpinner, EmptyState } from '../components/UI';
import { api } from '../services/api';
import type { ActionPlan, Solution, PlanPhase, PlanTask, PlanRisk } from '../types';

const GENERIC_ROLES = [
  'Project Sponsor', 'Project Manager', 'Facilities Manager',
  'Contractor / Vendor', 'Finance Lead', 'Occupant Representative',
];

const inputCls =
  'w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50';

function blankTask(phaseOrder: number, n: number): PlanTask {
  return {
    id: `new-${phaseOrder}-${Date.now()}-${n}`,
    title: '', description: '', role: 'Project Manager',
    dependencies: [], resources: [], duration_weeks: 1,
  };
}

export default function ActionPlanPage() {
  const { id } = useParams<{ id: string }>();
  const analysisId = parseInt(id || '0');
  const [solutions, setSolutions] = useState<Solution[]>([]);
  const [solutionId, setSolutionId] = useState<number | null>(null);
  const [plan, setPlan] = useState<ActionPlan | null>(null);
  const [draft, setDraft] = useState<ActionPlan | null>(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getSolutions(analysisId)
      .then((sols) => {
        setSolutions(sols);
        if (sols.length > 0) setSolutionId(sols[0].id);
        else setLoading(false);
      })
      .catch((e: any) => { setError(e.message || 'Failed to load interventions'); setLoading(false); });
  }, [analysisId]);

  useEffect(() => {
    if (solutionId === null) return;
    setLoading(true);
    setError('');
    setEditing(false);
    api.getActionPlanBySolution(solutionId)
      .then((p) => { setPlan(p); setDraft(p); })
      .catch((e: any) => setError(e.message || 'Failed to load action plan'))
      .finally(() => setLoading(false));
  }, [solutionId]);

  const handleGenerate = async () => {
    if (solutionId === null) return;
    setGenerating(true);
    setError('');
    try {
      const p = await api.generateActionPlan(analysisId, solutionId);
      setPlan(p);
      setDraft(p);
    } catch (e: any) {
      setError(e.message || 'Plan generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!plan || !draft) return;
    setSaving(true);
    setError('');
    try {
      const updated = await api.updateActionPlan(plan.id, {
        phases: draft.phases,
        success_metrics: draft.success_metrics,
        risk_register: draft.risk_register,
        timeline_months: draft.timeline_months,
        resources: draft.resources,
      });
      setPlan(updated);
      setDraft(updated);
      setEditing(false);
    } catch (e: any) {
      setError(e.message || 'Failed to save plan');
    } finally {
      setSaving(false);
    }
  };

  const patchPhase = (order: number, fn: (p: PlanPhase) => PlanPhase) =>
    setDraft((d) => d && ({ ...d, phases: d.phases.map((p) => (p.order === order ? fn(p) : p)) }));

  const patchTask = (order: number, idx: number, fn: (t: PlanTask) => PlanTask) =>
    patchPhase(order, (p) => ({ ...p, tasks: p.tasks.map((t, i) => (i === idx ? fn(t) : t)) }));

  if (loading && solutions.length === 0) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size={24} label="Loading action plan..." />
      </div>
    );
  }

  const selectedSolution = solutions.find((s) => s.id === solutionId);
  const view = editing ? draft : plan;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Link to={`/analysis/${analysisId}`} className="text-slate-500 hover:text-slate-300">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1 min-w-[200px]">
          <h1 className="text-xl font-semibold text-white">Action Plan</h1>
          <p className="text-sm text-slate-400">Phased implementation per intervention · timelines are estimates</p>
        </div>
        {plan && !editing && (
          <button
            onClick={() => { setDraft(plan); setEditing(true); }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm rounded-lg border border-slate-700 transition-colors"
          >
            <Pencil size={14} /> Edit plan
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 mb-4 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      <Card className="mb-4">
        <label className="block text-xs text-slate-500 uppercase tracking-wider mb-2">Selected intervention</label>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={solutionId ?? ''}
            onChange={(e) => setSolutionId(parseInt(e.target.value))}
            className="flex-1 min-w-[220px] px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500/50"
          >
            {solutions.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          {!plan && !loading && (
            <button
              onClick={handleGenerate}
              disabled={generating || solutionId === null}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-400 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Sparkles size={14} /> {generating ? 'Generating...' : 'Generate plan'}
            </button>
          )}
        </div>
        {selectedSolution && (
          <p className="text-xs text-slate-500 mt-2 line-clamp-2">{selectedSolution.description}</p>
        )}
      </Card>

      {!plan && !loading ? (
        <Card>
          <EmptyState
            icon={<Target size={32} />}
            title="No action plan yet"
            description="Generate a phased implementation plan (Audit → Pilot → Deployment → Measurement) for the selected intervention."
            action={
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white text-sm rounded-lg transition-colors"
              >
                <Sparkles size={14} /> {generating ? 'Generating...' : 'Generate plan'}
              </button>
            }
          />
        </Card>
      ) : view && (
        <>
          {editing && (
            <div className="flex items-center gap-2 mb-4">
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <Save size={14} /> {saving ? 'Saving...' : 'Save changes'}
              </button>
              <button
                onClick={() => { setDraft(plan); setEditing(false); setError(''); }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm rounded-lg border border-slate-700 transition-colors"
              >
                <X size={14} /> Cancel
              </button>
            </div>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <Card className="flex items-center gap-3">
              <Clock size={18} className="text-blue-400 shrink-0" />
              <div className="flex-1">
                <p className="text-xs text-slate-500">Timeline (est.)</p>
                {editing ? (
                  <input type="number" min={1} max={120} value={draft?.timeline_months ?? 0}
                    onChange={(e) => setDraft((d) => d && ({ ...d, timeline_months: parseInt(e.target.value) || 0 }))}
                    className={inputCls} />
                ) : (
                  <p className="text-lg font-semibold text-white">{view.timeline_months ?? '—'} <span className="text-xs font-normal text-slate-500">months</span></p>
                )}
              </div>
            </Card>
            <Card className="flex items-center gap-3">
              <ListChecks size={18} className="text-emerald-400 shrink-0" />
              <div>
                <p className="text-xs text-slate-500">Tasks</p>
                <p className="text-lg font-semibold text-white">{view.phases.reduce((n, p) => n + p.tasks.length, 0)}</p>
              </div>
            </Card>
            <Card className="flex items-center gap-3">
              <Target size={18} className="text-purple-400 shrink-0" />
              <div>
                <p className="text-xs text-slate-500">Success metrics</p>
                <p className="text-lg font-semibold text-white">{view.success_metrics.length}</p>
              </div>
            </Card>
            <Card className="flex items-center gap-3">
              <ShieldAlert size={18} className="text-amber-400 shrink-0" />
              <div>
                <p className="text-xs text-slate-500">Risks tracked</p>
                <p className="text-lg font-semibold text-white">{view.risk_register.length}</p>
              </div>
            </Card>
          </div>

          {view.phases.slice().sort((a, b) => a.order - b.order).map((phase) => (
            <Card key={phase.order} className="mb-4">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-medium shrink-0">
                  {phase.order}
                </span>
                <h2 className="text-sm font-medium text-white">{phase.name}</h2>
                <span className="text-xs text-slate-500">{phase.duration_weeks} weeks (est.)</span>
              </div>
              <p className="text-xs text-slate-400 mb-3 ml-8">{phase.objective}</p>
              <div className="space-y-2 ml-0 sm:ml-8">
                {phase.tasks.map((task, ti) => (
                  <div key={task.id || ti} className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
                    {editing ? (
                      <div className="space-y-2">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input value={task.title} placeholder="Task title"
                            onChange={(e) => patchTask(phase.order, ti, (t) => ({ ...t, title: e.target.value }))}
                            className={inputCls} />
                          <select value={task.role}
                            onChange={(e) => patchTask(phase.order, ti, (t) => ({ ...t, role: e.target.value }))}
                            className="px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500/50">
                            {GENERIC_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                          </select>
                        </div>
                        <textarea value={task.description} placeholder="Description" rows={2}
                          onChange={(e) => patchTask(phase.order, ti, (t) => ({ ...t, description: e.target.value }))}
                          className={`${inputCls} resize-none`} />
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <input value={task.dependencies.join(', ')} placeholder="Depends on (comma-separated)"
                            onChange={(e) => patchTask(phase.order, ti, (t) => ({ ...t, dependencies: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) }))}
                            className={inputCls} />
                          <input value={task.resources.join(', ')} placeholder="Resources (comma-separated)"
                            onChange={(e) => patchTask(phase.order, ti, (t) => ({ ...t, resources: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) }))}
                            className={inputCls} />
                          <input type="number" min={0} max={520} value={task.duration_weeks} placeholder="Weeks"
                            onChange={(e) => patchTask(phase.order, ti, (t) => ({ ...t, duration_weeks: parseInt(e.target.value) || 0 }))}
                            className={inputCls} />
                        </div>
                        <button
                          onClick={() => patchPhase(phase.order, (p) => ({ ...p, tasks: p.tasks.filter((_, i) => i !== ti) }))}
                          className="inline-flex items-center gap-1 text-xs text-red-400 hover:text-red-300">
                          <Trash2 size={12} /> Remove task
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <p className="text-sm font-medium text-slate-200">{task.title}</p>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-blue-500/10 text-blue-300 border border-blue-500/20">
                            <Users size={10} /> {task.role}
                          </span>
                          <span className="text-[11px] text-slate-500 ml-auto">{task.duration_weeks} wk</span>
                        </div>
                        <p className="text-xs text-slate-400 mb-2">{task.description}</p>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
                          {task.dependencies.length > 0 && <span>Depends on: {task.dependencies.join(', ')}</span>}
                          {task.resources.length > 0 && <span>Resources: {task.resources.join(', ')}</span>}
                        </div>
                      </>
                    )}
                  </div>
                ))}
                {editing && (
                  <button
                    onClick={() => patchPhase(phase.order, (p) => ({ ...p, tasks: [...p.tasks, blankTask(phase.order, p.tasks.length)] }))}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-emerald-400 hover:text-emerald-300 border border-dashed border-slate-700 hover:border-emerald-500/40 rounded-lg transition-colors">
                    <Plus size={12} /> Add task
                  </button>
                )}
              </div>
            </Card>
          ))}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            <Card>
              <h2 className="text-sm font-medium text-slate-300 uppercase tracking-wider mb-3">
                <Target size={13} className="inline mr-1" /> Success Metrics
              </h2>
              {editing ? (
                <div className="space-y-2">
                  {(draft?.success_metrics ?? []).map((m, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input value={m}
                        onChange={(e) => setDraft((d) => d && ({ ...d, success_metrics: d.success_metrics.map((x, j) => (j === i ? e.target.value : x)) }))}
                        className={inputCls} />
                      <button
                        onClick={() => setDraft((d) => d && ({ ...d, success_metrics: d.success_metrics.filter((_, j) => j !== i) }))}
                        className="text-red-400 hover:text-red-300 shrink-0"><Trash2 size={14} /></button>
                    </div>
                  ))}
                  <button
                    onClick={() => setDraft((d) => d && ({ ...d, success_metrics: [...d.success_metrics, ''] }))}
                    className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300">
                    <Plus size={12} /> Add metric
                  </button>
                </div>
              ) : (
                <ul className="space-y-1.5">
                  {view.success_metrics.map((m, i) => (
                    <li key={i} className="text-xs text-slate-300">• {m}</li>
                  ))}
                  {view.success_metrics.length === 0 && <li className="text-xs text-slate-600">No success metrics defined.</li>}
                </ul>
              )}
            </Card>

            <Card>
              <h2 className="text-sm font-medium text-slate-300 uppercase tracking-wider mb-3">
                <ShieldAlert size={13} className="inline mr-1" /> Risks & Mitigations
              </h2>
              {editing ? (
                <div className="space-y-2">
                  {(draft?.risk_register ?? []).map((r, i) => (
                    <div key={i} className="p-2 rounded-lg bg-slate-800/50 space-y-2">
                      <input value={r.risk} placeholder="Risk"
                        onChange={(e) => setDraft((d) => d && ({ ...d, risk_register: d.risk_register.map((x, j) => (j === i ? { ...x, risk: e.target.value } : x)) }))}
                        className={inputCls} />
                      <input value={r.mitigation} placeholder="Mitigation"
                        onChange={(e) => setDraft((d) => d && ({ ...d, risk_register: d.risk_register.map((x, j) => (j === i ? { ...x, mitigation: e.target.value } : x)) }))}
                        className={inputCls} />
                      <button
                        onClick={() => setDraft((d) => d && ({ ...d, risk_register: d.risk_register.filter((_, j) => j !== i) }))}
                        className="inline-flex items-center gap-1 text-xs text-red-400 hover:text-red-300">
                        <Trash2 size={12} /> Remove
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => setDraft((d) => d && ({ ...d, risk_register: [...d.risk_register, { risk: '', mitigation: '' }] }))}
                    className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300">
                    <Plus size={12} /> Add risk
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {view.risk_register.map((r, i) => (
                    <div key={i} className="p-2.5 rounded-lg bg-slate-800/50">
                      <p className="text-xs font-medium text-amber-200/90">⚠ {r.risk}</p>
                      <p className="text-xs text-slate-400 mt-1">→ {r.mitigation || 'No mitigation recorded.'}</p>
                    </div>
                  ))}
                  {view.risk_register.length === 0 && <p className="text-xs text-slate-600">No risks recorded.</p>}
                </div>
              )}
            </Card>
          </div>

          <div className="flex items-start gap-2 p-3 rounded-lg bg-slate-800/40 border border-slate-700/50">
            <Users size={14} className="text-slate-500 mt-0.5 shrink-0" />
            <p className="text-xs text-slate-500">
              Roles shown are generic placeholders (no organizational chart was provided).
              Assign real owners during edit. Timelines are planning estimates, not commitments.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
