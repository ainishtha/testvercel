import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, FileText, CheckCircle2, AlertTriangle,
  DollarSign, Zap, Leaf, Clock, ShieldCheck
} from 'lucide-react';
import { Card, Badge } from '../components/UI';
import { api } from '../services/api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import type { ImpactReport as ReportType, ImpactEstimate } from '../types';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6'];

export default function ImpactReportPage() {
  const { id } = useParams<{ id: string }>();
  const analysisId = parseInt(id || '0');
  const [report, setReport] = useState<ReportType | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getReport(analysisId)
      .then(setReport)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [analysisId]);

  if (loading) return <div className="p-8 text-center text-slate-500">Loading report...</div>;
  if (!report) return <div className="p-8 text-center text-slate-500">Report not found</div>;

  const allEstimates: ImpactEstimate[] = Object.values(report.impact_estimates).flat();
  const energyEstimates = allEstimates.filter((e) => e.category === 'energy');
  const financialEstimates = allEstimates.filter((e) => e.category === 'financial');
  const environmentalEstimates = allEstimates.filter((e) => e.category === 'environmental');

  const energyChartData = energyEstimates.map((e) => ({
    name: e.label.slice(0, 20),
    value: e.value,
    low: e.low_bound || 0,
    high: e.high_bound || 0,
  }));

  const costBreakdown = financialEstimates.map((e, i) => ({
    name: e.label,
    value: e.value,
  }));

  const totalKwhSaved = energyEstimates
    .filter((e) => e.unit.includes('kWh'))
    .reduce((sum, e) => sum + e.value, 0);

  const totalCo2 = environmentalEstimates
    .filter((e) => e.unit.includes('CO2'))
    .reduce((sum, e) => sum + e.value, 0);

  const totalSavings = financialEstimates
    .filter((e) => e.unit.includes('USD'))
    .reduce((sum, e) => sum + e.value, 0);

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link to={`/analysis/${analysisId}`} className="text-slate-500 hover:text-slate-300">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-white">Impact Report</h1>
          <p className="text-sm text-slate-400">{report.problem?.title}</p>
        </div>
        <Badge status={report.analysis.status} />
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/10">
            <Zap size={18} className="text-emerald-400" />
          </div>
          <div>
            <p className="text-xs text-slate-500">Annual Savings</p>
            <p className="text-lg font-semibold text-white">{totalKwhSaved.toLocaleString()} kWh</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10">
            <DollarSign size={18} className="text-blue-400" />
          </div>
          <div>
            <p className="text-xs text-slate-500">Cost Savings</p>
            <p className="text-lg font-semibold text-white">${totalSavings.toLocaleString()}/yr</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-green-500/10">
            <Leaf size={18} className="text-green-400" />
          </div>
          <div>
            <p className="text-xs text-slate-500">CO2 Reduction</p>
            <p className="text-lg font-semibold text-white">{totalCo2} tons/yr</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-500/10">
            <Clock size={18} className="text-amber-400" />
          </div>
          <div>
            <p className="text-xs text-slate-500">Solutions Evaluated</p>
            <p className="text-lg font-semibold text-white">{report.solutions.length}</p>
          </div>
        </Card>
      </div>

      {report.root_causes.length > 0 && (
        <Card className="mb-6">
          <h2 className="text-sm font-medium text-slate-300 uppercase tracking-wider mb-3">Root Causes Identified</h2>
          <div className="space-y-3">
            {report.root_causes.map((rc) => (
              <div key={rc.id} className="flex items-start gap-3 p-3 bg-slate-800/50 rounded-lg">
                <AlertTriangle size={14} className="text-amber-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm text-slate-200">{rc.description}</p>
                  <p className="text-xs text-slate-500 mt-1">Confidence: {(rc.confidence * 100).toFixed(0)}%</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-6 mb-6">
        {energyChartData.length > 0 && (
          <Card>
            <h2 className="text-sm font-medium text-slate-300 uppercase tracking-wider mb-4">Energy Impact</h2>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={energyChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                />
                <Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]} name="Estimated" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}

        {costBreakdown.length > 0 && (
          <Card>
            <h2 className="text-sm font-medium text-slate-300 uppercase tracking-wider mb-4">Financial Impact</h2>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={costBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name}: $${value.toLocaleString()}`}>
                  {costBreakdown.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        )}
      </div>

      <Card className="mb-6">
        <h2 className="text-sm font-medium text-slate-300 uppercase tracking-wider mb-3">All Estimates</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left py-2 text-slate-500 font-medium">Metric</th>
                <th className="text-right py-2 text-slate-500 font-medium">Value</th>
                <th className="text-right py-2 text-slate-500 font-medium">Range</th>
                <th className="text-left py-2 text-slate-500 font-medium">Key Assumptions</th>
              </tr>
            </thead>
            <tbody>
              {allEstimates.map((e) => (
                <tr key={e.id} className="border-b border-slate-800/50">
                  <td className="py-2.5 text-slate-300">{e.label}</td>
                  <td className="py-2.5 text-right text-white font-medium">
                    {e.value.toLocaleString()} {e.unit}
                  </td>
                  <td className="py-2.5 text-right text-slate-500 text-xs">
                    {e.low_bound?.toLocaleString()} - {e.high_bound?.toLocaleString()}
                  </td>
                  <td className="py-2.5 text-slate-500 text-xs max-w-xs">
                    {e.assumptions.slice(0, 2).join('; ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {report.comparison && (
        <Card className="mb-6">
          <h2 className="text-sm font-medium text-slate-300 uppercase tracking-wider mb-2">Recommendation</h2>
          <p className="text-sm text-emerald-400 font-medium mb-1">{report.comparison.recommendation}</p>
          <p className="text-sm text-slate-400">{report.comparison.rationale}</p>
        </Card>
      )}

      {report.action_plan && (
        <Card>
          <h2 className="text-sm font-medium text-slate-300 uppercase tracking-wider mb-3">Implementation Plan</h2>
          <div className="space-y-3">
            {report.action_plan.steps.map((step: any) => (
              <div key={step.order} className="flex gap-3 p-3 bg-slate-800/50 rounded-lg">
                <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-medium shrink-0">
                  {step.order}
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-200">{step.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{step.description}</p>
                  <p className="text-xs text-slate-600 mt-1">{step.duration_weeks} weeks</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
