import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, Clock, Play, AlertCircle, Loader2 } from 'lucide-react';

const iconMap = {
  task_completed: CheckCircle2,
  repo_imported: CheckCircle2,
  plan_approved: CheckCircle2,
  execution_started: Play,
  execution_failed: AlertCircle,
  task_created: Clock,
  repo_failed: AlertCircle,
  plan_generated: Clock,
};

const colorMap = {
  task_completed: 'text-green-400',
  repo_imported: 'text-green-400',
  plan_approved: 'text-green-400',
  execution_started: 'text-blue-400',
  execution_failed: 'text-red-400',
  task_created: 'text-text-secondary',
  repo_failed: 'text-red-400',
  plan_generated: 'text-purple-400',
};

export default function NotificationsPanel({ isOpen, onClose }) {
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      setError(null);
      fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/activity`, {
        credentials: 'include'
      })
        .then(res => {
          if (!res.ok) throw new Error('Failed to load activity');
          return res.json();
        })
        .then(data => setActivity(data))
        .catch(err => setError(err.message))
        .finally(() => setLoading(false));
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-40 transition-opacity"
        onClick={onClose}
      />
      
      {/* Panel */}
      <div className="fixed top-0 right-0 h-screen w-80 bg-surface border-l border-border shadow-2xl z-50 flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="font-heading font-medium text-text-primary">Notifications</h3>
          <button 
            onClick={onClose}
            className="p-1 text-text-secondary hover:text-text-primary hover:bg-[#21262D] rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading && (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          )}

          {error && (
            <div className="py-8 text-center text-sm text-red-400">{error}</div>
          )}

          {!loading && !error && activity.length === 0 && (
            <div className="py-12 text-center text-sm text-text-secondary">
              No recent activity.
            </div>
          )}

          {!loading && !error && activity.map(item => {
            const Icon = iconMap[item.type] || Clock;
            const colorClass = colorMap[item.type] || 'text-text-secondary';
            
            return (
              <div key={item.id} className="flex gap-3 items-start">
                <div className={`mt-1 rounded-full p-1 bg-[#161B22] border border-border ${colorClass}`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-text-primary leading-tight">{item.title}</p>
                  <p className="text-[13px] text-text-secondary mt-0.5 leading-snug">{item.description}</p>
                  <div className="flex gap-2 items-center mt-1 text-[11px] text-text-secondary">
                    <span>{new Date(item.timestamp).toLocaleDateString()}</span>
                    {item.repoName && (
                      <>
                        <span>•</span>
                        <span>{item.repoName}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        
        <div className="p-4 border-t border-border">
          <button 
            className="w-full py-2 text-sm text-text-secondary hover:text-text-primary border border-border rounded hover:bg-[#161B22] transition-colors"
            onClick={onClose}
          >
            Mark all as read
          </button>
        </div>
      </div>
    </>
  );
}
