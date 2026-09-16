import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, TrendingUp, Shield, Lightbulb, ChevronDown,
  Info, Calculator,
} from 'lucide-react';
import { Card, StatCard, LoadingSpinner } from '../components/UI';
import { api } from '../services/api';
import type { RippleImpact, RippleGraph, RippleGraphNode } from '../types';

const GRAPH_INPUTS = {
  baseline_kwh: 2_000_000,
  budget: 1_280_000,
  implementation_pct: 100,
  reduction_factor: 1.0,
  electricity_rate: 0.12,
  project_years: 10,
  emission_factor: 0.4,
};

const KIND_DOT: Record<string, string> = {
  intervention: 'bg-slate-400',
  energy: 'bg-emerald-400',
  financial: 'bg-blue-400',
  environmental: 'bg-amber-400',
};

function fmtValue(node: RippleGraphNode): string {
  const v = node.value;
  if (v === null || v === undefined) return '—';
  if (node.unit === 'USD' || node.unit === 'USD/year') return `$${Math.round(v).toLocaleString()}`;
  if (node.unit.includes('CO2')) return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return Math.round(v).toLocaleString();
}

function EdgeConnector({ formula, description }: { formula: string; description: string }) {
  return (
    <div className="flex flex-col items-center py-1" title={description}>
      <div className="w-px h-5 bg-slate-700" />
      <ChevronDown size={14} className="text-slate-500 -my-0.5" />
      <span className="mt-1 px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700/60 text-[10px] text-slate-400 font-mono">
        {formula}
      </span>
    </div>
  );
}

