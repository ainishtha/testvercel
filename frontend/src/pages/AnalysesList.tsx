import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, ArrowRight } from 'lucide-react';
import { Card, Badge, EmptyState } from '../components/UI';
import { api } from '../services/api';
import type { Analysis, Problem } from '../types';

export default function AnalysesList() {
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.listAnalyses(), api.listProblems()])
      .then(([a, p]) => { setAnalyses(a); setProblems(p); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-center text-slate-500">Loading...</div>;

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-white">All Analyses</h1>
        <p className="text-sm text-slate-400 mt-1">{analyses.length} analyses run</p>
      </div>

      {analyses.length === 0 ? (
        <EmptyState
          icon={<Activity size={32} />}
          title="No analyses yet"
          description="Start your first campus sustainability analysis."
        />
      ) : (
        <div className="space-y-3">
          {analyses.map((a) => {
            const problem = problems.find((p) => p.id === a.problem_id);
            return (
              <Link
                key={a.id}
                to={`/analysis/${a.id}`}
                className="block p-4 bg-slate-900 border border-slate-800 rounded-xl hover:border-slate-700 transition-colors group"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-200 group-hover:text-white">
                      {problem?.title || `Analysis #${a.id}`}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {new Date(a.created_at).toLocaleDateString()} · {problem?.domain?.replace(/_/g, ' ')}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge status={a.status} />
                    <ArrowRight size={14} className="text-slate-600 group-hover:text-slate-400" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
