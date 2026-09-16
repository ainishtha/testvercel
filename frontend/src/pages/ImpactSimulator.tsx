import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Zap, DollarSign, Leaf, Clock, Wallet, Play,
  AlertTriangle, FlaskConical, Info,
} from 'lucide-react';
import { Card, LoadingSpinner, EmptyState } from '../components/UI';
import { api } from '../services/api';
import {
  BarChart, Bar, ErrorBar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ScatterChart, Scatter, ReferenceLine,
  LineChart, Line,
} from 'recharts';
import type { SimulateInput, SimulateResponse } from '../types';

const DEFAULT_INPUTS: SimulateInput = {
  baseline_kwh: 2_000_000,
  budget: 1_280_000,
  implementation_pct: 100,
  reduction_factor: 1.0,
  electricity_rate: 0.12,
  project_years: 10,
  emission_factor: 0.4,
};

const fmtInt = (v: number | null | undefined) =>
  v === null || v === undefined ? '—' : Math.round(v).toLocaleString();
const fmtMoney = (v: number | null | undefined) =>
  v === null || v === undefined ? '—' : `$${Math.round(v).toLocaleString()}`;

interface SliderProps {
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  value: number;
  display: string;
  onChange: (v: number) => void;
}

function SliderInput({ label, unit, min, max, step, value, display, onChange }: SliderProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs text-slate-400">{label}</label>
        <span className="text-xs font-medium text-white">{display} <span className="text-slate-500">{unit}</span></span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-emerald-500"
      />
      <div className="flex justify-between text-[10px] text-slate-600 mt-0.5">
        <span>{min}</span><span>{max}</span>
      </div>
    </div>
  );
}

const tooltipStyle = { backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 };
const legendStyle = { fontSize: 11, color: '#94a3b8' };

