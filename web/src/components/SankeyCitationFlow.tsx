import React, { useState } from 'react';
import { clsx } from 'clsx';
import { GitFork, Layers, Sparkles } from 'lucide-react';
import { DomainCell } from './DomainCell';

export interface SankeyCitationFlowProps {
  onSelectDomain?: (domain: string) => void;
  className?: string;
}

export const SankeyCitationFlow: React.FC<SankeyCitationFlowProps> = ({
  onSelectDomain,
  className,
}) => {
  const [activeHover, setActiveHover] = useState<string | null>(null);

  const topics = [
    { id: 't1', label: 'Local GEO Ranking', count: 18 },
    { id: 't2', label: 'Digital PR & Citations', count: 24 },
    { id: 't3', label: 'B2B Link Building Agencies', count: 32 },
    { id: 't4', label: 'SaaS Technical SEO Audit', count: 14 },
  ];

  const engines = [
    { id: 'e1', label: 'Gemini', share: '38%' },
    { id: 'e2', label: 'ChatGPT', share: '32%' },
    { id: 'e3', label: 'Perplexity', share: '20%' },
    { id: 'e4', label: 'Claude', share: '10%' },
  ];

  const domains = [
    { id: 'd1', domain: 'digital4local.com', isClient: true, citations: 42, score: 94 },
    { id: 'd2', domain: 'searchengineland.com', isClient: false, citations: 28, score: 88 },
    { id: 'd3', domain: 'hubspot.com', isClient: false, citations: 22, score: 85 },
    { id: 'd4', domain: 'backlinko.com', isClient: false, citations: 19, score: 82 },
    { id: 'd5', domain: 'ahrefs.com', isClient: false, citations: 16, score: 80 },
  ];

  return (
    <div
      className={clsx(
        'bg-app-surface border border-app-border hover:border-app-border-strong radius-card p-6 transition-all duration-150',
        className
      )}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 rounded-md bg-brand/15 text-brand flex items-center justify-center">
              <GitFork className="w-3.5 h-3.5" />
            </div>
            <h3 className="font-h3 text-app-text">AI Citation Flow Architecture</h3>
            <span className="text-xs px-2 py-0.5 radius-pill bg-brand-accent/10 text-brand-accent border border-brand-accent/20 font-medium">
              Sankey Intelligence
            </span>
          </div>
          <p className="text-xs text-app-text-2">
            Multi-stage mapping of prompt clusters to LLM synthesis models and target cited domains.
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-brand" />
            <span className="font-semibold text-app-text">digital4local.com (Client)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-app-text-3" />
            <span className="text-app-text-2">Third-Party Authorities</span>
          </div>
        </div>
      </div>

      {/* 3 Column Sankey Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
        {/* Column 1: Prompt Topics */}
        <div className="space-y-3">
          <div className="text-xs font-semibold text-app-text-3 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Layers className="w-3 h-3 text-brand" />
            <span>1. Prompt Clusters</span>
          </div>

          {topics.map((t) => (
            <div
              key={t.id}
              onMouseEnter={() => setActiveHover(t.id)}
              onMouseLeave={() => setActiveHover(null)}
              className={clsx(
                'p-3 radius-input border transition-all duration-150 flex items-center justify-between cursor-pointer',
                activeHover === t.id
                  ? 'bg-app-surface-3 border-brand shadow-sm'
                  : 'bg-app-surface-2 border-app-border hover:border-app-border-strong'
              )}
            >
              <span className="text-xs font-medium text-app-text">{t.label}</span>
              <span className="text-[11px] px-2 py-0.5 radius-pill bg-app-surface border border-app-border text-app-text-2 tabular-nums">
                {t.count} queries
              </span>
            </div>
          ))}
        </div>

        {/* Column 2: AI Engines */}
        <div className="space-y-3">
          <div className="text-xs font-semibold text-app-text-3 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-brand-accent" />
            <span>2. Grounded AI Engines</span>
          </div>

          {engines.map((e) => (
            <div
              key={e.id}
              onMouseEnter={() => setActiveHover(e.id)}
              onMouseLeave={() => setActiveHover(null)}
              className={clsx(
                'p-3 radius-input border transition-all duration-150 flex items-center justify-between cursor-pointer',
                activeHover === e.id
                  ? 'bg-app-surface-3 border-brand-accent shadow-sm'
                  : 'bg-app-surface-2 border-app-border hover:border-app-border-strong'
              )}
            >
              <span className="text-xs font-semibold text-app-text">{e.label}</span>
              <div className="flex items-center gap-1.5">
                <div className="w-12 h-1.5 bg-app-surface rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand-accent"
                    style={{ width: e.share }}
                  />
                </div>
                <span className="text-[11px] text-app-text-3 tabular-nums">{e.share}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Column 3: Top Cited Domains */}
        <div className="space-y-3">
          <div className="text-xs font-semibold text-app-text-3 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-success" />
            <span>3. Dominant Cited Domains</span>
          </div>

          {domains.map((d) => (
            <div
              key={d.id}
              onClick={() => onSelectDomain?.(d.domain)}
              onMouseEnter={() => setActiveHover(d.id)}
              onMouseLeave={() => setActiveHover(null)}
              className={clsx(
                'p-3 radius-input border transition-all duration-150 flex items-center justify-between cursor-pointer group',
                d.isClient
                  ? 'bg-brand/10 border-brand/40 hover:border-brand shadow-sm'
                  : activeHover === d.id
                  ? 'bg-app-surface-3 border-app-border-strong'
                  : 'bg-app-surface-2 border-app-border hover:border-app-border-strong'
              )}
            >
              <DomainCell domain={d.domain} showLinkIcon={false} />

              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-success tabular-nums">
                  Score {d.score}
                </span>
                <span className="text-[11px] px-1.5 py-0.5 radius-badge bg-app-surface-3 border border-app-border text-app-text-2 tabular-nums">
                  {d.citations} cites
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
