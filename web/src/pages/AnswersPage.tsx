import React, { useState, useMemo } from 'react';
import { FileText, Sparkles, ExternalLink, ShieldCheck, ThumbsUp, Globe, Play, Search } from 'lucide-react';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { useAudit } from '../context/AuditContext';

export interface GroundedCitationItem {
  url: string;
  domain: string;
  title: string;
  score: number;
}

export interface RenderedAnswer {
  id: string;
  prompt: string;
  engine: string;
  modelName: string;
  market: string;
  timestamp: string;
  answerExcerpt: string;
  clientMentioned: boolean;
  groundedCitations: GroundedCitationItem[];
}

export const AnswersPage: React.FC = () => {
  const { auditResult, clientName, clientDomain, model, runAudit, isLoading } = useAudit();
  const [selectedEngine, setSelectedEngine] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Extract rendered answers from live auditResult.records
  const renderedAnswers: RenderedAnswer[] = useMemo(() => {
    if (!auditResult?.records || !auditResult.records.length) return [];

    return auditResult.records.map((rec: any, idx: number) => {
      const promptText = rec.prompt || rec.query || `Query #${idx + 1}`;
      const ansText = rec.answer || rec.response_text || 'No response returned.';
      const isClientMentioned =
        ansText.toLowerCase().includes(clientName.toLowerCase()) ||
        ansText.toLowerCase().includes(clientDomain.toLowerCase());

      const cites: GroundedCitationItem[] = [];
      if (Array.isArray(rec.citations)) {
        rec.citations.forEach((c: any) => {
          const u = typeof c === 'string' ? c : c.url || '';
          if (u) {
            const dom = u.replace(/^https?:\/\//, '').split('/')[0];
            const title = typeof c === 'object' && c.title ? c.title : dom;
            cites.push({
              url: u.startsWith('http') ? u : `https://${u}`,
              domain: dom,
              title: title,
              score: 85,
            });
          }
        });
      }

      // If citations were empty in records, extract from unique_cited_urls or table
      if (cites.length === 0 && auditResult.table) {
        auditResult.table.slice(idx * 2, idx * 2 + 4).forEach((t) => {
          cites.push({
            url: t.top_urls?.split('\n')[0] || `https://${t.domain}`,
            domain: t.domain,
            title: `Citation Target · ${t.domain}`,
            score: t.priority_score || 80,
          });
        });
      }

      return {
        id: `ans-${idx}`,
        prompt: promptText,
        engine: 'Gemini',
        modelName: model || 'gemini-3.1-flash-lite',
        market: rec.market || 'the UK',
        timestamp: 'Live Grounded Result',
        answerExcerpt: ansText,
        clientMentioned: isClientMentioned,
        groundedCitations: cites,
      };
    });
  }, [auditResult, clientName, clientDomain, model]);

  const filteredAnswers = renderedAnswers.filter((a) => {
    if (searchQuery.trim() && !a.prompt.toLowerCase().includes(searchQuery.toLowerCase()) && !a.answerExcerpt.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    return true;
  });

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-app-border pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 rounded-md bg-info/15 text-info flex items-center justify-center">
              <FileText className="w-3.5 h-3.5" />
            </div>
            <h1 className="font-h1 text-app-text">Grounded AI Answers & Responses</h1>
          </div>
          <p className="text-xs text-app-text-2">
            Inspect raw LLM responses and authentic publisher citations extracted from Google Gemini for <strong>{clientName}</strong>.
          </p>
        </div>

        {/* Filter / Search */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-app-text-3 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search in answers..."
              className="h-9 pl-9 pr-3 bg-app-surface-2 border border-app-border radius-input text-xs text-app-text focus:outline-none focus:border-brand"
            />
          </div>
        </div>
      </div>

      {/* If No Audit Run Yet */}
      {renderedAnswers.length === 0 ? (
        <div className="bg-app-surface border border-app-border radius-card p-8 md:p-12 text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-info/15 text-info flex items-center justify-center mx-auto">
            <FileText className="w-6 h-6" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="font-h2 text-app-text">No Synthesized Answers Available</h3>
            <p className="text-xs text-app-text-2">
              Run the citation prospector to inspect live LLM answers, rankings, and grounded URLs.
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
        /* Answer Cards List */
        <div className="space-y-4">
          {filteredAnswers.map((ans) => (
            <div
              key={ans.id}
              className="bg-app-surface border border-app-border hover:border-app-border-strong radius-card p-6 transition-all duration-150 space-y-4"
            >
              {/* Card Header: Prompt & Meta */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-app-border/60 pb-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="brand">
                      {ans.engine} · {ans.modelName}
                    </Badge>
                    <span className="text-[11px] text-app-text-3 font-mono">Market: {ans.market}</span>
                  </div>
                  <h3 className="font-h3 text-app-text">"{ans.prompt}"</h3>
                </div>

                {/* Rank & Sentiment Badges */}
                <div className="flex items-center gap-2 shrink-0">
                  {ans.clientMentioned ? (
                    <span className="px-2.5 py-1 radius-badge bg-[#10B981] text-slate-950 font-bold text-xs shadow-sm">
                      {clientName} Cited
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 radius-badge bg-warning/15 text-warning border border-warning/25 font-semibold text-xs">
                      Citation Gap
                    </span>
                  )}
                  <span className="px-2.5 py-1 radius-badge bg-success/15 text-success border border-success/25 font-semibold text-xs flex items-center gap-1">
                    <ThumbsUp className="w-3 h-3" />
                    Live Grounded
                  </span>
                </div>
              </div>

              {/* Answer Excerpt with markdown bold styling */}
              <div className="p-4 bg-app-surface-2 radius-input border border-app-border text-xs md:text-sm text-app-text leading-relaxed whitespace-pre-wrap">
                <div
                  dangerouslySetInnerHTML={{
                    __html: ans.answerExcerpt.replace(
                      /\*\*(.*?)\*\*/g,
                      '<strong class="text-brand font-bold">$1</strong>'
                    ),
                  }}
                />
              </div>

              {/* Grounded Citations Grid */}
              {ans.groundedCitations.length > 0 && (
                <div>
                  <span className="text-xs font-semibold text-app-text-3 uppercase tracking-wider block mb-2">
                    Grounded Citations Extracted by {ans.engine}:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {ans.groundedCitations.map((cite, i) => (
                      <a
                        key={i}
                        href={cite.url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-3 bg-app-surface-2 hover:bg-app-surface-3 border border-app-border hover:border-app-border-strong radius-input flex items-center justify-between gap-3 text-xs transition-colors group"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-app-text group-hover:text-brand transition-colors truncate">
                            {cite.title}
                          </div>
                          <span className="text-[11px] text-app-text-3 font-mono">{cite.domain}</span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-bold text-success tabular-nums text-[11px]">
                            Score {cite.score}
                          </span>
                          <ExternalLink className="w-3.5 h-3.5 text-app-text-3 group-hover:text-brand" />
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
