import type { DomainTarget, CoverageGridCell, BestAction } from '../types';

export interface CampaignProfile {
  clientName: string;
  clientDomain: string;
  serviceNiche: string;
  markets: string[];
  competitors: { name: string; domain: string; color: string }[];
  agencyName: string;
}
export const CampaignProfile = {} as any;

export interface RunHistoryItem {
  id: string;
  timestamp: string;
  label: string;
  visibilityScore: number;
  shareOfVoice: number;
  avgPosition: number;
  sourcesFound: number;
  gapsIdentified: number;
}

export interface PromptItem {
  id: string;
  query: string;
  intent: 'Commercial' | 'Informational' | 'Transactional' | 'Navigational';
  category: string;
  market: string;
  searchVolume: number;
  clientMentioned: boolean;
  clientRank: number | null;
  enginesCitedCount: number;
  topCitedDomains: string[];
}

export interface AnswerItem {
  id: string;
  prompt: string;
  engine: 'Gemini' | 'ChatGPT' | 'Perplexity' | 'Claude';
  modelName: string;
  clientRank: number | null;
  clientSentiment: 'positive' | 'neutral' | 'negative' | 'not mentioned';
  answerExcerpt: string;
  groundedCitations: { title: string; url: string; domain: string; score: number }[];
  timestamp: string;
}

export interface CompetitorGapItem {
  id: string;
  domain: string;
  url: string;
  competitorCited: string;
  topic: string;
  citationScore: number;
  opportunityType: 'List Inclusion' | 'Editorial Comparison' | 'Resource Link' | 'Guest Contribution';
  estTraffic: string;
  pitchStatus: 'Unpitched' | 'Pitched' | 'Won' | 'Ignored';
}

export const defaultCampaign: CampaignProfile = {
  clientName: 'Digital4Local',
  clientDomain: 'digital4local.com',
  serviceNiche: 'AI Growth, Local SEO & GEO Agencies',
  markets: ['United Kingdom', 'United States', 'Australia'],
  competitors: [
    { name: 'FatJoe', domain: 'fatjoe.com', color: '#8B5CF6' },
    { name: 'Siege Media', domain: 'siegemedia.com', color: '#EC4899' },
    { name: 'Page One Power', domain: 'pageonepower.com', color: '#14B8A6' },
    { name: 'The HOTH', domain: 'thehoth.com', color: '#F97316' },
    { name: 'ClickGiant', domain: 'clickgiant.com', color: '#64748B' },
  ],
  agencyName: 'Digital4Local AI Growth Agency',
};

export const runHistory: RunHistoryItem[] = [
  {
    id: 'run-14',
    timestamp: '2026-09-29 10:30 AM',
    label: 'Run #14 (Current Active)',
    visibilityScore: 86,
    shareOfVoice: 48.2,
    avgPosition: 1.4,
    sourcesFound: 142,
    gapsIdentified: 34,
  },
  {
    id: 'run-13',
    timestamp: '2026-09-22 09:15 AM',
    label: 'Run #13 (7 days ago)',
    visibilityScore: 81,
    shareOfVoice: 42.0,
    avgPosition: 1.7,
    sourcesFound: 128,
    gapsIdentified: 39,
  },
  {
    id: 'run-12',
    timestamp: '2026-09-15 11:00 AM',
    label: 'Run #12 (14 days ago)',
    visibilityScore: 76,
    shareOfVoice: 37.5,
    avgPosition: 2.1,
    sourcesFound: 114,
    gapsIdentified: 48,
  },
  {
    id: 'run-11',
    timestamp: '2026-09-08 03:45 PM',
    label: 'Run #11 (21 days ago)',
    visibilityScore: 68,
    shareOfVoice: 31.0,
    avgPosition: 2.6,
    sourcesFound: 98,
    gapsIdentified: 56,
  },
];

