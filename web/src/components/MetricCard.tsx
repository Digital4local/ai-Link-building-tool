import React, { useState } from 'react';
import { Info, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { clsx } from 'clsx';

export interface MetricCardProps {
  label: string;
  value: string | number;
  delta?: number;
  deltaLabel?: string;
  tooltip?: string;
  sparklineData?: number[];
  variant?: 'default' | 'brand' | 'success';
  className?: string;
  prefix?: string;
  suffix?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  delta,
  deltaLabel = 'vs last run',
  tooltip,
  sparklineData = [12, 14, 13, 17, 19, 24, 28, 32],
  variant = 'default',
  className,
  prefix,
  suffix,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);

  // Sparkline path generation
  const min = Math.min(...sparklineData);
  const max = Math.max(...sparklineData);
  const range = max - min || 1;
  const width = 160;
  const height = 36;
  const padding = 2;

  const points = sparklineData
    .map((val, idx) => {
      const x = (idx / (sparklineData.length - 1)) * (width - padding * 2) + padding;
      const y = height - ((val - min) / range) * (height - padding * 2) - padding;
      return `${x},${y}`;
    })
    .join(' ');

  const isPositive = (delta ?? 0) > 0;
  const isNegative = (delta ?? 0) < 0;

  const sparklineColor =
    variant === 'brand'
      ? 'var(--brand)'
      : isPositive
      ? 'var(--success)'
      : isNegative
      ? 'var(--danger)'
      : 'var(--brand)';

  return (
    <div
      className={clsx(
        'group relative bg-app-surface border border-app-border hover:border-app-border-strong radius-card p-4 transition-all duration-150 flex flex-col justify-between overflow-hidden',
        className
      )}
    >
      {/* Top row: Label & Info Tooltip */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="font-caption font-medium text-app-text-2 tracking-wide uppercase">
          {label}
        </span>

        {tooltip && (
          <div className="relative">
            <button
              type="button"
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
              onFocus={() => setShowTooltip(true)}
              onBlur={() => setShowTooltip(false)}
              className="text-app-text-3 hover:text-app-text transition-colors p-0.5"
              aria-label={tooltip}
            >
              <Info className="w-3.5 h-3.5" />
            </button>

            {showTooltip && (
              <div className="absolute right-0 bottom-full mb-1.5 w-48 p-2 bg-app-surface-3 border border-app-border-strong text-app-text text-xs radius-input elevation-sheet z-50 pointer-events-none">
                {tooltip}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Metric Value & Delta row */}
      <div className="flex items-baseline justify-between gap-3 my-1">
        <div className="font-metric text-app-text flex items-baseline">
          {prefix && <span className="text-xl font-normal text-app-text-2 mr-0.5">{prefix}</span>}
          <span>{value}</span>
          {suffix && <span className="text-lg font-normal text-app-text-2 ml-1">{suffix}</span>}
        </div>

        {delta !== undefined && (
          <div
            className={clsx(
              'inline-flex items-center gap-0.5 px-1.5 py-0.5 radius-badge text-xs font-semibold tabular-nums border',
              isPositive
                ? 'bg-success/12 text-success border-success/25'
                : isNegative
                ? 'bg-danger/12 text-danger border-danger/25'
                : 'bg-app-surface-2 text-app-text-3 border-app-border'
            )}
            title={`${delta > 0 ? '+' : ''}${delta}% ${deltaLabel}`}
          >
            {isPositive ? (
              <ArrowUpRight className="w-3 h-3 stroke-[2.5]" />
            ) : isNegative ? (
              <ArrowDownRight className="w-3 h-3 stroke-[2.5]" />
            ) : (
              <Minus className="w-3 h-3 stroke-[2.5]" />
            )}
            <span>
              {isPositive ? '+' : ''}
              {delta}%
            </span>
          </div>
        )}
      </div>

      {/* Delta label & 40px Sparkline */}
      <div className="mt-3 pt-2 border-t border-app-border/40 flex items-center justify-between">
        <span className="text-[11px] text-app-text-3 truncate">{deltaLabel}</span>

        {sparklineData && sparklineData.length > 1 && (
          <div className="h-[28px] w-[90px] shrink-0">
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
              <polyline
                fill="none"
                stroke={sparklineColor}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={points}
              />
            </svg>
          </div>
        )}
      </div>
    </div>
  );
};
