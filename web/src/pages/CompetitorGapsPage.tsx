import React, { useState } from 'react';
import { ArrowRightLeft, Sparkles, Send, ExternalLink, ShieldAlert } from 'lucide-react';
import { DataTable, Column } from '../components/DataTable';
import { Badge } from '../components/Badge';
import { DomainCell } from '../components/DomainCell';
import { Button } from '../components/Button';
import { mockCompetitorGaps } from '../data/mockData';
import type { CompetitorGapItem } from '../data/mockData';

export interface CompetitorGapsPageProps {
  onNavigateToOutreach: () => void;
}

export const CompetitorGapsPage: React.FC<CompetitorGapsPageProps> = ({
  onNavigateToOutreach,
}) => {
  const [selectedCompetitor, setSelectedCompetitor] = useState<string>('All');

  const filteredGaps = mockCompetitorGaps.filter((g) => {
    if (selectedCompetitor !== 'All' && g.competitorCited !== selectedCompetitor) return false;
    return true;
  });

  const columns: Column<CompetitorGapItem>[] = [
    {
      key: 'domain',
      header: 'Authority Domain',
      sortable: true,
      render: (item) => <DomainCell domain={item.domain} url={item.url} />,
    },
    {
      key: 'competitorCited',
      header: 'Competitor Cited',
      sortable: true,
      render: (item) => (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 radius-badge bg-danger/10 text-danger border border-danger/20 text-xs font-semibold">
          {item.competitorCited}
        </span>
      ),
    },
    {
      key: 'topic',
      header: 'Citation Topic / Context',
      render: (item) => (
        <span className="text-xs text-app-text font-medium">{item.topic}</span>
      ),
    },
    {
      key: 'citationScore',
      header: 'Citation Score',
      sortable: true,
      align: 'right',
      render: (item) => (
        <span className="font-bold text-success font-metric text-xs tabular-nums">
          {item.citationScore} / 100
        </span>
      ),
    },
    {
      key: 'opportunityType',
      header: 'Opportunity Pitch',
      render: (item) => (
        <Badge
          variant={
            item.opportunityType === 'List Inclusion'
              ? 'quick-win'
              : item.opportunityType === 'Editorial Comparison'
              ? 'high-priority'
              : 'editorial'
          }
        >
          {item.opportunityType}
        </Badge>
      ),
    },
    {
      key: 'estTraffic',
      header: 'Est. Traffic',
      sortable: true,
      align: 'right',
      render: (item) => (
        <span className="font-mono text-app-text-2 tabular-nums">{item.estTraffic}</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (item) => (
        <Button
          variant="primary"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onNavigateToOutreach();
          }}
          icon={<Send className="w-3 h-3" />}
        >
          Write Pitch
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
            <div className="w-6 h-6 rounded-md bg-warning/15 text-warning flex items-center justify-center">
              <ArrowRightLeft className="w-3.5 h-3.5" />
            </div>
            <h1 className="font-h1 text-app-text">Competitor Citation Gaps</h1>
          </div>
          <p className="text-xs text-app-text-2">
            Exact URLs citing competitors where Digital4Local is currently missing.
          </p>
        </div>

        {/* Competitor Filter Dropdown */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-app-text-3 font-medium">Filter Competitor:</span>
          <select
            value={selectedCompetitor}
            onChange={(e) => setSelectedCompetitor(e.target.value)}
            className="h-9 px-3 bg-app-surface-2 border border-app-border radius-input text-xs text-app-text focus:outline-none focus:border-brand"
          >
            <option value="All">All Competitors (34 Gaps)</option>
            <option value="FatJoe">FatJoe</option>
            <option value="Siege Media">Siege Media</option>
            <option value="Page One Power">Page One Power</option>
            <option value="The HOTH">The HOTH</option>
          </select>
        </div>
      </div>

      {/* KPI Highlight Card */}
      <div className="p-4 bg-brand/5 border border-brand/20 radius-card flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-brand/15 text-brand flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <strong className="text-app-text block font-semibold">
              34 High-Intent Citation Opportunities Detected
            </strong>
            <span className="text-app-text-2">
              Closing these top 5 competitor gaps can increase AI Share of Voice by +18.4%.
            </span>
          </div>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={onNavigateToOutreach}
          icon={<Send className="w-3.5 h-3.5" />}
        >
          Draft All 34 Pitches
        </Button>
      </div>

      {/* Main Table */}
      <DataTable
        title="Active Competitor Gaps"
        data={filteredGaps}
        columns={columns}
        keyExtractor={(item) => item.id}
        onBulkAction={(action, ids) => {
          onNavigateToOutreach();
        }}
      />
    </div>
  );
};
