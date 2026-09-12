import React from 'react';
import { Link } from 'react-router-dom';
import { GitBranch, Shield, Cpu, Terminal, ArrowRight, ExternalLink } from 'lucide-react';

export default function PublicFooter() {
  return (
    <footer className="w-full bg-surface border-t border-border/70 text-text-secondary text-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-12">
          {/* Col 1: Brand */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-background border border-border rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(59,130,246,0.2)]">
                <img src="/optimus-logo.png" alt="OPTIMUS" className="w-5 h-5 object-contain" />
              </div>
              <span className="font-heading text-xl font-bold tracking-tight text-text-primary">
                OPTIMUS
              </span>
            </div>
            <p className="text-text-secondary text-xs sm:text-sm leading-relaxed max-w-sm">
              Autonomous AI Software Engineer Platform. Inspects repository codebases, synthesizes structured implementation plans, safely executes multi-turn code modifications, verifies with automated test suites, and delivers production-ready GitHub pull requests.
            </p>
            <div className="flex items-center gap-2 text-xs text-text-secondary">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>All Systems Operational</span>
              <span className="text-border">•</span>
              <span className="font-mono text-[11px]">Phase 17 Verified</span>
            </div>
          </div>

          {/* Col 2: Product */}
          <div>
            <h4 className="text-xs font-semibold text-text-primary uppercase tracking-wider mb-3.5">
              Product
            </h4>
            <ul className="space-y-2.5 text-xs sm:text-sm">
              <li>
                <Link to="/#workflow" className="hover:text-text-primary transition-colors">
                  Engineering Workflow
                </Link>
              </li>
              <li>
                <Link to="/#capabilities" className="hover:text-text-primary transition-colors">
                  Core Capabilities
                </Link>
              </li>
              <li>
                <Link to="/#security" className="hover:text-text-primary transition-colors">
                  Security & Reliability
                </Link>
              </li>
              <li>
                <Link to="/learn-more" className="text-primary hover:underline transition-colors flex items-center gap-1">
                  Learn More Deep Dive
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 3: Architecture */}
          <div>
            <h4 className="text-xs font-semibold text-text-primary uppercase tracking-wider mb-3.5">
              Architecture
            </h4>
            <ul className="space-y-2.5 text-xs sm:text-sm">
              <li>
                <span className="text-text-secondary">AST Codebase Indexing</span>
              </li>
              <li>
                <span className="text-text-secondary">AI Planning Engine</span>
              </li>
              <li>
                <span className="text-text-secondary">Human Approval Gate</span>
              </li>
              <li>
                <span className="text-text-secondary">Sandboxed Worker Isolation</span>
              </li>
              <li>
                <span className="text-text-secondary">Automated Test Verification</span>
              </li>
              <li>
                <span className="text-text-secondary">GitHub Pull Requests</span>
              </li>
            </ul>
          </div>

          {/* Col 4: Platform */}
          <div>
            <h4 className="text-xs font-semibold text-text-primary uppercase tracking-wider mb-3.5">
              Platform
            </h4>
            <ul className="space-y-2.5 text-xs sm:text-sm">
              <li>
                <Link to="/login" className="hover:text-text-primary transition-colors">
                  Sign In / Connect
                </Link>
              </li>
              <li>
                <Link to="/dashboard" className="hover:text-text-primary transition-colors">
                  Workspace Dashboard
                </Link>
              </li>
              <li>
                <Link to="/repositories" className="hover:text-text-primary transition-colors">
                  Repositories
                </Link>
              </li>
              <li>
                <Link to="/history" className="hover:text-text-primary transition-colors">
                  Task History
                </Link>
              </li>
              <li>
                <Link to="/settings" className="hover:text-text-primary transition-colors">
                  AI & Model Settings
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 mt-8 border-t border-border/50 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-text-secondary">
          <p>© 2026 OPTIMUS Engineering Platform. Built for autonomous, verifiable software development.</p>
          <div className="flex items-center gap-4">
            <Link to="/login" className="text-primary hover:underline">
              Get Started →
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
