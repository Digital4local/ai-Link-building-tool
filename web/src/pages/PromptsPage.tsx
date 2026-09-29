import React, { useState, useMemo } from 'react';
import { Sparkles, Search, Plus, Play, CheckCircle2, Trash2, ArrowRight } from 'lucide-react';
import { DataTable, Column } from '../components/DataTable';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { useAudit } from '../context/AuditContext';

export interface PromptRow {
  id: string;
  query: string;
  category: string;
  intent: 'Commercial' | 'Informational';
  clientRank: number | null;
  enginesCitedCount: number;
  topCitedDomains: string[];
}

export interface PromptsPageProps {
  onNavigateToAnswers: (prompt: string) => void;
}

export const PromptsPage: React.FC<PromptsPageProps> = ({
  onNavigateToAnswers,
}) => {
  const {
    prompts,
    setPrompts,
    generatePrompts,
    runAudit,
    service,
    markets,
    clientName,
    clientDomain,
    auditResult,
    isLoading,
  } = useAudit();

  const [selectedIntent, setSelectedIntent] = useState<string>('All');
  const [newPromptText, setNewPromptText] = useState<string>('');

  // Map prompts into PromptRow[]
  const promptRows: PromptRow[] = useMemo(() => {
    return prompts.map((query, idx) => {
      const qLower = query.toLowerCase();
      const isCommercial =
        qLower.includes('best') ||
        qLower.includes('top') ||
        qLower.includes('compare') ||
        qLower.includes('review') ||
        qLower.includes('agency') ||
        qLower.includes('hire') ||
        qLower.includes('cost') ||
        qLower.includes('choose');

      // Check if client was cited in records for this query
      let clientRank: number | null = null;
      let topDomains: string[] = [];

      if (auditResult?.records) {
        const record = auditResult.records.find((r) => r.prompt === query || r.query === query);
        if (record) {
          const ansText = (record.answer || record.response_text || '').toLowerCase();
          if (ansText.includes(clientName.toLowerCase()) || ansText.includes(clientDomain.toLowerCase())) {
            clientRank = 1;
          }
          if (record.citations) {
            topDomains = record.citations.map((c: any) => {
              const u = typeof c === 'string' ? c : c.url || '';
              return u.replace(/^https?:\/\//, '').split('/')[0];
            }).filter(Boolean).slice(0, 3);
          }
        }
      }

      // If no records yet, provide smart domain hints
      if (topDomains.length === 0 && auditResult?.table) {
        topDomains = auditResult.table.slice(idx * 2, idx * 2 + 3).map((t) => t.domain);
      }

      return {
        id: `prompt-${idx}`,
        query,
        category: service || 'Service Audit',
        intent: isCommercial ? 'Commercial' : 'Informational',
        clientRank,
        enginesCitedCount: auditResult ? 1 : 0,
        topCitedDomains: topDomains,
      };
    });
  }, [prompts, service, auditResult, clientName, clientDomain]);

  const filteredPrompts = promptRows.filter((p) => {
    if (selectedIntent !== 'All' && p.intent !== selectedIntent) return false;
    return true;
  });

  const handleAddPrompt = () => {
    if (!newPromptText.trim()) return;
    setPrompts([...prompts, newPromptText.trim()]);
    setNewPromptText('');
  };

  const handleDeletePrompt = (index: number) => {
    const next = [...prompts];
    next.splice(index, 1);
    setPrompts(next);
  };

  const columns: Column<PromptRow>[] = [
    {
      key: 'query',
      header: 'Buyer Query / Prompt Synthesized',
      sortable: true,
      render: (item) => (
        <div className="space-y-0.5">
          <span className="font-semibold text-app-text text-xs hover:text-brand transition-colors block">
            "{item.query}"
          </span>
          <span className="text-[11px] text-app-text-3 font-mono">{item.category} · {markets[0] || 'UK'}</span>
        </div>
      ),
    },
    {
      key: 'intent',
      header: 'Search Intent',
      sortable: true,
      render: (item) => (
        <Badge variant={item.intent === 'Commercial' ? 'brand' : 'info'}>
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
          <span className="inline-flex items-center justify-center px-2 py-0.5 radius-badge text-xs font-bold bg-[#10B981] text-slate-950 shadow-sm">
            Cited #{item.clientRank}
          </span>
        ) : (
          <span className="text-xs text-app-text-3 opacity-40">—</span>
        ),
    },
    {
      key: 'topCitedDomains',
      header: 'Discovered Citations',
      render: (item) => (
        <div className="flex items-center gap-1.5 flex-wrap">
          {item.topCitedDomains.length > 0 ? (
            item.topCitedDomains.map((d, i) => (
              <span
                key={i}
                className="px-1.5 py-0.5 radius-badge text-[11px] font-mono border bg-app-surface-2 text-app-text-2 border-app-border"
              >
                {d}
              </span>
            ))
          ) : (
            <span className="text-[11px] text-app-text-3">Pending audit run</span>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (item, idx) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onNavigateToAnswers(item.query);
            }}
            icon={<Search className="w-3 h-3 text-brand" />}
          >
            Inspect Answer
          </Button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDeletePrompt(idx);
            }}
            className="p-1.5 text-app-text-3 hover:text-danger rounded transition-colors"
            title="Remove prompt"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
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
            <div className="w-6 h-6 rounded-md bg-brand-accent/15 text-brand-accent flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <h1 className="font-h1 text-app-text">Prompt Intelligence & Query Matrix</h1>
          </div>
          <p className="text-xs text-app-text-2">
            Track exact buyer questions queried against Google Gemini Grounding for <strong>{clientName}</strong>.
          </p>
        </div>

        {/* Action controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="secondary"
            size="sm"
            onClick={generatePrompts}
            isLoading={isLoading}
            icon={<Sparkles className="w-3.5 h-3.5 text-brand-accent" />}
          >
            Auto-Generate with Gemini
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={runAudit}
            isLoading={isLoading}
            icon={<Play className="w-3.5 h-3.5" />}
          >
            Run Audit ({prompts.length} Prompts)
          </Button>
        </div>
      </div>

      {/* Quick Add Custom Prompt */}
      <div className="p-4 bg-app-surface border border-app-border radius-card flex flex-col sm:flex-row items-center gap-2">
        <input
          type="text"
          value={newPromptText}
          onChange={(e) => setNewPromptText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAddPrompt()}
          placeholder={`Add custom query for ${clientName}... (e.g. "What is the best ${service} in ${markets[0] || 'the UK'}?")`}
          className="flex-1 h-9 px-3 bg-app-surface-2 border border-app-border radius-input text-xs text-app-text focus:outline-none focus:border-brand"
        />
        <Button
          variant="secondary"
          size="sm"
          onClick={handleAddPrompt}
          icon={<Plus className="w-3.5 h-3.5" />}
        >
          Add Prompt
        </Button>
      </div>

      {/* Main Table */}
      <DataTable
        title={`Active Query Matrix (${filteredPrompts.length} Prompts)`}
        data={filteredPrompts}
        columns={columns}
        keyExtractor={(item) => item.id}
        onRowClick={(item) => onNavigateToAnswers(item.query)}
      />
    </div>
  );
};
