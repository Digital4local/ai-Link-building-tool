import React, { useState, useMemo } from 'react';
import {
  Send,
  Kanban,
  Table as TableIcon,
  Copy,
  Check,
  Sparkles,
  ExternalLink,
  Plus,
  Mail,
  ChevronDown,
  ChevronUp,
  Play,
  Download,
} from 'lucide-react';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import { DomainCell } from '../components/DomainCell';
import { DataTable, Column } from '../components/DataTable';
import { useAudit } from '../context/AuditContext';
import type { DomainTarget } from '../types';

export interface OutreachTargetItem {
  id: string;
  domain: string;
  sampleUrl: string;
  citationScore: number;
  market: string;
  actionBucket: 'High Priority' | 'Quick Win' | 'Editorial Pitch' | 'Directory';
  status: 'Identified' | 'Pitched' | 'In Discussion' | 'Acquired' | 'Declined';
  pitchType: string;
  subject: string;
  emailBody: string;
  suggestedAnchor: string;
  suggestedSentence: string;
}

export const OutreachPage: React.FC = () => {
  const {
    auditResult,
    pitches,
    generatePitches,
    clientName,
    clientDomain,
    service,
    markets,
    runAudit,
    isLoading,
    downloadExcelReport,
  } = useAudit();

  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedPitchId, setExpandedPitchId] = useState<string | null>(null);
  const [targetStatuses, setTargetStatuses] = useState<Record<string, DomainTarget['status']>>({});

  const statuses: DomainTarget['status'][] = [
    'Identified',
    'Pitched',
    'In Discussion',
    'Acquired',
    'Declined',
  ];

  // Merge auditResult.table and generated pitches
  const outreachTargets: OutreachTargetItem[] = useMemo(() => {
    if (!auditResult?.table || !auditResult.table.length) return [];

    return auditResult.table.map((item, idx) => {
      const pScore = item.priority_score || item.citation_worthiness_score || 80;
      const bucket: OutreachTargetItem['actionBucket'] =
        pScore >= 80 ? 'High Priority' : pScore >= 60 ? 'Quick Win' : 'Editorial Pitch';

      // Find matching pitch if generated
      const pitchMatch = pitches.find((p) => p.domain === item.domain || (p.url && item.top_urls?.includes(p.url)));

      const pitchType = pitchMatch?.pitch_type || item.best_pitch_type || 'Resource Inclusion';
      const subject =
        pitchMatch?.subject ||
        `Quick addition for your ${service} guide — citation resource`;
      const emailBody =
        pitchMatch?.email ||
        `Hi Editorial Team,\n\nI noticed your comprehensive guide on ${service}. We recently published an in-depth benchmark analysis for ${clientName} (${clientDomain}) that provides verified performance data.\n\nWould this make a valuable citation addition for your readers?\n\nBest regards,\n${clientName} Team`;

      const id = `target-${idx}-${item.domain}`;
      const currentStatus = targetStatuses[id] || 'Identified';

      return {
        id,
        domain: item.domain,
        sampleUrl: item.top_urls?.split('\n')[0] || `https://${item.domain}`,
        citationScore: pScore,
        market: markets[0] || 'UK & Global',
        actionBucket: bucket,
        status: currentStatus,
        pitchType,
        subject,
        emailBody,
        suggestedAnchor: pitchMatch?.suggested_anchor || `${clientName} ${service}`,
        suggestedSentence: pitchMatch?.suggested_sentence || `According to benchmark data from ${clientName}...`,
      };
    });
  }, [auditResult, pitches, clientName, clientDomain, service, markets, targetStatuses]);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const updateStatus = (id: string, nextStatus: DomainTarget['status']) => {
    setTargetStatuses((prev) => ({ ...prev, [id]: nextStatus }));
  };

  const handleGenerateAllPitches = async () => {
    if (auditResult?.table) {
      await generatePitches(auditResult.table.slice(0, 15));
    }
  };

  const columns: Column<OutreachTargetItem>[] = [
    {
      key: 'domain',
      header: 'Target Authority Domain',
      sortable: true,
      render: (item) => <DomainCell domain={item.domain} url={item.sampleUrl} />,
    },
    {
      key: 'citationScore',
      header: 'Score',
      sortable: true,
      align: 'right',
      render: (item) => (
        <span className="font-bold text-success text-xs tabular-nums">
          {item.citationScore} / 100
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (item) => (
        <select
          value={item.status}
          onChange={(e) => updateStatus(item.id, e.target.value as any)}
          className="h-8 px-2 bg-app-surface-2 border border-app-border radius-badge text-xs text-app-text focus:outline-none focus:border-brand"
        >
          {statuses.map((st) => (
            <option key={st} value={st}>
              {st}
            </option>
          ))}
        </select>
      ),
    },
    {
      key: 'emailBody',
      header: 'Tailored Outreach Pitch',
      render: (item) => (
        <div className="space-y-1.5 max-w-md">
          <p className="text-xs text-app-text line-clamp-1 font-mono">
            {item.subject}
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleCopy(item.id, `Subject: ${item.subject}\n\n${item.emailBody}`);
            }}
            icon={copiedId === item.id ? <Check className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
          >
            {copiedId === item.id ? 'Copied Full Pitch' : 'Copy Pitch'}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Page Header & View Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-app-border pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 rounded-md bg-success/15 text-success flex items-center justify-center">
              <Send className="w-3.5 h-3.5" />
            </div>
            <h1 className="font-h1 text-app-text">Outreach & Pitch Intelligence</h1>
          </div>
          <p className="text-xs text-app-text-2">
            AI-crafted, zero-fluff outreach pitches tailored for <strong>{clientName}</strong> citation inclusion.
          </p>
        </div>

        {/* Action Controls & View Switcher */}
        <div className="flex items-center gap-2 flex-wrap">
          {outreachTargets.length > 0 && (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleGenerateAllPitches}
                isLoading={isLoading}
                icon={<Sparkles className="w-3.5 h-3.5 text-brand-accent" />}
              >
                Synthesize AI Pitches
              </Button>

              <Button
                variant="secondary"
                size="sm"
                onClick={downloadExcelReport}
                icon={<Download className="w-3.5 h-3.5" />}
              >
                Export Worklist (.xlsx)
              </Button>
            </>
          )}

          <div className="flex items-center bg-app-surface-2 p-1 radius-input border border-app-border">
            <button
              onClick={() => setViewMode('kanban')}
              className={`px-3 py-1.5 text-xs font-medium radius-badge flex items-center gap-1.5 transition-colors ${
                viewMode === 'kanban'
                  ? 'bg-app-surface text-brand font-semibold shadow-xs'
                  : 'text-app-text-3 hover:text-app-text'
              }`}
            >
              <Kanban className="w-3.5 h-3.5" />
              Kanban Board
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 text-xs font-medium radius-badge flex items-center gap-1.5 transition-colors ${
                viewMode === 'table'
                  ? 'bg-app-surface text-brand font-semibold shadow-xs'
                  : 'text-app-text-3 hover:text-app-text'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              Table View
            </button>
          </div>
        </div>
      </div>

      {/* If No Targets Available */}
      {outreachTargets.length === 0 ? (
        <div className="bg-app-surface border border-app-border radius-card p-8 md:p-12 text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-success/15 text-success flex items-center justify-center mx-auto">
            <Send className="w-6 h-6" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="font-h2 text-app-text">No Outreach Targets in Queue</h3>
            <p className="text-xs text-app-text-2">
              Run the citation audit to discover high-authority publishers and automatically draft link inclusion pitches for <strong>{clientName}</strong>.
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
          {/* Kanban View */}
          {viewMode === 'kanban' && (
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 overflow-x-auto pb-4">
              {statuses.map((status) => {
                const statusTargets = outreachTargets.filter((t) => t.status === status);

                return (
                  <div
                    key={status}
                    className="bg-app-surface-2/60 border border-app-border radius-card p-3 flex flex-col min-w-[260px] space-y-3"
                  >
                    {/* Column Header */}
                    <div className="flex items-center justify-between pb-2 border-b border-app-border/60">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            status === 'Acquired'
                              ? 'bg-success'
                              : status === 'In Discussion'
                              ? 'bg-warning'
                              : status === 'Pitched'
                              ? 'bg-info'
                              : status === 'Declined'
                              ? 'bg-danger'
                              : 'bg-app-text-3'
                          }`}
                        />
                        <h3 className="text-xs font-semibold text-app-text">{status}</h3>
                      </div>
                      <span className="text-[11px] px-1.5 py-0.2 radius-pill bg-app-surface border border-app-border text-app-text-3 font-mono">
                        {statusTargets.length}
                      </span>
                    </div>

                    {/* Cards */}
                    <div className="space-y-3 flex-1">
                      {statusTargets.map((item) => (
                        <div
                          key={item.id}
                          className="bg-app-surface border border-app-border hover:border-app-border-strong radius-input p-3 shadow-xs space-y-2.5 transition-all group"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <DomainCell domain={item.domain} url={item.sampleUrl} />
                            <span className="font-bold text-success text-[11px] tabular-nums shrink-0">
                              {item.citationScore}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <Badge variant={item.actionBucket === 'High Priority' ? 'high-priority' : 'quick-win'} size="sm">
                              {item.actionBucket}
                            </Badge>
                            <span className="text-[10px] text-app-text-3 font-mono">{item.pitchType}</span>
                          </div>

                          {/* Expandable Pitch Preview */}
                          <div className="pt-2 border-t border-app-border/40">
                            <button
                              onClick={() =>
                                setExpandedPitchId(expandedPitchId === item.id ? null : item.id)
                              }
                              className="w-full flex items-center justify-between text-[11px] text-app-text-3 hover:text-brand font-medium"
                            >
                              <span className="flex items-center gap-1 truncate">
                                <Sparkles className="w-3 h-3 text-brand shrink-0" />
                                <span className="truncate">{item.subject}</span>
                              </span>
                              {expandedPitchId === item.id ? (
                                <ChevronUp className="w-3 h-3 shrink-0" />
                              ) : (
                                <ChevronDown className="w-3 h-3 shrink-0" />
                              )}
                            </button>

                            {expandedPitchId === item.id && (
                              <div className="mt-2 p-2 bg-app-surface-2 rounded text-[11px] text-app-text font-mono whitespace-pre-wrap leading-relaxed border border-app-border space-y-2">
                                <div>
                                  <strong className="text-brand block">Subject:</strong>
                                  <span>{item.subject}</span>
                                </div>
                                <div>
                                  <strong className="text-brand block">Email Draft:</strong>
                                  <p>{item.emailBody}</p>
                                </div>
                                {item.suggestedAnchor && (
                                  <div>
                                    <strong className="text-brand-accent block">Suggested Anchor:</strong>
                                    <span>"{item.suggestedAnchor}"</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Bottom Action / Status Mover */}
                          <div className="flex items-center justify-between pt-1 gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCopy(item.id, `Subject: ${item.subject}\n\n${item.emailBody}`)}
                              icon={copiedId === item.id ? <Check className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
                            >
                              {copiedId === item.id ? 'Copied' : 'Copy'}
                            </Button>

                            <select
                              value={item.status}
                              onChange={(e) => updateStatus(item.id, e.target.value as any)}
                              className="h-6 px-1.5 bg-app-surface-2 border border-app-border rounded text-[10px] text-app-text-2 focus:outline-none"
                            >
                              {statuses.map((st) => (
                                <option key={st} value={st}>
                                  → {st}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      ))}

                      {statusTargets.length === 0 && (
                        <div className="p-4 text-center text-[11px] text-app-text-3 border border-dashed border-app-border/60 rounded">
                          No targets in this column.
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Table View */}
          {viewMode === 'table' && (
            <DataTable
              title={`Outreach Campaign Queue (${outreachTargets.length})`}
              data={outreachTargets}
              columns={columns}
              keyExtractor={(item) => item.id}
            />
          )}
        </>
      )}
    </div>
  );
};
