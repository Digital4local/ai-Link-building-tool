import React from 'react';
import { clsx } from 'clsx';
import { Award, TrendingUp, Target, BarChart2 } from 'lucide-react';

export interface RadialGaugeProps {
  score: number; // 0 to 100
  title?: string;
  shareOfVoice: number; // %
  avgPosition: number; // e.g. 1.8
  citationShare: number; // %
  className?: string;
}

export const RadialGauge: React.FC<RadialGaugeProps> = ({
  score = 78,
  title = 'AI Visibility Score',
  shareOfVoice = 42.5,
  avgPosition = 1.9,
  citationShare = 64.0,
  className,
}) => {
  // SVG gauge constants
  const size = 220;
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const center = size / 2;

  // Semicircle arc (180 deg or 240 deg)
  // Let's make a 220-degree arc for high aesthetic polish
  const startAngle = 160;
  const endAngle = 380;
  const totalAngle = endAngle - startAngle;

  const polarToCartesian = (cx: number, cy: number, r: number, angleInDegrees: number) => {
    const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
    return {
      x: cx + r * Math.cos(angleInRadians),
      y: cy + r * Math.sin(angleInRadians),
    };
  };

  const describeArc = (cx: number, cy: number, r: number, start: number, end: number) => {
    const p1 = polarToCartesian(cx, cy, r, end);
    const p2 = polarToCartesian(cx, cy, r, start);
    const largeArcFlag = end - start <= 180 ? '0' : '1';
    return ['M', p1.x, p1.y, 'A', r, r, 0, largeArcFlag, 0, p2.x, p2.y].join(' ');
  };

  const bgPath = describeArc(center, center, radius, startAngle, endAngle);
  const currentAngle = startAngle + (score / 100) * totalAngle;
  const activePath = describeArc(center, center, radius, startAngle, currentAngle);

  // Status text based on score
  const getScoreRating = (val: number) => {
    if (val >= 80) return { label: 'Dominant Leader', color: 'text-brand-accent' };
    if (val >= 60) return { label: 'High Visibility', color: 'text-success' };
    if (val >= 40) return { label: 'Competitive', color: 'text-warning' };
    return { label: 'Low Visibility', color: 'text-danger' };
  };

  const rating = getScoreRating(score);

  return (
    <div
      className={clsx(
        'bg-app-surface border border-app-border hover:border-app-border-strong radius-card p-6 transition-all duration-150 flex flex-col justify-between',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <span className="font-caption font-medium text-app-text-2 tracking-wide uppercase">
            Executive Metric
          </span>
          <h3 className="font-h3 text-app-text">{title}</h3>
        </div>

        <div className="w-8 h-8 rounded-lg bg-brand-soft border border-brand/20 flex items-center justify-center text-brand">
          <Award className="w-4 h-4" />
        </div>
      </div>

      {/* Center Gauge */}
      <div className="relative flex flex-col items-center justify-center my-2">
        <svg width={size} height={size * 0.75} viewBox={`0 0 ${size} ${size * 0.85}`}>
          <defs>
            <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#1B64B5" />
              <stop offset="60%" stopColor="#22C55E" />
              <stop offset="100%" stopColor="#68B82E" />
            </linearGradient>
          </defs>

          {/* Background Track */}
          <path
            d={bgPath}
            fill="none"
            stroke="var(--surface-3)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />

          {/* Active Score Track */}
          <path
            d={activePath}
            fill="none"
            stroke="url(#gaugeGradient)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            className="transition-all duration-500 ease-out"
          />
        </svg>

        {/* Center Score Readout */}
        <div className="absolute top-[38%] left-1/2 -translate-x-1/2 text-center">
          <div className="text-4xl font-extrabold tracking-tight font-metric text-app-text">
            {score}
            <span className="text-sm font-normal text-app-text-3 ml-0.5">/100</span>
          </div>
          <div className={clsx('text-xs font-semibold mt-0.5', rating.color)}>
            {rating.label}
          </div>
        </div>
      </div>

      {/* 3 Core Components underneath */}
      <div className="grid grid-cols-3 gap-2 pt-4 border-t border-app-border/60">
        <div className="bg-app-surface-2 radius-input p-2 text-center border border-app-border/40">
          <div className="flex items-center justify-center gap-1 text-app-text-3 text-[11px] mb-0.5">
            <TrendingUp className="w-3 h-3 text-brand" />
            <span>Share of Voice</span>
          </div>
          <div className="text-sm font-semibold tabular-nums text-app-text">
            {shareOfVoice}%
          </div>
        </div>

        <div className="bg-app-surface-2 radius-input p-2 text-center border border-app-border/40">
          <div className="flex items-center justify-center gap-1 text-app-text-3 text-[11px] mb-0.5">
            <Target className="w-3 h-3 text-brand-accent" />
            <span>Avg Position</span>
          </div>
          <div className="text-sm font-semibold tabular-nums text-app-text">
            #{avgPosition}
          </div>
        </div>

        <div className="bg-app-surface-2 radius-input p-2 text-center border border-app-border/40">
          <div className="flex items-center justify-center gap-1 text-app-text-3 text-[11px] mb-0.5">
            <BarChart2 className="w-3 h-3 text-info" />
            <span>Citation Share</span>
          </div>
          <div className="text-sm font-semibold tabular-nums text-app-text">
            {citationShare}%
          </div>
        </div>
      </div>
    </div>
  );
};