export default function ImpactSimulator() {
  const { id } = useParams<{ id: string }>();
  const analysisId = parseInt(id || '0');
  const [inputs, setInputs] = useState<SimulateInput>(DEFAULT_INPUTS);
  const [result, setResult] = useState<SimulateResponse | null>(null);
  const [problemTitle, setProblemTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getAnalysis(analysisId)
      .then((a) => api.getProblem(a.problem_id).then((p) => setProblemTitle(p.title)).catch(() => {}))
      .catch(() => {});
  }, [analysisId]);

  useEffect(() => {
    setRunning(true);
    setError('');
    const t = setTimeout(() => {
      api.runSimulation(inputs)
        .then(setResult)
        .catch((e: any) => setError(e.message || 'Simulation failed'))
        .finally(() => { setLoading(false); setRunning(false); });
    }, 400);
    return () => clearTimeout(t);
  }, [inputs]);

  const set = (patch: Partial<SimulateInput>) => setInputs((prev) => ({ ...prev, ...patch }));

  if (loading && !result) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size={24} label="Running simulation..." />
      </div>
    );
  }

  const totals = result?.totals;
  const scenarios = result?.scenarios ?? [];

  const scenarioBars = scenarios.map((s) => ({
    name: s.name.split(' ')[0],
    annual: s.financial_savings_annual.value ?? 0,
    lifetime: s.financial_savings_lifetime.value ?? 0,
  }));

  const costScatter = scenarios.map((s) => ({
    x: s.investment_cost.value,
    y: s.financial_savings_lifetime.value ?? 0,
    name: s.name,
  }));
  const maxScatter = Math.max(1, ...costScatter.flatMap((p) => [p.x, p.y]));

  const energyBars = scenarios.map((s) => ({
    name: s.name.split(' ')[0],
    value: s.energy_savings.value ?? 0,
    err: ((s.energy_savings.high_bound ?? 0) - (s.energy_savings.low_bound ?? 0)) / 2,
    low: s.energy_savings.low_bound ?? 0,
    high: s.energy_savings.high_bound ?? 0,
  }));

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Link to={`/analysis/${analysisId}`} className="text-slate-500 hover:text-slate-300">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1 min-w-[200px]">
          <h1 className="text-xl font-semibold text-white">Impact Simulator</h1>
          <p className="text-sm text-slate-400">{problemTitle || 'Campus electricity optimization'}</p>
        </div>
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-500/10 text-slate-300 border border-slate-500/20">
          <FlaskConical size={11} /> Deterministic estimates
        </span>
        {running && <span className="text-xs text-slate-500">Updating…</span>}
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 mb-4 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <Card className="lg:col-span-1">
          <h2 className="text-sm font-medium text-slate-300 uppercase tracking-wider mb-4">Inputs</h2>
          <div className="space-y-4">
            <SliderInput label="Budget" unit="USD" min={0} max={2000000} step={10000}
              value={inputs.budget} display={fmtInt(inputs.budget)} onChange={(v) => set({ budget: v })} />
            <SliderInput label="Implementation" unit="%" min={0} max={100} step={1}
              value={inputs.implementation_pct} display={`${inputs.implementation_pct}%`} onChange={(v) => set({ implementation_pct: v })} />
            <SliderInput label="Energy reduction assumption" unit="% of base" min={10} max={150} step={5}
              value={inputs.reduction_factor * 100} display={`${Math.round(inputs.reduction_factor * 100)}%`}
              onChange={(v) => set({ reduction_factor: v / 100 })} />
            <SliderInput label="Electricity price" unit="$/kWh" min={0.05} max={0.30} step={0.005}
              value={inputs.electricity_rate} display={`$${inputs.electricity_rate.toFixed(3)}`} onChange={(v) => set({ electricity_rate: v })} />
            <SliderInput label="Project duration" unit="years" min={1} max={25} step={1}
              value={inputs.project_years} display={`${inputs.project_years}`} onChange={(v) => set({ project_years: v })} />
          </div>
          <button
            onClick={() => set({ ...inputs })}
            className="mt-5 inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Play size={14} /> Re-run simulation
          </button>
          <p className="text-[11px] text-slate-600 mt-3">Baseline {inputs.baseline_kwh.toLocaleString()} kWh/yr · Grid factor {inputs.emission_factor} kg CO₂/kWh</p>
        </Card>

        <div className="lg:col-span-2 grid grid-cols-2 xl:grid-cols-3 gap-4 content-start">
          <Card className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10"><Zap size={18} className="text-emerald-400" /></div>
            <div>
              <p className="text-xs text-slate-500">Energy savings (est.)</p>
              <p className="text-lg font-semibold text-white">{fmtInt(totals?.energy_savings.value)} <span className="text-xs font-normal text-slate-500">kWh/yr</span></p>
            </div>
          </Card>
          <Card className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10"><DollarSign size={18} className="text-blue-400" /></div>
            <div>
              <p className="text-xs text-slate-500">Financial savings (est.)</p>
              <p className="text-lg font-semibold text-white">{fmtMoney(totals?.financial_savings_annual.value)}<span className="text-xs font-normal text-slate-500">/yr</span></p>
              <p className="text-[11px] text-slate-500">{fmtMoney(totals?.financial_savings_lifetime.value)} lifetime</p>
            </div>
          </Card>
          <Card className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10"><Leaf size={18} className="text-amber-400" /></div>
            <div>
              <p className="text-xs text-slate-500">CO₂e reduction (est.)</p>
              <p className="text-lg font-semibold text-white">{fmtInt(totals?.co2_reduction.value)} <span className="text-xs font-normal text-slate-500">t/yr</span></p>
            </div>
          </Card>
          <Card className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/10"><Wallet size={18} className="text-purple-400" /></div>
            <div>
              <p className="text-xs text-slate-500">Investment cost (est.)</p>
              <p className="text-lg font-semibold text-white">{fmtMoney(totals?.investment_cost.value)}</p>
              {totals && (
                <p className={`text-[11px] ${totals.within_budget ? 'text-emerald-400' : 'text-red-400'}`}>
                  {totals.within_budget ? 'Within budget' : `Over budget by $${Math.round(totals.budget_gap.value).toLocaleString()}`}
                </p>
              )}
            </div>
          </Card>
          <Card className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-slate-500/10"><Clock size={18} className="text-slate-300" /></div>
            <div>
              <p className="text-xs text-slate-500">Payback period (est.)</p>
              <p className="text-lg font-semibold text-white">
                {totals?.payback.value === null || totals?.payback.value === undefined
                  ? '—' : `${totals.payback.value} `}<span className="text-xs font-normal text-slate-500">years</span>
              </p>
            </div>
          </Card>
          <Card className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-slate-500/10"><Info size={18} className="text-slate-400" /></div>
            <div>
              <p className="text-xs text-slate-500">Scenarios modeled</p>
              <p className="text-lg font-semibold text-white">{scenarios.length}</p>
              <p className="text-[11px] text-slate-500">deterministic engine</p>
            </div>
          </Card>
        </div>
      </div>

      {!result ? (
        <Card>
          <EmptyState
            icon={<Zap size={32} />}
            title="No simulation yet"
            description="Adjust the inputs and run a simulation to see projected outcomes."
          />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            <Card>
              <h2 className="text-sm font-medium text-slate-300 uppercase tracking-wider mb-1">1 · Scenario comparison</h2>
              <p className="text-xs text-slate-500 mb-4">Est. annual vs lifetime financial savings (USD)</p>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={scenarioBars}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickFormatter={(v: number) => `$${Math.round(v / 1000)}k`} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`$${Math.round(Number(v)).toLocaleString()} (est.)`, '']} />
                  <Legend wrapperStyle={legendStyle} />
                  <Bar dataKey="annual" fill="#3b82f6" name="Annual savings" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="lifetime" fill="#10b981" name={`Lifetime (${inputs.project_years}y)`} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card>
              <h2 className="text-sm font-medium text-slate-300 uppercase tracking-wider mb-1">2 · Cost versus savings</h2>
              <p className="text-xs text-slate-500 mb-4">Investment vs lifetime savings (USD est.) — diagonal is break-even</p>
              <ResponsiveContainer width="100%" height={280}>
                <ScatterChart margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis type="number" dataKey="x" name="Investment" unit=" USD"
                    tick={{ fill: '#64748b', fontSize: 10 }} tickFormatter={(v: number) => `$${Math.round(v / 1000)}k`} />
                  <YAxis type="number" dataKey="y" name="Lifetime savings" unit=" USD"
                    tick={{ fill: '#64748b', fontSize: 10 }} tickFormatter={(v: number) => `$${Math.round(v / 1000)}k`} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ strokeDasharray: '3 3' }} />
                  <ReferenceLine segment={[{ x: 0, y: 0 }, { x: maxScatter, y: maxScatter }]} stroke="#64748b" strokeDasharray="5 5" />
                  <Scatter data={costScatter} fill="#10b981" />
                </ScatterChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-2 mt-2">
                {scenarios.map((s) => (
                  <span key={s.key} className="text-[11px] text-slate-500">{s.name.split(' ')[0]}: {fmtMoney(s.investment_cost.value)} in → {fmtMoney(s.financial_savings_lifetime.value)} out</span>
                ))}
              </div>
            </Card>

            <Card>
              <h2 className="text-sm font-medium text-slate-300 uppercase tracking-wider mb-1">3 · Energy reduction</h2>
              <p className="text-xs text-slate-500 mb-4">Est. kWh/year per scenario with uncertainty range</p>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={energyBars}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number, name: string, props: any) => {
                    const p = props?.payload;
                    return [`${Math.round(Number(v)).toLocaleString()} kWh/yr (range ${Math.round(p?.low ?? 0).toLocaleString()}–${Math.round(p?.high ?? 0).toLocaleString()})`, 'Energy savings'];
                  }} />
                  <Bar dataKey="value" fill="#10b981" name="kWh/year (est.)" radius={[4, 4, 0, 0]}>
                    <ErrorBar dataKey="err" width={4} strokeWidth={1.5} stroke="#e2e8f0" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card>
              <h2 className="text-sm font-medium text-slate-300 uppercase tracking-wider mb-1">4 · Sensitivity analysis</h2>
              <p className="text-xs text-slate-500 mb-4">How outcomes move with electricity price (all else fixed)</p>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={result.sensitivity.rate_sweep} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="electricity_rate" tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={(v: number) => `$${v.toFixed(2)}`} />
                  <YAxis yAxisId="left" tick={{ fill: '#64748b', fontSize: 10 }} tickFormatter={(v: number) => `$${Math.round(v / 1000)}k`} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fill: '#64748b', fontSize: 10 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={legendStyle} />
                  <Line yAxisId="left" type="monotone" dataKey="annual_savings_usd" name="Annual savings (USD)" stroke="#10b981" strokeWidth={2} dot={false} />
                  <Line yAxisId="right" type="monotone" dataKey="payback_years" name="Payback (years)" stroke="#f59e0b" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </div>

          <Card className="mb-4">
            <h2 className="text-sm font-medium text-slate-300 uppercase tracking-wider mb-1">Reduction-assumption sweep</h2>
            <p className="text-xs text-slate-500 mb-3">Same portfolio at 50%–150% of base engineering assumptions (deterministic)</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[520px]">
                <thead>
                  <tr className="border-b border-slate-800">
                    <th className="text-left py-2 pr-3 text-slate-500 font-medium text-xs">Reduction factor</th>
                    <th className="text-right py-2 px-3 text-slate-500 font-medium text-xs">Annual savings (est.)</th>
                    <th className="text-right py-2 px-3 text-slate-500 font-medium text-xs">Lifetime savings (est.)</th>
                    <th className="text-right py-2 pl-3 text-slate-500 font-medium text-xs">Payback (est.)</th>
                  </tr>
                </thead>
                <tbody>
                  {result.sensitivity.reduction_sweep.map((r) => (
                    <tr key={r.reduction_factor} className="border-b border-slate-800/50">
                      <td className="py-2 pr-3 text-slate-300">{Math.round(r.reduction_factor * 100)}%</td>
                      <td className="py-2 px-3 text-right text-white">{fmtMoney(r.annual_savings_usd)}</td>
                      <td className="py-2 px-3 text-right text-white">{fmtMoney(r.lifetime_savings_usd)}</td>
                      <td className="py-2 pl-3 text-right text-slate-300">{r.payback_years === null ? '—' : `${r.payback_years} yrs`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="mb-4">
            <h2 className="text-sm font-medium text-slate-300 uppercase tracking-wider mb-3">Assumptions & units</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ul className="space-y-1.5">
                {result.assumptions.map((a, i) => (
                  <li key={i} className="text-xs text-slate-400">• {a}</li>
                ))}
              </ul>
              <div className="p-3 bg-slate-800/50 rounded-lg text-xs space-y-1.5">
                <p className="text-slate-500 uppercase tracking-wider text-[11px]">Units</p>
                <p className="text-slate-400">Energy: {result.units.energy}</p>
                <p className="text-slate-400">Money: {result.units.money}</p>
                <p className="text-slate-400">Emissions: {result.units.co2}</p>
                <p className="text-slate-400">Payback: {result.units.payback}</p>
                <p className="text-slate-500 uppercase tracking-wider text-[11px] pt-2">Inputs used</p>
                {Object.entries(result.inputs).map(([k, m]) => (
                  <p key={k} className="text-slate-400">{k.replace(/_/g, ' ')}: {m.value.toLocaleString()} {m.unit}</p>
                ))}
              </div>
            </div>
          </Card>

          <p className="text-xs text-slate-600 text-center pb-2">
            All figures on this page are deterministic planning estimates computed from your inputs —
            not measured results, vendor quotes, or verified facts. Validate with site audits before deciding.
          </p>
        </>
      )}
    </div>
  );
}
