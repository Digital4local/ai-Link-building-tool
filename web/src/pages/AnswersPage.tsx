import React, { useState } from 'react';
import { FileText, Sparkles, ExternalLink, ShieldCheck, ThumbsUp, Globe } from 'lucide-react';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { DomainCell } from '../components/DomainCell';
import { mockAnswers } from '../data/mockData';
import type { AnswerItem } from '../data/mockData';

export const AnswersPage: React.FC = () => {
  const [selectedEngine, setSelectedEngine] = useState<string>('All');

  const filteredAnswers = mockAnswers.filter((a) => {
    if (selectedEngine !== 'All' && a.engine !== selectedEngine) return false;
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
            Inspect raw LLM synthesis and exact citation links extracted from Google Gemini and ChatGPT.
          </p>
        </div>

        {/* Engine Filter */}
        <div className="flex items-center gap-1.5 bg-app-surface-2 p-1 radius-input border border-app-border">
          {['All', 'Gemini', 'ChatGPT', 'Perplexity'].map((eng) => (
            <button
              key={eng}
              onClick={() => setSelectedEngine(eng)}
              className={`px-3 py-1 text-xs font-medium radius-badge transition-colors ${
                selectedEngine === eng
                  ? 'bg-app-surface text-brand font-semibold shadow-xs'
                  : 'text-app-text-3 hover:text-app-text'
              }`}
            >
              {eng}
            </button>
          ))}
        </div>
      </div>

      {/* Answer Cards List */}
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
                  <Badge variant={ans.engine === 'Gemini' ? 'brand' : 'brand-accent'}>
                    {ans.engine} · {ans.modelName}
                  </Badge>
                  <span className="text-[11px] text-app-text-3 font-mono">{ans.timestamp}</span>
                </div>
                <h3 className="font-h3 text-app-text">"{ans.prompt}"</h3>
              </div>

              {/* Rank & Sentiment Badges */}
              <div className="flex items-center gap-2 shrink-0">
                {ans.clientRank && (
                  <span className="px-2.5 py-1 radius-badge bg-[#10B981] text-slate-950 font-bold text-xs shadow-sm">
                    Position #{ans.clientRank}
                  </span>
                )}
                <span className="px-2.5 py-1 radius-badge bg-success/15 text-success border border-success/25 font-semibold text-xs flex items-center gap-1">
                  <ThumbsUp className="w-3 h-3" />
                  Positive Sentiment
                </span>
              </div>
            </div>

            {/* Answer Excerpt with markdown bold styling */}
            <div className="p-4 bg-app-surface-2 radius-input border border-app-border text-xs md:text-sm text-app-text leading-relaxed">
              <div
                dangerouslySetInnerHTML={{
                  __html: ans.answerExcerpt.replace(
                    /\*\*(.*?)\*\*/g,
                    '<strong class="text-brand font-bold">$1</strong>'
                  ),
                }}
              />
            </div>

            {/* Grounded Citations Carousel / Links */}
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
          </div>
        ))}
      </div>
    </div>
  );
};
