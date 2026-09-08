import React from 'react';
import { CheckCircle2, AlertCircle, Clock, Loader2, XCircle, Pause, Play, Eye, Zap, GitMerge } from 'lucide-react';

const statusConfig = {
  READY:             { label: 'Ready',           bg: 'bg-green-900/30',  text: 'text-green-400',  border: 'border-green-800',  icon: CheckCircle2 },
  IMPORTING:         { label: 'Importing',       bg: 'bg-blue-900/30',   text: 'text-blue-400',   border: 'border-blue-800',   icon: Loader2, animate: true },
  INDEXING:          { label: 'Indexing',         bg: 'bg-yellow-900/30', text: 'text-yellow-400', border: 'border-yellow-800', icon: Loader2, animate: true },
  FAILED:            { label: 'Failed',           bg: 'bg-red-900/30',    text: 'text-red-400',    border: 'border-red-800',    icon: XCircle },
  CANCELLED:         { label: 'Cancelled',        bg: 'bg-gray-800',      text: 'text-gray-400',   border: 'border-gray-700',   icon: XCircle },
  ANALYZING:         { label: 'Analyzing',        bg: 'bg-blue-900/30',   text: 'text-blue-400',   border: 'border-blue-800',   icon: Loader2, animate: true },
  CONTEXT_READY:     { label: 'Context Ready',    bg: 'bg-cyan-900/30',   text: 'text-cyan-400',   border: 'border-cyan-800',   icon: Eye },
  PLANNING:          { label: 'Planning',         bg: 'bg-purple-900/30', text: 'text-purple-400', border: 'border-purple-800', icon: Loader2, animate: true },
  PLAN_READY:        { label: 'Plan Ready',       bg: 'bg-purple-900/30', text: 'text-purple-400', border: 'border-purple-800', icon: Zap },
  AWAITING_APPROVAL: { label: 'Awaiting Approval',bg: 'bg-amber-900/30',  text: 'text-amber-400',  border: 'border-amber-800',  icon: Pause },
  IMPLEMENTING:      { label: 'Executing',        bg: 'bg-blue-900/30',   text: 'text-blue-400',   border: 'border-blue-800',   icon: Play, animate: true },
  TESTING:           { label: 'Testing',          bg: 'bg-blue-900/30',   text: 'text-blue-400',   border: 'border-blue-800',   icon: Loader2, animate: true },
  DIAGNOSING:        { label: 'Diagnosing',       bg: 'bg-orange-900/30', text: 'text-orange-400', border: 'border-orange-800', icon: Loader2, animate: true },
  RETRYING:          { label: 'Retrying',         bg: 'bg-purple-900/30', text: 'text-purple-400', border: 'border-purple-800', icon: Loader2, animate: true },
  VERIFYING:         { label: 'Verifying',        bg: 'bg-indigo-900/30', text: 'text-indigo-400', border: 'border-indigo-800', icon: Loader2, animate: true },
  VALIDATING:        { label: 'Validating',       bg: 'bg-yellow-900/30', text: 'text-yellow-400', border: 'border-yellow-800', icon: Loader2, animate: true },
  COMPLETED:         { label: 'Completed',        bg: 'bg-green-900/30',  text: 'text-green-400',  border: 'border-green-800',  icon: CheckCircle2 },
  VERIFIED:          { label: 'Verified',         bg: 'bg-emerald-900/30', text: 'text-emerald-400', border: 'border-emerald-800', icon: CheckCircle2 },
  ACCEPTED:          { label: 'Accepted',         bg: 'bg-green-900/30',  text: 'text-green-400',  border: 'border-green-800',  icon: CheckCircle2 },
  DELIVERED:         { label: 'Delivered',        bg: 'bg-teal-900/30',   text: 'text-teal-400',   border: 'border-teal-800',   icon: CheckCircle2 },
  MERGED:            { label: 'Merged',           bg: 'bg-purple-900/30', text: 'text-purple-400', border: 'border-purple-800', icon: GitMerge },
  CLOSED:            { label: 'Closed',           bg: 'bg-gray-800',      text: 'text-gray-400',   border: 'border-gray-700',   icon: XCircle },
  RUNNING:           { label: 'Running',          bg: 'bg-blue-900/30',   text: 'text-blue-400',   border: 'border-blue-800',   icon: Play, animate: true },
};

export function StatusBadge({ status, className = '' }) {
  const config = statusConfig[status] || {
    label: status, bg: 'bg-gray-800', text: 'text-gray-400', border: 'border-gray-700', icon: Clock
  };
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 ${config.bg} ${config.text} border ${config.border} rounded text-xs font-medium ${className}`}>
      <Icon className={`w-3 h-3 ${config.animate ? 'animate-spin' : ''}`} />
      {config.label}
    </span>
  );
}

export function EmptyState({ icon: Icon, title, description, action, onAction }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-8 bg-surface border border-border rounded-md">
      {Icon && <Icon className="w-10 h-10 text-text-secondary mb-4" strokeWidth={1.5} />}
      <h3 className="text-lg font-medium text-text-primary mb-2">{title}</h3>
      {description && <p className="text-sm text-text-secondary mb-6 text-center max-w-md">{description}</p>}
      {action && (
        React.isValidElement(action) ? (
          action
        ) : (
          <button onClick={onAction} className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-sm text-sm font-medium transition-colors">
            {action}
          </button>
        )
      )}
    </div>
  );
}

export function LoadingState({ message = 'Loading...' }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-text-secondary">
      <Loader2 className="w-6 h-6 animate-spin mb-3 text-primary" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

export function StatCard({ label, value, detail, icon: Icon }) {
  return (
    <div className="bg-surface border border-border p-4 rounded-md">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs text-text-secondary uppercase tracking-wider">{label}</h4>
        {Icon && <Icon className="w-4 h-4 text-text-secondary" />}
      </div>
      <p className="text-2xl font-mono font-semibold text-text-primary">{value}</p>
      {detail && <p className="text-xs text-text-secondary mt-1">{detail}</p>}
    </div>
  );
}

export function SectionHeader({ title, action, onAction, actions, children }) {
  return (
    <div className="flex items-center justify-between mb-6">
      <h2 className="font-heading text-lg font-semibold text-text-primary">{title}</h2>
      <div className="flex items-center gap-3">
        {actions}
        {children}
        {action && typeof action === 'string' && (
          <button onClick={onAction} className="px-3 py-1.5 bg-primary hover:bg-primary/90 text-white rounded-sm text-sm font-medium transition-colors">
            {action}
          </button>
        )}
        {action && React.isValidElement(action) && action}
      </div>
    </div>
  );
}

export function TabBar({ tabs, active, onChange }) {
  return (
    <div className="flex border-b border-border mb-6">
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
            active === tab.id
              ? 'text-primary border-primary'
              : 'text-text-secondary border-transparent hover:text-text-primary hover:border-border'
          }`}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span className="ml-2 px-1.5 py-0.5 text-[10px] bg-gray-800 rounded-full">{tab.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}
