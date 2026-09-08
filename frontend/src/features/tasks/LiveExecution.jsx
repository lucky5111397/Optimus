import React, { useState, useEffect, useRef } from 'react';
import {
  XCircle, CheckCircle2, Clock, Terminal, AlertTriangle,
  Copy, Check, Activity, ChevronDown, ChevronRight,
  ShieldAlert, Wrench, ShieldCheck, ArrowDown, Loader2
} from 'lucide-react';
import { StatusBadge } from '../../components/ui';

export default function LiveExecution({ taskId, onComplete, onFailed, readOnly = false }) {
  const [execution, setExecution] = useState(null);
  const [activeTab, setActiveTab] = useState('terminal'); // 'terminal' | 'audit'
  const [auditEvents, setAuditEvents] = useState([]);
  const [copiedTrace, setCopiedTrace] = useState(false);
  const [copiedLogs, setCopiedLogs] = useState(false);
  const [expandedEvents, setExpandedEvents] = useState({});
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);

  const terminalRef = useRef(null);
  const lastSequenceRef = useRef(0);
  const currentTraceRef = useRef(null);

  // Incremental event retrieval using sequence cursors
  const fetchAuditEvents = async () => {
    try {
      const sinceSeq = lastSequenceRef.current;
      const res = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/tasks/${taskId}/execution/events?sinceSequence=${sinceSeq}`,
        { credentials: 'include' }
      );
      if (!res.ok) return;
      const newEvents = await res.json();

      if (Array.isArray(newEvents) && newEvents.length > 0) {
        setAuditEvents(prev => {
          const existingIds = new Set(prev.map(e => e._id || `${e.sequenceNumber}-${e.timestamp}`));
          const uniqueIncoming = newEvents.filter(e => !existingIds.has(e._id || `${e.sequenceNumber}-${e.timestamp}`));
          if (uniqueIncoming.length === 0) return prev;
          const merged = [...prev, ...uniqueIncoming].sort((a, b) => (a.sequenceNumber || 0) - (b.sequenceNumber || 0));
          return merged;
        });

        // Update cursor to highest sequence received
        const maxSeq = Math.max(...newEvents.map(e => e.sequenceNumber || 0));
        if (maxSeq > lastSequenceRef.current) {
          lastSequenceRef.current = maxSeq;
        }
      }
    } catch (err) {
      console.error('Error fetching incremental audit events:', err);
    }
  };

  // Execution polling interval
  useEffect(() => {
    // Reset sequence cursor if taskId changes
    lastSequenceRef.current = 0;
    setAuditEvents([]);

    const pollExecution = () => {
      fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/tasks/${taskId}/execution`, {
        credentials: 'include'
      })
        .then(res => res.json())
        .then(data => {
          // If trace changed, this is a fresh run (e.g. after retry)
          if (data.traceId && currentTraceRef.current && currentTraceRef.current !== data.traceId) {
            lastSequenceRef.current = 0;
            setAuditEvents([]);
          }
          currentTraceRef.current = data.traceId;
          setExecution(data);

          // Fetch incremental audit events
          fetchAuditEvents();

          if (!readOnly) {
            if (['COMPLETED', 'VERIFIED'].includes(data.status)) {
              clearInterval(interval);
              if (onComplete) setTimeout(onComplete, 1200);
            } else if (['FAILED', 'CANCELLED'].includes(data.status)) {
              clearInterval(interval);
              if (onFailed) setTimeout(onFailed, 1200);
            }
          }
        })
        .catch(err => console.error('Execution poll error:', err));
    };

    pollExecution();
    const interval = setInterval(pollExecution, 2000);

    return () => clearInterval(interval);
  }, [taskId, onComplete, onFailed, readOnly]);

  // Terminal scroll handling
  useEffect(() => {
    if (activeTab === 'terminal' && terminalRef.current && autoScrollEnabled) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [execution?.executionLogs, activeTab, autoScrollEnabled]);

  const handleTerminalScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    // Auto-scroll pauses when scrolled more than 40px away from bottom
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 40;
    setAutoScrollEnabled(isAtBottom);
  };

  const resumeAutoScroll = () => {
    setAutoScrollEnabled(true);
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  };

  const handleCancel = async () => {
    try {
      await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/tasks/${taskId}/execution/cancel`, {
        method: 'POST',
        credentials: 'include'
      });
    } catch (err) {
      console.error('Cancel execution error:', err);
    }
  };

  const handleCopyTrace = () => {
    if (!execution?.traceId) return;
    navigator.clipboard.writeText(execution.traceId);
    setCopiedTrace(true);
    setTimeout(() => setCopiedTrace(false), 2000);
  };

  const handleCopyLogs = () => {
    if (!execution?.executionLogs || execution.executionLogs.length === 0) return;
    const formatted = execution.executionLogs
      .map(log => `[${new Date(log.timestamp || Date.now()).toLocaleTimeString()}][${log.stream || 'system'}] ${log.text}`)
      .join('\n');
    navigator.clipboard.writeText(formatted);
    setCopiedLogs(true);
    setTimeout(() => setCopiedLogs(false), 2000);
  };

  const toggleEventExpand = (id) => {
    setExpandedEvents(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const totalSteps = execution?.totalSteps || 1;
  const currentStepIndex = execution?.currentStep || 0;
  const activeStatus = execution?.taskStatus || execution?.status || 'RUNNING';
  const isCompleted = ['COMPLETED', 'VERIFIED'].includes(activeStatus) || ['COMPLETED', 'VERIFIED'].includes(execution?.status);

  // Derive Active Tool Execution Indicator from actual audit events
  const deriveActiveTool = () => {
    if (isCompleted || activeStatus === 'FAILED' || activeStatus === 'CANCELLED') return null;

    for (let i = auditEvents.length - 1; i >= 0; i--) {
      const ev = auditEvents[i];
      if (ev.eventType === 'TOOL_CALL_STARTED') {
        const targetPath = ev.metadata?.args?.path || ev.metadata?.args?.command || ev.metadata?.args?.query || '';
        return {
          name: ev.toolName || 'tool',
          target: targetPath,
          status: 'running',
          step: ev.stepIndex || currentStepIndex
        };
      }
      if (ev.eventType === 'TOOL_CALL_COMPLETED') {
        const targetPath = ev.metadata?.args?.path || ev.metadata?.outputSummary || '';
        return {
          name: ev.toolName || 'tool',
          target: targetPath,
          status: ev.status === 'FAILED' ? 'failed' : 'completed',
          durationMs: ev.durationMs || 0,
          step: ev.stepIndex || currentStepIndex
        };
      }
    }
    return null;
  };

  const activeTool = deriveActiveTool();

  // Derive Live Validation State
  const isValidationPhase = ['TESTING', 'VALIDATING', 'DIAGNOSING', 'RETRYING', 'VERIFYING'].includes(activeStatus);
  const deriveValidationInfo = () => {
    if (!isValidationPhase) return null;

    let attempt = 1;
    let command = 'npm test';

    for (let i = auditEvents.length - 1; i >= 0; i--) {
      const ev = auditEvents[i];
      if (ev.eventType === 'VALIDATION_STARTED' || ev.eventType === 'VALIDATION_COMPLETED') {
        if (ev.metadata?.attempt) attempt = ev.metadata.attempt;
        if (ev.metadata?.command) command = ev.metadata.command;
        break;
      }
    }

    let phaseLabel = 'Running validation checks...';
    if (activeStatus === 'DIAGNOSING') {
      phaseLabel = 'Diagnosing test failure...';
    } else if (activeStatus === 'RETRYING') {
      phaseLabel = 'Applying self-correction patch...';
    } else if (activeStatus === 'VERIFYING') {
      phaseLabel = 'Re-verifying fixes...';
    }

    return { attempt, command, phaseLabel };
  };

  const validationInfo = deriveValidationInfo();

  let currentAction = 'Executing plan...';
  if (isValidationPhase && validationInfo) {
    currentAction = validationInfo.phaseLabel;
  } else if (['COMPLETED', 'VERIFIED'].includes(activeStatus)) {
    currentAction = 'Verification passed!';
  } else if (activeStatus === 'FAILED') {
    currentAction = 'Execution failed.';
  } else if (activeStatus === 'CANCELLED') {
    currentAction = 'Execution cancelled.';
  }

  const getEventBadgeClass = (eventType, status) => {
    if (status === 'FAILED' || eventType.includes('FAILED')) return 'bg-red-500/10 text-red-400 border-red-500/30';
    if (status === 'SUCCESS' || eventType.includes('COMPLETED')) return 'bg-green-500/10 text-green-400 border-green-500/30';
    if (eventType.includes('VALIDATION')) return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30';
    if (eventType.includes('TOOL')) return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
    if (eventType.includes('ROLLBACK')) return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
    return 'bg-surface text-text-secondary border-border';
  };

  return (
    <div className="h-full flex flex-col p-6 space-y-4 max-w-5xl mx-auto">
      {/* Header and Progress Card */}
      <div className="bg-background border border-border rounded-md p-4 flex flex-col gap-4 shadow-modal">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <StatusBadge status={activeStatus} />
            <span className="text-sm font-medium text-text-primary">{currentAction}</span>
          </div>

          <div className="flex items-center gap-3">
            {/* Model Badge */}
            {(execution?.metadata?.model || execution?.metadata?.finalModel) && (
              <div className="flex items-center gap-1.5 bg-surface border border-border px-2.5 py-1 rounded-sm text-xs font-mono">
                <span className="text-text-secondary opacity-60">model:</span>
                <span className="text-emerald-400 font-medium truncate max-w-[130px]" title={execution.metadata.finalModel || execution.metadata.model}>
                  {execution.metadata.finalModel || execution.metadata.model}
                </span>
                {(execution.metadata.fallbackUsed || execution.metadata.modelFallbackUsed) && (
                  <span className="bg-yellow-500/20 text-yellow-300 text-[10px] px-1 py-0.2 rounded border border-yellow-500/30">
                    fallback
                  </span>
                )}
              </div>
            )}

            {/* Token Usage Badge */}
            {(execution?.metadata?.totalTokens > 0 || execution?.metadata?.usage?.totalTokens > 0) && (
              <div className="hidden sm:flex items-center gap-1.5 bg-surface border border-border px-2.5 py-1 rounded-sm text-xs font-mono">
                <span className="text-text-secondary opacity-60">tokens:</span>
                <span className="text-text-primary font-medium">
                  {(execution.metadata.totalTokens || execution.metadata.usage?.totalTokens).toLocaleString()}
                </span>
              </div>
            )}

            {/* Trace ID Badge */}
            {execution?.traceId && (
              <div className="flex items-center gap-1.5 bg-surface border border-border px-2.5 py-1 rounded-sm text-xs font-mono">
                <span className="text-text-secondary opacity-60">trace:</span>
                <span className="text-primary font-medium">{execution.traceId}</span>
                <button
                  onClick={handleCopyTrace}
                  title="Copy Trace ID"
                  className="text-text-secondary hover:text-text-primary p-0.5 rounded transition-colors ml-1"
                >
                  {copiedTrace ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            )}

            {!readOnly && !isCompleted && activeStatus !== 'FAILED' && activeStatus !== 'CANCELLED' && (
              <button
                onClick={handleCancel}
                title="Cancel Execution"
                className="p-1.5 text-text-secondary hover:text-red-400 rounded-sm transition-colors border border-border hover:border-red-500/30"
              >
                <XCircle className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-text-secondary font-mono">
            {isValidationPhase ? (
              <span>Verification & Validation Phase</span>
            ) : isCompleted ? (
              <span>All Steps Completed</span>
            ) : (
              <span>Step {currentStepIndex} of {totalSteps}</span>
            )}
            <span>
              {isValidationPhase
                ? 'Validating'
                : isCompleted
                ? '100%'
                : `${Math.round((currentStepIndex / Math.max(1, totalSteps)) * 100)}%`}
            </span>
          </div>
          <div className="h-1.5 w-full bg-surface rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-500 ease-out rounded-full"
              style={{
                width: isValidationPhase || isCompleted
                  ? '100%'
                  : `${(currentStepIndex / Math.max(1, totalSteps)) * 100}%`
              }}
            />
          </div>
        </div>

        {/* Active Tool Execution Indicator */}
        {activeTool && !isValidationPhase && (
          <div className="flex items-center justify-between p-2.5 bg-surface border border-border rounded-sm text-xs font-mono">
            <div className="flex items-center gap-2 truncate">
              <div className="p-1 bg-primary/10 rounded">
                <Wrench className="w-3.5 h-3.5 text-primary" />
              </div>
              <span className="text-text-secondary">Tool:</span>
              <span className="text-primary font-medium">{activeTool.name}</span>
              {activeTool.target && (
                <span className="text-text-secondary truncate max-w-sm text-[11px]">
                  ({activeTool.target})
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 flex-none">
              {activeTool.status === 'running' ? (
                <span className="flex items-center gap-1 text-[11px] text-primary px-2 py-0.5 bg-primary/10 border border-primary/30 rounded">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  RUNNING
                </span>
              ) : activeTool.status === 'completed' ? (
                <span className="flex items-center gap-1 text-[11px] text-green-400 px-2 py-0.5 bg-green-500/10 border border-green-500/30 rounded">
                  <Check className="w-3 h-3" />
                  COMPLETED {activeTool.durationMs > 0 ? `(${activeTool.durationMs}ms)` : ''}
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[11px] text-red-400 px-2 py-0.5 bg-red-500/10 border border-red-500/30 rounded">
                  <XCircle className="w-3 h-3" />
                  FAILED
                </span>
              )}
            </div>
          </div>
        )}

        {/* Live Validation Progress Card */}
        {isValidationPhase && validationInfo && (
          <div className="p-3 bg-primary/5 border border-primary/25 rounded-sm text-xs space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-primary" />
                <span className="font-heading font-medium text-text-primary">
                  Automated Sandbox Verification
                </span>
                <span className="px-2 py-0.5 bg-primary/20 text-primary border border-primary/30 rounded text-[11px] font-mono">
                  Attempt {validationInfo.attempt} of 3
                </span>
              </div>
              <div className="flex items-center gap-1.5 font-mono text-[11px]">
                <span className="text-text-secondary">Running:</span>
                <span className="px-2 py-0.5 bg-background border border-border rounded text-text-primary font-bold">
                  {validationInfo.command}
                </span>
              </div>
            </div>
            <div className="text-[12px] text-text-secondary flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span>{validationInfo.phaseLabel}</span>
            </div>
          </div>
        )}

        {/* AI Configuration Error Alert */}
        {(execution?.error?.includes('OPENROUTER_API_KEY') || execution?.executionLogs?.some(l => l.text?.includes('OPENROUTER_API_KEY'))) && (
          <div className="mt-2 p-3 bg-red-500/10 border border-red-500/30 rounded-sm text-xs text-red-300 space-y-1">
            <div className="font-medium text-red-400 flex items-center gap-1.5 text-sm">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              AI Provider Configuration Required
            </div>
            <p className="text-text-secondary">
              Real autonomous execution requires an LLM API key. Configure <code className="font-mono bg-background px-1 py-0.5 rounded border border-border text-text-primary">OPENROUTER_API_KEY</code> in <code className="font-mono bg-background px-1 py-0.5 rounded border border-border text-text-primary">backend/.env</code> to enable live code generation.
            </p>
          </div>
        )}

        {/* Structured Failure Card */}
        {activeStatus === 'FAILED' && execution?.error && !execution?.error?.includes('OPENROUTER_API_KEY') && (
          <div className="mt-2 p-4 bg-red-500/10 border border-red-500/30 rounded-md text-xs text-red-300 space-y-2">
            <div className="flex items-center justify-between">
              <div className="font-semibold text-red-400 flex items-center gap-2 text-sm">
                <ShieldAlert className="w-4 h-4 text-red-400" />
                <span>Execution Failed: {execution?.failureDetails?.category || execution?.metadata?.failureCategory || 'EXECUTION_FAILED'}</span>
              </div>
              {execution?.traceId && (
                <span className="font-mono text-[11px] text-red-400/80 bg-red-500/15 px-2 py-0.5 rounded">
                  Ref: {execution.traceId}
                </span>
              )}
            </div>
            <p className="text-text-primary font-mono text-[12px] bg-background/60 p-2.5 rounded border border-red-500/20">
              {execution?.failureDetails?.message || execution.error}
            </p>
            {execution?.failureDetails?.suggestedAction && (
              <div className="flex items-center gap-2 text-[12px] text-text-secondary pt-1">
                <span className="text-primary font-medium">Recommended Action:</span>
                <span>{execution.failureDetails.suggestedAction}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main Execution Output Card with Tabs */}
      <div className="flex-1 bg-background border border-border rounded-md shadow-modal flex flex-col overflow-hidden min-h-[350px]">
        {/* Card Header with Tab Switcher */}
        <div className="flex-none px-4 py-2 bg-surface border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#FF5F56]" />
            <div className="w-3 h-3 rounded-full bg-[#FFBD2E]" />
            <div className="w-3 h-3 rounded-full bg-[#27C93F]" />
          </div>

          {/* Tab Selector */}
          <div className="flex items-center gap-1 bg-background border border-border rounded-sm p-0.5">
            <button
              onClick={() => setActiveTab('terminal')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-sm text-xs font-medium transition-colors ${
                activeTab === 'terminal'
                  ? 'bg-surface text-primary border border-border shadow-sm'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>Agent Terminal</span>
            </button>
            <button
              onClick={() => setActiveTab('audit')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-sm text-xs font-medium transition-colors ${
                activeTab === 'audit'
                  ? 'bg-surface text-primary border border-border shadow-sm'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Audit Timeline</span>
              {auditEvents.length > 0 && (
                <span className="bg-primary/20 text-primary text-[10px] px-1.5 py-0.2 rounded-full font-mono">
                  {auditEvents.length}
                </span>
              )}
            </button>
          </div>

          {/* Terminal Copy Controls */}
          <div className="flex items-center gap-2">
            {activeTab === 'terminal' && (
              <button
                onClick={handleCopyLogs}
                title="Copy terminal logs"
                className="flex items-center gap-1 text-[11px] font-mono text-text-secondary hover:text-text-primary px-2 py-1 bg-background border border-border rounded-sm transition-colors"
              >
                {copiedLogs ? (
                  <>
                    <Check className="w-3 h-3 text-green-400" />
                    <span className="text-green-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy Logs</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Tab 1: Terminal Content */}
        {activeTab === 'terminal' && (
          <div className="relative flex-1 flex flex-col overflow-hidden">
            <div
              ref={terminalRef}
              onScroll={handleTerminalScroll}
              className="flex-1 p-4 overflow-y-auto font-mono text-[13px] leading-relaxed bg-[#0A0C10]"
            >
              {(execution?.executionLogs || []).map((log, i) => (
                <div key={i} className="flex gap-4 hover:bg-white/5 px-2 py-0.5 -mx-2 rounded">
                  <span className="text-text-secondary opacity-50 flex-none w-20">
                    {new Date(log.timestamp || Date.now()).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second:'2-digit' })}
                  </span>
                  <span className={`
                    flex-1 whitespace-pre-wrap break-words
                    ${log.stream === 'stderr' ? 'text-red-400' : ''}
                    ${log.stream === 'system' ? 'text-primary' : ''}
                    ${log.stream === 'stdout' || !log.stream ? 'text-text-primary' : ''}
                  `}>
                    {log.text}
                  </span>
                </div>
              ))}
              {!isCompleted && activeStatus !== 'FAILED' && activeStatus !== 'CANCELLED' && (
                <div className="flex gap-4 px-2 py-0.5 -mx-2 mt-2">
                  <span className="text-text-secondary opacity-50 flex-none w-20">...</span>
                  <span className="w-2 h-4 bg-primary animate-pulse inline-block" />
                </div>
              )}
            </div>

            {/* Resume Auto-Scroll Button */}
            {!autoScrollEnabled && (
              <button
                onClick={resumeAutoScroll}
                className="absolute bottom-4 right-6 bg-surface/95 border border-primary/40 text-primary text-xs font-mono px-3 py-1.5 rounded-full shadow-lg hover:bg-primary hover:text-white transition-all flex items-center gap-1.5"
              >
                <ArrowDown className="w-3.5 h-3.5" />
                <span>Resume Auto-Scroll</span>
              </button>
            )}
          </div>
        )}

        {/* Tab 2: Audit Timeline Content */}
        {activeTab === 'audit' && (
          <div className="flex-1 p-4 overflow-y-auto bg-[#0A0C10] space-y-2">
            {auditEvents.length === 0 ? (
              <div className="text-center py-12 text-text-secondary text-xs">
                No audit events recorded yet for this execution.
              </div>
            ) : (
              auditEvents.map((event) => {
                const eventId = event._id || `${event.sequenceNumber}-${event.timestamp}`;
                const isExpanded = !!expandedEvents[eventId];
                const hasMetadata = event.metadata && Object.keys(event.metadata).length > 0;

                return (
                  <div
                    key={eventId}
                    className="p-3 bg-surface/50 border border-border/80 hover:border-border rounded-sm text-xs space-y-1.5 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] text-text-secondary opacity-60">
                          #{event.sequenceNumber}
                        </span>
                        <span className={`px-2 py-0.5 rounded border text-[11px] font-mono font-medium ${getEventBadgeClass(event.eventType, event.status)}`}>
                          {event.eventType}
                        </span>
                        {event.status && (
                          <span className="text-[11px] text-text-secondary font-mono">
                            [{event.status}]
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-text-secondary font-mono text-[11px]">
                        {event.durationMs > 0 && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-text-secondary opacity-60" />
                            {event.durationMs}ms
                          </span>
                        )}
                        <span>
                          {new Date(event.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      </div>
                    </div>

                    <div className="text-text-primary text-[13px] flex items-center justify-between">
                      <span>{event.summary}</span>
                      {hasMetadata && (
                        <button
                          onClick={() => toggleEventExpand(eventId)}
                          className="text-text-secondary hover:text-primary p-0.5 rounded flex items-center gap-1 text-[11px]"
                        >
                          {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                          <span>Details</span>
                        </button>
                      )}
                    </div>

                    {hasMetadata && isExpanded && (
                      <pre className="p-2.5 bg-background rounded border border-border font-mono text-[11px] text-text-secondary overflow-x-auto mt-2">
                        {JSON.stringify(event.metadata, null, 2)}
                      </pre>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
