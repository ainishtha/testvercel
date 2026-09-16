import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, AlertCircle } from 'lucide-react';
import { Card } from '../components/UI';
import { api } from '../services/api';

export default function ProblemInput() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [domain, setDomain] = useState('campus_sustainability');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      setError('Please fill in all fields');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const problem = await api.createProblem({ title, description, domain });
      const analysis = await api.createAnalysis(problem.id);
      navigate(`/analysis/${analysis.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create analysis');
    } finally {
      setSubmitting(false);
    }
  };

  const examples = [
    { title: 'Campus electricity consumption is too high', desc: 'Our annual electricity costs have increased 25% over the past 3 years. We need to identify the root causes and find cost-effective interventions.' },
    { title: 'Water waste in residence halls', desc: 'Student water usage in dormitories is 40% above the national campus average. Leak detection and behavioral interventions may help.' },
    { title: 'Low recycling rate across campus', desc: 'Only 15% of campus waste is diverted from landfill. We need solutions to improve sorting infrastructure and student engagement.' },
  ];

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white">New Analysis</h1>
        <p className="text-sm text-slate-400 mt-1">
          Describe a campus sustainability problem. The AI agent pipeline will investigate root causes,
          research evidence, generate solutions, and provide an impact report.
        </p>
      </div>

      <Card className="mb-6">
        <h2 className="text-sm font-medium text-slate-300 uppercase tracking-wider mb-4">
          Problem Statement
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Campus electricity consumption is too high"
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/25 transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Provide context, current metrics, and what you've observed..."
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/25 transition-colors resize-none"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Domain</label>
            <select
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-colors"
            >
              <option value="campus_sustainability">Campus Sustainability</option>
              <option value="energy">Energy Management</option>
              <option value="waste">Waste Reduction</option>
              <option value="water">Water Conservation</option>
              <option value="transportation">Transportation</option>
            </select>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-400 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {submitting ? (
              <>
                <svg width={16} height={16} viewBox="0 0 24 24" className="animate-spin">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" opacity="0.25" />
                  <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" />
                </svg>
                Running Analysis...
              </>
            ) : (
              <>
                <Send size={14} />
                Run Full Analysis
              </>
            )}
          </button>
        </form>
      </Card>

      <Card>
        <h2 className="text-sm font-medium text-slate-300 uppercase tracking-wider mb-3">
          Example Problems
        </h2>
        <div className="space-y-3">
          {examples.map((ex, i) => (
            <button
              key={i}
              onClick={() => { setTitle(ex.title); setDescription(ex.desc); }}
              className="w-full text-left p-3 rounded-lg bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 hover:border-slate-600 transition-colors"
            >
              <p className="text-sm font-medium text-slate-200">{ex.title}</p>
              <p className="text-xs text-slate-500 mt-1">{ex.desc}</p>
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}