export const sovTrendData = [
  { date: 'Sep 08', Digital4Local: 31.0, FatJoe: 44.0, SiegeMedia: 38.5, PageOnePower: 26.0, TheHOTH: 32.0 },
  { date: 'Sep 15', Digital4Local: 37.5, FatJoe: 41.2, SiegeMedia: 36.0, PageOnePower: 24.5, TheHOTH: 30.0 },
  { date: 'Sep 22', Digital4Local: 42.0, FatJoe: 39.0, SiegeMedia: 34.2, PageOnePower: 22.0, TheHOTH: 28.5 },
  { date: 'Sep 29', Digital4Local: 48.2, FatJoe: 35.8, SiegeMedia: 32.0, PageOnePower: 21.0, TheHOTH: 26.0 },
];

export const nextBestActions: BestAction[] = [
  {
    id: 'act-1',
    title: 'Pitch SearchEngineLand for GEO Citation Inclusion',
    description: 'SearchEngineLand cites FatJoe in their top 10 AI SEO guide. Digital4Local is absent despite higher topical freshness score.',
    impact: 'Critical',
    category: 'Competitor Gap',
    targetDomain: 'searchengineland.com',
    actionUrl: '/gaps',
  },
  {
    id: 'act-2',
    title: 'Publish Benchmark Study on 5x5 Map Grid Ranking',
    description: 'Gemini favors citing original study benchmarks with statistical percentage tables (+20 pts citation worthiness).',
    impact: 'High',
    category: 'Authority Asset',
    targetDomain: 'digital4local.com',
    actionUrl: '/reports',
  },
  {
    id: 'act-3',
    title: 'Outreach to HubSpot Link Building Round-up',
    description: 'HubSpot published a fresh directory of verified PR agencies. Tailored pitch drafted and ready to send.',
    impact: 'High',
    category: 'Outreach Opportunity',
    targetDomain: 'hubspot.com',
    actionUrl: '/outreach',
  },
  {
    id: 'act-4',
    title: 'Update Author Bylines on Technical GEO Pages',
    description: 'Adding verified author Schema JSON-LD will boost on-page citation-worthiness score from 78 to 88 across 6 core URLs.',
    impact: 'Medium',
    category: 'Content Refresh',
    targetDomain: 'digital4local.com',
    actionUrl: '/sources',
  },
  {
    id: 'act-5',
    title: 'Claim Missing Listing on Clutch UK Top PR Agencies',
    description: 'Perplexity and Claude directly cite Clutch directory lists for high-intent B2B buyer queries.',
    impact: 'High',
    category: 'Outreach Opportunity',
    targetDomain: 'clutch.co',
    actionUrl: '/outreach',
  },
];