function GraphNode({
  node, selected, onSelect,
}: {
  node: RippleGraphNode; selected: boolean; onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left p-4 rounded-xl border transition-colors ${
        selected
          ? 'bg-emerald-500/5 border-emerald-500/40'
          : 'bg-slate-800/50 border-slate-700/50 hover:border-slate-600'
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className={`w-2 h-2 rounded-full ${KIND_DOT[node.kind] ?? 'bg-slate-500'}`} />
        <span className="text-sm font-medium text-white">{node.label}</span>
        <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-slate-500">
          <Info size={10} /> {node.assumptions.length} assumption{node.assumptions.length === 1 ? '' : 's'} · est.
        </span>
      </div>
      <p className="text-[11px] text-slate-500 uppercase tracking-wider">{node.metric}</p>
      <p className="text-xl font-semibold text-white">
        {fmtValue(node)} <span className="text-xs font-normal text-slate-500">{node.unit}</span>
      </p>
      {(node.low_bound !== null && node.low_bound !== undefined) && (
        <p className="text-[11px] text-slate-600 mt-0.5">
          Range {Math.round(node.low_bound).toLocaleString()} – {Math.round(node.high_bound ?? 0).toLocaleString()} {node.unit}
        </p>
      )}
    </button>
  );
}

function Inspector({ node }: { node: RippleGraphNode | undefined }) {
  if (!node) {
    return (
      <Card>
        <h2 className="text-sm font-medium text-slate-300 uppercase tracking-wider mb-2">Inspector</h2>
        <p className="text-xs text-slate-500">Select a node in the graph to inspect how its value was calculated.</p>
      </Card>
    );
  }
  return (
    <Card>
      <div className="flex items-center gap-2 mb-1">
        <span className={`w-2 h-2 rounded-full ${KIND_DOT[node.kind] ?? 'bg-slate-500'}`} />
        <h2 className="text-sm font-medium text-white">{node.label}</h2>
      </div>
      <p className="text-[11px] text-slate-500 uppercase tracking-wider">{node.metric}</p>
      <p className="text-2xl font-semibold text-white mb-1">
        {fmtValue(node)} <span className="text-sm font-normal text-slate-500">{node.unit}</span>
      </p>
      <p className="text-[11px] text-slate-500 mb-4">Estimate — not a measured result</p>

      <p className="text-[11px] text-slate-500 uppercase tracking-wider mb-1.5">Calculation</p>
      <p className="text-xs text-slate-300 font-mono leading-relaxed p-2.5 rounded-lg bg-slate-900/70 border border-slate-700/50 mb-4">
        {node.calculation}
      </p>

      <p className="text-[11px] text-slate-500 uppercase tracking-wider mb-1.5">
        Assumptions ({node.assumptions.length})
      </p>
      <ul className="space-y-1.5">
        {node.assumptions.map((a, i) => (
          <li key={i} className="text-xs text-slate-400">• {a}</li>
        ))}
      </ul>
    </Card>
  );
}

export default function RippleImpact() {
  const { id } = useParams<{ id: string }>();
  const analysisId = parseInt(id || '0');
  const [data, setData] = useState<RippleImpact | null>(null);
  const [graph, setGraph] = useState<RippleGraph | null>(null);
  const [scenarioKey, setScenarioKey] = useState('hvac');
  const [selectedId, setSelectedId] = useState('energy');
  const [loading, setLoading] = useState(true);
  const [graphLoading, setGraphLoading] = useState(true);
  const [graphError, setGraphError] = useState('');

  useEffect(() => {
    api.getRippleImpact(analysisId)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [analysisId]);

  useEffect(() => {
    setGraphLoading(true);
    setGraphError('');
    api.getRippleGraph({ ...GRAPH_INPUTS, scenario_key: scenarioKey })
      .then(setGraph)
      .catch((e: any) => setGraphError(e.message || 'Failed to load impact graph'))
      .finally(() => setGraphLoading(false));
  }, [scenarioKey]);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size={24} label="Calculating ripple impact..." />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8 text-center">
        <p className="text-slate-500">Ripple impact data not found</p>
        <Link to={`/analysis/${analysisId}`} className="text-sm text-emerald-400 hover:text-emerald-300 mt-2 inline-block">
          Back to Mission Control
        </Link>
      </div>
    );
  }

  const byId = new Map((graph?.nodes ?? []).map((n) => [n.id, n]));
  const edgeFormula = (from: string, to: string) =>
    graph?.edges.find((e) => e.from === from && e.to === to)?.formula ?? '';
  const edgeDesc = (from: string, to: string) =>
    graph?.edges.find((e) => e.from === from && e.to === to)?.description ?? '';
  const netNode = byId.get('net');
  const capexNote = netNode
    ? `Includes −$${Math.round(byId.get('intervention')?.value ?? 0).toLocaleString()} capex (edge: intervention → net)`
    : '';

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link to={`/analysis/${analysisId}`} className="text-slate-500 hover:text-slate-300">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-white">Ripple Impact</h1>
          <p className="text-sm text-slate-400">{data.problem_title}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard label="Total Investment" value={data.financial_projection.total_investment.toLocaleString()} unit="$" trend="down" />
        <StatCard label="Annual Savings" value={data.financial_projection.annual_savings.toLocaleString()} unit="$/yr" trend="up" />
        <StatCard label="5-Year Net Value" value={data.financial_projection['5_year_net_value'].toLocaleString()} unit="$" trend="up" />
      </div>

      <Card className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
          <h2 className="text-sm font-medium text-slate-300 uppercase tracking-wider">
            Impact Chain <span className="text-slate-600 normal-case">— every edge is a model derivation</span>
          </h2>
          <Link to={`/analysis/${analysisId}/simulator`} className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300">
            <Calculator size={12} /> Adjust inputs in Simulator
          </Link>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          Modeled at baseline 2,000,000 kWh/yr · $0.12/kWh · 10 years · 100% implementation. Select a node to inspect its calculation.
        </p>

        {graph && graph.scenarios.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-5">
            {graph.scenarios.map((s) => (
              <button
                key={s.key}
                onClick={() => setScenarioKey(s.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  scenarioKey === s.key
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>
        )}

        {graphLoading && (
          <div className="py-10 flex justify-center"><LoadingSpinner size={22} label="Building impact chain..." /></div>
        )}
        {graphError && (
          <p className="text-sm text-red-400 py-6 text-center">{graphError}</p>
        )}

        {graph && !graphLoading && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-3">
              {byId.get('intervention') && (
                <GraphNode node={byId.get('intervention')!} selected={selectedId === 'intervention'} onSelect={() => setSelectedId('intervention')} />
              )}
              <EdgeConnector formula={edgeFormula('intervention', 'energy')} description={edgeDesc('intervention', 'energy')} />
              {byId.get('energy') && (
                <GraphNode node={byId.get('energy')!} selected={selectedId === 'energy'} onSelect={() => setSelectedId('energy')} />
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <EdgeConnector formula={edgeFormula('energy', 'cost')} description={edgeDesc('energy', 'cost')} />
                  {byId.get('cost') && (
                    <GraphNode node={byId.get('cost')!} selected={selectedId === 'cost'} onSelect={() => setSelectedId('cost')} />
                  )}
                </div>
                <div>
                  <EdgeConnector formula={edgeFormula('energy', 'co2')} description={edgeDesc('energy', 'co2')} />
                  {byId.get('co2') && (
                    <GraphNode node={byId.get('co2')!} selected={selectedId === 'co2'} onSelect={() => setSelectedId('co2')} />
                  )}
                </div>
              </div>
              <EdgeConnector formula={edgeFormula('cost', 'lifetime')} description={edgeDesc('cost', 'lifetime')} />
              {byId.get('lifetime') && (
                <GraphNode node={byId.get('lifetime')!} selected={selectedId === 'lifetime'} onSelect={() => setSelectedId('lifetime')} />
              )}
              <EdgeConnector formula={edgeFormula('lifetime', 'net')} description={edgeDesc('lifetime', 'net')} />
              {netNode && (
                <GraphNode node={netNode} selected={selectedId === 'net'} onSelect={() => setSelectedId('net')} />
              )}
              <p className="text-[11px] text-slate-600 mt-2 text-center">{capexNote}</p>
            </div>

            <div className="lg:col-span-2">
              <div className="lg:sticky lg:top-4 space-y-4">
                <Inspector node={byId.get(selectedId)} />
                <Card>
                  <p className="text-[11px] text-slate-500 uppercase tracking-wider mb-2">All model edges ({graph.edges.length})</p>
                  <ul className="space-y-1.5">
                    {graph.edges.map((e, i) => (
                      <li key={i} className="text-[11px] text-slate-400 font-mono" title={e.description}>
                        {e.from} → {e.to}: {e.formula}
                      </li>
                    ))}
                  </ul>
                </Card>
              </div>
            </div>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <h2 className="text-sm font-medium text-slate-300 uppercase tracking-wider mb-3">
            <TrendingUp size={14} className="inline mr-2" />
            Financial Projection
          </h2>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Total Investment</span>
              <span className="text-white">${data.financial_projection.total_investment.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Annual Savings</span>
              <span className="text-emerald-400">${data.financial_projection.annual_savings.toLocaleString()}/yr</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">5-Year Net Value</span>
              <span className="text-emerald-400">${data.financial_projection['5_year_net_value'].toLocaleString()}</span>
            </div>
            <div className="pt-3 border-t border-slate-700/50">
              <p className="text-xs text-slate-500">All figures are estimates based on projected savings.</p>
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="text-sm font-medium text-slate-300 uppercase tracking-wider mb-3">
            <Lightbulb size={14} className="inline mr-2" />
            Key Assumptions
          </h2>
          <div className="space-y-2">
            {data.key_assumptions.map((assumption, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <span className="text-emerald-400 mt-0.5">•</span>
                <p className="text-slate-400">{assumption}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <h2 className="text-sm font-medium text-slate-300 uppercase tracking-wider mb-3">
          <Shield size={14} className="inline mr-2" />
          Root Causes Identified
        </h2>
        <div className="space-y-2">
          {data.root_causes.map((rc, i) => (
            <div key={i} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
              <span className="text-sm text-slate-300">{rc.description}</span>
              <span className="text-xs text-slate-500">{(rc.confidence * 100).toFixed(0)}% confidence</span>
            </div>
          ))}
        </div>
      </Card>

      <p className="text-xs text-slate-600 text-center pt-4 pb-2">
        The chain above shows only derivations supported by the deterministic impact model. No secondary
        effects (education, community, resilience) are shown because the model does not quantify them.
      </p>
    </div>
  );
}
