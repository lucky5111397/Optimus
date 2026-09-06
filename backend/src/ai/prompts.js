const path = require('path');
const { scrubTokens } = require('../agent/toolExecutors');

function isSensitivePath(filePath) {
  if (!filePath || typeof filePath !== 'string') return true;
  const normalized = filePath.toLowerCase().replace(/\\/g, '/');
  const baseName = path.basename(normalized);
  
  // Sensitive file names and patterns
  if (baseName.startsWith('.env') || 
      baseName.endsWith('.pem') || 
      baseName.endsWith('.key') || 
      baseName.endsWith('.pfx') ||
      baseName.endsWith('.p12') ||
      baseName.startsWith('id_rsa') || 
      baseName.includes('secret') || 
      baseName.includes('credential') || 
      baseName.includes('cred') || 
      baseName.includes('serviceaccount') || 
      baseName.includes('token') ||
      baseName === 'package-lock.json') {
    return true;
  }

  // Sensitive directory or path segments
  const pathParts = normalized.split('/');
  for (const part of pathParts) {
    if (part === '.git' || 
        part === 'node_modules' || 
        part === '.ssh' || 
        part === 'secrets' || 
        part === 'credentials' ||
        part === '.aws' ||
        part === '.kube') {
      return true;
    }
  }

  return false;
}

function buildPlanningPrompt(task, context = {}) {
  const systemPrompt = `You are OPTIMUS, an expert autonomous software engineer.
Your job is to analyze a user's task and the provided real repository context, and generate a comprehensive, structured technical implementation plan.
You must output strictly in JSON format.

JSON SCHEMA:
{
  "summary": "A concise high-level summary of what will be implemented.",
  "approach": "Architectural approach and rationale.",
  "steps": [
    {
      "title": "Short title of the step",
      "description": "Detailed technical instructions of what to implement, functions/classes to touch.",
      "filesAffected": ["path/to/file1.js"]
    }
  ],
  "filesToInspect": ["path/to/file1.js"],
  "filesExpectedToChange": ["path/to/file1.js"],
  "implementationDetails": "Key technical details, architectural interfaces, or code structures to update.",
  "assumptions": ["List of technical assumptions"],
  "risks": ["Potential risks, regression vectors, or edge cases"],
  "validationStrategy": "How the solution will be verified (test commands, scenarios, edge case validations).",
  "markdown": "A complete, beautifully formatted GitHub Flavored Markdown implementation plan starting with an H3 (###) overview, including sections for Approach, Files Affected, Step-by-Step Breakdown, and Validation."
}

CRITICAL RULES:
1. Only return the JSON object, absolutely no wrapper text.
2. The plan must be deterministic, production-safe, and grounded in the real repository files and symbols.
3. Do not invent arbitrary files if existing codebase files already serve the purpose.
4. Ensure filesAffected matches real files in the repository context where applicable.`;

  const rawFiles = context.fileTree || [];
  const safeFiles = rawFiles
    .filter(f => !isSensitivePath(f.path))
    .map(f => ({ path: f.path, extension: f.extension }));

  const rawSymbols = context.symbols || [];
  const safeSymbols = rawSymbols
    .filter(s => !isSensitivePath(s.file))
    .slice(0, 100); // Bounded symbols payload

  const safeContext = {
    fileCount: safeFiles.length,
    files: safeFiles,
    symbols: safeSymbols
  };

  const safeTitle = scrubTokens(task.title || '');
  const safeDescription = scrubTokens(task.description || 'No description provided');

  const userPrompt = `TASK SPECIFICATION:
Title: ${safeTitle}
Description: ${safeDescription}
Priority: ${task.priority || 'MEDIUM'}

REAL REPOSITORY CONTEXT:
${JSON.stringify(safeContext, null, 2)}

Generate the structured JSON plan.`;

  return { systemPrompt, userPrompt, safeContext };
}

module.exports = {
  buildPlanningPrompt,
  isSensitivePath
};

