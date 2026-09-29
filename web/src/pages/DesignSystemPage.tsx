import React, { useState } from 'react';
import {
  Palette,
  Type,
  Sliders,
  Send,
  Sparkles,
  Layers,
  Award,
  CheckCircle2,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import { DomainCell } from '../components/DomainCell';
import { MetricCard } from '../components/MetricCard';
import { RadialGauge } from '../components/RadialGauge';
import { PromptCoverageGrid } from '../components/PromptCoverageGrid';
import { SankeyCitationFlow } from '../components/SankeyCitationFlow';
import { DataTable } from '../components/DataTable';
import type { Column } from '../components/DataTable';
import { SideSheet } from '../components/SideSheet';
import type { DomainTarget, CoverageGridCell } from '../types';

export const DesignSystemPage: React.FC = () => {
  const [selectedSheetTarget, setSelectedSheetTarget] = useState<DomainTarget | null>(null);

  // Sample data for demo
  const sampleTargets: DomainTarget[] = [
    {
      id: '1',
      domain: 'digital4local.com',
      citationScore: 94,
      citationFrequency: 42,
      market: 'UK',
      category: 'Local SEO & GEO',
      actionBucket: 'High Priority',
      status: 'Acquired',
      avgWordCount: 1850,
      schemaTypes: ['Organization', 'Service', 'FAQPage'],
      contactEmail: 'hello@digital4local.com',
      sampleUrl: 'https://digital4local.com/services/generative-engine-optimization',
      pitchAngle: 'Hi Editor,\n\nI noticed your comprehensive breakdown on AI search engine rankings. Digital4Local has developed verified benchmarks on Google Maps 5x5 grid ranking and Gemini citations that would enrich your statistics section.\n\nBest,\nDigital4Local PR Team',
      competitorsCited: ['FatJoe', 'Siege Media'],
    },
    {
      id: '2',
      domain: 'searchengineland.com',
      citationScore: 88,
      citationFrequency: 28,
      market: 'US',
      category: 'Search Intelligence',
      actionBucket: 'High Priority',
      status: 'In Discussion',
      avgWordCount: 2200,
      schemaTypes: ['NewsArticle', 'Author'],
      contactEmail: 'news@searchengineland.com',
      sampleUrl: 'https://searchengineland.com/how-ai-citations-work-gemini-chatgpt',
      pitchAngle: 'Hi Editorial Team,\n\nGreat analysis on AI citation grounding. We ran a study across 5,000 local business queries showing Gemini cites structured tables 3.4x more frequently. Would love to contribute this data.',
      competitorsCited: ['Page One Power'],
    },
    {
      id: '3',
      domain: 'hubspot.com',
      citationScore: 85,
      citationFrequency: 22,
      market: 'Global',
      category: 'B2B Growth & Marketing',
      actionBucket: 'Quick Win',
      status: 'Pitched',
      avgWordCount: 3100,
      schemaTypes: ['Article', 'FAQPage'],
      contactEmail: 'blog@hubspot.com',
      sampleUrl: 'https://blog.hubspot.com/marketing/ai-seo-strategies',
      pitchAngle: 'Hi HubSpot Team,\n\nYour guide on AI SEO is stellar. We noticed your section on GEO mentions ChatGPT but omits Gemini search grounding. We have a fresh comparative dataset ready to plug in.',
      competitorsCited: ['FatJoe'],
    },
    {
      id: '4',
      domain: 'backlinko.com',
      citationScore: 82,
      citationFrequency: 19,
      market: 'US',
      category: 'SEO & Link Building',
      actionBucket: 'Editorial Pitch',
      status: 'Identified',
      avgWordCount: 2450,
      schemaTypes: ['TechArticle'],
      contactEmail: 'team@backlinko.com',
      sampleUrl: 'https://backlinko.com/link-building-guide',
      pitchAngle: 'Hi Brian & Team,\n\nLove the link building hub. AI citation optimization is quickly becoming the #1 prerequisite for LLM answer mentions. Happy to share our 2026 citation audit checklist.',
      competitorsCited: ['Siege Media', 'Page One Power'],
    },
  ];

  const sampleGridData: CoverageGridCell[] = [
    {
      prompt: 'Best AI local SEO agency London UK',
      category: 'Local SEO',
      engines: {
        Gemini: { rank: 1, sentiment: 'positive' },
        ChatGPT: { rank: 1, sentiment: 'positive' },
        Perplexity: { rank: 2, sentiment: 'positive' },
        Claude: { rank: 1, sentiment: 'neutral' },
      },
    },
    {
      prompt: 'Top B2B link building agencies for SaaS 2026',
      category: 'Link Building',
      engines: {
        Gemini: { rank: 2, sentiment: 'positive' },
        ChatGPT: { rank: 1, sentiment: 'positive' },
        Perplexity: { rank: 1, sentiment: 'positive' },
        Claude: { rank: 3, sentiment: 'neutral' },
      },
    },
    {
      prompt: 'Generative engine optimization agency reviews',
      category: 'GEO Intelligence',
      engines: {
        Gemini: { rank: 1, sentiment: 'positive' },
        ChatGPT: { rank: 2, sentiment: 'positive' },
        Perplexity: { rank: 1, sentiment: 'positive' },
        Claude: { rank: null, sentiment: null },
      },
    },
    {
      prompt: 'Google maps 5x5 grid rank tracking tool',
      category: 'Grid Rank',
      engines: {
        Gemini: { rank: 1, sentiment: 'positive' },
        ChatGPT: { rank: 3, sentiment: 'positive' },
        Perplexity: { rank: 2, sentiment: 'neutral' },
        Claude: { rank: 2, sentiment: 'neutral' },
      },
    },
  ];

  const columns: Column<DomainTarget>[] = [
    {
      key: 'domain',
      header: 'Authority Domain',
      sortable: true,
      render: (item) => <DomainCell domain={item.domain} />,
    },
    {
      key: 'citationScore',
      header: 'Citation Score',
      sortable: true,
      align: 'right',
      render: (item) => (
        <span className="font-bold text-success tabular-nums">
          {item.citationScore} / 100
        </span>
      ),
    },
    {
      key: 'citationFrequency',
      header: 'Citations',
      sortable: true,
      align: 'right',
      render: (item) => (
        <span className="font-mono text-app-text tabular-nums">{item.citationFrequency}</span>
      ),
    },
    {
      key: 'actionBucket',
      header: 'Action Priority',
      render: (item) => (
        <Badge
          variant={
            item.actionBucket === 'High Priority'
              ? 'high-priority'
              : item.actionBucket === 'Quick Win'
              ? 'quick-win'
              : 'editorial'
          }
        >
          {item.actionBucket}
        </Badge>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (item) => (
        <Badge
          variant={
            item.status === 'Acquired'
              ? 'success'
              : item.status === 'In Discussion'
              ? 'warning'
              : item.status === 'Pitched'
              ? 'info'
              : 'neutral'
          }
          dot
        >
          {item.status}
        </Badge>
      ),
    },
  ];

  return (
    <div className="space-y-12">
      {/* Page Header */}
      <div className="border-b border-app-border pb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 radius-pill bg-brand/12 text-brand border border-brand/20 text-xs font-semibold">
              Digital4Local Design System v2.0
            </span>
          </div>
          <h1 className="font-display text-app-text">UI Tokens & Component Specs</h1>
          <p className="text-sm text-app-text-2 mt-1 max-w-2xl">
            Live interactive design system matching Digital4Local branding (Hex #1B64B5 Royal Blue & #68B82E Leaf Green).
            Calm, high-density, data-driven B2B analytics aesthetic with zero emoji and strict WCAG AA contrast.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            onClick={() => setSelectedSheetTarget(sampleTargets[0])}
            icon={<ExternalLink className="w-4 h-4" />}
          >
            Open Side Sheet (480px)
          </Button>
          <Button
            variant="primary"
            icon={<Sparkles className="w-4 h-4" />}
          >
            Run System Audit
          </Button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* SECTION 1: BRAND TOKENS & COLOR PALETTE                       */}
      {/* ------------------------------------------------------------- */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Palette className="w-4 h-4 text-brand" />
          <h2 className="font-h2 text-app-text">1. Color Palette & Semantic Tokens</h2>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          {/* Brand Primary */}
          <div className="p-3.5 bg-app-surface border border-app-border radius-card space-y-2">
            <div className="h-12 rounded bg-brand flex items-center justify-center text-white text-xs font-bold shadow-xs">
              #1B64B5
            </div>
            <div>
              <div className="text-xs font-semibold text-app-text">Brand Primary</div>
              <div className="text-[11px] text-app-text-3 font-mono">--brand (Digital Blue)</div>
            </div>
          </div>

          {/* Brand Accent */}
          <div className="p-3.5 bg-app-surface border border-app-border radius-card space-y-2">
            <div className="h-12 rounded bg-brand-accent flex items-center justify-center text-white text-xs font-bold shadow-xs">
              #68B82E
            </div>
            <div>
              <div className="text-xs font-semibold text-app-text">Brand Accent</div>
              <div className="text-[11px] text-app-text-3 font-mono">--brand-accent (Green)</div>
            </div>
          </div>

          {/* Surface */}
          <div className="p-3.5 bg-app-surface border border-app-border radius-card space-y-2">
            <div className="h-12 rounded bg-app-surface-2 border border-app-border flex items-center justify-center text-app-text text-xs font-bold">
              Surface 2
            </div>
            <div>
              <div className="text-xs font-semibold text-app-text">Surface Elevation</div>
              <div className="text-[11px] text-app-text-3 font-mono">--surface-2 (#161A23)</div>
            </div>
          </div>

          {/* Success */}
          <div className="p-3.5 bg-app-surface border border-app-border radius-card space-y-2">
            <div className="h-12 rounded bg-success flex items-center justify-center text-white text-xs font-bold shadow-xs">
              #22C55E
            </div>
            <div>
              <div className="text-xs font-semibold text-app-text">Success / Win</div>
              <div className="text-[11px] text-app-text-3 font-mono">--success</div>
            </div>
          </div>

          {/* Warning */}
          <div className="p-3.5 bg-app-surface border border-app-border radius-card space-y-2">
            <div className="h-12 rounded bg-warning flex items-center justify-center text-slate-950 text-xs font-bold shadow-xs">
              #F5A524
            </div>
            <div>
              <div className="text-xs font-semibold text-app-text">Warning / In Progress</div>
              <div className="text-[11px] text-app-text-3 font-mono">--warning</div>
            </div>
          </div>

          {/* Danger */}
          <div className="p-3.5 bg-app-surface border border-app-border radius-card space-y-2">
            <div className="h-12 rounded bg-danger flex items-center justify-center text-white text-xs font-bold shadow-xs">
              #EF4444
            </div>
            <div>
              <div className="text-xs font-semibold text-app-text">Danger / Lost</div>
              <div className="text-[11px] text-app-text-3 font-mono">--danger</div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* SECTION 2: TYPOGRAPHY SCALE & NUMERIC SPEC                    */}
      {/* ------------------------------------------------------------- */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Type className="w-4 h-4 text-brand-accent" />
          <h2 className="font-h2 text-app-text">2. Typography Scale (Plus Jakarta Sans)</h2>
        </div>

        <div className="p-6 bg-app-surface border border-app-border radius-card space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-baseline border-b border-app-border/40 pb-4">
            <span className="text-xs text-app-text-3 font-mono">Display (40/48 semibold)</span>
            <div className="md:col-span-3 font-display text-app-text">
              Engineered for #1 AI Visibility & Citations
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-baseline border-b border-app-border/40 pb-4">
            <span className="text-xs text-app-text-3 font-mono">Heading 1 (28/36 semibold)</span>
            <div className="md:col-span-3 font-h1 text-app-text">
              Reverse-Engineer Google Gemini Citations
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-baseline border-b border-app-border/40 pb-4">
            <span className="text-xs text-app-text-3 font-mono">Heading 2 (20/28 semibold)</span>
            <div className="md:col-span-3 font-h2 text-app-text">
              Domain Citation-Worthiness Intelligence
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-baseline border-b border-app-border/40 pb-4">
            <span className="text-xs text-app-text-3 font-mono">Heading 3 (16/24 medium)</span>
            <div className="md:col-span-3 font-h3 text-app-text">
              Active Outreach & Citation Gap Opportunities
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-baseline border-b border-app-border/40 pb-4">
            <span className="text-xs text-app-text-3 font-mono">Body (14/22 regular)</span>
            <div className="md:col-span-3 font-body text-app-text-2">
              Analyzes on-page freshness, table schema structures, author bylines, and content depth to compute 0-100 citation-worthiness without expensive third-party scrapers.
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-baseline">
            <span className="text-xs text-app-text-3 font-mono">Tabular Numeric (32/36 semibold)</span>
            <div className="md:col-span-3 font-metric text-app-text flex items-center gap-6">
              <span>94.2%</span>
              <span className="text-brand-accent">#1.4</span>
              <span className="text-success">+340%</span>
              <span className="text-app-text-3 text-lg font-normal font-mono">
                font-variant-numeric: tabular-nums
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* SECTION 3: BUTTONS & ACTION CONTROLS                          */}
      {/* ------------------------------------------------------------- */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-info" />
          <h2 className="font-h2 text-app-text">3. Button Variants & Interaction States</h2>
        </div>

        <div className="p-6 bg-app-surface border border-app-border radius-card space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary" icon={<Sparkles className="w-4 h-4" />}>
              Primary Button (Brand Fill)
            </Button>
            <Button variant="accent" icon={<CheckCircle2 className="w-4 h-4" />}>
              Accent Action (Leaf Green)
            </Button>
            <Button variant="secondary" icon={<ExternalLink className="w-4 h-4" />}>
              Secondary Button
            </Button>
            <Button variant="ghost">
              Ghost Button
            </Button>
            <Button variant="destructive" icon={<ShieldAlert className="w-4 h-4" />}>
              Destructive
            </Button>
            <Button variant="primary" isLoading>
              Saving Changes...
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-app-border/40">
            <Button variant="primary" size="sm">
              Small (h-8)
            </Button>
            <Button variant="primary" size="md">
              Medium (h-9 Default)
            </Button>
            <Button variant="primary" size="lg">
              Large (h-11)
            </Button>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* SECTION 4: METRIC CARDS & RADIAL GAUGE                        */}
      {/* ------------------------------------------------------------- */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Award className="w-4 h-4 text-warning" />
          <h2 className="font-h2 text-app-text">4. Metric Cards & Radial Score Gauge</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Radial Gauge */}
          <RadialGauge
            score={86}
            shareOfVoice={48.2}
            avgPosition={1.4}
            citationShare={72.5}
          />

          {/* 2 Metric Cards */}
          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <MetricCard
              label="Share of Voice"
              value="48.2"
              suffix="%"
              delta={12.4}
              deltaLabel="vs previous run"
              tooltip="Percentage of tracked buyer queries where Digital4Local was cited as a top recommendation."
              sparklineData={[32, 35, 38, 41, 45, 48]}
            />
            <MetricCard
              label="Active Citation Targets"
              value="142"
              delta={8.0}
              deltaLabel="vs last month"
              tooltip="High-authority publishing domains citing your niche competitors."
              sparklineData={[110, 118, 125, 134, 142]}
            />
            <MetricCard
              label="Average Recommendation Rank"
              value="#1.4"
              delta={-0.3}
              deltaLabel="improvement"
              tooltip="Average position of client brand within Gemini and ChatGPT generated answers."
              sparklineData={[2.2, 1.9, 1.8, 1.6, 1.4]}
            />
            <MetricCard
              label="Outreach Conversion Rate"
              value="24.6"
              suffix="%"
              delta={4.2}
              deltaLabel="vs industry avg"
              tooltip="Percentage of pitched authority domains resulting in acquired links or brand citations."
              sparklineData={[18, 19, 21, 22, 24.6]}
            />
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* SECTION 5: SANKEY CITATION FLOW VISUAL                        */}
      {/* ------------------------------------------------------------- */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-brand" />
          <h2 className="font-h2 text-app-text">5. Sankey Citation Flow Diagram</h2>
        </div>

        <SankeyCitationFlow
          onSelectDomain={(dom) => {
            const found = sampleTargets.find((t) => t.domain === dom);
            if (found) setSelectedSheetTarget(found);
          }}
        />
      </section>

      {/* ------------------------------------------------------------- */}
      {/* SECTION 6: PROMPT COVERAGE GEO MATRIX                         */}
      {/* ------------------------------------------------------------- */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-brand-accent" />
          <h2 className="font-h2 text-app-text">6. Prompt Coverage GEO Matrix (5x5 Heatmap)</h2>
        </div>

        <PromptCoverageGrid data={sampleGridData} />
      </section>

      {/* ------------------------------------------------------------- */}
      {/* SECTION 7: DATA TABLE WITH BULK ACTIONS                       */}
      {/* ------------------------------------------------------------- */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Send className="w-4 h-4 text-success" />
          <h2 className="font-h2 text-app-text">7. Data Table & Bulk Action Bar</h2>
        </div>

        <DataTable
          title="Authority Link Targets"
          data={sampleTargets}
          columns={columns}
          keyExtractor={(item) => item.id}
          onRowClick={(item) => setSelectedSheetTarget(item)}
          onBulkAction={(action, ids) => {
            alert(`Executed ${action} on ${ids.length} selected domains.`);
          }}
        />
      </section>

      {/* Side Sheet Component */}
      <SideSheet
        target={selectedSheetTarget}
        isOpen={Boolean(selectedSheetTarget)}
        onClose={() => setSelectedSheetTarget(null)}
      />
    </div>
  );
};
