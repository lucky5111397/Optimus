import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, GitFork, History, BarChart3, Settings,
  Search, Bell, ChevronLeft, ChevronRight, LogOut, User
} from 'lucide-react';
import { useAuth } from '../features/auth/AuthContext';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/repositories', label: 'Repositories', icon: GitFork },
  { path: '/history', label: 'History', icon: History },
  { path: '/analytics', label: 'Analytics', icon: BarChart3 },
  { path: '/settings', label: 'Settings', icon: Settings },
];

export default function AppShell({ children, onOpenCommandPalette, onOpenNotifications }) {
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { user, logout } = useAuth();

  return (
    <div className="flex h-screen bg-background text-text-primary overflow-hidden">
      {/* Sidebar — Level 0 background */}
      <aside className={`${sidebarCollapsed ? 'w-16' : 'w-60'} bg-[#0A0C10] border-r border-border flex flex-col transition-all duration-200 flex-shrink-0`}>
        {/* Logo */}
        <div className={`h-14 flex items-center border-b border-border ${sidebarCollapsed ? 'justify-center px-2' : 'px-4'}`}>
          <img
            src="/optimus-logo.png"
            alt={sidebarCollapsed ? "OPTIMUS" : ""}
            className="w-6 h-6 object-contain flex-shrink-0"
          />
          {!sidebarCollapsed && (
            <span className="ml-2.5 font-heading font-semibold text-sm tracking-wide text-text-primary">
              OPTIMUS
            </span>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-2 space-y-1">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2 rounded-sm text-sm transition-colors ${
                  isActive
                    ? 'bg-primary/10 text-primary font-medium border-l-2 border-primary'
                    : 'text-text-secondary hover:text-text-primary hover:bg-[#161B22]'
                } ${sidebarCollapsed ? 'justify-center' : ''}`}
                title={sidebarCollapsed ? item.label : undefined}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {!sidebarCollapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User area */}
        <div className="border-t border-border p-3">
          <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'}`}>
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt="" className="w-7 h-7 rounded-full flex-shrink-0" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                <User className="w-3.5 h-3.5 text-primary" />
              </div>
            )}
            {!sidebarCollapsed && (
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{user?.username || user?.name || 'User'}</p>
                <p className="text-[11px] text-text-secondary truncate">{user?.email}</p>
              </div>
            )}
            {!sidebarCollapsed && (
              <button onClick={logout} className="p-1.5 text-text-secondary hover:text-red-400 hover:bg-[#161B22] rounded transition-colors" title="Logout">
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="h-10 border-t border-border flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-[#161B22] transition-colors"
        >
          {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Sticky Header — Glassmorphic */}
        <header className="h-14 border-b border-border bg-surface/70 backdrop-blur-xl flex items-center justify-between px-6 flex-shrink-0 z-10">
          <div className="flex items-center gap-4">
            <button
              onClick={onOpenCommandPalette}
              className="flex items-center gap-2 px-3 py-1.5 bg-background border border-border rounded-sm text-text-secondary text-sm hover:border-border-active transition-colors"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Search...</span>
              <kbd className="ml-4 text-[10px] bg-[#21262D] px-1.5 py-0.5 rounded text-text-secondary border border-border">⌘K</kbd>
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onOpenNotifications}
              className="relative p-2 text-text-secondary hover:text-text-primary hover:bg-[#161B22] rounded-sm transition-colors"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary rounded-full" />
            </button>
          </div>
        </header>

        {/* Content Canvas — Level 1 background */}
        <main className="flex-1 overflow-y-auto bg-[#0D1117]">
          {children}
        </main>
      </div>
    </div>
  );
}
