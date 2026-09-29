import React, { useState } from 'react';
import { clsx } from 'clsx';
import type { CoverageGridCell } from '../types';
import { Grid } from 'lucide-react';

export interface PromptCoverageGridProps {
  data: CoverageGridCell[];
  onSelectPrompt?: (prompt: string) => void;
  className?: string;
}

export const PromptCoverageGrid: React.FC<PromptCoverageGridProps> = ({
  data,
  onSelectPrompt,
  className,
}) => {
  const [hoveredCell, setHoveredCell] = useState<{
    prompt: string;
    engine: string;
    rank: number | null;
    sentiment: string | null;
    citedUrl?: string;
  } | null>(null);

  const engines = ['Gemini', 'ChatGPT', 'Perplexity', 'Claude'] as const;

  const getRankBadgeStyle = (rank: number | null) => {
    if (rank === 1) {
      return {
        bg: 'bg-[#10B981] text-slate-950 font-bold shadow-sm shadow-[#10B981]/30',
        label: '#1',
      };
    }
    if (rank === 2) {
      return {
        bg: 'bg-[#68B82E] text-slate-950 font-bold shadow-sm shadow-[#68B82E]/30',
        label: '#2',
      };
    }
    if (rank === 3) {
      return {
        bg: 'bg-[#F59E0B] text-slate-950 font-bold',
        label: '#3',
      };
    }
    if (rank && rank > 3) {
      return {
        bg: 'bg-app-surface-3 text-app-text-2 border border-app-border',
        label: `#${rank}`,
      };
    }
    return {
      bg: 'bg-app-surface-2 text-app-text-3 border border-app-border/40 opacity-40',
      label: '—',
    };
  };

  return (
    <div
      className={clsx(
        'bg-app-surface border border-app-border hover:border-app-border-strong radius-card p-6 transition-all duration-150',
        className
      )}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 rounded-md bg-brand-accent/15 text-brand-accent flex items-center justify-center">
              <Grid className="w-3.5 h-3.5" />
            </div>
            <h3 className="font-h3 text-app-text">AI Prompt Coverage Grid</h3>
            <span className="text-xs px-2 py-0.5 radius-pill bg-brand/10 text-brand border border-brand/20 font-medium">
              5x5 GEO Matrix
            </span>
          </div>
          <p className="text-xs text-app-text-2">
            Real-time answer positions across high-intent buyer prompts. Echoes Digital4Local local GEO matrix.
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-xs shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded bg-[#10B981] inline-block" />
            <span className="text-app-text-2">#1 Rank</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded bg-[#68B82E] inline-block" />
            <span className="text-app-text-2">#2 Rank</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded bg-[#F59E0B] inline-block" />
            <span className="text-app-text-2">#3 Rank</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded bg-app-surface-3 border border-app-border inline-block" />
            <span className="text-app-text-3">Not Cited</span>
          </div>
        </div>
      </div>

      {/* Grid Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-app-border text-xs text-app-text-3 font-medium uppercase tracking-wider">
              <th className="py-2.5 px-3 w-[45%]">Target Buyer Prompt</th>
              <th className="py-2.5 px-3 text-center">Category</th>
              {engines.map((eng) => (
                <th key={eng} className="py-2.5 px-3 text-center w-[12%]">
                  {eng}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-app-border/40 text-sm">
            {data.map((row, idx) => (
              <tr
                key={idx}
                onClick={() => onSelectPrompt?.(row.prompt)}
                className="hover:bg-app-surface-2 transition-colors cursor-pointer group"
              >
                {/* Prompt Name */}
                <td className="py-3 px-3">
                  <span className="font-medium text-app-text group-hover:text-brand transition-colors line-clamp-1">
                    {row.prompt}
                  </span>
                </td>

                {/* Category tag */}
                <td className="py-3 px-3 text-center">
                  <span className="inline-block text-[11px] px-2 py-0.5 radius-badge bg-app-surface-3 text-app-text-2 border border-app-border">
                    {row.category}
                  </span>
                </td>

                {/* Engine Rank Cells */}
                {engines.map((eng) => {
                  const cell = row.engines[eng];
                  const rankInfo = getRankBadgeStyle(cell.rank);

                  return (
                    <td key={eng} className="py-2.5 px-3 text-center">
                      <div
                        onMouseEnter={() =>
                          setHoveredCell({
                            prompt: row.prompt,
                            engine: eng,
                            rank: cell.rank,
                            sentiment: cell.sentiment,
                            citedUrl: cell.citedUrl,
                          })
                        }
                        onMouseLeave={() => setHoveredCell(null)}
                        className={clsx(
                          'inline-flex items-center justify-center w-8 h-8 rounded-lg text-xs transition-transform duration-150 group-hover:scale-105',
                          rankInfo.bg
                        )}
                      >
                        {rankInfo.label}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Interactive Tooltip Footer if hovered */}
      {hoveredCell && (
        <div className="mt-4 p-3 bg-app-surface-2 border border-app-border-strong radius-input text-xs flex items-center justify-between animate-fadeIn">
          <div>
            <span className="text-app-text-3 mr-2">Query:</span>
            <strong className="text-app-text mr-3">"{hoveredCell.prompt}"</strong>
            <span className="text-app-text-3 mr-1">Engine:</span>
            <span className="text-brand font-semibold mr-3">{hoveredCell.engine}</span>
          </div>
          <div>
            <span className="text-app-text-3 mr-1">Rank:</span>
            <span className="text-app-text font-bold mr-3">
              {hoveredCell.rank ? `#${hoveredCell.rank}` : 'Unranked'}
            </span>
            {hoveredCell.sentiment && (
              <span className="text-success font-medium capitalize">
                • {hoveredCell.sentiment} Sentiment
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
