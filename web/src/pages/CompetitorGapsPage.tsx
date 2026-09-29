import React, { useState, useMemo } from 'react';
import { ArrowRightLeft, Sparkles, Send, Play, ExternalLink, ShieldAlert } from 'lucide-react';
import { DataTable, Column } from '../components/DataTable';
import { Badge } from '../components/Badge';
import { DomainCell } from '../components/DomainCell';
import { Button } from '../components/Button';
import { useAudit } from '../context/AuditContext';

export interface GapRow {
  id: string;
  domain: string;
  url: string;
  competitorCited: string;
  topic: string;
  citationScore: number;
  opportunityType: string;
  estTraffic: string;
}

export interface CompetitorGapsPageProps {
  onNavigateToOutreach: () => void;
}

export const CompetitorGapsPage: React.FC<CompetitorGapsPageProps> = ({
  onNavigateToOutreach,
}) => {
  const { auditResult, clientName, competitors, runAudit, generatePitches, isLoading } = useAudit();
  const [selectedCompetitor, setSelectedCompetitor] = useState<string>('All');

  // Parse competitors list
  const competitorNames = useMemo(() => {
    return competitors
      .split('\n')
      .map((l) => l.split('|')[0].trim())
      .filter(Boolean);
  }, [competitors]);

  // Construct real gaps from auditResult
  const activeGaps: GapRow[] = useMemo(() => {
    if (!auditResult) return [];

    const gaps: GapRow[] = [];

    // 1. From explicit competitor_gaps in auditResult
    if (auditResult.competitor_gaps && auditResult.competitor_gaps.length) {
      auditResult.competitor_gaps.forEach((g, idx) => {
        const comp = g.winning_competitors?.join(', ') || 'Competitor';
        const src = g.cited_sources?.[0] || 'authority-source.com';
        const domain = src.replace(/^https?:\/\//, '').split('/')[0];
        gaps.push({
          id: `gap-${idx}-${domain}`,
          domain: domain,
          url: src.startsWith('http') ? src : `https://${src}`,
          competitorCited: comp,
          topic: g.prompt,
          citationScore: 85,
          opportunityType: g.prompt.toLowerCase().includes('best') ? 'List Inclusion' : 'Editorial Comparison',
          estTraffic: 'Top Cited',
        });
      });
    }

    // 2. From table records where cited_where_competitor_wins > 0 or competitor_gap_pages > 0
    if (auditResult.table && auditResult.table.length) {
      auditResult.table.forEach((item, idx) => {
        if (item.cited_where_competitor_wins > 0 || item.competitor_gap_pages > 0) {
          const firstUrl = item.top_urls?.split('\n')[0] || `https://${item.domain}`;
          const compName = competitorNames[idx % competitorNames.length] || 'Industry Competitor';
          // Avoid duplicate domain in gaps
          if (!gaps.some((g) => g.domain === item.domain)) {
            gaps.push({
              id: `gap-table-${idx}-${item.domain}`,
              domain: item.domain,
              url: firstUrl,
              competitorCited: compName,
              topic: item.action || `High-value recommendation query`,
              citationScore: item.priority_score || 80,
              opportunityType: item.best_pitch_type || 'Resource Link / Inclusion',
              estTraffic: `${item.citations} Cites`,
            });
          }
        }
      });
    }

    return gaps;
  }, [auditResult, competitorNames]);

  const filteredGaps = activeGaps.filter((g) => {
    if (selectedCompetitor !== 'All' && !g.competitorCited.toLowerCase().includes(selectedCompetitor.toLowerCase())) {
      return false;
    }
    return true;
  });

  const handleDraftAllPitches = () => {
    if (auditResult?.table) {
      generatePitches(auditResult.table.slice(0, 10));
    }
    onNavigateToOutreach();
  };

  const columns: Column<GapRow>[] = [
    {
      key: 'domain',
      header: 'Authority Domain',
      sortable: true,
      render: (item) => <DomainCell domain={item.domain} url={item.url} />,
    },
    {
      key: 'competitorCited',
      header: 'Competitor Mentioned',
      sortable: true,
      render: (item) => (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 radius-badge bg-danger/10 text-danger border border-danger/20 text-xs font-semibold">
          {item.competitorCited}
        </span>
      ),
    },
    {
      key: 'topic',
      header: 'Citation Query / Context',
      render: (item) => (
        <span className="text-xs text-app-text font-medium line-clamp-2">{item.topic}</span>
      ),
    },
    {
      key: 'citationScore',
      header: 'Priority Score',
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
      header: 'Opportunity Pitch Angle',
      render: (item) => (
        <Badge
          variant={
            item.opportunityType.includes('List')
              ? 'quick-win'
              : item.opportunityType.includes('Editorial')
              ? 'high-priority'
              : 'editorial'
          }
        >
          {item.opportunityType}
        </Badge>
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
            if (auditResult) {
              const tableMatch = auditResult.table.find((t) => t.domain === item.domain);
              if (tableMatch) generatePitches([tableMatch]);
            }
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
            Exact URLs citing competitors where <strong>{clientName}</strong> is currently missing.
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
            <option value="All">All Competitors ({activeGaps.length} Gaps)</option>
            {competitorNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* If No Audit Run Yet */}
      {activeGaps.length === 0 ? (
        <div className="bg-app-surface border border-app-border radius-card p-8 md:p-12 text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-warning/15 text-warning flex items-center justify-center mx-auto">
            <ArrowRightLeft className="w-6 h-6" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="font-h2 text-app-text">No Competitor Gaps Scanned Yet</h3>
            <p className="text-xs text-app-text-2">
              Run the citation prospector for <strong>{clientName}</strong> to cross-reference which publishers are recommending your competitors instead.
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
          {/* KPI Highlight Card */}
          <div className="p-4 bg-brand/5 border border-brand/20 radius-card flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-brand/15 text-brand flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <strong className="text-app-text block font-semibold">
                  {activeGaps.length} High-Intent Citation Opportunities Detected
                </strong>
                <span className="text-app-text-2">
                  Acquiring citations on these publisher URLs will directly contest competitor visibility in LLM queries.
                </span>
              </div>
            </div>

            <Button
              variant="primary"
              size="sm"
              onClick={handleDraftAllPitches}
              icon={<Send className="w-3.5 h-3.5" />}
            >
              Draft All Pitches
            </Button>
          </div>

          {/* Main Table */}
          <DataTable
            title={`Active Competitor Gaps (${filteredGaps.length})`}
            data={filteredGaps}
            columns={columns}
            keyExtractor={(item) => item.id}
            onBulkAction={() => handleDraftAllPitches()}
          />
        </>
      )}
    </div>
  );
};
