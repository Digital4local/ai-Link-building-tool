/**
 * API Service for AI Citation Prospector
 * Connects React SaaS frontend with FastAPI backend
 */

export interface ConfigResponse {
  has_env_key: boolean;
  env_key: string;
  default_client_name: string;
  default_client_domain: string;
  default_service: string;
  default_markets: string[];
  default_competitors: string;
  default_model: string;
  available_models: { id: string; name: string }[];
}

export interface RunAuditParams {
  client_name: string;
  client_domain: string;
  service: string;
  markets: string[];
  competitors: string;
  prompts: string[];
  repeats?: number;
  api_key: string;
  model?: string;
  delay_sec?: number;
}

export interface AuditSummary {
  total_answers: number;
  unique_domains: number;
  outreach_targets: number;
  client_sov_pct: number;
  avg_priority_score: number;
  total_queries_run: number;
  unique_cited_urls_count: number;
}

export interface AuditTableItem {
  domain: string;
  priority_score: number;
  citations: number;
  prompts_cited_in: number;
  consistency_pct: number;
  cited_where_competitor_wins: number;
  action: string;
  top_urls: string;
  competitor_gap_pages: number;
  best_pitch_type: string;
  citation_worthiness_score: number;
  contact: string;
  guest_post_url: string;
  newest_last_updated: string;
}

export interface ShareOfVoiceItem {
  brand: string;
  type: string;
  mentions: number;
  share_of_voice_pct: number;
}

export interface CompetitorGapItem {
  prompt: string;
  market: string;
  winning_competitors: string[];
  cited_sources: string[];
}

export interface PitchItem {
  url: string;
  domain: string;
  contact: string;
  pitch_type: string;
  subject: string;
  email: string;
  suggested_anchor: string;
  suggested_sentence: string;
  title_ideas?: string[];
}

export interface AuditResult {
  status: string;
  campaign_id: string;
  summary: AuditSummary;
  table: AuditTableItem[];
  share_of_voice: ShareOfVoiceItem[];
  unique_cited_urls: string[];
  competitor_gaps: CompetitorGapItem[];
  records: any[];
  saved_path: string;
}

const API_BASE = '/api';

export const api = {
  async getConfig(): Promise<ConfigResponse> {
    const res = await fetch(`${API_BASE}/config`);
    if (!res.ok) throw new Error('Failed to fetch config');
    return res.json();
  },

  async verifyKey(apiKey: string, model: string = 'gemini-3.1-flash-lite'): Promise<{ status: string; message: string }> {
    const res = await fetch(`${API_BASE}/verify-key`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: apiKey, model }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Validation failed' }));
      throw new Error(err.detail || 'Failed to verify API key');
    }
    return res.json();
  },

  async generatePrompts(
    service: string,
    location: string,
    numPrompts: number = 5,
    apiKey: string = '',
    model: string = 'gemini-3.1-flash-lite'
  ): Promise<string[]> {
    const res = await fetch(`${API_BASE}/generate-prompts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ service, location, num_prompts: numPrompts, api_key: apiKey, model }),
    });
    if (!res.ok) throw new Error('Failed to generate prompts');
    const data = await res.json();
    return data.prompts || [];
  },

  async runAudit(params: RunAuditParams): Promise<AuditResult> {
    const res = await fetch(`${API_BASE}/run-audit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Audit execution failed' }));
      throw new Error(err.detail || 'Audit execution failed');
    }
    return res.json();
  },

  async deepAnalysis(urls: string[], clientName: string, clientDomain: string, competitors: string) {
    const res = await fetch(`${API_BASE}/deep-analysis`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls, client_name: clientName, client_domain: clientDomain, competitors }),
    });
    if (!res.ok) throw new Error('Deep analysis failed');
    return res.json();
  },

  async generatePitches(
    targets: any[],
    clientName: string,
    clientDomain: string,
    service: string,
    market: string = 'the UK',
    apiKey: string = '',
    model: string = 'gemini-3.1-flash-lite'
  ): Promise<PitchItem[]> {
    const res = await fetch(`${API_BASE}/generate-pitches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targets,
        client_name: clientName,
        client_domain: clientDomain,
        service,
        market,
        api_key: apiKey,
        model,
      }),
    });
    if (!res.ok) throw new Error('Failed to generate pitches');
    const data = await res.json();
    return data.pitches || [];
  },

  async generateBrief(
    topPages: any[],
    clientName: string,
    clientDomain: string,
    service: string,
    market: string = 'the UK',
    apiKey: string = '',
    model: string = 'gemini-3.1-flash-lite'
  ) {
    const res = await fetch(`${API_BASE}/generate-brief`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        top_pages: topPages,
        client_name: clientName,
        client_domain: clientDomain,
        service,
        market,
        api_key: apiKey,
        model,
      }),
    });
    if (!res.ok) throw new Error('Failed to generate brief');
    return res.json();
  },

  async exportExcel(payload: any): Promise<Blob> {
    const res = await fetch(`${API_BASE}/export-excel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Failed to export Excel report');
    return res.blob();
  },

  async exportHtml(payload: any): Promise<Blob> {
    const res = await fetch(`${API_BASE}/export-html`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Failed to export HTML report');
    return res.blob();
  },
};
