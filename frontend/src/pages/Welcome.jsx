import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Code,
  GitMerge,
  Cpu,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  Terminal,
  Layers,
  Lock,
  CheckCircle2,
  FolderTree,
  FileCode2,
  GitPullRequest,
  Check,
  Zap,
  BookOpen,
  Eye,
  RefreshCw,
  Sliders
} from 'lucide-react';
import PublicNavbar from '../components/PublicNavbar';
import PublicFooter from '../components/PublicFooter';

export default function Welcome() {
  useEffect(() => {
    if (window.location.hash) {
      const id = window.location.hash.replace('#', '');
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }, []);

  return (
    <div className="min-h-screen bg-background text-text-primary flex flex-col relative overflow-x-clip selection:bg-primary selection:text-white">
      {/* Background decorations */}
      <div className="absolute top-20 left-1/4 w-72 sm:w-96 h-72 sm:h-96 bg-primary/15 rounded-full blur-[128px] pointer-events-none" />
      <div className="absolute top-[800px] right-1/4 w-72 sm:w-96 h-72 sm:h-96 bg-purple-900/15 rounded-full blur-[128px] pointer-events-none" />
      <div className="absolute top-[1800px] left-1/3 w-72 sm:w-96 h-72 sm:h-96 bg-blue-900/10 rounded-full blur-[128px] pointer-events-none" />

      {/* Navigation */}
      <PublicNavbar />

      {/* 1. HERO SECTION */}
      <section className="relative pt-12 pb-16 md:pt-20 md:pb-24 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto flex flex-col items-center text-center z-10">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/25 text-primary text-xs sm:text-sm font-medium mb-6 shadow-[0_0_20px_rgba(59,130,246,0.15)]">
          <Sparkles className="w-4 h-4 text-primary" />
          <span>Autonomous AI Software Engineer Platform</span>
        </div>

        {/* Brand Logo & Title */}
        <div className="flex justify-center mb-4 sm:mb-5">
          <div className="w-14 h-14 sm:w-16 sm:h-16 bg-surface border border-border rounded-2xl flex items-center justify-center shadow-[0_0_35px_rgba(59,130,246,0.25)]">
            <img src="/optimus-logo.png" alt="OPTIMUS" className="w-9 h-9 sm:w-11 sm:h-11 object-contain" />
          </div>
        </div>

        <h1 className="font-heading text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight mb-4 text-text-primary">
          OPTIMUS
          <span className="block text-xl sm:text-2xl md:text-3xl text-text-secondary mt-2 font-medium tracking-normal">
            From Task Description to Validated Pull Request
          </span>
        </h1>

        <p className="text-text-secondary text-sm sm:text-base md:text-lg max-w-2xl mx-auto mb-8 leading-relaxed">
          Connect your GitHub repositories, define engineering tasks, and let OPTIMUS inspect codebases, generate multi-step implementation plans, execute targeted changes in sandboxes, validate with automated tests, and deliver verified pull requests.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 mb-12">
          <Link
            to="/login"
            className="flex items-center gap-2 px-7 py-3 bg-primary hover:bg-primary/90 text-white rounded-md font-medium transition-all shadow-[0_0_25px_rgba(59,130,246,0.4)] hover:shadow-[0_0_35px_rgba(59,130,246,0.6)] text-sm sm:text-base"
          >
            Get Started
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            to="/learn-more"
            className="flex items-center gap-2 px-6 py-3 bg-surface hover:bg-surface-hover border border-border text-text-primary rounded-md font-medium transition-all text-sm sm:text-base cursor-pointer shadow-sm"
          >
            <BookOpen className="w-4 h-4 text-primary" />
            Learn More
          </Link>
        </div>

        {/* Feature Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 max-w-3xl w-full text-xs font-mono text-text-secondary">
          <div className="bg-surface/60 border border-border/80 px-3 py-2 rounded-md flex items-center justify-center gap-1.5">
            <FolderTree className="w-3.5 h-3.5 text-primary" />
            <span>AST Codebase Intel</span>
          </div>
          <div className="bg-surface/60 border border-border/80 px-3 py-2 rounded-md flex items-center justify-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-amber-400" />
            <span>Approval Gate</span>
          </div>
          <div className="bg-surface/60 border border-border/80 px-3 py-2 rounded-md flex items-center justify-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Test Validation</span>
          </div>
          <div className="bg-surface/60 border border-border/80 px-3 py-2 rounded-md flex items-center justify-center gap-1.5">
            <GitPullRequest className="w-3.5 h-3.5 text-purple-400" />
            <span>GitHub Delivery</span>
          </div>
        </div>
      </section>

      {/* 2. PRODUCT VALUE / HIGHLIGHTS */}
      <section className="py-12 sm:py-16 bg-surface/30 border-y border-border/50 relative z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <h2 className="text-xs font-mono text-primary uppercase tracking-wider mb-2 font-semibold">
              Engineered for Quality
            </h2>
            <p className="font-heading text-2xl sm:text-3xl font-bold text-text-primary">
              Not Just Code Generation. Complete Autonomous Delivery.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="bg-surface border border-border p-5 rounded-lg hover:border-primary/40 transition-colors">
              <div className="w-10 h-10 rounded-md bg-emerald-900/20 border border-emerald-800/40 flex items-center justify-center text-emerald-400 mb-3.5">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <h3 className="font-heading font-semibold text-text-primary text-base mb-1.5">
                Deterministic Gates
              </h3>
              <p className="text-text-secondary text-xs sm:text-sm leading-relaxed">
                OPTIMUS never ships unvalidated code. Every modification must compile and pass your automated test suites before pull request delivery.
              </p>
            </div>

            <div className="bg-surface border border-border p-5 rounded-lg hover:border-primary/40 transition-colors">
              <div className="w-10 h-10 rounded-md bg-amber-900/20 border border-amber-800/40 flex items-center justify-center text-amber-400 mb-3.5">
                <Lock className="w-5 h-5" />
              </div>
              <h3 className="font-heading font-semibold text-text-primary text-base mb-1.5">
                Developer Sovereignty
              </h3>
              <p className="text-text-secondary text-xs sm:text-sm leading-relaxed">
                Implementation plans detail affected files, step sequences, and assumptions, requiring explicit developer approval before execution begins.
              </p>
            </div>

            <div className="bg-surface border border-border p-5 rounded-lg hover:border-primary/40 transition-colors">
              <div className="w-10 h-10 rounded-md bg-primary/20 border border-primary/40 flex items-center justify-center text-primary mb-3.5">
                <FolderTree className="w-5 h-5" />
              </div>
              <h3 className="font-heading font-semibold text-text-primary text-base mb-1.5">
                Syntax-Aware Context
              </h3>
              <p className="text-text-secondary text-xs sm:text-sm leading-relaxed">
                AST parsing via Babel and Acorn indexes symbol declarations, dependencies, and file relationships to prevent hallucinated paths or broken signatures.
              </p>
            </div>

            <div className="bg-surface border border-border p-5 rounded-lg hover:border-primary/40 transition-colors">
              <div className="w-10 h-10 rounded-md bg-purple-900/20 border border-purple-800/40 flex items-center justify-center text-purple-400 mb-3.5">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="font-heading font-semibold text-text-primary text-base mb-1.5">
                Sandboxed Workspaces
              </h3>
              <p className="text-text-secondary text-xs sm:text-sm leading-relaxed">
                Executions run within isolated worker environments using allow-listed commands, strict turn limits, and zero secret exposure.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. HOW OPTIMUS WORKS (The 9-Stage Workflow Pipeline) */}
      <section id="workflow" className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto z-10 scroll-mt-16 w-full">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-mono font-medium mb-3">
            <span>Deterministic Lifecycle</span>
          </div>
          <h2 className="font-heading text-3xl sm:text-4xl font-bold text-text-primary mb-3">
            The Autonomous Engineering Workflow
          </h2>
          <p className="text-text-secondary text-sm sm:text-base leading-relaxed">
            From initial authentication to final pull request delivery, every task flows through nine deterministic, audited stages.
          </p>
        </div>

        {/* 9-Stage Step Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Step 1 */}
          <div className="bg-surface border border-border p-5 rounded-lg relative overflow-hidden group hover:border-primary/40 transition-colors">
            <span className="text-xs font-mono text-primary font-semibold">01</span>
            <h3 className="font-heading text-base font-semibold text-text-primary mt-1 mb-2">
              Authentication & Auth
            </h3>
            <p className="text-text-secondary text-xs sm:text-sm leading-relaxed">
              Connect via GitHub OAuth or Google Firebase. Verify repository read/write access and initialize secure user session with JWT cookies.
            </p>
          </div>

          {/* Step 2 */}
          <div className="bg-surface border border-border p-5 rounded-lg relative overflow-hidden group hover:border-primary/40 transition-colors">
            <span className="text-xs font-mono text-primary font-semibold">02</span>
            <h3 className="font-heading text-base font-semibold text-text-primary mt-1 mb-2">
              Repository Indexing
            </h3>
            <p className="text-text-secondary text-xs sm:text-sm leading-relaxed">
              Clone or import repository branch. Crawl directory structure, track files, and initiate AST parser workers to extract symbol tables.
            </p>
          </div>

          {/* Step 3 */}
          <div className="bg-surface border border-border p-5 rounded-lg relative overflow-hidden group hover:border-primary/40 transition-colors">
            <span className="text-xs font-mono text-primary font-semibold">03</span>
            <h3 className="font-heading text-base font-semibold text-text-primary mt-1 mb-2">
              Codebase Intelligence
            </h3>
            <p className="text-text-secondary text-xs sm:text-sm leading-relaxed">
              Extract functions, classes, and exported symbols. Build dependency mapping to provide precise semantic context for engineering tasks.
            </p>
          </div>

          {/* Step 4 */}
          <div className="bg-surface border border-border p-5 rounded-lg relative overflow-hidden group hover:border-primary/40 transition-colors">
            <span className="text-xs font-mono text-primary font-semibold">04</span>
            <h3 className="font-heading text-base font-semibold text-text-primary mt-1 mb-2">
              Task Definition
            </h3>
            <p className="text-text-secondary text-xs sm:text-sm leading-relaxed">
              Define bugs, feature tickets, or refactor goals. Set execution priority and assign relevant target branches within your repository.
            </p>
          </div>

          {/* Step 5 */}
          <div className="bg-surface border border-border p-5 rounded-lg relative overflow-hidden group hover:border-primary/40 transition-colors">
            <span className="text-xs font-mono text-primary font-semibold">05</span>
            <h3 className="font-heading text-base font-semibold text-text-primary mt-1 mb-2">
              AI Planning Engine
            </h3>
            <p className="text-text-secondary text-xs sm:text-sm leading-relaxed">
              Synthesizes structured implementation plans: numbered steps, affected files, structural assumptions, and expected diff previews.
            </p>
          </div>

          {/* Step 6 */}
          <div className="bg-surface border border-border p-5 rounded-lg relative overflow-hidden group hover:border-primary/40 transition-colors">
            <span className="text-xs font-mono text-primary font-semibold">06</span>
            <h3 className="font-heading text-base font-semibold text-text-primary mt-1 mb-2">
              Human Approval Gate
            </h3>
            <p className="text-text-secondary text-xs sm:text-sm leading-relaxed">
              Developers inspect the proposed plan. State machine halts at <code className="text-amber-400 text-xs">AWAITING_APPROVAL</code> until explicitly authorized.
            </p>
          </div>

          {/* Step 7 */}
          <div className="bg-surface border border-border p-5 rounded-lg relative overflow-hidden group hover:border-primary/40 transition-colors">
            <span className="text-xs font-mono text-primary font-semibold">07</span>
            <h3 className="font-heading text-base font-semibold text-text-primary mt-1 mb-2">
              Agentic Execution
            </h3>
            <p className="text-text-secondary text-xs sm:text-sm leading-relaxed">
              Autonomous multi-turn agent reads workspace files, applies targeted code diffs, updates syntax trees, and tracks state changes.
            </p>
          </div>

          {/* Step 8 */}
          <div className="bg-surface border border-border p-5 rounded-lg relative overflow-hidden group hover:border-primary/40 transition-colors">
            <span className="text-xs font-mono text-primary font-semibold">08</span>
            <h3 className="font-heading text-base font-semibold text-text-primary mt-1 mb-2">
              Automated Validation
            </h3>
            <p className="text-text-secondary text-xs sm:text-sm leading-relaxed">
              Executes <code className="text-emerald-400 text-xs">npm test</code> and <code className="text-emerald-400 text-xs">npm run build</code>. If tests fail, diagnosis triggers corrective retry cycles.
            </p>
          </div>

          {/* Step 9 */}
          <div className="bg-surface border border-border p-5 rounded-lg relative overflow-hidden group hover:border-primary/40 transition-colors">
            <span className="text-xs font-mono text-primary font-semibold">09</span>
            <h3 className="font-heading text-base font-semibold text-text-primary mt-1 mb-2">
              GitHub Delivery & PR
            </h3>
            <p className="text-text-secondary text-xs sm:text-sm leading-relaxed">
              Verified patch is committed to a clean branch, pushed upstream, and opened as a ready-to-merge GitHub Pull Request with execution logs.
            </p>
          </div>
        </div>

        {/* Link to Deep Dive */}
        <div className="text-center mt-10">
          <Link
            to="/learn-more"
            className="inline-flex items-center gap-2 text-sm text-primary hover:underline font-medium"
          >
            Read the comprehensive architectural breakdown in Learn More
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* 4. CORE CAPABILITIES SECTION */}
      <section id="capabilities" className="py-16 sm:py-24 bg-surface/20 border-t border-border/50 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto z-10 scroll-mt-16 w-full">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-mono font-medium mb-3">
            <span>Built-In Capabilities</span>
          </div>
          <h2 className="font-heading text-3xl sm:text-4xl font-bold text-text-primary mb-3">
            Engineered for Production Software
          </h2>
          <p className="text-text-secondary text-sm sm:text-base leading-relaxed">
            OPTIMUS combines structural parsing, AI reasoning, and verifiable execution into an integrated engineering stack.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Card 1 */}
          <div className="bg-surface border border-border p-6 rounded-lg">
            <div className="w-10 h-10 rounded-md bg-blue-900/20 border border-blue-800/40 flex items-center justify-center text-primary mb-4">
              <FolderTree className="w-5 h-5" />
            </div>
            <h3 className="font-heading text-lg font-semibold text-text-primary mb-2">
              Codebase AST Indexing
            </h3>
            <p className="text-text-secondary text-sm leading-relaxed">
              Parses abstract syntax trees (via Babel and Acorn) across repository branches to extract symbols, classes, methods, and file import trees.
            </p>
          </div>

          {/* Card 2 */}
          <div className="bg-surface border border-border p-6 rounded-lg">
            <div className="w-10 h-10 rounded-md bg-purple-900/20 border border-purple-800/40 flex items-center justify-center text-purple-400 mb-4">
              <Layers className="w-5 h-5" />
            </div>
            <h3 className="font-heading text-lg font-semibold text-text-primary mb-2">
              Structured Planning
            </h3>
            <p className="text-text-secondary text-sm leading-relaxed">
              Synthesizes detailed implementation plans with clear assumptions, affected files, and step sequences before writing a single line of code.
            </p>
          </div>

          {/* Card 3 */}
          <div className="bg-surface border border-border p-6 rounded-lg">
            <div className="w-10 h-10 rounded-md bg-cyan-900/20 border border-cyan-800/40 flex items-center justify-center text-cyan-400 mb-4">
              <Terminal className="w-5 h-5" />
            </div>
            <h3 className="font-heading text-lg font-semibold text-text-primary mb-2">
              Bounded Agent Loop
            </h3>
            <p className="text-text-secondary text-sm leading-relaxed">
              Executes multi-turn agent operations with safety turn limits, model fallback hierarchies, and configurable autonomy levels.
            </p>
          </div>

          {/* Card 4 */}
          <div className="bg-surface border border-border p-6 rounded-lg">
            <div className="w-10 h-10 rounded-md bg-emerald-900/20 border border-emerald-800/40 flex items-center justify-center text-emerald-400 mb-4">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <h3 className="font-heading text-lg font-semibold text-text-primary mb-2">
              Automated Validation & Recovery
            </h3>
            <p className="text-text-secondary text-sm leading-relaxed">
              Validates modified code by running test suites. Generates failure hypotheses and corrective iteration plans automatically when tests fail.
            </p>
          </div>

          {/* Card 5 */}
          <div className="bg-surface border border-border p-6 rounded-lg">
            <div className="w-10 h-10 rounded-md bg-amber-900/20 border border-amber-800/40 flex items-center justify-center text-amber-400 mb-4">
              <GitMerge className="w-5 h-5" />
            </div>
            <h3 className="font-heading text-lg font-semibold text-text-primary mb-2">
              Patch Review & Verification
            </h3>
            <p className="text-text-secondary text-sm leading-relaxed">
              Side-by-side unified diffs highlight additions and deletions, displaying exact files changed and plan alignment status.
            </p>
          </div>

          {/* Card 6 */}
          <div className="bg-surface border border-border p-6 rounded-lg">
            <div className="w-10 h-10 rounded-md bg-teal-900/20 border border-teal-800/40 flex items-center justify-center text-teal-400 mb-4">
              <GitPullRequest className="w-5 h-5" />
            </div>
            <h3 className="font-heading text-lg font-semibold text-text-primary mb-2">
              Native GitHub Delivery
            </h3>
            <p className="text-text-secondary text-sm leading-relaxed">
              Formats clean commits and delivers pull requests directly to target branches with full task summaries and verification results.
            </p>
          </div>
        </div>
      </section>

      {/* 5. SECURITY & RELIABILITY */}
      <section id="security" className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto z-10 scroll-mt-16 w-full">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-emerald-900/20 border border-emerald-800/40 text-emerald-400 text-xs font-mono font-medium mb-3">
            <span>Hardened Architecture</span>
          </div>
          <h2 className="font-heading text-3xl sm:text-4xl font-bold text-text-primary mb-3">
            Security & Safe Execution Boundaries
          </h2>
          <p className="text-text-secondary text-sm sm:text-base leading-relaxed">
            Autonomous engineering requires strict guardrails. OPTIMUS enforces multi-layered defense to keep code and credentials protected.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-surface border border-border p-6 rounded-lg flex gap-4">
            <div className="w-10 h-10 rounded-md bg-primary/20 border border-primary/40 flex items-center justify-center text-primary shrink-0 mt-0.5">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading font-semibold text-text-primary text-base mb-1.5">
                Sandboxed Worker Containers
              </h3>
              <p className="text-text-secondary text-xs sm:text-sm leading-relaxed">
                Code execution and test suites run in isolated Docker worker environments. Commands are restricted to strict allow-listed operations (<code className="text-primary text-xs">npm test</code>, <code className="text-primary text-xs">npm run build</code>). Arbitrary bash scripts from models are blocked.
              </p>
            </div>
          </div>

          <div className="bg-surface border border-border p-6 rounded-lg flex gap-4">
            <div className="w-10 h-10 rounded-md bg-amber-900/20 border border-amber-800/40 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading font-semibold text-text-primary text-base mb-1.5">
                Credential & Token Isolation
              </h3>
              <p className="text-text-secondary text-xs sm:text-sm leading-relaxed">
                Sensitive user API keys, GitHub tokens, and OpenRouter credentials are encrypted and never injected into the execution workspace directory, eliminating leak vectors in build logs or diffs.
              </p>
            </div>
          </div>

          <div className="bg-surface border border-border p-6 rounded-lg flex gap-4">
            <div className="w-10 h-10 rounded-md bg-emerald-900/20 border border-emerald-800/40 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading font-semibold text-text-primary text-base mb-1.5">
                Traversal & Injection Defense
              </h3>
              <p className="text-text-secondary text-xs sm:text-sm leading-relaxed">
                ZIP extraction and file operations sanitize paths to eliminate <code className="text-emerald-400 text-xs">../../</code> directory escapes. Mongoose schemas enforce strict type validation to prevent NoSQL injection.
              </p>
            </div>
          </div>

          <div className="bg-surface border border-border p-6 rounded-lg flex gap-4">
            <div className="w-10 h-10 rounded-md bg-purple-900/20 border border-purple-800/40 flex items-center justify-center text-purple-400 shrink-0 mt-0.5">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading font-semibold text-text-primary text-base mb-1.5">
                Audit Trails & Rate Limiting
              </h3>
              <p className="text-text-secondary text-xs sm:text-sm leading-relaxed">
                Every state transition, AI prompt, file modification, and tool execution is recorded with structured timestamps. In-memory sliding-window limiters and strict HTTP security headers protect all endpoints.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 6. DEVELOPER OUTCOME (Before vs After) */}
      <section className="py-16 sm:py-20 bg-surface/30 border-y border-border/50 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto z-10 w-full">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="font-heading text-2xl sm:text-3xl font-bold text-text-primary mb-2">
            The OPTIMUS Advantage
          </h2>
          <p className="text-text-secondary text-sm sm:text-base">
            How autonomous engineering changes your daily development workflow.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Traditional */}
          <div className="bg-surface border border-border/70 p-6 rounded-lg space-y-3">
            <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider font-mono">
              Traditional Manual Process
            </h3>
            <ul className="space-y-2.5 text-xs sm:text-sm text-text-secondary">
              <li className="flex items-start gap-2">
                <span className="text-red-400 font-bold">✕</span>
                <span>Manual search through unfamiliar repository directories</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-400 font-bold">✕</span>
                <span>Writing boilerplate code and manual unit test scaffolding</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-400 font-bold">✕</span>
                <span>Running local tests repeatedly to diagnose regressions</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-400 font-bold">✕</span>
                <span>Context switching between terminal, IDE, and GitHub</span>
              </li>
            </ul>
          </div>

          {/* With OPTIMUS */}
          <div className="bg-surface border border-primary/40 p-6 rounded-lg space-y-3 shadow-[0_0_30px_rgba(59,130,246,0.1)]">
            <h3 className="text-sm font-semibold text-primary uppercase tracking-wider font-mono flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-primary" />
              With OPTIMUS
            </h3>
            <ul className="space-y-2.5 text-xs sm:text-sm text-text-primary">
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>Instant AST indexing of symbols, methods, and dependencies</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>Structured implementation plan with explicit developer approval</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>Sandboxed execution with automated build and test verification</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>Direct GitHub delivery as a ready-to-merge Pull Request</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* 7. FINAL CALL TO ACTION */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto text-center z-10">
        <div className="bg-surface border border-border p-8 sm:p-12 rounded-2xl shadow-[0_0_50px_rgba(59,130,246,0.15)] relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-[90px] pointer-events-none" />
          <h2 className="font-heading text-3xl sm:text-4xl font-bold text-text-primary mb-4">
            Ready to Build with OPTIMUS?
          </h2>
          <p className="text-text-secondary text-sm sm:text-base max-w-xl mx-auto mb-8 leading-relaxed">
            Connect your repositories, assign tasks, and experience a disciplined, verified autonomous engineering platform.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link
              to="/login"
              className="flex items-center gap-2 px-8 py-3.5 bg-primary hover:bg-primary/90 text-white rounded-md font-medium transition-all shadow-[0_0_25px_rgba(59,130,246,0.4)] hover:shadow-[0_0_35px_rgba(59,130,246,0.6)] text-sm sm:text-base"
            >
              Get Started
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/learn-more"
              className="flex items-center gap-2 px-6 py-3.5 bg-background hover:bg-surface-hover border border-border text-text-primary rounded-md font-medium transition-all text-sm sm:text-base"
            >
              <BookOpen className="w-4 h-4 text-primary" />
              Explore Technical Guide
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <PublicFooter />
    </div>
  );
}
