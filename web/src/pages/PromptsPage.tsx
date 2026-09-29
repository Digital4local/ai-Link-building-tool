import React, { useState } from 'react';
import { Sparkles, Search, CheckCircle2, XCircle, Globe, BarChart2 } from 'lucide-react';
import { DataTable, Column } from '../components/DataTable';
import { Badge } from '../components/Badge';
import { DomainCell } from '../components/DomainCell';
import { Button } from '../components/Button';
import { mockPrompts } from '../data/mockData';
import type { PromptItem } from '../data/mockData';

export interface PromptsPageProps {
  onNavigateToAnswers: (prompt: string) => void;
}

export const PromptsPage: React.FC<PromptsPageProps> = ({
  onNavigateToAnswers,
}) => {
  const [selectedIntent, setSelectedIntent] = useState<string>('All');

  const filteredPrompts = mockPrompts.filter((p) => {
    if (selectedIntent !== 'All' && p.intent !== selectedIntent) return false;
    return true;
  });

  const columns: Column<PromptItem>[] = [
    {
      key: 'query',
      header: 'Buyer Query / Prompt',
      sortable: true,
      render: (item) => (
        <div className="space-y-0.5">
          <span className="font-semibold text-app-text text-xs hover:text-brand transition-colors block">
            "{item.query}"
          </span>
          <span className="text-[11px] text-app-text-3 font-mono">{item.category}</span>
        </div>
      ),
    },
    {
      key: 'intent',
      header: 'Intent',
      sortable: true,
      render: (item) => (
        <Badge variant={item.intent === 'Commercial' ? 'brand-accent' : 'info'}>
          {item.intent}
        </Badge>
      ),
    },
    {
      key: 'clientRank',
      header: 'Client Position',
      sortable: true,
      align: 'center',
      render: (item) =>
        item.clientRank ? (
          <span
            className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-bold ${
              item.clientRank === 1
                ? 'bg-[#10B981] text-slate-950 shadow-sm'
                : 'bg-[#68B82E] text-slate-950'
            }`}
          >
            #{item.clientRank}
          </span>
        ) : (
          <span className="text-xs text-app-text-3 opacity-40">—</span>
        ),
    },
    {
      key: 'enginesCitedCount',
      header: 'Engines Citing',
      sortable: true,
      align: 'right',
      render: (item) => (
        <span className="font-mono text-app-text tabular-nums font-semibold">
          {item.enginesCitedCount} / 4
        </span>
      ),
    },
    {
      key: 'searchVolume',
      header: 'Est. Search Vol',
      sortable: true,
      align: 'right',
      render: (item) => (
        <span className="font-mono text-app-text-2 tabular-nums">
          {item.searchVolume.toLocaleString()} /mo
        </span>
      ),
    },
    {
      key: 'topCitedDomains',
      header: 'Top Authority Citations',
      render: (item) => (
        <div className="flex items-center gap-1.5 flex-wrap">
          {item.topCitedDomains.map((d, i) => (
            <span
              key={i}
              className={`px-1.5 py-0.5 radius-badge text-[11px] font-mono border ${
                d.includes('digital4local')
                  ? 'bg-brand/12 text-brand border-brand/25 font-semibold'
                  : 'bg-app-surface-2 text-app-text-3 border-app-border'
              }`}
            >
              {d.replace('.com', '')}
            </span>
          ))}
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (item) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onNavigateToAnswers(item.query);
          }}
          icon={<Search className="w-3 h-3 text-brand" />}
        >
          View Answer
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-app-border pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 rounded-md bg-brand-accent/15 text-brand-accent flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <h1 className="font-h1 text-app-text">Prompt Intelligence & Coverage</h1>
          </div>
          <p className="text-xs text-app-text-2">
            Track exact user queries synthesized across Google Gemini and ChatGPT Search Grounding.
          </p>
        </div>

        {/* Intent filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-app-text-3 font-medium">Intent Filter:</span>
          <select
            value={selectedIntent}
            onChange={(e) => setSelectedIntent(e.target.value)}
            className="h-9 px-3 bg-app-surface-2 border border-app-border radius-input text-xs text-app-text focus:outline-none focus:border-brand"
          >
            <option value="All">All Intents (24 Prompts)</option>
            <option value="Commercial">Commercial High-Intent</option>
            <option value="Informational">Informational</option>
          </select>
        </div>
      </div>

      {/* Main Table */}
      <DataTable
        title="Synthesized Query Matrix"
        data={filteredPrompts}
        columns={columns}
        keyExtractor={(item) => item.id}
        onRowClick={(item) => onNavigateToAnswers(item.query)}
      />
    </div>
  );
};
