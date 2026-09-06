/**
 * Bounded Agent Context Engine.
 * Constructs focused, deterministic, sensitive-scrubbed context for agent execution and self-correction.
 */

const { scrubTokens } = require('./toolExecutors');
const { isSensitivePath } = require('../ai/prompts');

const MAX_DIFF_SNIPPET_CHARS = 2000;
const MAX_ERROR_OUTPUT_CHARS = 2000;
const MAX_MESSAGE_CONTENT_CHARS = 25000;

/**
 * Build bounded step prompt and instructions for agent step execution.
 */
function buildStepMessages({ task, plan, stepIndex, currentDiff = '', changedFiles = [] }) {
  const step = plan.steps[stepIndex] || { title: `Step ${stepIndex + 1}`, description: '' };
  const safeTitle = scrubTokens(task.title || 'Engineering Task');
  const safeDescription = scrubTokens(task.description || '');
  const safePlanSummary = scrubTokens(plan.summary || '');
  const safeApproach = scrubTokens(plan.approach || '');

  // Filter out any sensitive files from affected files list
  const safeFilesAffected = (step.filesAffected || [])
    .filter(f => !isSensitivePath(f))
    .slice(0, 20);

  // Bounded and scrubbed git diff
  let diffSnippet = '';
  if (currentDiff && typeof currentDiff === 'string' && currentDiff.trim()) {
    const scrubbedDiff = scrubTokens(currentDiff.trim());
    diffSnippet = scrubbedDiff.length > MAX_DIFF_SNIPPET_CHARS
      ? scrubbedDiff.substring(0, MAX_DIFF_SNIPPET_CHARS) + '\n... [Diff truncated]'
      : scrubbedDiff;
  }

  const systemContent = `You are OPTIMUS, an autonomous software engineering agent.
TASK OBJECTIVE:
Title: ${safeTitle}
Description: ${safeDescription}

PLAN CONTEXT:
Summary: ${safePlanSummary}
Approach: ${safeApproach}
Overall Steps: ${plan.steps.length}

CURRENT ASSIGNMENT (Step ${stepIndex + 1} of ${plan.steps.length}):
Title: ${step.title}
Instructions: ${step.description}
Files Targeted: ${safeFilesAffected.join(', ') || 'Codebase files as needed'}
${changedFiles.length > 0 ? `Files Modified So Far: ${Array.from(changedFiles).join(', ')}` : ''}
${diffSnippet ? `\nCurrent Git Changes:\n\`\`\`diff\n${diffSnippet}\n\`\`\`` : ''}

OPERATIONAL CONSTRAINTS:
1. Inspect code first with 'read_file' or 'search_code' before modifying. Do NOT hallucinate code.
2. Use 'apply_patch' or 'create_file' to apply changes safely.
3. For 'apply_patch', 'oldText' must EXACTLY match the source file lines including indentation.
4. Never modify environment configuration files, credentials, secrets, or git directories.
5. When this step is complete, call 'complete_step' tool to proceed.`;

  return [
    {
      role: 'system',
      content: systemContent
    }
  ];
}

/**
 * Build focused context for agent self-correction when validation fails.
 */
function buildCorrectionMessages({ failureDetails, validationAttempts, maxAttempts, currentDiff = '', changedFiles = [] }) {
  const safeCommand = scrubTokens(failureDetails?.command || 'npm test');
  const exitCode = failureDetails?.exitCode !== undefined ? failureDetails.exitCode : 1;
  const rawOutput = failureDetails?.output || failureDetails?.stderr || failureDetails?.stdout || 'No output recorded';
  
  let safeOutput = scrubTokens(rawOutput);
  if (safeOutput.length > MAX_ERROR_OUTPUT_CHARS) {
    safeOutput = safeOutput.substring(0, MAX_ERROR_OUTPUT_CHARS) + '\n... [Error output truncated]';
  }

  let diffSnippet = '';
  if (currentDiff && typeof currentDiff === 'string' && currentDiff.trim()) {
    const scrubbedDiff = scrubTokens(currentDiff.trim());
    diffSnippet = scrubbedDiff.length > MAX_DIFF_SNIPPET_CHARS
      ? scrubbedDiff.substring(0, MAX_DIFF_SNIPPET_CHARS) + '\n... [Diff truncated]'
      : scrubbedDiff;
  }

  const systemContent = `You are OPTIMUS. The recent changes failed project validation.
SELF-CORRECTION ATTEMPT ${validationAttempts} of ${maxAttempts}:

FAILED VALIDATION COMMAND:
Command: ${safeCommand}
Exit Code: ${exitCode}

ERROR LOG:
${safeOutput}

MODIFIED FILES:
${changedFiles.length > 0 ? Array.from(changedFiles).join(', ') : 'None yet'}
${diffSnippet ? `\nCurrent Git Changes:\n\`\`\`diff\n${diffSnippet}\n\`\`\`` : ''}

CORRECTION INSTRUCTIONS:
1. Analyze the error output and inspect relevant source files with 'read_file'.
2. Identify the root cause of the validation failure.
3. Apply targeted fix using 'apply_patch'.
4. When you believe the issue is resolved, call 'complete_step' to re-run validation.`;

  return [
    {
      role: 'system',
      content: systemContent
    }
  ];
}

/**
 * Prune and bound message history to prevent context window exhaustion.
 * Preserves the system prompt, deduplicates consecutive user nudges, and bounds message content length.
 */
function pruneMessageHistory(messages, maxTurns = 12) {
  if (!Array.isArray(messages) || messages.length <= 1) return messages;

  const systemMsg = messages[0];
  let conversationTurns = messages.slice(1);

  // Bound content size of individual messages & scrub tokens
  conversationTurns = conversationTurns.map(msg => {
    let content = msg.content;
    if (typeof content === 'string') {
      content = scrubTokens(content);
      if (content.length > MAX_MESSAGE_CONTENT_CHARS) {
        content = content.substring(0, MAX_MESSAGE_CONTENT_CHARS) + '\n... [Content truncated]';
      }
    }
    return { ...msg, content };
  });

  // Deduplicate consecutive identical nudges
  const deduplicated = [];
  for (let i = 0; i < conversationTurns.length; i++) {
    const curr = conversationTurns[i];
    const prev = deduplicated[deduplicated.length - 1];
    if (prev && prev.role === 'user' && curr.role === 'user' && prev.content === curr.content) {
      continue;
    }
    deduplicated.push(curr);
  }

  // If conversation history exceeds turn limit, retain the most recent turns
  const maxHistoryItems = maxTurns * 2;
  if (deduplicated.length > maxHistoryItems) {
    const pruned = deduplicated.slice(-maxHistoryItems);
    return [systemMsg, ...pruned];
  }

  return [systemMsg, ...deduplicated];
}

module.exports = {
  buildStepMessages,
  buildCorrectionMessages,
  pruneMessageHistory
};
