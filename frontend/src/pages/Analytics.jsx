import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Clock, FileText, GitPullRequest, CheckCircle2, Circle, Loader2 } from 'lucide-react';
import { StatCard, SectionHeader } from '../components/ui';

export default function Analytics() {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/analytics`, {
      credentials: 'include'
    })
      .then(res => {
        if (!res.ok) throw new Error('Failed to load analytics');
        return res.json();
      })
      .then(data => setAnalytics(data))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-6 bg-surface min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-surface min-h-screen text-text-primary font-sans">
        <h1 className="text-2xl font-heading font-semibold text-text-primary mb-6">Engineering Analytics</h1>
        <div className="p-8 text-center text-red-400 border border-red-500/20 rounded-md bg-red-500/5">{error}</div>
      </div>
    );
  }

  const weeklyData = analytics?.weeklyData || [];
  const maxTasks = Math.max(...weeklyData.map(d => d.tasks), 1);

  return (
    <div className="p-6 space-y-6 bg-surface min-h-screen text-text-primary font-sans">
      <h1 className="text-2xl font-heading font-semibold text-text-primary mb-6">Engineering Analytics</h1>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Tasks" value={analytics?.totalTasks || 0} icon={BarChart3} />
        <StatCard label="Success Rate" value={`${analytics?.successRate || 0}%`} icon={TrendingUp} />
        <StatCard label="Avg Execution Time" value={analytics?.avgExecutionTime || '0s'} icon={Clock} />
        <StatCard label="Files Modified" value={analytics?.totalFilesModified || 0} icon={FileText} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <div className="bg-background border border-border p-6 rounded-md">
          <SectionHeader title="Weekly Performance" />
          <div className="h-64 mt-6 flex items-end justify-between space-x-2">
            {weeklyData.length > 0 ? weeklyData.map((data, i) => {
              const heightPct = (data.tasks / maxTasks) * 100;
              return (
                <div key={i} className="flex flex-col items-center w-full">
                  <div 
                    className="w-full bg-primary rounded-t-sm opacity-80 hover:opacity-100 transition-opacity relative group cursor-pointer"
                    style={{ height: `${Math.max(heightPct, 2)}%` }}
                  >
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-modal border border-border px-2 py-1 rounded text-xs hidden group-hover:block whitespace-nowrap z-10">
                      {data.tasks} tasks
                    </div>
                  </div>
                  <span className="text-xs text-text-secondary mt-2">{data.day}</span>
                </div>
              );
            }) : (
              <div className="w-full flex items-center justify-center text-text-secondary text-sm">
                No data for this week
              </div>
            )}
          </div>
        </div>

        <div className="bg-background border border-border p-6 rounded-md">
          <SectionHeader title="Summary" />
          <div className="mt-4 space-y-4">
            <div className="flex items-center justify-between p-3 border border-border rounded-sm">
              <div className="flex items-center gap-3">
                <GitPullRequest className="w-4 h-4 text-primary" />
                <span className="text-sm text-text-primary">Total Repositories</span>
              </div>
              <span className="font-mono text-text-primary">{analytics?.totalRepos || 0}</span>
            </div>
            <div className="flex items-center justify-between p-3 border border-border rounded-sm">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-4 h-4 text-green-400" />
                <span className="text-sm text-text-primary">Completed Tasks</span>
              </div>
              <span className="font-mono text-green-400">{analytics?.completedTasks || 0}</span>
            </div>
            <div className="flex items-center justify-between p-3 border border-border rounded-sm">
              <div className="flex items-center gap-3">
                <Circle className="w-4 h-4 text-yellow-400" />
                <span className="text-sm text-text-primary">Active Tasks</span>
              </div>
              <span className="font-mono text-yellow-400">{analytics?.activeTasks || 0}</span>
            </div>
            <div className="flex items-center justify-between p-3 border border-border rounded-sm">
              <div className="flex items-center gap-3">
                <Circle className="w-4 h-4 text-red-400" />
                <span className="text-sm text-text-primary">Failed Tasks</span>
              </div>
              <span className="font-mono text-red-400">{analytics?.failedTasks || 0}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
