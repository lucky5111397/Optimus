import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, Menu, X, BookOpen } from 'lucide-react';

export default function PublicNavbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const isHome = location.pathname === '/';

  const handleNavClick = (sectionId) => {
    setMobileMenuOpen(false);
    if (isHome) {
      const el = document.getElementById(sectionId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        window.history.pushState(null, '', `#${sectionId}`);
      }
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-background/80 backdrop-blur-md border-b border-border/60 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-3 group">
          <div className="w-9 h-9 bg-surface border border-border rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(59,130,246,0.2)] group-hover:border-primary/50 transition-colors">
            <img src="/optimus-logo.png" alt="OPTIMUS" className="w-6 h-6 object-contain" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-heading text-lg font-bold tracking-tight text-text-primary group-hover:text-primary transition-colors">
                OPTIMUS
              </span>
              <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono font-medium bg-primary/10 text-primary border border-primary/20 rounded">
                v1.0
              </span>
            </div>
            <span className="text-[11px] text-text-secondary -mt-1 hidden sm:block">
              Autonomous AI Engineering
            </span>
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-1 text-sm font-medium">
          {isHome ? (
            <>
              <button
                onClick={() => handleNavClick('workflow')}
                className="px-3 py-1.5 text-text-secondary hover:text-text-primary hover:bg-surface-hover rounded-md transition-colors cursor-pointer"
              >
                Workflow
              </button>
              <button
                onClick={() => handleNavClick('capabilities')}
                className="px-3 py-1.5 text-text-secondary hover:text-text-primary hover:bg-surface-hover rounded-md transition-colors cursor-pointer"
              >
                Capabilities
              </button>
              <button
                onClick={() => handleNavClick('security')}
                className="px-3 py-1.5 text-text-secondary hover:text-text-primary hover:bg-surface-hover rounded-md transition-colors cursor-pointer"
              >
                Security
              </button>
            </>
          ) : (
            <>
              <Link
                to="/#workflow"
                className="px-3 py-1.5 text-text-secondary hover:text-text-primary hover:bg-surface-hover rounded-md transition-colors"
              >
                Workflow
              </Link>
              <Link
                to="/#capabilities"
                className="px-3 py-1.5 text-text-secondary hover:text-text-primary hover:bg-surface-hover rounded-md transition-colors"
              >
                Capabilities
              </Link>
              <Link
                to="/#security"
                className="px-3 py-1.5 text-text-secondary hover:text-text-primary hover:bg-surface-hover rounded-md transition-colors"
              >
                Security
              </Link>
            </>
          )}

          <Link
            to="/learn-more"
            className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${
              location.pathname === '/learn-more'
                ? 'text-primary bg-primary/10 border border-primary/20 font-semibold'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            Learn More
          </Link>
        </nav>

        {/* Action Buttons */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            to="/login"
            className="px-3.5 py-1.5 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
          >
            Sign In
          </Link>
          <Link
            to="/login"
            className="flex items-center gap-1.5 px-4 py-1.5 bg-primary hover:bg-primary/90 text-white rounded-md text-sm font-medium transition-all shadow-[0_0_15px_rgba(59,130,246,0.3)] hover:shadow-[0_0_20px_rgba(59,130,246,0.5)]"
          >
            Get Started
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Mobile Hamburger Toggle */}
        <div className="flex md:hidden items-center gap-2">
          <Link
            to="/login"
            className="px-3 py-1 bg-primary text-white rounded text-xs font-medium"
          >
            Get Started
          </Link>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-surface rounded-md focus:outline-none"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-border bg-surface/95 backdrop-blur-md px-4 pt-2 pb-4 space-y-2">
          {isHome ? (
            <>
              <button
                onClick={() => handleNavClick('workflow')}
                className="w-full text-left px-3 py-2 text-sm text-text-secondary hover:text-text-primary rounded-md hover:bg-surface-hover"
              >
                Workflow
              </button>
              <button
                onClick={() => handleNavClick('capabilities')}
                className="w-full text-left px-3 py-2 text-sm text-text-secondary hover:text-text-primary rounded-md hover:bg-surface-hover"
              >
                Capabilities
              </button>
              <button
                onClick={() => handleNavClick('security')}
                className="w-full text-left px-3 py-2 text-sm text-text-secondary hover:text-text-primary rounded-md hover:bg-surface-hover"
              >
                Security
              </button>
            </>
          ) : (
            <>
              <Link
                to="/"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2 text-sm text-text-secondary hover:text-text-primary rounded-md hover:bg-surface-hover"
              >
                Home
              </Link>
              <Link
                to="/#workflow"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2 text-sm text-text-secondary hover:text-text-primary rounded-md hover:bg-surface-hover"
              >
                Workflow
              </Link>
              <Link
                to="/#capabilities"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2 text-sm text-text-secondary hover:text-text-primary rounded-md hover:bg-surface-hover"
              >
                Capabilities
              </Link>
            </>
          )}

          <Link
            to="/learn-more"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-primary font-medium rounded-md bg-primary/10"
          >
            <BookOpen className="w-4 h-4" />
            Learn More (Architecture & Guide)
          </Link>

          <div className="pt-2 border-t border-border flex items-center justify-between">
            <Link
              to="/login"
              onClick={() => setMobileMenuOpen(false)}
              className="text-sm text-text-secondary hover:text-text-primary py-1"
            >
              Sign In
            </Link>
            <Link
              to="/login"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-md text-sm font-medium"
            >
              Get Started
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
