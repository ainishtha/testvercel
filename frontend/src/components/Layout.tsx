import { useEffect, useState } from 'react';
import { NavLink, Outlet, useParams } from 'react-router-dom';
import {
  LayoutDashboard, Lightbulb, Target, BarChart3,
  FileText, Activity, GitCompare,
  ShieldCheck, Monitor, ClipboardList,
  GitBranch, Calculator, Award, ClipboardCheck, FlaskConical,
} from 'lucide-react';
import { api } from '../services/api';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/new', icon: Lightbulb, label: 'New Analysis' },
  { to: '/analyses', icon: Activity, label: 'Missions' },
];

const analysisSubItems = [
  { to: 'mission', icon: Target, label: 'Mission Control' },
  { to: 'solutions', icon: GitCompare, label: 'Solutions' },
  { to: 'action-plan', icon: ClipboardList, label: 'Action Plan' },
  { to: 'simulator', icon: Calculator, label: 'Simulator' },
  { to: 'score', icon: Award, label: 'Impact Score' },
  { to: 'report', icon: FileText, label: 'Impact Report' },
  { to: 'ripple', icon: GitBranch, label: 'Ripple Impact' },
  { to: 'evidence', icon: ShieldCheck, label: 'Evidence' },
  { to: 'verification', icon: ClipboardCheck, label: 'Verification' },
  { to: 'monitoring', icon: Monitor, label: 'Monitoring' },
];

function AnalysisNav() {
  const { id } = useParams<{ id: string }>();
  if (!id) return null;
  return (
    <nav className="flex flex-col space-y-1 p-3 border-t border-slate-800">
      <p className="text-[10px] text-slate-600 uppercase tracking-wider mb-2">Analysis</p>
      {analysisSubItems.map((item) => (
        <NavLink
          key={item.to}
          to={`/analysis/${id}/${item.to}`}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
              isActive
                ? 'bg-slate-800 text-white'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`
          }
        >
          <item.icon size={16} />
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}

export default function Layout() {
  const [demoMode, setDemoMode] = useState(false);

  useEffect(() => {
    api.getDemoStatus().then((s) => setDemoMode(s.demo_mode)).catch(() => {});
  }, []);

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="w-56 bg-slate-900 border-r border-slate-800 flex flex-col">
        <div className="p-5 border-b border-slate-800">
          <h1 className="text-lg font-semibold tracking-tight text-white">
            <span className="text-emerald-400">Impact</span>us
          </h1>
          <p className="text-[11px] text-slate-500 mt-0.5">AI Impact Optimization</p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`
              }
            >
              <item.icon size={16} />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <AnalysisNav />
        <div className="p-4 border-t border-slate-800">
          <p className="text-[10px] text-slate-600">v0.1.0 - Hackathon MVP</p>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        {demoMode && (
          <div className="flex items-center justify-center gap-2 px-4 py-1.5 bg-amber-500/10 border-b border-amber-500/20 text-xs font-semibold tracking-wide text-amber-300">
            <FlaskConical size={13} />
            DEMO MODE — synthetic data only · no live APIs configured · not real-world findings
          </div>
        )}
        <Outlet />
      </main>
    </div>
  );
}