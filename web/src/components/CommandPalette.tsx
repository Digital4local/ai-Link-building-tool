import React, { useState, useEffect } from 'react';
import { Search, Sparkles, FileText, Layers, Send, Settings, ArrowRight } from 'lucide-react';

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (route: string) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onNavigate,
}) => {
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const actions = [
    { label: 'Overview Dashboard', route: '/overview', category: 'Navigation', icon: <Layers className="w-4 h-4 text-brand" /> },
    { label: 'Prompt Coverage Grid', route: '/prompts', category: 'Navigation', icon: <Sparkles className="w-4 h-4 text-brand-accent" /> },
    { label: 'Top Cited Sources & Domains', route: '/sources', category: 'Navigation', icon: <FileText className="w-4 h-4 text-info" /> },
    { label: 'Competitor Citation Gaps', route: '/gaps', category: 'Navigation', icon: <ArrowRight className="w-4 h-4 text-warning" /> },
    { label: 'Outreach & Pitch Generator', route: '/outreach', category: 'Actions', icon: <Send className="w-4 h-4 text-success" /> },
    { label: 'Client White-Label Reports', route: '/reports', category: 'Deliver', icon: <FileText className="w-4 h-4 text-brand" /> },
    { label: 'Engine & API Settings', route: '/settings', category: 'Settings', icon: <Settings className="w-4 h-4 text-app-text-3" /> },
  ];

  const filtered = actions.filter((a) =>
    a.label.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex items-start justify-center pt-24 px-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Palette Box */}
      <div className="relative w-full max-w-lg bg-app-surface border border-app-border-strong radius-panel elevation-sheet overflow-hidden z-10 animate-fadeIn">
        {/* Input Bar */}
        <div className="p-3.5 border-b border-app-border flex items-center gap-3">
          <Search className="w-4 h-4 text-brand shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or search screens..."
            autoFocus
            className="w-full bg-transparent text-sm text-app-text placeholder:text-app-text-3 focus:outline-none"
          />
          <kbd className="px-1.5 py-0.5 radius-input bg-app-surface-2 border border-app-border text-[10px] text-app-text-3 font-mono">
            ESC
          </kbd>
        </div>

        {/* Action List */}
        <div className="p-2 max-h-72 overflow-y-auto space-y-1">
          {filtered.length > 0 ? (
            filtered.map((action, idx) => (
              <div
                key={idx}
                onClick={() => {
                  onNavigate(action.route);
                  onClose();
                }}
                className="p-2.5 radius-input hover:bg-app-surface-2 flex items-center justify-between cursor-pointer group transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-md bg-app-surface-3 flex items-center justify-center">
                    {action.icon}
                  </div>
                  <span className="text-xs font-medium text-app-text group-hover:text-brand transition-colors">
                    {action.label}
                  </span>
                </div>
                <span className="text-[11px] text-app-text-3 font-mono">
                  {action.category}
                </span>
              </div>
            ))
          ) : (
            <div className="p-6 text-center text-xs text-app-text-3">
              No matching commands or screens found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
