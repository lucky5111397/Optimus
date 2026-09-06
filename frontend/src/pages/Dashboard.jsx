import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { GitFork, Zap, CheckCircle2, TrendingUp, Clock, Plus, ArrowRight, Loader2 } from 'lucide-react';
import { StatusBadge, StatCard, SectionHeader } from '../components/ui';

export default function Dashboard() {
  const [repositories, setRepositories] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [activity, setActivity] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [reposRes, tasksRes, activityRes, analyticsRes] = await Promise.all([
          fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/repositories`, { credentials: 'include' }),
          fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/tasks?limit=10`, { credentials: 'include' }),
          fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/activity`, { credentials: 'include' }),
          fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/analytics`, { credentials: 'include' })
        ]);
        
        if (reposRes.ok) setRepositories(await reposRes.json());
        if (tasksRes.ok) setTasks(await tasksRes.json());
        if (activityRes.ok) setActivity(await activityRes.json());
        if (analyticsRes.ok) setAnalytics(await analyticsRes.json());
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const activeRepos = repositories?.filter(r => r.status === 'READY') || [];
  const activeTasks = tasks?.filter(t => !['COMPLETED', 'VERIFIED', 'DELIVERED', 'FAILED', 'CANCELLED'].includes(t.status)) || [];
  const completedTasks = tasks?.filter(t => ['COMPLETED', 'VERIFIED', 'DELIVERED'].includes(t.status)) || [];
  
  const getActivityColor = (type) => {
    switch(type) {
      case 'task_completed': return 'border-green-500';
      case 'execution_started': return 'border-blue-500';
      case 'execution_failed': return 'border-red-500';
      case 'plan_generated': return 'border-purple-500';
      case 'task_created': return 'border-text-secondary';
      default: return 'border-border';
    }
  };

  return (
    <div className="p-6 space-y-6 bg-surface min-h-screen text-text-primary font-sans">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-heading font-semibold text-text-primary">Dashboard</h1>
        <div className="flex space-x-3">
          <Link to="/repositories" className="flex items-center px-4 py-2 bg-background border border-border rounded-sm text-sm hover:border-border-active transition-colors">
            <GitFork className="w-4 h-4 mr-2" />
            Import Repository
          </Link>
          <Link to="/repositories" className="flex items-center px-4 py-2 bg-primary text-white rounded-sm text-sm hover:bg-opacity-90 transition-colors">
            <Plus className="w-4 h-4 mr-2" />
            Create Task
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Active Repos" value={activeRepos.length} icon={GitFork} />
        <StatCard label="Active Tasks" value={activeTasks.length} icon={Zap} />
        <StatCard label="Completed Tasks" value={completedTasks.length} icon={CheckCircle2} />
        <StatCard label="Success Rate" value={`${analytics?.successRate || 0}%`} icon={TrendingUp} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <SectionHeader title="Active Repositories" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeRepos.slice(0, 4).map(repo => (
              <div key={repo._id} className="bg-background border border-border p-4 rounded-md">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-text-primary">{repo.name}</h3>
                  <StatusBadge status={repo.status} />
                </div>
                <p className="text-sm text-text-secondary mb-4">{repo.description || 'No description available.'}</p>
                <div className="flex items-center justify-between text-xs text-text-secondary">
                  <span>Updated {new Date(repo.updatedAt).toLocaleDateString()}</span>
                  <Link to={`/repositories/${repo._id}`} className="flex items-center text-primary hover:underline">
                    View <ArrowRight className="w-3 h-3 ml-1" />
                  </Link>
                </div>
              </div>
            ))}
            {activeRepos.length === 0 && !loading && (
              <div className="col-span-1 md:col-span-2 p-8 text-center text-text-secondary border border-border rounded-md">
                No active repositories. Import one to get started.
              </div>
            )}
          </div>
        </div>

        <div className="col-span-1 space-y-4">
          <SectionHeader title="Recent Activity" />
          <div className="bg-background border border-border rounded-md p-4 space-y-4">
            {loading ? (
              <div className="py-4 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-text-secondary" /></div>
            ) : activity.length === 0 ? (
              <div className="py-4 text-center text-sm text-text-secondary">No recent activity.</div>
            ) : (
              activity.slice(0, 8).map((item) => (
                <div key={item.id} className={`flex pl-3 border-l-2 ${getActivityColor(item.type)} py-1`}>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-text-primary">{item.title}</span>
                      <span className="text-xs text-text-secondary flex items-center">
                        <Clock className="w-3 h-3 mr-1" />
                        {new Date(item.timestamp).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm text-text-secondary mt-1">{item.description}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
