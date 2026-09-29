import React, { useState } from 'react';
import { clsx } from 'clsx';
import {
  LayoutDashboard,
  Sparkles,
  FileText,
  Layers,
  ArrowRightLeft,
  Send,
  BarChart3,
  ChevronDown,
  Moon,
  Sun,
  Search,
  Plus,
  PanelLeftClose,
  PanelLeftOpen,
  User,
  Palette,
} from 'lucide-react';
import { Button } from '../components/Button';
import { CommandPalette } from '../components/CommandPalette';
import { ToastContainer } from '../components/Toast';
import type { ToastMessage } from '../components/Toast';
import { useAudit } from '../context/AuditContext';

export interface AppLayoutProps {
  children: React.ReactNode;
  currentRoute: string;
  onNavigate: (route: string) => void;
  isDark: boolean;
  onToggleTheme: () => void;
  activeEngine: string;
  onSelectEngine: (engine: string) => void;
  onStartNewRun?: () => void;
  isTrackingLive?: boolean;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  children,
  currentRoute,
  onNavigate,
  isDark,
  onToggleTheme,
  activeEngine,
  onSelectEngine,
  onStartNewRun,
  isTrackingLive = false,
}) => {
  const { clientName, clientDomain, markets, auditResult } = useAudit();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (type: 'success' | 'info' | 'warning' | 'error', title: string, description?: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, title, description }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const navGroups = [
    {
      group: 'Insights',
      items: [
        { label: 'Overview', route: '/overview', icon: <LayoutDashboard className="w-4 h-4" /> },
        { label: 'Prompts Grid', route: '/prompts', icon: <Sparkles className="w-4 h-4" /> },
        { label: 'AI Answers', route: '/answers', icon: <FileText className="w-4 h-4" /> },
        { label: 'Cited Sources', route: '/sources', icon: <Layers className="w-4 h-4" /> },
      ],
    },
    {
      group: 'Action',
      items: [
        { label: 'Competitor Gaps', route: '/gaps', icon: <ArrowRightLeft className="w-4 h-4" /> },
        { label: 'Outreach & Pitches', route: '/outreach', icon: <Send className="w-4 h-4" /> },
      ],
    },
    {
      group: 'Deliver',
      items: [
        { label: 'Client Reports', route: '/reports', icon: <BarChart3 className="w-4 h-4" /> },
        { label: 'Design System', route: '/design', icon: <Palette className="w-4 h-4" /> },
      ],
    },
  ];

  const engines = ['All', 'Gemini', 'ChatGPT', 'Perplexity', 'Claude'];

  return (
    <div className="min-h-screen bg-app-bg text-app-text flex flex-col md:flex-row transition-colors duration-150">
      {/* ------------------------------------------------------------- */}
      {/* SIDEBAR (Desktop 248px / Collapsed 64px)                      */}
      {/* ------------------------------------------------------------- */}
      <aside
        className={clsx(
          'hidden md:flex flex-col justify-between border-r border-app-border bg-app-surface transition-all duration-200 ease-out z-30 sticky top-0 h-screen shrink-0',
          isCollapsed ? 'w-16' : 'w-[248px]'
        )}
      >
        {/* Top Brand Header & Project Switcher */}
        <div>
          {/* Logo Bar */}
          <div className="h-14 px-4 border-b border-app-border flex items-center justify-between">
            {!isCollapsed ? (
              <div
                onClick={() => onNavigate('/overview')}
                className="flex items-center gap-2 cursor-pointer select-none"
              >
                <img
                  src="/brand/logo.svg"
                  alt="Digital4Local Logo"
                  className="h-7 w-auto object-contain"
                />
              </div>
            ) : (
              <div
                onClick={() => onNavigate('/overview')}
                className="w-full flex items-center justify-center cursor-pointer"
              >
                <img
                  src="/brand/logo_icon.svg"
                  alt="Digital4Local Icon"
                  className="w-8 h-8 object-contain"
                />
              </div>
            )}

            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="text-app-text-3 hover:text-app-text p-1 transition-colors rounded"
              title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {isCollapsed ? (
                <PanelLeftOpen className="w-4 h-4" />
              ) : (
                <PanelLeftClose className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* Project Switcher */}
          {!isCollapsed && (
            <div className="p-3 border-b border-app-border">
              <div
                onClick={() => onNavigate('/overview')}
                className="p-2 radius-input bg-app-surface-2 border border-app-border hover:border-app-border-strong flex items-center justify-between cursor-pointer transition-colors group"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-5 h-5 rounded bg-brand/15 text-brand flex items-center justify-center font-bold text-xs">
                    {(clientName || 'D').charAt(0).toUpperCase()}
                  </div>
                  <div className="truncate">
                    <div className="text-xs font-semibold text-app-text truncate">
                      {clientName || 'Digital4Local'}
                    </div>
                    <div className="text-[10px] text-app-text-3 truncate">
                      {clientDomain || markets.join(', ') || 'UK & Global GEO Grid'}
                    </div>
                  </div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-app-text-3 group-hover:text-app-text shrink-0" />
              </div>
            </div>
          )}

          {/* Navigation Groups */}
          <nav className="p-3 space-y-5 overflow-y-auto max-h-[calc(100vh-250px)]">
            {navGroups.map((group, gIdx) => (
              <div key={gIdx} className="space-y-1">
                {!isCollapsed && (
                  <div className="px-3 text-[10px] font-semibold tracking-wider text-app-text-3 uppercase mb-1">
                    {group.group}
                  </div>
                )}
                {group.items.map((item) => {
                  const isActive = currentRoute === item.route;
                  return (
                    <button
                      key={item.route}
                      onClick={() => onNavigate(item.route)}
                      title={isCollapsed ? item.label : undefined}
                      className={clsx(
                        'w-full flex items-center radius-input text-xs font-medium transition-colors select-none cursor-pointer',
                        isCollapsed
                          ? 'justify-center h-10 px-0'
                          : 'gap-3 px-3 h-9',
                        isActive
                          ? 'bg-brand text-white shadow-sm shadow-brand/20 font-semibold'
                          : 'text-app-text-2 hover:text-app-text hover:bg-app-surface-2'
                      )}
                    >
                      <span className={clsx('shrink-0', isActive ? 'text-white' : 'text-current')}>
                        {item.icon}
                      </span>
                      {!isCollapsed && <span className="truncate">{item.label}</span>}
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>
        </div>

        {/* Bottom Section: Usage Meter & User Profile */}
        <div className="p-3 border-t border-app-border space-y-3">
          {/* Usage Meter */}
          {!isCollapsed && (
            <div className="p-2.5 bg-app-surface-2 radius-input border border-app-border space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-app-text-3">AI Engine Status</span>
                <span className="font-semibold text-app-text tabular-nums">
                  {auditResult ? `${auditResult.summary.unique_domains} Domains` : 'BYOK Free Tier'}
                </span>
              </div>
              <div className="w-full h-1.5 bg-app-surface-3 rounded-full overflow-hidden">
                <div className={`h-full ${auditResult ? 'bg-success' : 'bg-brand-accent'} rounded-full w-full`} />
              </div>
              <span className="text-[10px] text-brand-accent font-medium block">
                {auditResult ? 'Audit Complete & Ready' : 'Gemini 3.1 Flash-Lite BYOK'}
              </span>
            </div>
          )}

          {/* User Profile */}
          <div
            onClick={() => onNavigate('/settings')}
            className={clsx(
              'flex items-center radius-input hover:bg-app-surface-2 cursor-pointer transition-colors',
              isCollapsed ? 'justify-center p-2' : 'gap-2.5 p-2'
            )}
          >
            <div className="w-7 h-7 rounded-full bg-brand/20 border border-brand/30 flex items-center justify-center text-brand font-bold text-xs shrink-0">
              <User className="w-3.5 h-3.5" />
            </div>
            {!isCollapsed && (
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-app-text truncate">{clientName || 'Agency Lead'}</div>
                <div className="text-[10px] text-app-text-3 truncate">{clientDomain || 'digital4local.com'}</div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* ------------------------------------------------------------- */}
      {/* MAIN CONTENT WRAPPER                                          */}
      {/* ------------------------------------------------------------- */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 56px Top Bar */}
        <header className="h-14 border-b border-app-border bg-app-surface/90 backdrop-blur-md sticky top-0 z-20 px-4 md:px-6 flex items-center justify-between gap-4">
          {/* Left: Breadcrumbs & Status Pill */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center gap-2 text-xs text-app-text-3 truncate">
              <span className="hover:text-app-text cursor-pointer" onClick={() => onNavigate('/overview')}>
                {clientName || 'Digital4Local'}
              </span>
              <span>/</span>
              <span className="font-semibold text-app-text capitalize">
                {currentRoute.replace('/', '') || 'Overview'}
              </span>
            </div>

            {/* Status Pill */}
            <div
              className={clsx(
                'hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 radius-pill text-xs font-medium border select-none',
                isTrackingLive
                  ? 'bg-success/12 text-success border-success/30'
                  : auditResult
                  ? 'bg-brand/12 text-brand border-brand/30'
                  : 'bg-app-surface-2 text-app-text-2 border-app-border'
              )}
            >
              <span
                className={clsx(
                  'w-1.5 h-1.5 rounded-full shrink-0',
                  isTrackingLive
                    ? 'bg-success pulse-dot'
                    : auditResult
                    ? 'bg-brand'
                    : 'bg-brand-accent'
                )}
              />
              <span>
                {isTrackingLive
                  ? 'Tracking live...'
                  : auditResult
                  ? `${auditResult.summary.unique_domains} cited domains`
                  : 'Ready'}
              </span>
            </div>
          </div>

          {/* Center/Right: Engine Filter Chips & Actions */}
          <div className="flex items-center gap-2.5">
            {/* Engine filter chips (hidden on very small screens) */}
            <div className="hidden lg:flex items-center gap-1 bg-app-surface-2 p-1 radius-input border border-app-border">
              {engines.map((eng) => (
                <button
                  key={eng}
                  onClick={() => onSelectEngine(eng)}
                  className={clsx(
                    'px-2.5 py-1 text-xs font-medium radius-badge transition-colors cursor-pointer',
                    activeEngine === eng
                      ? 'bg-app-surface text-brand font-semibold shadow-xs'
                      : 'text-app-text-3 hover:text-app-text'
                  )}
                >
                  {eng}
                </button>
              ))}
            </div>

            {/* Cmd+K Search trigger */}
            <button
              onClick={() => setIsCommandPaletteOpen(true)}
              className="h-8 px-2.5 bg-app-surface-2 border border-app-border radius-input text-xs text-app-text-3 hover:text-app-text hover:border-app-border-strong flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Search className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Search...</span>
              <kbd className="text-[10px] font-mono px-1 py-0.2 bg-app-surface-3 rounded border border-app-border">
                ⌘K
              </kbd>
            </button>

            {/* Theme Toggle */}
            <button
              onClick={onToggleTheme}
              className="w-8 h-8 rounded-lg bg-app-surface-2 border border-app-border text-app-text-2 hover:text-app-text flex items-center justify-center transition-colors cursor-pointer"
              title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {isDark ? <Sun className="w-4 h-4 text-warning" /> : <Moon className="w-4 h-4 text-brand" />}
            </button>

            {/* New Run Primary Button */}
            <Button
              variant="primary"
              size="sm"
              icon={<Plus className="w-3.5 h-3.5" />}
              onClick={() => {
                if (onStartNewRun) onStartNewRun();
                else addToast('info', 'Starting new citation run', 'Synthesizing queries across Gemini and ChatGPT.');
              }}
            >
              New run
            </Button>
          </div>
        </header>

        {/* Page Content Viewport */}
        <main className="flex-1 p-4 md:p-6 max-w-[1440px] w-full mx-auto pb-20 md:pb-8">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar (<768px) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 h-14 bg-app-surface border-t border-app-border z-40 flex items-center justify-around px-2">
        {navGroups[0].items.concat(navGroups[1].items.slice(0, 1)).map((item) => {
          const isActive = currentRoute === item.route;
          return (
            <button
              key={item.route}
              onClick={() => onNavigate(item.route)}
              className={clsx(
                'flex flex-col items-center justify-center py-1 px-3 text-[10px] font-medium transition-colors',
                isActive ? 'text-brand font-semibold' : 'text-app-text-3 hover:text-app-text'
              )}
            >
              {item.icon}
              <span className="mt-0.5">{item.label.split(' ')[0]}</span>
            </button>
          );
        })}
      </div>

      {/* Global Command Palette */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onNavigate={onNavigate}
      />

      {/* Global Toast Container */}
      <ToastContainer toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />
    </div>
  );
};