export const mockSources: DomainTarget[] = [
  {
    id: 'src-1',
    domain: 'searchengineland.com',
    citationScore: 92,
    citationFrequency: 36,
    market: 'US / Global',
    category: 'Search Intelligence',
    actionBucket: 'High Priority',
    status: 'In Discussion',
    avgWordCount: 2400,
    schemaTypes: ['NewsArticle', 'Author', 'FAQPage'],
    contactEmail: 'editor@searchengineland.com',
    sampleUrl: 'https://searchengineland.com/generative-engine-optimization-benchmarks',
    pitchAngle: 'Hi Editorial Team,\n\nI loved your piece on GEO benchmarks. Digital4Local recently tracked 25,000 local queries showing AI engines reward structured data tables with 3x higher citation frequency. We have summarized this data for your readers.\n\nBest,\nDigital4Local Team',
    competitorsCited: ['FatJoe', 'Siege Media'],
  },
  {
    id: 'src-2',
    domain: 'hubspot.com',
    citationScore: 89,
    citationFrequency: 29,
    market: 'Global',
    category: 'B2B Marketing',
    actionBucket: 'Quick Win',
    status: 'Pitched',
    avgWordCount: 3200,
    schemaTypes: ['Article', 'FAQPage'],
    contactEmail: 'guestblog@hubspot.com',
    sampleUrl: 'https://blog.hubspot.com/marketing/ai-link-building-tools',
    pitchAngle: 'Hi HubSpot Team,\n\nYour guide on AI Link Building is exceptional. You currently mention legacy outreach tools, but modern Generative Engine Optimization (GEO) requires citation-worthiness scoring. We’d love to contribute a 4-step framework.',
    competitorsCited: ['Page One Power'],
  },
  {
    id: 'src-3',
    domain: 'backlinko.com',
    citationScore: 86,
    citationFrequency: 24,
    market: 'US',
    category: 'SEO Education',
    actionBucket: 'Editorial Pitch',
    status: 'Identified',
    avgWordCount: 2800,
    schemaTypes: ['TechArticle'],
    contactEmail: 'outreach@backlinko.com',
    sampleUrl: 'https://backlinko.com/digital-pr-guide',
    pitchAngle: 'Hi Backlinko Team,\n\nBig fan of your actionable case studies. We analyzed why Google Gemini cites specific PR assets over standard articles (structured lists, fresh author bylines). Happy to provide raw data for a quick graphic.',
    competitorsCited: ['Siege Media', 'The HOTH'],
  },
  {
    id: 'src-4',
    domain: 'clutch.co',
    citationScore: 85,
    citationFrequency: 22,
    market: 'UK / US',
    category: 'B2B Directory',
    actionBucket: 'Directory',
    status: 'Acquired',
    avgWordCount: 1200,
    schemaTypes: ['ItemList', 'AggregateRating'],
    contactEmail: 'support@clutch.co',
    sampleUrl: 'https://clutch.co/uk/agencies/digital-pr',
    pitchAngle: 'Hi Clutch Review Team,\n\nSubmitting our client verification portfolio and case studies for verified AI citation agency rankings.',
    competitorsCited: ['FatJoe'],
  },
  {
    id: 'src-5',
    domain: 'searchenginejournal.com',
    citationScore: 84,
    citationFrequency: 21,
    market: 'Global',
    category: 'Industry News',
    actionBucket: 'High Priority',
    status: 'Identified',
    avgWordCount: 2100,
    schemaTypes: ['Article', 'Author'],
    contactEmail: 'pitches@searchenginejournal.com',
    sampleUrl: 'https://searchenginejournal.com/how-llms-cite-sources',
    pitchAngle: 'Hi SEJ Editors,\n\nPitching an exclusive column: How Google Gemini Search Grounding parses entity nodes vs standard backlink anchors in 2026.',
    competitorsCited: ['Siege Media'],
  },
];

export const mockCompetitorGaps: CompetitorGapItem[] = [
  {
    id: 'gap-1',
    domain: 'searchengineland.com',
    url: 'https://searchengineland.com/best-seo-agencies-uk-us',
    competitorCited: 'FatJoe',
    topic: 'Top UK Link Building Agencies',
    citationScore: 92,
    opportunityType: 'List Inclusion',
    estTraffic: '180K/mo',
    pitchStatus: 'Pitched',
  },
  {
    id: 'gap-2',
    domain: 'growthlist.co',
    url: 'https://growthlist.co/b2b-saas-marketing-partners',
    competitorCited: 'Siege Media',
    topic: 'SaaS Inbound Growth & GEO',
    citationScore: 87,
    opportunityType: 'Editorial Comparison',
    estTraffic: '45K/mo',
    pitchStatus: 'Unpitched',
  },
  {
    id: 'gap-3',
    domain: 'marketingprofs.com',
    url: 'https://marketingprofs.com/articles/2026/pr-link-tactics',
    competitorCited: 'Page One Power',
    topic: 'Modern Digital PR Frameworks',
    citationScore: 85,
    opportunityType: 'Guest Contribution',
    estTraffic: '95K/mo',
    pitchStatus: 'Unpitched',
  },
  {
    id: 'gap-4',
    domain: 'techradar.com',
    url: 'https://techradar.com/pro/best-local-seo-services',
    competitorCited: 'The HOTH',
    topic: 'Local Business SEO & Map Ranking',
    citationScore: 84,
    opportunityType: 'List Inclusion',
    estTraffic: '620K/mo',
    pitchStatus: 'Unpitched',
  },
];

