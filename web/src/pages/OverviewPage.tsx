import React, { useState } from 'react';
import {
  TrendingUp,
  Award,
  ArrowRight,
  ExternalLink,
  Send,
  Sparkles,
} from 'lucide-react';
import { RadialGauge } from '../components/RadialGauge';
import { MetricCard } from '../components/MetricCard';
import { SankeyCitationFlow } from '../components/SankeyCitationFlow';
import { PromptCoverageGrid } from '../components/PromptCoverageGrid';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import { SideSheet } from '../components/SideSheet';
import {
  sovTrendData,
  nextBestActions,
  mockSources,
  mockPrompts,
} from '../data/mockData';
import type { DomainTarget, CoverageGridCell } from '../types';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';

export interface OverviewPageProps {
  onNavigate: (route: string) => void;
  onStartRun: () => void;
}

export const OverviewPage: React.FC<OverviewPageProps> = ({
  onNavigate,
  onStartRun,
}) => {
  const [selectedSheetTarget, setSelectedSheetTarget] = useState<DomainTarget | null>(null);

  // Transform mock prompts to coverage grid format
  const coverageData: CoverageGridCell[] = mockPrompts.map((p) => ({
    prompt: p.query,
    category: p.category,
    engines: {
      Gemini: { rank: p.clientRank, sentiment: 'positive' },
      ChatGPT: { rank: p.clientRank === 1 ? 1 : 2, sentiment: 'positive' },
      Perplexity: { rank: p.clientRank ? p.clientRank + 1 : null, sentiment: 'neutral' },
      Claude: { rank: p.clientRank === 1 ? 2 : null, sentiment: null },
    },
  }));

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Top BYOK & Business Campaign Banner */}
      <div className="p-4 md:p-5 bg-gradient-to-r from-brand/12 via-app-surface to-brand-accent/10 border border-brand/25 radius-card flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 radius-pill bg-brand-accent/20 text-brand-accent border border-brand-accent/30 text-[11px] font-bold">
              100% FREE · BYOK ACTIVE
            </span>
            <span className="text-xs text-app-text-3 font-mono">
              Campaign: <strong className="text-app-text">Digital4Local</strong> (digital4local.com)
            </span>
          </div>
          <h2 className="text-sm md:text-base font-bold text-app-text">
            Reverse-Engineer Google Gemini & ChatGPT Citations
          </h2>
          <p className="text-xs text-app-text-2">
            Enter your free Google Gemini API Key and business details to prospect high-authority citation targets.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onNavigate('/onboarding')}
            icon={<Sparkles className="w-3.5 h-3.5 text-brand" />}
          >
            Edit Business Details
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={onStartRun}
            icon={<Send className="w-3.5 h-3.5" />}
          >
            Run New AI Audit
          </Button>
        </div>
      </div>
      {/* ------------------------------------------------------------- */}
      {/* ROW 1: RADIAL GAUGE (0-100) + 3 METRIC CARDS                  */}
      {/* ------------------------------------------------------------- */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Radial Score Gauge (4 cols on lg) */}
        <div className="lg:col-span-4 flex flex-col">
          <RadialGauge
            score={86}
            shareOfVoice={48.2}
            avgPosition={1.4}
            citationShare={72.5}
            className="h-full"
          />
        </div>

        {/* 3 Metric Cards (8 cols on lg) */}
        <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <MetricCard
            label="Share of Voice"
            value="48.2"
            suffix="%"
            delta={12.4}
            deltaLabel="vs last run"
            tooltip="Percentage of tracked buyer queries where Digital4Local is cited as a top recommendation."
            sparklineData={[31, 37.5, 42, 48.2]}
          />

          <MetricCard
            label="Active Authority Targets"
            value="142"
            delta={8.0}
            deltaLabel="vs previous run"
            tooltip="High-authority publishing domains citing competitors where Digital4Local can build links."
            sparklineData={[98, 114, 128, 142]}
          />

          <MetricCard
            label="Citation Gaps Identified"
            value="34"
            delta={-14.2}
            deltaLabel="closing gap velocity"
            tooltip="Exact URLs currently missing client citation anchors that competitors occupy."
            sparklineData={[56, 48, 39, 34]}
          />
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* ROW 2: HERO SANKEY CITATION FLOW DIAGRAM                      */}
      {/* ------------------------------------------------------------- */}
      <section>
        <SankeyCitationFlow
          onSelectDomain={(domain) => {
            const found = mockSources.find((s) => s.domain === domain) || {
              id: 'custom',
              domain,
              citationScore: 88,
              citationFrequency: 18,
              market: 'UK / US',
              category: 'Authority Platform',
              actionBucket: 'High Priority',
              status: 'Identified',
              avgWordCount: 2100,
              schemaTypes: ['Article'],
              sampleUrl: `https://${domain}/rankings`,
              pitchAngle: `Hi Editorial Team,\n\nWe love your insights on ${domain}. Digital4Local has verified benchmark data on AI search citations ready to add.`,
              competitorsCited: ['FatJoe'],
            };
            setSelectedSheetTarget(found);
          }}
        />
      </section>

      {/* ------------------------------------------------------------- */}
      {/* ROW 3: SOV TREND (LINE CHART) + NEXT BEST ACTIONS             */}
      {/* ------------------------------------------------------------- */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* SOV Trend Chart (7 cols) */}
        <div className="lg:col-span-7 bg-app-surface border border-app-border radius-card p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-brand/15 text-brand flex items-center justify-center">
                  <TrendingUp className="w-3.5 h-3.5" />
                </div>
                <h3 className="font-h3 text-app-text">Share of Voice Trend Across Runs</h3>
              </div>
              <span className="text-xs text-app-text-3 font-mono">Last 4 Runs (Weekly)</span>
            </div>
            <p className="text-xs text-app-text-2 mb-4">
              Tracking visibility trajectory against direct SEO & Link Building competitors.
            </p>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sovTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.6} />
                <XAxis dataKey="date" stroke="var(--text-3)" fontSize={11} tickLine={false} />
                <YAxis stroke="var(--text-3)" fontSize={11} tickLine={false} unit="%" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--surface-3)',
                    borderColor: 'var(--border-strong)',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: 'var(--text)',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Line
                  type="monotone"
                  dataKey="Digital4Local"
                  stroke="var(--brand)"
                  strokeWidth={3}
                  dot={{ fill: 'var(--brand)', r: 4 }}
                  activeDot={{ r: 6 }}
                />
                <Line type="monotone" dataKey="FatJoe" stroke="#8B5CF6" strokeWidth={1.5} dot={false} />
                <Line type="monotone" dataKey="SiegeMedia" stroke="#EC4899" strokeWidth={1.5} dot={false} />
                <Line type="monotone" dataKey="PageOnePower" stroke="#14B8A6" strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Next Best Actions (5 cols) */}
        <div className="lg:col-span-5 bg-app-surface border border-app-border radius-card p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-brand-accent/15 text-brand-accent flex items-center justify-center">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <h3 className="font-h3 text-app-text">Next Best Actions</h3>
              </div>
              <span className="text-xs px-2 py-0.5 radius-pill bg-brand-accent/10 text-brand-accent border border-brand-accent/20 font-semibold">
                5 High Impact
              </span>
            </div>
            <p className="text-xs text-app-text-2 mb-4">
              AI-ranked tactical steps to boost citation frequency and overtake competitor anchors.
            </p>
          </div>

          <div className="space-y-2.5">
            {nextBestActions.map((act) => (
              <div
                key={act.id}
                onClick={() => onNavigate(act.actionUrl)}
                className="p-3 radius-input bg-app-surface-2 border border-app-border hover:border-app-border-strong transition-colors cursor-pointer group flex items-start justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`px-1.5 py-0.2 radius-badge text-[10px] font-bold uppercase tracking-wider ${
                        act.impact === 'Critical'
                          ? 'bg-danger/15 text-danger border border-danger/30'
                          : 'bg-brand-accent/15 text-brand-accent border border-brand-accent/30'
                      }`}
                    >
                      {act.impact}
                    </span>
                    <span className="text-[11px] text-app-text-3 font-mono">{act.category}</span>
                  </div>
                  <h4 className="text-xs font-semibold text-app-text group-hover:text-brand transition-colors truncate">
                    {act.title}
                  </h4>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0 p-1.5 text-app-text-3 group-hover:text-brand"
                  icon={<ArrowRight className="w-3.5 h-3.5" />}
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* ROW 4: PROMPT COVERAGE GEO MATRIX                             */}
      {/* ------------------------------------------------------------- */}
      <section>
        <PromptCoverageGrid
          data={coverageData}
          onSelectPrompt={(prompt) => {
            onNavigate('/prompts');
          }}
        />
      </section>

      {/* Side Sheet Drawer */}
      <SideSheet
        target={selectedSheetTarget}
        isOpen={Boolean(selectedSheetTarget)}
        onClose={() => setSelectedSheetTarget(null)}
        onGeneratePitch={(t) => {
          setSelectedSheetTarget(null);
          onNavigate('/outreach');
        }}
      />
    </div>
  );
};
