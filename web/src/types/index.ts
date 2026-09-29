export type Theme = 'dark' | 'light';

export type EngineType = 'Gemini' | 'ChatGPT' | 'Perplexity' | 'Claude' | 'All';

export interface DomainTarget {
  id: string;
  domain: string;
  citationScore: number;
  citationFrequency: number;
  market: string;
  category: string;
  actionBucket: 'High Priority' | 'Quick Win' | 'Editorial Pitch' | 'Directory';
  status: 'Identified' | 'Pitched' | 'In Discussion' | 'Acquired' | 'Declined';
  avgWordCount: number;
  schemaTypes: string[];
  contactEmail?: string;
  sampleUrl: string;
  pitchAngle: string;
  competitorsCited: string[];
}

export interface MetricData {
  label: string;
  value: string | number;
  delta: number;
  deltaLabel: string;
  sparklineData: number[];
  tooltip: string;
}

export interface CoverageGridCell {
  prompt: string;
  category: string;
  engines: {
    Gemini: { rank: number | null; sentiment: 'positive' | 'neutral' | 'negative' | null; citedUrl?: string };
    ChatGPT: { rank: number | null; sentiment: 'positive' | 'neutral' | 'negative' | null; citedUrl?: string };
    Perplexity: { rank: number | null; sentiment: 'positive' | 'neutral' | 'negative' | null; citedUrl?: string };
    Claude: { rank: number | null; sentiment: 'positive' | 'neutral' | 'negative' | null; citedUrl?: string };
  };
}

export interface BestAction {
  id: string;
  title: string;
  description: string;
  impact: 'High' | 'Medium' | 'Critical';
  category: 'Competitor Gap' | 'Content Refresh' | 'Outreach Opportunity' | 'Authority Asset';
  targetDomain: string;
  actionUrl: string;
}

// Runtime fallbacks to prevent ESM resolution syntax errors
export const BestAction = {} as any;
export const DomainTarget = {} as any;
export const CoverageGridCell = {} as any;
export const MetricData = {} as any;
export const CampaignProfile = {} as any;
