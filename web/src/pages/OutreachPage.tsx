import React, { useState } from 'react';
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
} from 'lucide-react';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import { DomainCell } from '../components/DomainCell';
import { DataTable, Column } from '../components/DataTable';
import { mockSources } from '../data/mockData';
import type { DomainTarget } from '../types';

export const OutreachPage: React.FC = () => {
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban');
  const [targets, setTargets] = useState<DomainTarget[]>(mockSources);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedPitchId, setExpandedPitchId] = useState<string | null>(null);

  const statuses: DomainTarget['status'][] = [
    'Identified',
    'Pitched',
    'In Discussion',
    'Acquired',
    'Declined',
  ];

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const updateStatus = (id: string, nextStatus: DomainTarget['status']) => {
    setTargets((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: nextStatus } : t))
    );
  };

  const columns: Column<DomainTarget>[] = [
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
      key: 'pitchAngle',
      header: 'Tailored Outreach Pitch',
      render: (item) => (
        <div className="space-y-1.5 max-w-md">
          <p className="text-xs text-app-text line-clamp-1 font-mono">
            {item.pitchAngle.split('\n')[0]}
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleCopy(item.id, item.pitchAngle);
            }}
            icon={copiedId === item.id ? <Check className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
          >
            {copiedId === item.id ? 'Copied' : 'Copy Pitch'}
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
            AI-crafted, zero-fluff outreach pitches tailored for citation inclusion & guest assets.
          </p>
        </div>

        {/* View Switcher */}
        <div className="flex items-center gap-2">
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

      {/* Kanban View */}
      {viewMode === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 overflow-x-auto pb-4">
          {statuses.map((status) => {
            const statusTargets = targets.filter((t) => t.status === status);

            return (
              <div
                key={status}
                className="bg-app-surface-2/60 border border-app-border radius-card p-3 flex flex-col min-w-[240px] space-y-3"
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
                        <span className="text-[10px] text-app-text-3 font-mono">{item.market}</span>
                      </div>

                      {/* Expandable Pitch Preview */}
                      <div className="pt-2 border-t border-app-border/40">
                        <button
                          onClick={() =>
                            setExpandedPitchId(expandedPitchId === item.id ? null : item.id)
                          }
                          className="w-full flex items-center justify-between text-[11px] text-app-text-3 hover:text-brand font-medium"
                        >
                          <span className="flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-brand" />
                            Outreach Draft
                          </span>
                          {expandedPitchId === item.id ? (
                            <ChevronUp className="w-3 h-3" />
                          ) : (
                            <ChevronDown className="w-3 h-3" />
                          )}
                        </button>

                        {expandedPitchId === item.id && (
                          <div className="mt-2 p-2 bg-app-surface-2 rounded text-[11px] text-app-text font-mono whitespace-pre-wrap leading-relaxed border border-app-border">
                            {item.pitchAngle}
                          </div>
                        )}
                      </div>

                      {/* Bottom Action / Status Mover */}
                      <div className="flex items-center justify-between pt-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopy(item.id, item.pitchAngle)}
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
                      No domains in this stage.
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
          title="Outreach Campaign Queue"
          data={targets}
          columns={columns}
          keyExtractor={(item) => item.id}
        />
      )}
    </div>
  );
};
