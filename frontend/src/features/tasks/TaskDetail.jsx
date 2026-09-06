import React, { useState, useEffect } from 'react';
import { ArrowLeft, Play, CheckCircle2, XCircle, Clock, Eye, FileText, GitPullRequest, Loader2, GitMerge, AlertTriangle, ExternalLink, ShieldCheck } from 'lucide-react';
import { StatusBadge } from '../../components/ui';
import ImplementationPlan from './ImplementationPlan';
import LiveExecution from './LiveExecution';

export default function TaskDetail({ task, onBack }) {
  const [currentStatus, setCurrentStatus] = useState(task.status);
  const [showDiff, setShowDiff] = useState(false);
  const [loadingAction, setLoadingAction] = useState(false);

  // Poll for status updates if in a transitional state
  useEffect(() => {
    let interval;
    if (['ANALYZING', 'PLANNING', 'IMPLEMENTING', 'TESTING', 'VALIDATING', 'RUNNING', 'DIAGNOSING', 'RETRYING', 'VERIFYING'].includes(currentStatus)) {
      interval = setInterval(() => {
        fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/tasks/${task._id}`, {
          credentials: 'include'
        })
          .then(res => res.json())
          .then(data => {
            if (data.status !== currentStatus) {
              setCurrentStatus(data.status);
            }
          })
          .catch(err => console.error(err));
      }, 3000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [currentStatus, task._id]);

  const generatePlan = async () => {
    setLoadingAction(true);
    setCurrentStatus('PLANNING');
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/tasks/${task._id}/plan`, {
        method: 'POST',
        credentials: 'include'
      });
      if (response.ok) {
        setCurrentStatus('PLAN_READY');
      } else {
        const errData = await response.json();
        alert(errData.error || 'Failed to generate plan');
        setCurrentStatus('CONTEXT_READY');
      }
    } catch (err) {
      console.error(err);
      setCurrentStatus('CONTEXT_READY');
    } finally {
      setLoadingAction(false);
    }
  };

  const approvePlan = async (plan) => {
    setLoadingAction(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/tasks/${task._id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ planHash: plan?.planHash })
      });
      if (response.ok) {
        // Kick off execution right away after approval
        const execRes = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/tasks/${task._id}/execute`, {
          method: 'POST',
          credentials: 'include'
        });
        if (execRes.ok) {
          setCurrentStatus('RUNNING');
        } else {
          const errData = await execRes.json();
          alert(errData.error || 'Failed to start execution');
        }
      } else {
        const errData = await response.json();
        alert(errData.error || 'Failed to approve plan');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAction(false);
    }
  };

  const rejectPlan = async () => {
    setLoadingAction(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/tasks/${task._id}/reject`, {
        method: 'POST',
        credentials: 'include'
      });
      if (response.ok) {
        setCurrentStatus('CONTEXT_READY');
      } else {
        const errData = await response.json();
        alert(errData.error || 'Failed to reject plan');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAction(false);
    }
  };

  // Components for different states
  const AnalyzingState = () => (
    <div className="p-8 max-w-2xl mx-auto mt-10 space-y-8">
      <div className="bg-background border border-border rounded-md p-8 shadow-modal text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-primary/5 animate-pulse"></div>
        
        <div className="relative z-10">
          <div className="flex justify-center gap-2 mb-6">
            <div className="w-3 h-3 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-3 h-3 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-3 h-3 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
          <h2 className="text-xl font-heading text-text-primary mb-2">
            {currentStatus === 'PLANNING' ? 'Generating Implementation Plan...' : 'Analyzing Codebase...'}
          </h2>
          <p className="text-sm text-text-secondary">
            {currentStatus === 'PLANNING' 
              ? 'OPTIMUS is synthesizing repository context and formulating a technical plan.' 
              : 'OPTIMUS is processing context and building a mental model.'}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {(currentStatus === 'PLANNING' 
          ? ['Reading repository AST & file index', 'Filtering sensitive paths & secrets', 'Formulating technical implementation steps', 'Computing tamper-proof plan checksum']
          : ['Reading file tree', 'Extracting symbols', 'Building dependency graph', 'Identifying affected files']
        ).map((step, i) => (
          <div key={i} className="flex items-center gap-3 text-sm text-text-secondary">
            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${currentStatus === 'CONTEXT_READY' || (currentStatus === 'PLANNING' && i < 2) || (currentStatus === 'ANALYZING' && i < 2) ? 'border-primary' : 'border-border'}`}>
              {(currentStatus === 'CONTEXT_READY' || (currentStatus === 'PLANNING' && i < 2) || (currentStatus === 'ANALYZING' && i < 2)) && <div className="w-2 h-2 bg-primary rounded-full"></div>}
            </div>
            <span className={currentStatus === 'CONTEXT_READY' || i < 2 ? 'text-text-primary' : ''}>{step}</span>
          </div>
        ))}
      </div>
      
      {currentStatus === 'CONTEXT_READY' && (
        <div className="mt-8 flex justify-center">
          <button 
            onClick={generatePlan}
            disabled={loadingAction}
            className="flex items-center gap-2 px-6 py-2.5 bg-primary text-text-primary rounded-sm hover:bg-opacity-90 font-medium disabled:opacity-50"
          >
            {loadingAction ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Generate Implementation Plan
          </button>
        </div>
      )}
    </div>
  );

  const CompletedView = () => {
    const [review, setReview] = useState(null);
    const [loadingReview, setLoadingReview] = useState(true);
    const [deliveryState, setDeliveryState] = useState(task.status === 'DELIVERED' || task.prUrl ? 'pr_created' : 'review');
    const [delivering, setDelivering] = useState(false);
    const [deliveryError, setDeliveryError] = useState(null);
    const [activePrUrl, setActivePrUrl] = useState(task.prUrl || null);
    const [activePrNumber, setActivePrNumber] = useState(task.prNumber || null);

    const loadReview = () => {
      setLoadingReview(true);
      fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/tasks/${task._id}/review`, {
        credentials: 'include'
      })
        .then(res => res.json())
        .then(data => {
          setReview(data);
          if (data.isDelivered || data.prUrl) {
            setDeliveryState('pr_created');
            setActivePrUrl(data.prUrl);
            setActivePrNumber(data.prNumber);
          }
        })
        .catch(err => console.error('Failed to load review:', err))
        .finally(() => setLoadingReview(false));
    };

    useEffect(() => {
      loadReview();
    }, [task._id]);

    const handleDeliver = async () => {
      setDelivering(true);
      setDeliveryError(null);
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/tasks/${task._id}/deliver`, {
          method: 'POST',
          credentials: 'include'
        });
        const data = await res.json();
        if (res.ok) {
          setActivePrUrl(data.prUrl);
          setActivePrNumber(data.prNumber);
          setDeliveryState('pr_created');
          setCurrentStatus('DELIVERED');
        } else {
          setDeliveryError(data.error || 'Failed to deliver changes to GitHub');
        }
      } catch (err) {
        setDeliveryError(err.message || 'Network error delivering changes');
      } finally {
        setDelivering(false);
      }
    };

    if (deliveryState === 'pr_created' || activePrUrl) {
      return (
        <div className="p-6 max-w-4xl mx-auto space-y-6">
          <div className="bg-background border border-primary/30 rounded-md p-8 shadow-modal text-center">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <GitPullRequest className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-2xl font-heading text-text-primary mb-2">Pull Request Created!</h2>
            <p className="text-sm text-text-secondary mb-4">
              Verified changes have been committed, pushed to branch, and a Pull Request was opened against <span className="font-mono text-text-primary">{review?.targetBranch || 'main'}</span>.
            </p>
            
            <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
              {activePrNumber && (
                <div className="inline-block px-3 py-1 bg-surface border border-border rounded text-xs font-mono text-primary">
                  PR #{activePrNumber}
                </div>
              )}
              {review?.deliveryBranch && (
                <div className="inline-block px-3 py-1 bg-surface border border-border rounded text-xs font-mono text-text-secondary">
                  branch: {review.deliveryBranch}
                </div>
              )}
              {review?.commitSha && (
                <div className="inline-block px-3 py-1 bg-surface border border-border rounded text-xs font-mono text-text-secondary">
                  commit: {review.commitSha.substring(0, 7)}
                </div>
              )}
            </div>

            <div className="flex justify-center gap-4">
              <button 
                onClick={onBack}
                className="px-6 py-2 bg-surface border border-border text-text-primary rounded-sm hover:border-primary transition-colors text-sm"
              >
                Back to Tasks
              </button>
              {activePrUrl && (
                <a 
                  href={activePrUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-sm hover:bg-opacity-90 transition-colors text-sm font-medium"
                >
                  <ExternalLink className="w-4 h-4" />
                  View on GitHub
                </a>
              )}
            </div>
          </div>
        </div>
      );
    }

    if (loadingReview) {
      return (
        <div className="flex flex-col items-center justify-center p-16 text-text-secondary">
          <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
          <p className="text-sm font-mono">Generating working-tree diff and verification review...</p>
        </div>
      );
    }

    const ready = review?.readyForDelivery;
    const changedFiles = review?.filesChanged || [];
    const validationRuns = review?.validationResults?.runs || [];

    return (
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        {/* Verification & Review Header */}
        <div className="bg-background border border-green-500/30 rounded-md p-6 shadow-modal">
          <div className="flex items-start gap-4">
            <div className="p-2 bg-green-500/10 rounded-full">
              <CheckCircle2 className="w-6 h-6 text-green-400" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-medium text-green-400 mb-1">Execution Verified & Ready for Review</h2>
                <span className="text-xs font-mono px-2 py-0.5 bg-green-500/10 text-green-400 border border-green-500/20 rounded">
                  VERIFIED
                </span>
              </div>
              <p className="text-sm text-text-secondary mb-4">
                The agent completed all implementation steps and automated verification passed. Inspect the real working-tree diff and validation results before delivering to GitHub.
              </p>
              
              {/* Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <div className="p-3 bg-surface border border-border rounded-sm">
                  <span className="text-text-secondary block text-xs">Files Changed</span>
                  <span className="text-text-primary font-mono text-sm font-medium">{changedFiles.length} files</span>
                </div>
                <div className="p-3 bg-surface border border-border rounded-sm">
                  <span className="text-text-secondary block text-xs">Additions</span>
                  <span className="text-green-400 font-mono text-sm font-medium">+{review?.totalAdditions || 0} lines</span>
                </div>
                <div className="p-3 bg-surface border border-border rounded-sm">
                  <span className="text-text-secondary block text-xs">Deletions</span>
                  <span className="text-red-400 font-mono text-sm font-medium">-{review?.totalDeletions || 0} lines</span>
                </div>
                <div className="p-3 bg-surface border border-border rounded-sm">
                  <span className="text-text-secondary block text-xs">Validation</span>
                  <span className="text-green-400 font-mono text-sm font-medium flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    {review?.validationResults?.status || 'PASSED'}
                  </span>
                </div>
              </div>

              {/* Delivery Readiness Warning / Info */}
              {!ready && review?.reasonsNotReady?.length > 0 && (
                <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded text-xs space-y-1">
                  <div className="font-medium text-yellow-400 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" />
                    Delivery Requirements Not Met:
                  </div>
                  <ul className="list-disc list-inside text-text-secondary space-y-0.5">
                    {review.reasonsNotReady.map((r, idx) => (
                      <li key={idx}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Delivery Progress Indicator */}
              {delivering && (
                <div className="mb-4 p-4 bg-primary/10 border border-primary/30 rounded text-xs space-y-2">
                  <div className="flex items-center gap-2 text-primary font-medium">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Executing GitHub Delivery Pipeline...</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-[11px] text-text-secondary">
                    <div className="p-1.5 bg-surface/80 rounded border border-primary/20 text-center">1. Prepare Branch</div>
                    <div className="p-1.5 bg-surface/80 rounded border border-primary/20 text-center">2. Commit Changes</div>
                    <div className="p-1.5 bg-surface/80 rounded border border-primary/20 text-center">3. Push Branch</div>
                    <div className="p-1.5 bg-surface/80 rounded border border-primary/20 text-center">4. Open PR</div>
                  </div>
                </div>
              )}

              {/* Delivery Error Alert with Retry */}
              {deliveryError && (
                <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-400 space-y-2">
                  <div className="flex items-start gap-2">
                    <XCircle className="w-4 h-4 mt-0.5 flex-none" />
                    <div className="flex-1">
                      <span className="font-medium block mb-0.5">Delivery Failed</span>
                      <span>{deliveryError}</span>
                    </div>
                  </div>
                  <div className="pt-1 flex justify-end">
                    <button
                      onClick={handleDeliver}
                      disabled={delivering}
                      className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-300 rounded text-xs font-medium transition-colors"
                    >
                      {delivering ? 'Retrying...' : 'Retry Delivery'}
                    </button>
                  </div>
                </div>
              )}

              {/* Actions Bar */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button 
                  onClick={() => setShowDiff(!showDiff)}
                  className="flex items-center gap-2 px-4 py-2 bg-surface border border-border text-text-primary rounded-sm hover:border-primary transition-colors text-sm"
                >
                  <Eye className="w-4 h-4" />
                  {showDiff ? 'Hide Patch Review' : 'View Patch Review'}
                </button>
                <button 
                  onClick={handleDeliver}
                  disabled={!ready || delivering}
                  className="flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-sm hover:bg-opacity-90 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {delivering ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitMerge className="w-4 h-4" />}
                  {deliveryError ? 'Retry Delivery (Open PR)' : 'Deliver to GitHub (Open PR)'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Validation Details Card */}
        {validationRuns.length > 0 && (
          <div className="bg-background border border-border rounded-md p-4 shadow-modal">
            <h3 className="text-xs font-heading font-medium text-text-primary uppercase tracking-wider mb-2 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-green-400" />
              Automated Validation Suite
            </h3>
            <div className="space-y-2">
              {validationRuns.map((run, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 bg-surface border border-border rounded text-xs font-mono">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-400"></span>
                    <span className="text-text-primary">{run.command}</span>
                  </div>
                  <div className="flex items-center gap-3 text-text-secondary">
                    <span>Exit Code: {run.exitCode}</span>
                    <span>{run.durationMs}ms</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Changed Files Breakdown */}
        {changedFiles.length > 0 && (
          <div className="bg-background border border-border rounded-md p-4 shadow-modal">
            <h3 className="text-xs font-heading font-medium text-text-primary uppercase tracking-wider mb-2 flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              Changed Files ({changedFiles.length})
            </h3>
            <div className="space-y-1.5">
              {changedFiles.map((file, idx) => (
                <div key={idx} className="flex items-center justify-between px-3 py-1.5 bg-surface border border-border rounded text-xs font-mono">
                  <span className="text-text-primary">{file.path}</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                    file.status === 'added' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                    file.status === 'deleted' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                    'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                  }`}>
                    {file.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Diff Viewer */}
        {showDiff && (
          <div className="bg-background border border-border rounded-md overflow-hidden shadow-modal">
            <div className="px-4 py-2.5 bg-surface border-b border-border text-xs font-mono text-text-secondary flex justify-between items-center">
              <span>Git Working Tree Diff</span>
              {review?.diffStat && <span className="text-text-secondary text-[11px]">{review.diffStat}</span>}
            </div>
            <div className="p-4 text-xs font-mono overflow-x-auto max-h-96 leading-relaxed">
              {review?.diff ? (
                review.diff.split('\n').map((line, idx) => {
                  let lineClass = 'text-text-secondary';
                  if (line.startsWith('+') && !line.startsWith('+++')) lineClass = 'text-green-400 bg-green-500/5';
                  else if (line.startsWith('-') && !line.startsWith('---')) lineClass = 'text-red-400 bg-red-500/5';
                  else if (line.startsWith('@@')) lineClass = 'text-cyan-400';
                  else if (line.startsWith('diff') || line.startsWith('index')) lineClass = 'text-text-secondary opacity-60';
                  return (
                    <div key={idx} className={`${lineClass} px-1 rounded-sm`}>
                      {line || ' '}
                    </div>
                  );
                })
              ) : (
                <div className="text-text-secondary">No diff available.</div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const FailedView = () => (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="bg-background border border-red-500/30 rounded-md p-6 shadow-modal">
        <div className="flex items-start gap-4">
          <div className="p-2 bg-red-500/10 rounded-full">
            <XCircle className="w-6 h-6 text-red-400" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-medium text-red-400 mb-1">Execution Failed</h2>
            <p className="text-sm text-text-secondary mb-4">An unexpected error occurred during execution.</p>
            
            <button 
              onClick={() => setCurrentStatus('RUNNING')}
              className="px-4 py-2 bg-primary text-text-primary rounded-sm hover:bg-opacity-90 transition-colors text-sm"
            >
              Retry Execution
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col bg-surface overflow-hidden">
      <div className="flex-none px-6 py-4 border-b border-border bg-background flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-1.5 hover:bg-surface rounded-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-base font-heading font-medium text-text-primary">{task.title}</h2>
            <div className="text-xs text-text-secondary font-mono mt-0.5">ID: {task._id}</div>
          </div>
        </div>
        <StatusBadge status={currentStatus} />
      </div>

      <div className="flex-1 overflow-y-auto">
        {(currentStatus === 'CONTEXT_READY' || currentStatus === 'ANALYZING' || currentStatus === 'PLANNING') && <AnalyzingState />}
        
        {(currentStatus === 'PLAN_READY' || currentStatus === 'AWAITING_APPROVAL') && (
          <ImplementationPlan 
            taskId={task._id}
            onApprove={approvePlan}
            onReject={rejectPlan}
            loading={loadingAction}
          />
        )}
        
        {['IMPLEMENTING', 'TESTING', 'VALIDATING', 'RUNNING', 'DIAGNOSING', 'RETRYING', 'VERIFYING'].includes(currentStatus) && (
          <LiveExecution 
            taskId={task._id}
            onComplete={() => setCurrentStatus('VERIFIED')} 
            onFailed={() => setCurrentStatus('FAILED')}
          />
        )}
        
        {(currentStatus === 'COMPLETED' || currentStatus === 'VERIFIED' || currentStatus === 'DELIVERED') && <CompletedView />}
        
        {currentStatus === 'FAILED' && <FailedView />}
      </div>
    </div>
  );
}
