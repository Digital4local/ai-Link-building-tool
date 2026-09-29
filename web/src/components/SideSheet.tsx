import React, { useState } from 'react';
import { clsx } from 'clsx';
import { X, ExternalLink, Mail, Copy, Check, Sparkles, ShieldCheck, FileCode, Clock } from 'lucide-react';
import type { DomainTarget } from '../types';
import { Badge } from './Badge';
import { Button } from './Button';
import { DomainCell } from './DomainCell';

export interface SideSheetProps {
  target: DomainTarget | null;
  isOpen: boolean;
  onClose: () => void;
  onGeneratePitch?: (target: DomainTarget) => void;
}

export const SideSheet: React.FC<SideSheetProps> = ({
  target,
  isOpen,
  onClose,
  onGeneratePitch,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'signals' | 'pitch'>('overview');
  const [copied, setCopied] = useState(false);

  if (!isOpen || !target) return null;

  const handleCopyPitch = () => {
    navigator.clipboard.writeText(target.pitchAngle);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity duration-200"
        onClick={onClose}
      />

      {/* Sheet Panel */}
      <div className="relative w-full max-w-[480px] bg-app-surface border-l border-app-border elevation-sheet h-full flex flex-col z-10 transition-transform duration-200 ease-out">
        {/* Top Header */}
        <div className="p-5 border-b border-app-border flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant={target.actionBucket === 'High Priority' ? 'high-priority' : 'quick-win'}>
                {target.actionBucket}
              </Badge>
              <Badge variant="brand">{target.market}</Badge>
            </div>
            <h2 className="font-h2 text-app-text mt-1">
              <DomainCell domain={target.domain} />
            </h2>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-app-surface-2 text-app-text-3 hover:text-app-text flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-5 border-b border-app-border flex items-center gap-6 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('overview')}
            className={clsx(
              'py-3 border-b-2 transition-colors',
              activeTab === 'overview'
                ? 'border-brand text-brand'
                : 'border-transparent text-app-text-3 hover:text-app-text'
            )}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('signals')}
            className={clsx(
              'py-3 border-b-2 transition-colors',
              activeTab === 'signals'
                ? 'border-brand text-brand'
                : 'border-transparent text-app-text-3 hover:text-app-text'
            )}
          >
            On-Page Signals
          </button>
          <button
            onClick={() => setActiveTab('pitch')}
            className={clsx(
              'py-3 border-b-2 transition-colors',
              activeTab === 'pitch'
                ? 'border-brand text-brand'
                : 'border-transparent text-app-text-3 hover:text-app-text'
            )}
          >
            AI Outreach Pitch
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {activeTab === 'overview' && (
            <div className="space-y-4">
              {/* Score KPI banner */}
              <div className="p-4 bg-app-surface-2 radius-card border border-app-border flex items-center justify-between">
                <div>
                  <span className="text-xs text-app-text-3 uppercase tracking-wider font-medium">
                    Citation-Worthiness
                  </span>
                  <div className="text-2xl font-bold font-metric text-app-text mt-0.5">
                    {target.citationScore} <span className="text-xs text-app-text-3 font-normal">/100</span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs text-app-text-3 uppercase tracking-wider font-medium">
                    Frequency
                  </span>
                  <div className="text-xl font-bold font-metric text-brand-accent mt-0.5">
                    {target.citationFrequency} Citations
                  </div>
                </div>
              </div>

              {/* Sample Cited URL */}
              <div className="space-y-1.5">
                <span className="text-xs font-medium text-app-text-3">Sample Ranking URL</span>
                <div className="p-3 bg-app-surface-2 radius-input border border-app-border text-xs text-app-text font-mono break-all flex items-start justify-between gap-2">
                  <span>{target.sampleUrl}</span>
                  <a
                    href={target.sampleUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-brand hover:underline shrink-0"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>

              {/* Competitors Cited */}
              <div className="space-y-1.5">
                <span className="text-xs font-medium text-app-text-3">Competitors Missing on this Domain</span>
                <div className="flex flex-wrap gap-1.5">
                  {target.competitorsCited.map((comp, i) => (
                    <span
                      key={i}
                      className="px-2 py-1 radius-badge bg-danger/10 text-danger border border-danger/20 text-xs font-medium"
                    >
                      {comp}
                    </span>
                  ))}
                </div>
              </div>

              {/* Contact Information */}
              <div className="space-y-1.5">
                <span className="text-xs font-medium text-app-text-3">Direct Contact Email</span>
                <div className="flex items-center gap-2 p-2.5 bg-app-surface-2 radius-input border border-app-border text-xs">
                  <Mail className="w-4 h-4 text-app-text-3" />
                  <span className="text-app-text font-mono">
                    {target.contactEmail || 'editor@' + target.domain}
                  </span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'signals' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-app-surface-2 radius-card border border-app-border space-y-3 text-xs">
                <div className="flex items-center justify-between py-1 border-b border-app-border/40">
                  <span className="text-app-text-2 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-brand" /> Content Freshness
                  </span>
                  <span className="text-success font-semibold">Updated 2 months ago (+20 pts)</span>
                </div>

                <div className="flex items-center justify-between py-1 border-b border-app-border/40">
                  <span className="text-app-text-2 flex items-center gap-1.5">
                    <FileCode className="w-3.5 h-3.5 text-brand-accent" /> Schema JSON-LD
                  </span>
                  <span className="text-app-text font-medium">FAQPage, Article (+10 pts)</span>
                </div>

                <div className="flex items-center justify-between py-1 border-b border-app-border/40">
                  <span className="text-app-text-2 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-info" /> Author Attribution
                  </span>
                  <span className="text-success font-semibold">Verified Author Byline (+10 pts)</span>
                </div>

                <div className="flex items-center justify-between py-1">
                  <span className="text-app-text-2">Content Word Count</span>
                  <span className="text-app-text font-mono font-medium">{target.avgWordCount} words</span>
                </div>
              </div>

              <div className="p-3 bg-brand/5 border border-brand/20 radius-input text-xs text-app-text-2">
                <strong className="text-brand block mb-1">Citation Rationale:</strong>
                This domain holds strong topical authority in {target.category}. Google Gemini and ChatGPT extract statistics from its structured tables.
              </div>
            </div>
          )}

          {activeTab === 'pitch' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-app-text flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-brand-accent" />
                  Tailored Outreach Email
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleCopyPitch}
                  icon={copied ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                >
                  {copied ? 'Copied' : 'Copy Pitch'}
                </Button>
              </div>

              <div className="p-4 bg-app-surface-2 border border-app-border radius-card text-xs text-app-text font-mono leading-relaxed whitespace-pre-wrap">
                {target.pitchAngle}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-app-border bg-app-surface flex items-center justify-between gap-3">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => onGeneratePitch?.(target)}
            icon={<Sparkles className="w-3.5 h-3.5" />}
          >
            Regenerate Pitch
          </Button>
        </div>
      </div>
    </div>
  );
};
