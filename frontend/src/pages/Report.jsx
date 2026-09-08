import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, FileText, CheckCircle2, Clock, GitMerge, Box, Loader2, AlertCircle, GitPullRequest, ExternalLink } from 'lucide-react';
import { SectionHeader } from '../components/ui';

export default function EngineeringReport() {
  const { id } = useParams();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/tasks/${id}/report`, {
      credentials: 'include'
    })
      .then(res => {
        if (!res.ok) throw new Error('Failed to load report');
        return res.json();
      })
      .then(data => setReport(data))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="p-8 max-w-5xl mx-auto flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="p-8 max-w-5xl mx-auto">
        <Link to="/history" className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to History
        </Link>
        <div className="p-8 text-center text-red-400 border border-red-500/20 rounded-md bg-red-500/5 flex items-center justify-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {error || 'Report not found'}
        </div>
      </div>
    );
  }

  const { task, repository, plan, execution } = report;
  const repoName = repository ? `${repository.owner}/${repository.name}` : 'Unknown';

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <Link to="/history" className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Back to History
      </Link>

      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-heading font-bold text-text-primary mb-2">Engineering Report</h1>
          <p className="text-text-secondary">Comprehensive summary of task execution and codebase impact.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="md:col-span-2 space-y-6">
          <div className="bg-surface border border-border rounded-md p-6 shadow-modal">
            <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wider mb-4">Task Details</h2>
            <h3 className="text-xl font-medium text-text-primary mb-2">{task.title}</h3>
            <p className="text-text-secondary text-sm mb-6">{task.description || 'No description provided.'}</p>
            
            <div className="flex items-center gap-6 text-sm">
              <div className="flex flex-col gap-1">
                <span className="text-text-secondary">Task ID</span>
                <span className="font-mono text-text-primary">{task._id}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-text-secondary">Repository</span>
                <span className="text-text-primary">{repoName}</span>
              </div>
              {execution?.completedAt && (
                <div className="flex flex-col gap-1">
                  <span className="text-text-secondary">Completed On</span>
                  <span className="text-text-primary">{new Date(execution.completedAt).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          </div>

          {execution?.changedFiles?.length > 0 && (
            <div className="bg-surface border border-border rounded-md p-6 shadow-modal">
              <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wider mb-4 flex items-center gap-2">
                <Box className="w-4 h-4" /> Codebase Impact
              </h2>
              <div className="space-y-3">
                {execution.changedFiles.map(file => (
                  <div key={file} className="flex items-center justify-between p-3 bg-background border border-border rounded">
                    <span className="font-mono text-sm text-primary">{file}</span>
                    <span className="text-xs text-green-400 bg-green-500/10 px-2 py-0.5 rounded border border-green-500/20">Modified</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-surface border border-border rounded-md p-6 shadow-modal">
            <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wider mb-4">Execution Metrics</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-text-secondary">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm">Total Time</span>
                </div>
                <span className="font-mono text-text-primary">{execution?.timeElapsed || 'N/A'}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-text-secondary">
                  <GitMerge className="w-4 h-4" />
                  <span className="text-sm">Files Changed</span>
                </div>
                <span className="font-mono text-text-primary">{execution?.changedFiles?.length || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-text-secondary">
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="text-sm">Steps</span>
                </div>
                <span className="font-mono text-text-primary">{execution?.totalSteps || 0}</span>
              </div>
            </div>
          </div>

          {(task.prUrl || task.status === 'DELIVERED') && (
            <div className="bg-surface border border-primary/30 rounded-md p-6 shadow-modal">
              <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wider mb-4 flex items-center gap-2">
                <GitPullRequest className="w-4 h-4 text-primary" /> GitHub Delivery
              </h2>
              <div className="space-y-3 text-sm">
                {task.prNumber && (
                  <div className="flex items-center justify-between">
                    <span className="text-text-secondary">Pull Request</span>
                    <span className="font-mono text-primary font-medium">#{task.prNumber}</span>
                  </div>
                )}
                {task.deliveryBranch && (
                  <div className="flex items-center justify-between">
                    <span className="text-text-secondary">Branch</span>
                    <span className="font-mono text-text-primary text-xs truncate max-w-[140px]" title={task.deliveryBranch}>
                      {task.deliveryBranch}
                    </span>
                  </div>
                )}
                {task.deliveredAt && (
                  <div className="flex items-center justify-between">
                    <span className="text-text-secondary">Delivered At</span>
                    <span className="text-text-primary text-xs">{new Date(task.deliveredAt).toLocaleDateString()}</span>
                  </div>
                )}
                {task.prUrl && (
                  <div className="pt-2">
                    <a
                      href={task.prUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full py-2 px-3 bg-primary hover:bg-opacity-90 text-white rounded-sm text-xs font-medium transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      View Pull Request
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="bg-surface border border-border rounded-md overflow-hidden shadow-modal">
            <div className="p-4 border-b border-border bg-modal">
              <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wider">Status</h2>
            </div>
            <div className="p-6 flex flex-col items-center justify-center">
              <div className={`w-24 h-24 rounded-full border-4 flex items-center justify-center mb-3 ${
                execution?.status === 'COMPLETED' ? 'border-green-500' : 
                execution?.status === 'FAILED' ? 'border-red-500' : 'border-primary'
              }`}>
                <span className="text-lg font-bold text-text-primary">{execution?.status || task.status}</span>
              </div>
              <p className="text-xs text-text-secondary text-center">
                {execution?.status === 'COMPLETED' ? 'Task completed successfully.' : 
                 execution?.status === 'FAILED' ? `Failed: ${execution.error || 'Unknown error'}` :
                 'Task is still in progress.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
