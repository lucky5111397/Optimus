import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Code,
  Cpu,
  GitMerge,
  FolderTree,
  Layers,
  Terminal,
  CheckCircle2,
  ShieldCheck,
  Lock,
  Sliders,
  GitPullRequest,
  FileCode2,
  ExternalLink,
  AlertTriangle,
  RefreshCw,
  BookOpen
} from 'lucide-react';
import PublicNavbar from '../components/PublicNavbar';
import PublicFooter from '../components/PublicFooter';

export default function LearnMore() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-background text-text-primary flex flex-col relative overflow-x-clip selection:bg-primary selection:text-white">
      {/* Background decorations */}
      <div className="absolute top-24 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-[1200px] right-1/4 w-96 h-96 bg-purple-900/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-[2600px] left-1/3 w-96 h-96 bg-blue-900/10 rounded-full blur-[140px] pointer-events-none" />

      {/* Navigation */}
      <PublicNavbar />

      {/* Header / Hero */}
      <section className="pt-10 pb-12 sm:pt-14 sm:pb-16 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto z-10 w-full">
        <div className="mb-6">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm text-text-secondary hover:text-primary transition-colors font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
        </div>

        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/25 text-primary text-xs font-mono font-medium mb-4">
          <BookOpen className="w-3.5 h-3.5" />
          <span>Technical Architecture & Engineering Guide</span>
        </div>

        <h1 className="font-heading text-3xl sm:text-5xl font-extrabold tracking-tight text-text-primary mb-4">
          How OPTIMUS Works
        </h1>
        <p className="text-text-secondary text-base sm:text-lg max-w-3xl leading-relaxed">
          A comprehensive architectural guide covering AST codebase intelligence, human governance gates, sandboxed multi-turn execution, automated test validation, and verified GitHub delivery.
        </p>

        {/* Quick Nav Anchor Pills */}
        <div className="flex flex-wrap gap-2 mt-8 pt-6 border-t border-border/60 text-xs font-mono">
          <a href="#what-is-optimus" className="px-3 py-1.5 bg-surface hover:bg-surface-hover border border-border rounded-md text-text-secondary hover:text-text-primary transition-colors">
            What is OPTIMUS
          </a>
          <a href="#problem-solved" className="px-3 py-1.5 bg-surface hover:bg-surface-hover border border-border rounded-md text-text-secondary hover:text-text-primary transition-colors">
            The Problem Solved
          </a>
          <a href="#pipeline" className="px-3 py-1.5 bg-surface hover:bg-surface-hover border border-border rounded-md text-text-secondary hover:text-text-primary transition-colors">
            9-Stage Pipeline
          </a>
          <a href="#ast-intelligence" className="px-3 py-1.5 bg-surface hover:bg-surface-hover border border-border rounded-md text-text-secondary hover:text-text-primary transition-colors">
            AST Intelligence
          </a>
          <a href="#planning-governance" className="px-3 py-1.5 bg-surface hover:bg-surface-hover border border-border rounded-md text-text-secondary hover:text-text-primary transition-colors">
            Planning & Governance
          </a>
          <a href="#execution-engine" className="px-3 py-1.5 bg-surface hover:bg-surface-hover border border-border rounded-md text-text-secondary hover:text-text-primary transition-colors">
            Execution Engine
          </a>
          <a href="#validation-recovery" className="px-3 py-1.5 bg-surface hover:bg-surface-hover border border-border rounded-md text-text-secondary hover:text-text-primary transition-colors">
            Validation & Recovery
          </a>
          <a href="#security-sandboxing" className="px-3 py-1.5 bg-surface hover:bg-surface-hover border border-border rounded-md text-text-secondary hover:text-text-primary transition-colors">
            Security & Sandboxing
          </a>
          <a href="#roadmap" className="px-3 py-1.5 bg-surface hover:bg-surface-hover border border-border rounded-md text-text-secondary hover:text-text-primary transition-colors">
            Current vs Future Scope
          </a>
        </div>
      </section>

      {/* Main Content Area */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-20 space-y-16 z-10 w-full">

        {/* 1. WHAT IS OPTIMUS */}
        <section id="what-is-optimus" className="bg-surface border border-border p-6 sm:p-8 rounded-xl scroll-mt-24 space-y-4">
          <div className="flex items-center gap-2.5 text-primary font-mono text-xs uppercase font-semibold tracking-wider">
            <Cpu className="w-4 h-4" />
            <span>01 • Architectural Overview</span>
          </div>
          <h2 className="font-heading text-2xl sm:text-3xl font-bold text-text-primary">
            What is OPTIMUS?
          </h2>
          <p className="text-text-secondary text-sm sm:text-base leading-relaxed">
            OPTIMUS is an <strong className="text-text-primary">Autonomous AI Software Engineering Platform</strong>. Unlike chat-based code assistants or autocomplete extensions that simply propose snippets in an IDE, OPTIMUS is designed as an autonomous lifecycle agent capable of taking a high-level engineering task, exploring an entire repository, formulating a verifiable plan, executing code modifications across multiple files in a secure sandbox, and verifying the work against real automated test suites.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="bg-background/60 border border-border/80 p-4 rounded-lg">
              <h4 className="font-heading text-sm font-semibold text-text-primary mb-1 text-red-300">
                Superficial AI Assistants
              </h4>
              <ul className="text-xs text-text-secondary space-y-1.5 list-disc list-inside">
                <li>Generate isolated snippets without full repository AST context</li>
                <li>Hallucinate non-existent files, functions, and import paths</li>
                <li>Do not execute or verify code against test suites</li>
                <li>No formal planning or developer approval checkpoint</li>
                <li>Require manual copy-pasting, formatting, and PR creation</li>
              </ul>
            </div>

            <div className="bg-background/60 border border-primary/30 p-4 rounded-lg">
              <h4 className="font-heading text-sm font-semibold text-primary mb-1">
                OPTIMUS Autonomous Platform
              </h4>
              <ul className="text-xs text-text-secondary space-y-1.5 list-disc list-inside">
                <li>Parses ASTs and builds full symbol & dependency graphs</li>
                <li>Synthesizes structured plans with affected files & assumptions</li>
                <li>Mandatory human approval gate before any file is touched</li>
                <li>Executes in isolated Docker containers with automated test verification</li>
                <li>Delivers verified, formatted Pull Requests directly to GitHub</li>
              </ul>
            </div>
          </div>
        </section>

        {/* 2. THE PROBLEM SOLVED */}
        <section id="problem-solved" className="bg-surface border border-border p-6 sm:p-8 rounded-xl scroll-mt-24 space-y-4">
          <div className="flex items-center gap-2.5 text-amber-400 font-mono text-xs uppercase font-semibold tracking-wider">
            <AlertTriangle className="w-4 h-4" />
            <span>02 • Engineering Rationale</span>
          </div>
          <h2 className="font-heading text-2xl sm:text-3xl font-bold text-text-primary">
            The Problem OPTIMUS Solves
          </h2>
          <p className="text-text-secondary text-sm sm:text-base leading-relaxed">
            Modern software engineering teams face significant friction when delegating work to early-generation AI tools:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div className="bg-background/50 border border-border p-4 rounded-lg">
              <h4 className="font-heading font-semibold text-text-primary text-sm mb-1">
                Context Blindness
              </h4>
              <p className="text-text-secondary text-xs leading-relaxed">
                Raw LLMs cannot ingest 50,000 lines of code without degradation. Without structured AST indexing, AI tools guess symbol names, import non-existent modules, and violate existing patterns.
              </p>
            </div>
            <div className="bg-background/50 border border-border p-4 rounded-lg">
              <h4 className="font-heading font-semibold text-text-primary text-sm mb-1">
                Unverified Output
              </h4>
              <p className="text-text-secondary text-xs leading-relaxed">
                Code that looks plausible syntactically frequently fails to compile, breaks type contracts, or fails edge-case tests. Developers waste hours debugging AI hallucinations.
              </p>
            </div>
            <div className="bg-background/50 border border-border p-4 rounded-lg">
              <h4 className="font-heading font-semibold text-text-primary text-sm mb-1">
                Lack of Governance
              </h4>
              <p className="text-text-secondary text-xs leading-relaxed">
                Autonomous agents without human-in-the-loop gates can perform uncontrolled mutations, introduce security vulnerabilities, or modify wrong files without oversight.
              </p>
            </div>
          </div>
        </section>

        {/* 3. 9-STAGE PIPELINE */}
        <section id="pipeline" className="bg-surface border border-border p-6 sm:p-8 rounded-xl scroll-mt-24 space-y-6">
          <div className="flex items-center gap-2.5 text-primary font-mono text-xs uppercase font-semibold tracking-wider">
            <Layers className="w-4 h-4" />
            <span>03 • State Machine Architecture</span>
          </div>
          <div>
            <h2 className="font-heading text-2xl sm:text-3xl font-bold text-text-primary mb-2">
              The 9-Stage Operational Pipeline
            </h2>
            <p className="text-text-secondary text-sm sm:text-base leading-relaxed">
              Every task executed in OPTIMUS moves through a deterministic state machine managed by the backend orchestrator and stored in MongoDB:
            </p>
          </div>

          <div className="bg-background/80 border border-border/80 p-4 rounded-lg font-mono text-xs overflow-x-auto text-primary">
            DRAFT → ANALYZING → CONTEXT_READY → PLAN_READY → AWAITING_APPROVAL → IMPLEMENTING → TESTING → VERIFYING → DELIVERED
          </div>

          <div className="space-y-4 pt-2">
            <div className="border-l-2 border-primary pl-4 space-y-1">
              <h4 className="font-heading text-sm font-semibold text-text-primary">1. Authentication & Session Setup</h4>
              <p className="text-xs text-text-secondary leading-relaxed">
                The user signs in via GitHub OAuth or Firebase. Access tokens are verified, and an encrypted JWT cookie initializes the session.
              </p>
            </div>

            <div className="border-l-2 border-primary pl-4 space-y-1">
              <h4 className="font-heading text-sm font-semibold text-text-primary">2. Repository Import & Branch Indexing</h4>
              <p className="text-xs text-text-secondary leading-relaxed">
                The repository is imported via GitHub API or ZIP archive. Files are scanned, tracked, and stored in MongoDB under <code className="text-primary">RepositoryBranch</code>.
              </p>
            </div>

            <div className="border-l-2 border-primary pl-4 space-y-1">
              <h4 className="font-heading text-sm font-semibold text-text-primary">3. Codebase Intelligence & AST Extraction</h4>
              <p className="text-xs text-text-secondary leading-relaxed">
                AST parsers (Babel and Acorn) extract functions, classes, interfaces, imports, and exports. An in-memory dependency graph identifies cross-file symbol linkages.
              </p>
            </div>

            <div className="border-l-2 border-primary pl-4 space-y-1">
              <h4 className="font-heading text-sm font-semibold text-text-primary">4. Task Creation</h4>
              <p className="text-xs text-text-secondary leading-relaxed">
                The developer creates a task specifying the title, description, priority, and target repository. The orchestrator triggers context aggregation.
              </p>
            </div>

            <div className="border-l-2 border-primary pl-4 space-y-1">
              <h4 className="font-heading text-sm font-semibold text-text-primary">5. AI Planning Engine</h4>
              <p className="text-xs text-text-secondary leading-relaxed">
                The planning service queries OpenRouter with relevant symbol context and prompts for a structured JSON plan: numbered steps, affected files, assumptions, and diff previews.
              </p>
            </div>

            <div className="border-l-2 border-amber-400 pl-4 space-y-1">
              <h4 className="font-heading text-sm font-semibold text-amber-400">6. Human Approval Checkpoint (Mandatory Gate)</h4>
              <p className="text-xs text-text-secondary leading-relaxed">
                The task enters <code className="text-amber-400 text-xs">AWAITING_APPROVAL</code>. The engine halts execution until the developer explicitly reviews the plan and approves it.
              </p>
            </div>

            <div className="border-l-2 border-primary pl-4 space-y-1">
              <h4 className="font-heading text-sm font-semibold text-text-primary">7. Sandboxed Agentic Execution</h4>
              <p className="text-xs text-text-secondary leading-relaxed">
                Upon approval, the worker clones the branch to an isolated workspace, initializes the agent loop, reads required files, applies targeted diffs, and updates file trees.
              </p>
            </div>

            <div className="border-l-2 border-emerald-400 pl-4 space-y-1">
              <h4 className="font-heading text-sm font-semibold text-emerald-400">8. Automated Validation & Diagnostic Retries</h4>
              <p className="text-xs text-text-secondary leading-relaxed">
                The worker executes <code className="text-emerald-400 text-xs">npm test</code> and <code className="text-emerald-400 text-xs">npm run build</code>. If tests fail, the engine generates failure hypotheses and attempts corrective iterations within turn limits.
              </p>
            </div>

            <div className="border-l-2 border-purple-400 pl-4 space-y-1">
              <h4 className="font-heading text-sm font-semibold text-purple-400">9. GitHub Delivery & Pull Request</h4>
              <p className="text-xs text-text-secondary leading-relaxed">
                Once validated, changes are committed to a clean branch and pushed upstream. A Pull Request is created via the GitHub API with a full summary of executed steps and verification logs.
              </p>
            </div>
          </div>
        </section>

        {/* 4. CODEBASE INTELLIGENCE & AST */}
        <section id="ast-intelligence" className="bg-surface border border-border p-6 sm:p-8 rounded-xl scroll-mt-24 space-y-4">
          <div className="flex items-center gap-2.5 text-primary font-mono text-xs uppercase font-semibold tracking-wider">
            <FolderTree className="w-4 h-4" />
            <span>04 • Deep Syntax Analysis</span>
          </div>
          <h2 className="font-heading text-2xl sm:text-3xl font-bold text-text-primary">
            Codebase Intelligence & AST Analysis
          </h2>
          <p className="text-text-secondary text-sm sm:text-base leading-relaxed">
            Rather than relying on generic text search or embedding whole codebases into token windows, OPTIMUS parses your source code into Abstract Syntax Trees using Babel and Acorn parsers.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="bg-background/60 border border-border p-4 rounded-lg space-y-2">
              <h4 className="font-heading text-sm font-semibold text-text-primary">
                What AST Extraction Captures:
              </h4>
              <ul className="text-xs text-text-secondary space-y-1.5 list-disc list-inside">
                <li><strong className="text-text-primary">Symbol Definitions:</strong> Classes, functions, interfaces, type aliases, and exported variables.</li>
                <li><strong className="text-text-primary">File Import/Export Hierarchies:</strong> Exactly which files depend on each other.</li>
                <li><strong className="text-text-primary">Method Signatures:</strong> Argument counts, parameter names, and return types.</li>
                <li><strong className="text-text-primary">Call References:</strong> Tracing where a specific function or class is invoked across the project.</li>
              </ul>
            </div>
            <div className="bg-background/60 border border-border p-4 rounded-lg space-y-2">
              <h4 className="font-heading text-sm font-semibold text-text-primary">
                Why This Eliminates Errors:
              </h4>
              <ul className="text-xs text-text-secondary space-y-1.5 list-disc list-inside">
                <li>Prevents generating code that calls deprecated or non-existent methods.</li>
                <li>Ensures imports use correct relative or absolute paths.</li>
                <li>Permits injecting only the exact relevant symbols into the LLM context.</li>
                <li>Significantly reduces token consumption and response latency.</li>
              </ul>
            </div>
          </div>
        </section>

        {/* 5. PLANNING & GOVERNANCE */}
        <section id="planning-governance" className="bg-surface border border-border p-6 sm:p-8 rounded-xl scroll-mt-24 space-y-4">
          <div className="flex items-center gap-2.5 text-amber-400 font-mono text-xs uppercase font-semibold tracking-wider">
            <Lock className="w-4 h-4" />
            <span>05 • Human-in-the-Loop Control</span>
          </div>
          <h2 className="font-heading text-2xl sm:text-3xl font-bold text-text-primary">
            Planning & Developer Governance
          </h2>
          <p className="text-text-secondary text-sm sm:text-base leading-relaxed">
            In OPTIMUS, code execution is never instantaneous or opaque. The system enforces strict architectural planning before executing a single write operation.
          </p>
          <div className="bg-background/70 border border-border p-4 rounded-lg space-y-3">
            <h4 className="font-heading text-sm font-semibold text-text-primary">
              Structured Plan Schema:
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="border border-border/70 p-3 rounded bg-surface/50">
                <span className="font-mono text-primary font-semibold block mb-1">Steps Breakdown</span>
                <p className="text-text-secondary">Ordered array of sequential implementation actions, each with title, description, and affected files.</p>
              </div>
              <div className="border border-border/70 p-3 rounded bg-surface/50">
                <span className="font-mono text-amber-400 font-semibold block mb-1">Explicit Assumptions</span>
                <p className="text-text-secondary">List of architectural assumptions the model is making (e.g., framework versions, existing utilities).</p>
              </div>
              <div className="border border-border/70 p-3 rounded bg-surface/50">
                <span className="font-mono text-emerald-400 font-semibold block mb-1">Affected Files</span>
                <p className="text-text-secondary">Explicit list of file paths that will be created, modified, or deleted during execution.</p>
              </div>
            </div>
            <div className="p-3 bg-amber-950/20 border border-amber-800/40 rounded text-xs text-amber-200">
              <strong>Mandatory Approval Gate:</strong> The backend state machine prohibits transitioning from <code className="text-amber-300">PLAN_READY</code> to <code className="text-amber-300">IMPLEMENTING</code> without an explicit authenticated POST request from the developer.
            </div>
          </div>
        </section>

        {/* 6. EXECUTION ENGINE */}
        <section id="execution-engine" className="bg-surface border border-border p-6 sm:p-8 rounded-xl scroll-mt-24 space-y-4">
          <div className="flex items-center gap-2.5 text-primary font-mono text-xs uppercase font-semibold tracking-wider">
            <Terminal className="w-4 h-4" />
            <span>06 • Bounded Agentic Execution</span>
          </div>
          <h2 className="font-heading text-2xl sm:text-3xl font-bold text-text-primary">
            The Agentic Execution Engine
          </h2>
          <p className="text-text-secondary text-sm sm:text-base leading-relaxed">
            OPTIMUS uses an autonomous multi-turn tool calling loop connected via OpenRouter. The execution service manages step progression, tool calls, and state transitions.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 text-xs text-text-secondary">
            <div className="bg-background/60 border border-border p-4 rounded-lg space-y-2">
              <h4 className="font-heading text-sm font-semibold text-text-primary">Multi-Model Fallback Hierarchy</h4>
              <p className="leading-relaxed">
                Connects through OpenRouter to top-tier reasoning models (such as Claude 3.5 Sonnet, Gemini Flash, and DeepSeek). If an API provider experiences rate limits or downtime, OPTIMUS automatically falls back to secondary models in your configured hierarchy.
              </p>
            </div>
            <div className="bg-background/60 border border-border p-4 rounded-lg space-y-2">
              <h4 className="font-heading text-sm font-semibold text-text-primary">Bounded Autonomy & Safety Limits</h4>
              <p className="leading-relaxed">
                To prevent runaway token usage or infinite loops, every task enforces configurable max-turns (e.g. 15 turns) and timeout bounds. Autonomy levels can be set from semi-autonomous to fully autonomous per workspace.
              </p>
            </div>
          </div>
        </section>

        {/* 7. VALIDATION & RECOVERY */}
        <section id="validation-recovery" className="bg-surface border border-border p-6 sm:p-8 rounded-xl scroll-mt-24 space-y-4">
          <div className="flex items-center gap-2.5 text-emerald-400 font-mono text-xs uppercase font-semibold tracking-wider">
            <CheckCircle2 className="w-4 h-4" />
            <span>07 • Automated Verification</span>
          </div>
          <h2 className="font-heading text-2xl sm:text-3xl font-bold text-text-primary">
            Validation & Failure Recovery Loop
          </h2>
          <p className="text-text-secondary text-sm sm:text-base leading-relaxed">
            The defining differentiator of OPTIMUS is that it does not assume its own code is correct. It verifies every change using your repository's automated test suites.
          </p>
          <div className="bg-background/60 border border-border p-4 rounded-lg space-y-3">
            <h4 className="font-heading text-sm font-semibold text-text-primary">
              The Corrective Diagnostic Cycle:
            </h4>
            <ol className="text-xs text-text-secondary space-y-2 list-decimal list-inside">
              <li><strong className="text-text-primary">Build Check:</strong> Executes <code className="text-emerald-400">npm run build</code> to verify syntax, imports, and bundling.</li>
              <li><strong className="text-text-primary">Test Suites:</strong> Runs <code className="text-emerald-400">npm test</code> against your existing unit and integration tests.</li>
              <li><strong className="text-text-primary">Failure Diagnosis:</strong> If a test fails, stderr and assertion errors are fed to the diagnostic engine.</li>
              <li><strong className="text-text-primary">Corrective Plan:</strong> The model generates a diagnostic hypothesis and an targeted patch to resolve the failure.</li>
              <li><strong className="text-text-primary">Retry Limit:</strong> Up to 3 automatic corrective iterations are performed before human intervention is requested.</li>
            </ol>
          </div>
        </section>

        {/* 8. SECURITY & SANDBOXING */}
        <section id="security-sandboxing" className="bg-surface border border-border p-6 sm:p-8 rounded-xl scroll-mt-24 space-y-4">
          <div className="flex items-center gap-2.5 text-emerald-400 font-mono text-xs uppercase font-semibold tracking-wider">
            <ShieldCheck className="w-4 h-4" />
            <span>08 • Defense in Depth</span>
          </div>
          <h2 className="font-heading text-2xl sm:text-3xl font-bold text-text-primary">
            Security & Sandboxing Architecture
          </h2>
          <p className="text-text-secondary text-sm sm:text-base leading-relaxed">
            OPTIMUS implements strict security controls to ensure safe execution in production environments:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 text-xs">
            <div className="bg-background/60 border border-border p-4 rounded-lg space-y-1.5">
              <h4 className="font-heading text-sm font-semibold text-text-primary">Containerized Worker Isolation</h4>
              <p className="text-text-secondary leading-relaxed">
                Worker processes run in separate Docker containers with read-only root filesystems, temporary volume mounts, and strict memory/CPU limits.
              </p>
            </div>
            <div className="bg-background/60 border border-border p-4 rounded-lg space-y-1.5">
              <h4 className="font-heading text-sm font-semibold text-text-primary">Allow-Listed Commands Only</h4>
              <p className="text-text-secondary leading-relaxed">
                The LLM cannot execute arbitrary bash commands. Only strict, pre-approved commands (<code className="text-primary">npm test</code>, <code className="text-primary">npm run build</code>) can be executed.
              </p>
            </div>
            <div className="bg-background/60 border border-border p-4 rounded-lg space-y-1.5">
              <h4 className="font-heading text-sm font-semibold text-text-primary">Secret Isolation</h4>
              <p className="text-text-secondary leading-relaxed">
                GitHub tokens, OpenRouter keys, and database credentials reside only in backend memory and are never written to the workspace directory.
              </p>
            </div>
            <div className="bg-background/60 border border-border p-4 rounded-lg space-y-1.5">
              <h4 className="font-heading text-sm font-semibold text-text-primary">Path Sanitization</h4>
              <p className="text-text-secondary leading-relaxed">
                All file paths in diffs and archive extractors are normalized and checked to prevent path traversal (<code className="text-emerald-400">../../</code>) attacks.
              </p>
            </div>
          </div>
        </section>

        {/* 9. CURRENT VS FUTURE SCOPE */}
        <section id="roadmap" className="bg-surface border border-border p-6 sm:p-8 rounded-xl scroll-mt-24 space-y-6">
          <div className="flex items-center gap-2.5 text-purple-400 font-mono text-xs uppercase font-semibold tracking-wider">
            <Sliders className="w-4 h-4" />
            <span>09 • Implementation Status & Roadmap</span>
          </div>
          <div>
            <h2 className="font-heading text-2xl sm:text-3xl font-bold text-text-primary mb-2">
              Platform Status: Implemented vs. Future Scope
            </h2>
            <p className="text-text-secondary text-sm sm:text-base leading-relaxed">
              We believe in total transparency regarding what OPTIMUS currently delivers versus future planned capabilities.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Implemented */}
            <div className="bg-background/60 border border-emerald-900/40 p-5 rounded-lg space-y-3">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
                <CheckCircle2 className="w-4 h-4" />
                <span>Currently Implemented (Phases 1–17)</span>
              </div>
              <ul className="space-y-2 text-xs text-text-secondary">
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 font-bold">✓</span>
                  <span><strong>Auth & Accounts:</strong> GitHub OAuth & Google Firebase with JWT cookies</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 font-bold">✓</span>
                  <span><strong>AST Codebase Indexing:</strong> Babel/Acorn parsing of symbols and file hierarchies</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 font-bold">✓</span>
                  <span><strong>AI Planning Engine:</strong> Structured plan generation with affected files and assumptions</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 font-bold">✓</span>
                  <span><strong>Human Approval Gate:</strong> State machine pauses at <code className="text-amber-400">AWAITING_APPROVAL</code></span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 font-bold">✓</span>
                  <span><strong>Sandboxed Agent Loop:</strong> Multi-turn tool calling with diff generation</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 font-bold">✓</span>
                  <span><strong>Automated Validation:</strong> Build and test execution with failure diagnosis</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 font-bold">✓</span>
                  <span><strong>Diff Review & Verification:</strong> Unified diffs and plan alignment checks</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 font-bold">✓</span>
                  <span><strong>GitHub Delivery:</strong> Automated branch push and Pull Request creation</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 font-bold">✓</span>
                  <span><strong>Benchmark Harness:</strong> Curated 5-fixture reproducibility test suite (Phase 17)</span>
                </li>
              </ul>
            </div>

            {/* Future Scope */}
            <div className="bg-background/60 border border-purple-900/40 p-5 rounded-lg space-y-3">
              <div className="flex items-center gap-2 text-purple-400 font-semibold text-sm">
                <Sparkles className="w-4 h-4" />
                <span>Future Roadmap (Explicitly Future Scope)</span>
              </div>
              <ul className="space-y-2 text-xs text-text-secondary">
                <li className="flex items-start gap-2">
                  <span className="text-purple-400 font-bold">○</span>
                  <span><strong>Multi-Repo Orchestration:</strong> Coordinated changes across multiple microservices</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-400 font-bold">○</span>
                  <span><strong>Polyglot Runtime Containers:</strong> Built-in worker images for Python, Go, Rust, and Java</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-400 font-bold">○</span>
                  <span><strong>Enterprise RBAC:</strong> Granular permissions for engineering teams and compliance</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-400 font-bold">○</span>
                  <span><strong>Collaborative Terminal Pairing:</strong> Live bidirectional terminal interaction with the agent</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-400 font-bold">○</span>
                  <span><strong>Self-Hosted LLM Gateways:</strong> On-premises model deployment via vLLM or Ollama</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* 10. GET STARTED CALL TO ACTION */}
        <section className="bg-surface border border-primary/30 p-8 sm:p-12 rounded-2xl text-center space-y-5 shadow-[0_0_50px_rgba(59,130,246,0.15)] relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-[90px] pointer-events-none" />
          <h2 className="font-heading text-2xl sm:text-3xl font-bold text-text-primary">
            Ready to Experience Autonomous AI Engineering?
          </h2>
          <p className="text-text-secondary text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
            Connect your repositories, assign tasks, and watch as OPTIMUS plans, implements, validates, and delivers production-ready pull requests.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            <Link
              to="/login"
              className="flex items-center gap-2 px-8 py-3 bg-primary hover:bg-primary/90 text-white rounded-md font-medium transition-all shadow-[0_0_20px_rgba(59,130,246,0.4)] hover:shadow-[0_0_30px_rgba(59,130,246,0.6)] text-sm sm:text-base"
            >
              Get Started
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/"
              className="px-6 py-3 bg-background hover:bg-surface-hover border border-border text-text-primary rounded-md font-medium transition-all text-sm sm:text-base"
            >
              Return to Home
            </Link>
          </div>
        </section>

      </main>

      {/* FOOTER */}
      <PublicFooter />
    </div>
  );
}
