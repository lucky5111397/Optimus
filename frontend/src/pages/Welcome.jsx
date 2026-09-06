import React from 'react';
import { Link } from 'react-router-dom';
import { Code, GitMerge, Cpu, ArrowRight } from 'lucide-react';

export default function Welcome() {
  return (
    <div className="min-h-screen bg-background text-text-primary flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[128px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-900/20 rounded-full blur-[128px] pointer-events-none" />

      {/* Hero Section */}
      <div className="z-10 text-center max-w-4xl px-6">
        <div className="flex justify-center mb-8">
          <div className="w-16 h-16 bg-surface border border-border rounded-2xl flex items-center justify-center shadow-[0_0_40px_rgba(59,130,246,0.3)]">
            <img src="/optimus-logo.png" alt="OPTIMUS" className="w-11 h-11 object-contain" />
          </div>
        </div>
        
        <h1 className="font-heading text-5xl md:text-7xl font-bold tracking-tight mb-6">
          OPTIMUS
          <span className="block text-2xl md:text-3xl text-text-secondary mt-4 font-medium tracking-normal">
            Autonomous AI Engineering
          </span>
        </h1>
        
        <p className="text-text-secondary text-lg max-w-2xl mx-auto mb-12">
          Your intelligent co-pilot for software development. Connect your repositories,
          assign tasks, and watch as OPTIMUS plans, implements, validates, and delivers
          production-ready code.
        </p>

        <div className="flex items-center justify-center gap-4">
          <Link
            to="/login"
            className="flex items-center gap-2 px-8 py-4 bg-primary hover:bg-primary/90 text-white rounded-md font-medium transition-all shadow-[0_0_20px_rgba(59,130,246,0.4)] hover:shadow-[0_0_30px_rgba(59,130,246,0.6)]"
          >
            Get Started
            <ArrowRight className="w-4 h-4" />
          </Link>
          <a
            href="#features"
            className="flex items-center gap-2 px-8 py-4 bg-surface hover:bg-surface-hover border border-border text-text-primary rounded-md font-medium transition-all"
          >
            Learn More
          </a>
        </div>
      </div>

      {/* Feature grid */}
      <div id="features" className="z-10 grid grid-cols-1 md:grid-cols-3 gap-6 mt-32 max-w-6xl px-6">
        <div className="bg-surface/50 backdrop-blur-md border border-border p-6 rounded-lg">
          <Cpu className="w-8 h-8 text-primary mb-4" />
          <h3 className="text-xl font-heading font-semibold mb-2">AI-Driven Planning</h3>
          <p className="text-text-secondary text-sm">
            Generates comprehensive implementation plans with step-by-step breakdowns before writing a single line of code.
          </p>
        </div>
        <div className="bg-surface/50 backdrop-blur-md border border-border p-6 rounded-lg">
          <Code className="w-8 h-8 text-purple-400 mb-4" />
          <h3 className="text-xl font-heading font-semibold mb-2">Agentic Execution</h3>
          <p className="text-text-secondary text-sm">
            Executes tasks with a multi-step agent loop, reading files, searching context, and applying targeted diffs.
          </p>
        </div>
        <div className="bg-surface/50 backdrop-blur-md border border-border p-6 rounded-lg">
          <GitMerge className="w-8 h-8 text-green-400 mb-4" />
          <h3 className="text-xl font-heading font-semibold mb-2">Automated Validation</h3>
          <p className="text-text-secondary text-sm">
            Runs local build and test commands to verify code changes, automatically rolling back and fixing errors.
          </p>
        </div>
      </div>
    </div>
  );
}

