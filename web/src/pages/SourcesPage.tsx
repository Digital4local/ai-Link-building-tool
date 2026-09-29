import React, { useState } from 'react';
import { Layers, Download, SlidersHorizontal, Sparkles, Filter } from 'lucide-react';
import { DataTable, Column } from '../components/DataTable';
import { Badge } from '../components/Badge';
import { DomainCell } from '../components/DomainCell';
import { Button } from '../components/Button';
import { SideSheet } from '../components/SideSheet';
import { mockSources } from '../data/mockData';
import type { DomainTarget } from '../types';

export interface SourcesPageProps {
  onNavigateToOutreach: () => void;
}

export const SourcesPage: React.FC<SourcesPageProps> = ({
  onNavigateToOutreach,
}) => {
  const [selectedTarget, setSelectedTarget] = useState<DomainTarget | null>(null);
  const [selectedMarket, setSelectedMarket] = useState<string>('All');
  const [selectedPriority, setSelectedPriority] = useState<string>('All');

  const filteredSources = mockSources.filter((s) => {
    if (selectedMarket !== 'All' && !s.market.includes(selectedMarket)) return false;
    if (selectedPriority !== 'All' && s.actionBucket !== selectedPriority) return false;
    return true;
  });

  const columns: Column<DomainTarget>[] = [
    {
      key: 'domain',
      header: 'Authority Publishing Domain',
      sortable: true,
      render: (item) => <DomainCell domain={item.domain} url={item.sampleUrl} />,
    },
    {
      key: 'citationScore',
      header: 'Citation Score',
      sortable: true,
      align: 'right',
      render: (item) => (
        <span
          className={`font-bold font-metric text-xs tabular-nums ${
            item.citationScore >= 90
              ? 'text-brand-accent'
              : item.citationScore >= 80
              ? 'text-success'
              : 'text-warning'
          }`}
        >
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
      key: 'market',
      header: 'Market',
      sortable: true,
      render: (item) => (
        <span className="text-xs text-app-text-2 font-medium">{item.market}</span>
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
              : item.actionBucket === 'Directory'
              ? 'directory'
              : 'editorial'
          }
        >
          {item.actionBucket}
        </Badge>
      ),
    },
    {
      key: 'status',
      header: 'Outreach Status',
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
            setSelectedTarget(item);
          }}
          icon={<Sparkles className="w-3 h-3 text-brand" />}
        >
          Audit
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
            <div className="w-6 h-6 rounded-md bg-brand/15 text-brand flex items-center justify-center">
              <Layers className="w-3.5 h-3.5" />
            </div>
            <h1 className="font-h1 text-app-text">Cited Sources & Authority Targets</h1>
          </div>
          <p className="text-xs text-app-text-2">
            Reverse-engineered publisher domains cited by Google Gemini and ChatGPT for your niche.
          </p>
        </div>

        {/* Filter Chips */}
        <div className="flex items-center gap-2">
          <select
            value={selectedMarket}
            onChange={(e) => setSelectedMarket(e.target.value)}
            className="h-9 px-3 bg-app-surface-2 border border-app-border radius-input text-xs text-app-text focus:outline-none focus:border-brand"
          >
            <option value="All">All Markets</option>
            <option value="UK">United Kingdom</option>
            <option value="US">United States</option>
            <option value="Global">Global</option>
          </select>

          <select
            value={selectedPriority}
            onChange={(e) => setSelectedPriority(e.target.value)}
            className="h-9 px-3 bg-app-surface-2 border border-app-border radius-input text-xs text-app-text focus:outline-none focus:border-brand"
          >
            <option value="All">All Priorities</option>
            <option value="High Priority">High Priority</option>
            <option value="Quick Win">Quick Win</option>
            <option value="Editorial Pitch">Editorial Pitch</option>
            <option value="Directory">Directory</option>
          </select>
        </div>
      </div>

      {/* Main Table */}
      <DataTable
        title="Discovered Authority Domains"
        data={filteredSources}
        columns={columns}
        keyExtractor={(item) => item.id}
        onRowClick={(item) => setSelectedTarget(item)}
        onBulkAction={(action, ids) => {
          onNavigateToOutreach();
        }}
      />

      {/* Side Sheet */}
      <SideSheet
        target={selectedTarget}
        isOpen={Boolean(selectedTarget)}
        onClose={() => setSelectedTarget(null)}
        onGeneratePitch={() => {
          setSelectedTarget(null);
          onNavigateToOutreach();
        }}
      />
    </div>
  );
};
