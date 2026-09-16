import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: boolean;
}

export function Card({ children, className = '', padding = true }: CardProps) {
  return (
    <div className={`bg-slate-900 border border-slate-800 rounded-xl ${padding ? 'p-5' : ''} ${className}`}>
      {children}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string | number;
  unit?: string;
  trend?: 'up' | 'down' | 'neutral';
}

export function StatCard({ label, value, unit, trend }: StatCardProps) {
  return (
    <Card className="flex flex-col">
      <span className="text-xs text-slate-500 uppercase tracking-wider">{label}</span>
      <span className="text-2xl font-semibold text-white mt-1">
        {value}
        {unit && <span className="text-sm text-slate-400 ml-1">{unit}</span>}
      </span>
      {trend && (
        <span className={`text-xs mt-1 ${
          trend === 'up' ? 'text-emerald-400' : trend === 'down' ? 'text-red-400' : 'text-slate-500'
        }`}>
          {trend === 'up' ? '↑ Improving' : trend === 'down' ? '↓ Declining' : '— Stable'}
        </span>
      )}
    </Card>
  );
}

interface BadgeProps {
  status: string;
}

const statusColors: Record<string, string> = {
  completed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  pending: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  failed: 'bg-red-500/10 text-red-400 border-red-500/20',
  discovering: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  researching: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  generating_solutions: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  simulating: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  comparing: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  verifying: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  planning: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  reporting: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
};

export function Badge({ status }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
      statusColors[status] || 'bg-slate-500/10 text-slate-400 border-slate-500/20'
    }`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="text-slate-600 mb-4">{icon}</div>
      <h3 className="text-lg font-medium text-slate-300 mb-1">{title}</h3>
      <p className="text-sm text-slate-500 max-w-sm">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

interface LoadingSpinnerProps {
  size?: number;
  label?: string;
}

export function LoadingSpinner({ size = 20, label = 'Loading...' }: LoadingSpinnerProps) {
  return (
    <div className="flex items-center gap-2 text-slate-400">
      <svg width={size} height={size} viewBox="0 0 24 24" className="animate-spin">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" opacity="0.25" />
        <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" />
      </svg>
      <span className="text-sm">{label}</span>
    </div>
  );
}

interface ProgressBarProps {
  value: number;
  max?: number;
  className?: string;
}

export function ProgressBar({ value, max = 100, className = '' }: ProgressBarProps) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className={`w-full bg-slate-800 rounded-full h-2 ${className}`}>
      <div
        className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
