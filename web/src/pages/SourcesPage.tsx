import React, { useState } from 'react';
import { Layers, Download, Sparkles, Filter, Play, ExternalLink, ShieldCheck, ArrowRight } from 'lucide-react';
import { DataTable, Column } from '../components/DataTable';
import { Badge } from '../components/Badge';
import { DomainCell } from '../components/DomainCell';
import { Button } from '../components/Button';
import { SideSheet } from '../components/SideSheet';
import { useAudit } from '../context/AuditContext';
import type { DomainTarget } from '../types';

export interface SourcesPageProps {
  onNavigateToOutreach: () => void;
}

export const SourcesPage: React.FC<SourcesPageProps> = ({
  onNavigateToOutreach,
}) => {
  const { auditResult, clientName, markets, runAudit, isLoading, generatePitches, downloadExcelReport } = useAudit();
  const [selectedTarget, setSelectedTarget] = useState<DomainTarget | null>(null);
  const [selectedMarket, setSelectedMarket] = useState<string>('All');
  const [selectedPriority, setSelectedPriority] = useState<string>('All');

  // Convert real audit table to DomainTarget[] format
  const activeSources: DomainTarget[] = React.useMemo(() => {
    if (!auditResult?.table || !auditResult.table.length) return [];
    return auditResult.table.map((item, idx) => {
      const pScore = item.priority_score || item.citation_worthiness_score || 80;
      const bucket: DomainTarget['actionBucket'] =
        pScore >= 80 ? 'High Priority' : pScore >= 60 ? 'Quick Win' : item.action.toLowerCase().includes('directory') ? 'Directory' : 'Editorial Pitch';

      return {
        id: `source-${idx}-${item.domain}`,
        domain: item.domain,
        citationScore: pScore,
        citationFrequency: item.citations || 1,
        market: markets[0] || 'UK & Global',
        category: item.action || 'Authority Editorial',
        actionBucket: bucket,
        status: 'Identified',
        avgWordCount: 1650,
        schemaTypes: ['Article', 'Organization'],
        contactEmail: item.contact || `editorial@${item.domain}`,
        sampleUrl: item.top_urls?.split('\n')[0] || `https://${item.domain}`,
        pitchAngle: item.best_pitch_type || `Resource Link & Editorial Citation for ${clientName}`,
        competitorsCited: [],
      };
    });
  }, [auditResult, markets, clientName]);

  const filteredSources = activeSources.filter((s) => {
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
            item.citationScore >= 80
              ? 'text-brand-accent'
              : item.citationScore >= 60
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
      header: 'LLM Citations',
      sortable: true,
      align: 'right',
      render: (item) => (
        <span className="font-mono text-app-text tabular-nums font-semibold">{item.citationFrequency}</span>
      ),
    },
    {
      key: 'market',
      header: 'Target Market',
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
      header: 'Outreach Stage',
      render: (item) => (
        <Badge variant="neutral" dot>
          {item.status}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (item) => (
        <div className="flex items-center justify-end gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedTarget(item);
            }}
            icon={<Sparkles className="w-3 h-3 text-brand" />}
          >
            Inspect
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              const tableMatch = auditResult?.table.find((t) => t.domain === item.domain);
              if (tableMatch) generatePitches([tableMatch]);
              onNavigateToOutreach();
            }}
          >
            Draft Pitch
          </Button>
        </div>
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
            <h1 className="font-h1 text-app-text">
              Cited Sources & Authority Targets {clientName ? `· ${clientName}` : ''}
            </h1>
          </div>
          <p className="text-xs text-app-text-2">
            Discovered publisher domains cited by Google Gemini Search Grounding for <strong>{clientName}</strong>.
          </p>
        </div>

        {/* Filter Chips & Action */}
        <div className="flex items-center gap-2">
          {activeSources.length > 0 && (
            <Button
              variant="secondary"
              size="sm"
              onClick={downloadExcelReport}
              icon={<Download className="w-3.5 h-3.5" />}
            >
              Export (.xlsx)
            </Button>
          )}

          <select
            value={selectedPriority}
            onChange={(e) => setSelectedPriority(e.target.value)}
            className="h-9 px-3 bg-app-surface-2 border border-app-border radius-input text-xs text-app-text focus:outline-none focus:border-brand"
          >
            <option value="All">All Priorities ({activeSources.length})</option>
            <option value="High Priority">High Priority</option>
            <option value="Quick Win">Quick Win</option>
            <option value="Editorial Pitch">Editorial Pitch</option>
            <option value="Directory">Directory</option>
          </select>
        </div>
      </div>

      {/* If No Audit Run Yet */}
      {activeSources.length === 0 ? (
        <div className="bg-app-surface border border-app-border radius-card p-8 md:p-12 text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-brand/15 text-brand flex items-center justify-center mx-auto">
            <Layers className="w-6 h-6" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="font-h2 text-app-text">No Cited Sources Yet for {clientName}</h3>
            <p className="text-xs text-app-text-2">
              Launch the citation prospector to reverse-engineer live publisher links citing your niche in Google Gemini.
            </p>
          </div>
          <Button
            variant="primary"
            size="md"
            onClick={runAudit}
            isLoading={isLoading}
            icon={<Play className="w-4 h-4" />}
          >
            Run Citation Audit Now
          </Button>
        </div>
      ) : (
        <>
          {/* Main Table */}
          <DataTable
            title={`Discovered Authority Domains (${filteredSources.length})`}
            data={filteredSources}
            columns={columns}
            keyExtractor={(item) => item.id}
            onRowClick={(item) => setSelectedTarget(item)}
            onBulkAction={(action, ids) => {
              const selectedItems = auditResult?.table.filter((t) => ids.includes(t.domain)) || [];
              if (selectedItems.length) generatePitches(selectedItems);
              onNavigateToOutreach();
            }}
          />

          {/* Side Sheet */}
          <SideSheet
            target={selectedTarget}
            isOpen={Boolean(selectedTarget)}
            onClose={() => setSelectedTarget(null)}
            onGeneratePitch={() => {
              if (selectedTarget && auditResult) {
                const tableMatch = auditResult.table.find((t) => t.domain === selectedTarget.domain);
                if (tableMatch) generatePitches([tableMatch]);
              }
              setSelectedTarget(null);
              onNavigateToOutreach();
            }}
          />
        </>
      )}
    </div>
  );
};