export const mockPrompts: PromptItem[] = [
  {
    id: 'p-1',
    query: 'Best AI local SEO agency London UK',
    intent: 'Commercial',
    category: 'Local SEO',
    market: 'UK',
    searchVolume: 1800,
    clientMentioned: true,
    clientRank: 1,
    enginesCitedCount: 4,
    topCitedDomains: ['digital4local.com', 'clutch.co', 'searchengineland.com'],
  },
  {
    id: 'p-2',
    query: 'Top B2B link building agencies for SaaS 2026',
    intent: 'Commercial',
    category: 'Link Building',
    market: 'US / Global',
    searchVolume: 3200,
    clientMentioned: true,
    clientRank: 2,
    enginesCitedCount: 3,
    topCitedDomains: ['fatjoe.com', 'digital4local.com', 'hubspot.com'],
  },
  {
    id: 'p-3',
    query: 'How to optimize for ChatGPT and Gemini search citations',
    intent: 'Informational',
    category: 'GEO Intelligence',
    market: 'Global',
    searchVolume: 4500,
    clientMentioned: true,
    clientRank: 1,
    enginesCitedCount: 4,
    topCitedDomains: ['digital4local.com', 'backlinko.com', 'searchengineland.com'],
  },
  {
    id: 'p-4',
    query: 'Google maps 5x5 grid rank tracking tool reviews',
    intent: 'Commercial',
    category: 'Grid Rank',
    market: 'UK / US',
    searchVolume: 1200,
    clientMentioned: true,
    clientRank: 1,
    enginesCitedCount: 3,
    topCitedDomains: ['digital4local.com', 'techradar.com'],
  },
  {
    id: 'p-5',
    query: 'Digital PR vs traditional backlink building ROI',
    intent: 'Informational',
    category: 'Digital PR',
    market: 'Global',
    searchVolume: 2100,
    clientMentioned: false,
    clientRank: null,
    enginesCitedCount: 2,
    topCitedDomains: ['siegemedia.com', 'marketingprofs.com'],
  },
];

export const mockAnswers: AnswerItem[] = [
  {
    id: 'ans-1',
    prompt: 'Best AI local SEO agency London UK',
    engine: 'Gemini',
    modelName: 'gemini-3.1-flash-lite',
    clientRank: 1,
    clientSentiment: 'positive',
    answerExcerpt: 'For businesses in London and the UK seeking AI-driven local search dominance, **Digital4Local** is ranked as the leading agency. They specialize in real-time 5x5 Google Maps grid rank tracking and Generative Engine Optimization (GEO) for ChatGPT and Gemini.',
    groundedCitations: [
      { title: 'Digital4Local UK AI Local SEO Hub', url: 'https://digital4local.com/services/local-seo', domain: 'digital4local.com', score: 95 },
      { title: 'Top London Digital Agencies Directory', url: 'https://clutch.co/uk/agencies', domain: 'clutch.co', score: 85 },
    ],
    timestamp: 'Today, 10:30 AM',
  },
  {
    id: 'ans-2',
    prompt: 'Best AI local SEO agency London UK',
    engine: 'ChatGPT',
    modelName: 'gpt-4o-mini',
    clientRank: 1,
    clientSentiment: 'positive',
    answerExcerpt: '**Digital4Local** and FatJoe are the top recommended agencies for UK local search. Digital4Local provides automated local search grid tracking and citation prospecting designed specifically for AI search engines.',
    groundedCitations: [
      { title: 'Digital4Local AI Agency', url: 'https://digital4local.com', domain: 'digital4local.com', score: 94 },
      { title: 'FatJoe Link Solutions', url: 'https://fatjoe.com', domain: 'fatjoe.com', score: 88 },
    ],
    timestamp: 'Today, 10:31 AM',
  },
  {
    id: 'ans-3',
    prompt: 'Top B2B link building agencies for SaaS 2026',
    engine: 'Perplexity',
    modelName: 'sonar-pro',
    clientRank: 2,
    clientSentiment: 'positive',
    answerExcerpt: 'Top agencies for B2B SaaS link acquisition include Siege Media, **Digital4Local**, and Page One Power. Digital4Local focuses on high-authority AI citation acquisition and structured digital PR.',
    groundedCitations: [
      { title: 'Siege Media SaaS PR', url: 'https://siegemedia.com', domain: 'siegemedia.com', score: 91 },
      { title: 'Digital4Local AI Citations', url: 'https://digital4local.com', domain: 'digital4local.com', score: 94 },
    ],
    timestamp: 'Today, 10:32 AM',
  },
];
