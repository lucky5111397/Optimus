import React, { useState, useEffect } from 'react';
import { CheckCircle2, XCircle, FileText, Zap, AlertTriangle, Loader2, ShieldCheck, Search, Code, CheckSquare } from 'lucide-react';

export default function ImplementationPlan({ taskId, onApprove, onReject, loading }) {
  const [plan, setPlan] = useState(null);
  const [loadingPlan, setLoadingPlan] = useState(true);
  const [showMarkdown, setShowMarkdown] = useState(false);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/tasks/${taskId}/plan`, {
      credentials: 'include'
    })
      .then(res => res.json())
      .then(data => setPlan(data))
      .catch(err => console.error(err))
      .finally(() => setLoadingPlan(false));
  }, [taskId]);

  if (loadingPlan) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-text-secondary">
        <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
        <p className="text-sm font-mono">Loading implementation plan...</p>
      </div>
    );
  }

  if (!plan) {
    return <div className="p-12 text-center text-text-secondary">Plan not found</div>;
  }

  const shortHash = plan.planHash ? plan.planHash.substring(0, 8) : 'unknown';
  const generatedTime = plan.generatedAt ? new Date(plan.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="bg-background border border-border rounded-md shadow-modal overflow-hidden">
        {/* Header Bar */}
        <div className="px-6 py-4 border-b border-border bg-surface flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-sm">
              <Zap className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-heading text-text-primary font-medium">Implementation Plan</h2>
                <span className="px-2 py-0.5 text-xs font-mono bg-surface border border-border rounded-sm text-text-secondary">
                  v{plan.version || 1}
                </span>
                <span className="px-2 py-0.5 text-[11px] font-mono bg-primary/10 text-primary border border-primary/20 rounded-sm">
                  #{shortHash}
                </span>
              </div>
              <p className="text-xs text-text-secondary mt-0.5">
                {plan.steps?.length || 0} execution steps {generatedTime ? `• Generated at ${generatedTime}` : ''}
              </p>
            </div>
          </div>

          <button 
            onClick={() => setShowMarkdown(!showMarkdown)}
            className="text-xs font-mono px-3 py-1.5 bg-surface border border-border hover:border-primary text-text-secondary hover:text-text-primary rounded-sm transition-colors"
          >
            {showMarkdown ? 'Structured View' : 'Raw Markdown'}
          </button>
        </div>

        <div className="p-6 space-y-6">
          {showMarkdown ? (
            /* Raw Markdown View */
            <div className="text-xs text-text-primary leading-relaxed whitespace-pre-wrap font-mono bg-surface p-4 border border-border rounded overflow-x-auto">
              {plan.markdown || 'No markdown content.'}
            </div>
          ) : (
            /* Structured Cards View */
            <>
              {/* Summary & Approach */}
              {(plan.summary || plan.approach) && (
                <div className="bg-surface border border-border rounded-md p-4 space-y-2">
                  {plan.summary && (
                    <p className="text-sm text-text-primary leading-relaxed">{plan.summary}</p>
                  )}
                  {plan.approach && (
                    <div className="pt-2 border-t border-border/50 text-xs text-text-secondary leading-relaxed">
                      <span className="font-medium text-text-primary">Approach: </span>
                      {plan.approach}
                    </div>
                  )}
                </div>
              )}

              {/* Files to Inspect & Change */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {plan.filesToInspect && plan.filesToInspect.length > 0 && (
                  <div className="p-3 bg-surface border border-border rounded-sm">
                    <div className="flex items-center gap-2 text-xs font-medium text-text-secondary mb-2">
                      <Search className="w-3.5 h-3.5 text-blue-400" />
                      <span>Files to Inspect</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {plan.filesToInspect.map((file, idx) => (
                        <span key={idx} className="px-2 py-0.5 text-[11px] font-mono bg-background border border-border rounded text-text-primary">
                          {file}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {plan.filesExpectedToChange && plan.filesExpectedToChange.length > 0 && (
                  <div className="p-3 bg-surface border border-border rounded-sm">
                    <div className="flex items-center gap-2 text-xs font-medium text-text-secondary mb-2">
                      <Code className="w-3.5 h-3.5 text-primary" />
                      <span>Files Expected to Change</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {plan.filesExpectedToChange.map((file, idx) => (
                        <span key={idx} className="px-2 py-0.5 text-[11px] font-mono bg-background border border-border rounded text-text-primary">
                          {file}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Steps Breakdown */}
              {plan.steps && plan.steps.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-text-primary mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-primary" />
                    Execution Steps ({plan.steps.length})
                  </h3>
                  <div className="space-y-3">
                    {plan.steps.map((step, index) => (
                      <div key={index} className="flex gap-4 p-3 bg-surface border border-border rounded-sm">
                        <div className="flex-none w-6 h-6 rounded-full bg-background border border-border flex items-center justify-center text-xs font-mono text-primary mt-0.5 font-medium">
                          {index + 1}
                        </div>
                        <div className="flex-1 space-y-1">
                          <h4 className="text-sm font-medium text-text-primary">{step.title}</h4>
                          <p className="text-xs text-text-secondary leading-relaxed">{step.description}</p>
                          
                          {step.filesAffected && step.filesAffected.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {step.filesAffected.map((file, fIndex) => (
                                <span key={fIndex} className="px-2 py-0.5 text-[10px] font-mono bg-background border border-border rounded-sm text-text-secondary">
                                  {file}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Implementation Details */}
              {plan.implementationDetails && (
                <div className="p-4 bg-surface border border-border rounded-sm">
                  <h4 className="text-xs font-medium text-text-primary mb-1">Technical Implementation Details</h4>
                  <p className="text-xs text-text-secondary leading-relaxed">{plan.implementationDetails}</p>
                </div>
              )}

              {/* Assumptions & Risks */}
              {((plan.assumptions && plan.assumptions.length > 0) || (plan.risks && plan.risks.length > 0)) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {plan.assumptions && plan.assumptions.length > 0 && (
                    <div className="p-3 bg-yellow-500/5 border border-yellow-500/20 rounded-md">
                      <h4 className="text-xs font-medium text-yellow-500 mb-2 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Assumptions
                      </h4>
                      <ul className="list-disc list-inside space-y-1 text-xs text-text-secondary">
                        {plan.assumptions.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {plan.risks && plan.risks.length > 0 && (
                    <div className="p-3 bg-red-500/5 border border-red-500/20 rounded-md">
                      <h4 className="text-xs font-medium text-red-400 mb-2 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Risks & Guardrails
                      </h4>
                      <ul className="list-disc list-inside space-y-1 text-xs text-text-secondary">
                        {plan.risks.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Validation Strategy */}
              {plan.validationStrategy && (
                <div className="p-3 bg-surface border border-border rounded-sm flex items-start gap-3">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 mt-0.5 flex-none" />
                  <div>
                    <h4 className="text-xs font-medium text-emerald-400 mb-0.5">Validation Strategy</h4>
                    <p className="text-xs text-text-secondary leading-relaxed">{plan.validationStrategy}</p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Action Bar */}
        <div className="px-6 py-4 bg-surface border-t border-border flex justify-between items-center">
          <div className="text-xs text-text-secondary font-mono">
            {plan.approvedAt ? (
              <span className="text-emerald-400 flex items-center gap-1.5">
                <CheckSquare className="w-3.5 h-3.5" />
                Approved on {new Date(plan.approvedAt).toLocaleDateString()}
              </span>
            ) : (
              <span>Review plan before authorizing execution</span>
            )}
          </div>

          <div className="flex gap-3">
            <button 
              onClick={onReject}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 text-sm text-text-secondary hover:text-red-400 hover:bg-red-400/10 rounded-sm transition-colors disabled:opacity-50"
            >
              <XCircle className="w-4 h-4" />
              Reject Plan
            </button>
            <button 
              onClick={() => onApprove && onApprove(plan)}
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2 text-sm bg-primary text-text-primary rounded-sm hover:bg-opacity-90 transition-colors disabled:opacity-50 font-medium"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Approve & Execute
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
