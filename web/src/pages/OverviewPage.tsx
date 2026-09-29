import React, { useState } from 'react';
import {
  TrendingUp,
  Award,
  ArrowRight,
  ExternalLink,
  Send,
  Sparkles,
  Key,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  FileCode,
  Layers,
  Copy,
  Check,
  Building,
  Globe,
  MapPin,
  Users
} from 'lucide-react';
import { RadialGauge } from '../components/RadialGauge';
import { MetricCard } from '../components/MetricCard';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import { useAudit } from '../context/AuditContext';
import type { AuditTableItem } from '../services/api';

export interface OverviewPageProps {
  onNavigate: (route: string) => void;
  onStartRun: () => void;
}

export const OverviewPage: React.FC<OverviewPageProps> = ({ onNavigate }) => {
  const {
    apiKey,
    setApiKey,
    clientName,
    setClientName,
    clientDomain,
    setClientDomain,
    service,
    setService,
    locationInput,
    setLocationInput,
    markets,
    competitors,
    setCompetitors,
    prompts,
    setPrompts,
    model,
    setModel,
    auditResult,
    pitches,
    contentBrief,
    isLoading,
    statusMessage,
    error,
    isKeyVerified,
    verifyApiKey,
    generatePrompts,
    runAudit,
    generatePitches,
    generateBrief,
    downloadExcelReport,
    downloadHtmlReport,
  } = useAudit();

  const [selectedDomains, setSelectedDomains] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<'targets' | 'gaps' | 'pitches' | 'brief'>('targets');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const tableData = auditResult?.table || [];
  const sovData = auditResult?.share_of_voice || [];
  const gapsData = auditResult?.competitor_gaps || [];

  const selectedCount = Object.values(selectedDomains).filter(Boolean).length;

  const handleSelectAll = (checked: boolean) => {
    const updated: Record<string, boolean> = {};
    if (checked) {
      tableData.slice(0, 10).forEach((t) => {
        updated[t.domain] = true;
      });
    }
    setSelectedDomains(updated);
  };

  const handleToggleDomain = (domain: string) => {
    setSelectedDomains((prev) => ({
      ...prev,
      [domain]: !prev[domain],
    }));
  };

  const handleGeneratePitchesForSelected = async () => {
    const targetsToPitch = tableData.filter((t) => selectedDomains[t.domain]);
    if (targetsToPitch.length) {
      await generatePitches(targetsToPitch);
      setActiveTab('pitches');
    }
  };

  const handleCopyText = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // Visibility score calculation
  const visibilityScore = auditResult
    ? Math.min(100, Math.round(auditResult.summary.client_sov_pct * 1.5 + (tableData.length ? 30 : 0)))
    : 72;

  const clientSov = auditResult ? auditResult.summary.client_sov_pct : 38.5;
  const uniqueDomainsCount = auditResult ? auditResult.summary.unique_domains : 18;
  const outreachTargetsCount = auditResult ? auditResult.summary.outreach_targets : 12;
  const gapsCount = gapsData.length;

  return (
    <div className="space-y-8 animate-fadeIn max-w-7xl mx-auto pb-16">
      {/* ------------------------------------------------------------- */}
      {/* STEP 0: FREE GOOGLE GEMINI API KEY (BYOK) BANNER              */}
      {/* ------------------------------------------------------------- */}
      <div className="p-5 md:p-6 bg-gradient-to-r from-brand/15 via-app-surface to-brand-accent/10 border border-brand/35 radius-card shadow-lg">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 radius-pill bg-brand-accent/20 text-brand-accent border border-brand-accent/40 text-[11px] font-bold uppercase tracking-wider">
                100% Free · No Card Required
              </span>
              <span className="text-xs text-app-text-3 font-mono">
                Model: <strong>{model}</strong>
              </span>
            </div>
            <h2 className="text-lg md:text-xl font-bold text-app-text flex items-center gap-2">
              <Key className="w-5 h-5 text-brand" />
              Step 0: Free Google Gemini API Key
            </h2>
            <p className="text-xs md:text-sm text-app-text-2 max-w-2xl">
              Queries run directly against your Google AI Studio free tier quota. Your key is stored securely in this session only.
            </p>
          </div>

          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-2 radius-btn bg-brand hover:bg-brand-hover text-white text-xs font-semibold shadow-md transition-all shrink-0 self-start lg:self-center"
          >
            Get Free API Key in 30s <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        <div className="mt-4 pt-4 border-t border-app-border/40 grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          <div className="md:col-span-8">
            <div className="relative">
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AIzaSy... or AQ... (Paste your free Google Gemini API Key here)"
                className="w-full pl-3 pr-24 py-2 bg-app-bg/80 border border-app-border focus:border-brand radius-btn text-xs font-mono text-app-text outline-none"
              />
              <span className="absolute right-3 top-2.5 text-[10px] text-app-text-3 font-mono uppercase">
                {apiKey ? 'Key Loaded' : 'No Key'}
              </span>
            </div>
          </div>

          <div className="md:col-span-4 flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => verifyApiKey()}
              disabled={isLoading || !apiKey}
              icon={<ShieldCheck className="w-4 h-4 text-brand-accent" />}
              className="w-full justify-center"
            >
              Verify Key
            </Button>
            {isKeyVerified && (
              <span className="text-brand-accent text-xs font-semibold flex items-center gap-1 shrink-0">
                <CheckCircle2 className="w-4 h-4" /> Active
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* CAMPAIGN PROFILE & BUYER-INTENT PROMPTS INPUT CARD            */}
      {/* ------------------------------------------------------------- */}
      <div className="p-6 bg-app-surface border border-app-border radius-card space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-app-border pb-4">
          <div>
            <h3 className="text-base font-bold text-app-text flex items-center gap-2">
              <Building className="w-4 h-4 text-brand" />
              1. Business Profile & Multi-Market Scope
            </h3>
            <p className="text-xs text-app-text-2">
              Configure your brand, service niche, target geographic regions, and benchmark competitors.
            </p>
          </div>
          <Badge variant="brand">
            Multi-Market Active ({markets.length} Markets)
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-semibold text-app-text-2 mb-1">
              Your Business / Client Name
            </label>
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className="w-full px-3 py-2 bg-app-bg border border-app-border radius-btn text-xs font-medium text-app-text outline-none focus:border-brand"
              placeholder="e.g. Digital4Local"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-app-text-2 mb-1">
              Your Business Domain
            </label>
            <input
              type="text"
              value={clientDomain}
              onChange={(e) => setClientDomain(e.target.value)}
              className="w-full px-3 py-2 bg-app-bg border border-app-border radius-btn text-xs font-mono text-app-text outline-none focus:border-brand"
              placeholder="e.g. digital4local.com"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-app-text-2 mb-1">
              Service / Niche (Plural)
            </label>
            <input
              type="text"
              value={service}
              onChange={(e) => setService(e.target.value)}
              className="w-full px-3 py-2 bg-app-bg border border-app-border radius-btn text-xs font-medium text-app-text outline-none focus:border-brand"
              placeholder="e.g. AI growth and local SEO agencies"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-app-text-2 mb-1">
              Target Markets (comma-separated)
            </label>
            <input
              type="text"
              value={locationInput}
              onChange={(e) => setLocationInput(e.target.value)}
              className="w-full px-3 py-2 bg-app-bg border border-app-border radius-btn text-xs font-medium text-app-text outline-none focus:border-brand"
              placeholder="e.g. the UK, the US"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-app-text-2 mb-1">
              Competitors to Audit (Brand | domain per line)
            </label>
            <textarea
              rows={3}
              value={competitors}
              onChange={(e) => setCompetitors(e.target.value)}
              className="w-full px-3 py-2 bg-app-bg border border-app-border radius-btn text-xs font-mono text-app-text outline-none focus:border-brand resize-none"
              placeholder="FatJoe | fatjoe.com&#10;Siege Media | siegemedia.com"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-app-text-2">
                Buyer-Intent Prompts ({prompts.length} Prompts)
              </label>
              <button
                type="button"
                onClick={generatePrompts}
                disabled={isLoading}
                className="text-[11px] text-brand hover:text-brand-hover font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Sparkles className="w-3 h-3" /> Auto-Generate Prompts
              </button>
            </div>
            <textarea
              rows={3}
              value={prompts.join('\n')}
              onChange={(e) => setPrompts(e.target.value.split('\n').filter((p) => p.trim()))}
              className="w-full px-3 py-2 bg-app-bg border border-app-border radius-btn text-xs font-medium text-app-text outline-none focus:border-brand resize-none"
              placeholder="What are the best AI growth agencies in the UK?"
            />
          </div>
        </div>

        {/* Live Status & Run Button */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            {isLoading && (
              <span className="w-3 h-3 rounded-full bg-brand-accent animate-ping" />
            )}
            <span className="text-xs font-medium text-app-text-2">
              {statusMessage || (auditResult ? '✅ Ready for next audit run' : 'Ready to prospect')}
            </span>
          </div>

          <Button
            variant="primary"
            size="md"
            onClick={runAudit}
            disabled={isLoading || !apiKey.trim()}
            icon={<Send className="w-4 h-4" />}
            className="w-full sm:w-auto px-8"
          >
            {isLoading ? 'Running Audit Queries...' : '🚀 Run Gemini Citation Prospector'}
          </Button>
        </div>

        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 radius-btn flex items-center gap-2 text-xs text-rose-400 font-medium">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* SUMMARY METRICS & RADIAL GAUGE                                */}
      {/* ------------------------------------------------------------- */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 flex flex-col">
          <RadialGauge
            score={visibilityScore}
            shareOfVoice={clientSov}
            avgPosition={1.4}
            citationShare={Math.round((outreachTargetsCount / Math.max(uniqueDomainsCount, 1)) * 100)}
            className="h-full"
          />
        </div>

        <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <MetricCard
            label="Client Share of Voice"
            value={clientSov.toString()}
            suffix="%"
            delta={12.4}
            deltaLabel="mentions in answers"
            tooltip={`${clientName} cited across AI answers`}
            variant="success"
          />
          <MetricCard
            label="Unique Cited Domains"
            value={uniqueDomainsCount.toString()}
            delta={uniqueDomainsCount}
            deltaLabel="authentic domains"
            tooltip="Discovered in Google Gemini queries"
          />
          <MetricCard
            label="Outreach Targets"
            value={outreachTargetsCount.toString()}
            delta={outreachTargetsCount}
            deltaLabel="high-priority targets"
            tooltip="Non-competitor pitching opportunities"
            variant="brand"
          />
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* AUDIT RESULTS TABS (Link Targets, Competitor Gaps, Pitches)   */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-app-surface border border-app-border radius-card p-6 space-y-6">
        {/* Navigation Tabs Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-app-border pb-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setActiveTab('targets')}
              className={`px-3.5 py-1.5 radius-btn text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'targets'
                  ? 'bg-brand text-white shadow'
                  : 'text-app-text-2 hover:text-app-text hover:bg-app-bg'
              }`}
            >
              🎯 Prioritised Link Targets ({tableData.length})
            </button>
            <button
              onClick={() => setActiveTab('gaps')}
              className={`px-3.5 py-1.5 radius-btn text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'gaps'
                  ? 'bg-brand text-white shadow'
                  : 'text-app-text-2 hover:text-app-text hover:bg-app-bg'
              }`}
            >
              ⚔️ Competitor Gaps ({gapsCount})
            </button>
            <button
              onClick={() => setActiveTab('pitches')}
              className={`px-3.5 py-1.5 radius-btn text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'pitches'
                  ? 'bg-brand text-white shadow'
                  : 'text-app-text-2 hover:text-app-text hover:bg-app-bg'
              }`}
            >
              ✉️ Outreach Pitches ({pitches.length})
            </button>
            <button
              onClick={() => setActiveTab('brief')}
              className={`px-3.5 py-1.5 radius-btn text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'brief'
                  ? 'bg-brand text-white shadow'
                  : 'text-app-text-2 hover:text-app-text hover:bg-app-bg'
              }`}
            >
              📝 AI Content Brief
            </button>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="secondary"
              size="sm"
              onClick={downloadExcelReport}
              disabled={!auditResult}
              icon={<FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />}
            >
              Export Excel
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={downloadHtmlReport}
              disabled={!auditResult}
              icon={<FileCode className="w-3.5 h-3.5 text-sky-400" />}
            >
              Export HTML
            </Button>
          </div>
        </div>

        {/* TAB 1: LINK TARGETS TABLE */}
        {activeTab === 'targets' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <p className="text-xs text-app-text-2">
                Real domains cited by Gemini with calculated priority scores (0-100) and pitch classifications.
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleGeneratePitchesForSelected}
                  disabled={selectedCount === 0 || isLoading}
                  icon={<Sparkles className="w-3.5 h-3.5" />}
                >
                  ✍️ Write Pitches for Selected ({selectedCount})
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto border border-app-border radius-card">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-app-bg/80 border-b border-app-border text-app-text-3 font-semibold">
                    <th className="p-3 w-10">
                      <input
                        type="checkbox"
                        checked={selectedCount > 0 && selectedCount === Math.min(10, tableData.length)}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="rounded border-app-border text-brand focus:ring-0"
                      />
                    </th>
                    <th className="p-3">Target Domain</th>
                    <th className="p-3">Priority Score</th>
                    <th className="p-3">Citations</th>
                    <th className="p-3">Action Category</th>
                    <th className="p-3">Pitch Strategy</th>
                    <th className="p-3">Top Cited URL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-app-border/40">
                  {tableData.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-app-text-3">
                        No audit records yet. Click "Run Gemini Citation Prospector" above to start live discovery!
                      </td>
                    </tr>
                  ) : (
                    tableData.map((row, idx) => (
                      <tr
                        key={idx}
                        className={`hover:bg-brand/5 transition-colors ${
                          selectedDomains[row.domain] ? 'bg-brand/10' : ''
                        }`}
                      >
                        <td className="p-3">
                          <input
                            type="checkbox"
                            checked={Boolean(selectedDomains[row.domain])}
                            onChange={() => handleToggleDomain(row.domain)}
                            className="rounded border-app-border text-brand focus:ring-0"
                          />
                        </td>
                        <td className="p-3 font-semibold text-app-text font-mono">
                          {row.domain}
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 radius-pill bg-brand/15 text-brand font-bold">
                            {row.priority_score}
                          </span>
                        </td>
                        <td className="p-3 font-medium text-app-text-2">
                          {row.citations}
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 radius-pill text-[11px] font-semibold ${
                              row.action.startsWith('Outreach')
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                : row.action.startsWith('Directory')
                                ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30'
                                : row.action.startsWith('Community')
                                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                                : 'bg-app-bg text-app-text-3'
                            }`}
                          >
                            {row.action}
                          </span>
                        </td>
                        <td className="p-3 text-app-text-2 font-medium">
                          {row.best_pitch_type}
                        </td>
                        <td className="p-3 font-mono text-app-text-3 truncate max-w-xs">
                          {row.top_urls ? (
                            <a
                              href={row.top_urls.split(' | ')[0]}
                              target="_blank"
                              rel="noreferrer"
                              className="text-brand hover:underline flex items-center gap-1"
                            >
                              {row.top_urls.split(' | ')[0]} <ExternalLink className="w-3 h-3 shrink-0" />
                            </a>
                          ) : (
                            '-'
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: COMPETITOR GAPS */}
        {activeTab === 'gaps' && (
          <div className="space-y-4">
            <p className="text-xs text-app-text-2">
              Specific buyer questions where competitors were recommended by AI, but <strong>{clientName}</strong> was missing.
            </p>

            <div className="grid grid-cols-1 gap-3">
              {gapsData.length === 0 ? (
                <div className="p-6 text-center text-app-text-3 border border-app-border radius-card">
                  No competitor gaps detected in current run, or run the audit first!
                </div>
              ) : (
                gapsData.map((gap, idx) => (
                  <div key={idx} className="p-4 bg-app-bg border border-app-border radius-card space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-app-text">
                        ❓ "{gap.prompt}"
                      </span>
                      <Badge variant="warning">Market: {gap.market}</Badge>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-app-text-2">
                      <span className="text-rose-400 font-semibold">Winning Competitor(s):</span>
                      {gap.winning_competitors.map((c, cIdx) => (
                        <span key={cIdx} className="px-2 py-0.5 bg-rose-500/15 text-rose-300 radius-pill font-medium">
                          {c}
                        </span>
                      ))}
                    </div>
                    {gap.cited_sources.length > 0 && (
                      <div className="text-[11px] text-app-text-3 flex items-center gap-2 pt-1 font-mono">
                        <span>Citations:</span>
                        {gap.cited_sources.map((s, sIdx) => (
                          <a key={sIdx} href={s} target="_blank" rel="noreferrer" className="text-brand hover:underline truncate max-w-xs">
                            {s}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 3: OUTREACH PITCHES */}
        {activeTab === 'pitches' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-app-text-2">
                Personalized email drafts, anchor texts, and context sentences generated for target publishers.
              </p>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleGeneratePitchesForSelected}
                disabled={selectedCount === 0 || isLoading}
              >
                Write Pitches for Selected ({selectedCount})
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {pitches.length === 0 ? (
                <div className="p-8 text-center text-app-text-3 border border-app-border radius-card space-y-2">
                  <p>No pitches generated yet.</p>
                  <p className="text-xs">
                    Select target domains in the Link Targets tab and click "✍️ Write Pitches".
                  </p>
                </div>
              ) : (
                pitches.map((p, pIdx) => (
                  <div key={pIdx} className="p-5 bg-app-bg border border-app-border radius-card space-y-3">
                    <div className="flex items-center justify-between border-b border-app-border pb-2">
                      <div>
                        <h4 className="text-sm font-bold text-app-text font-mono">
                          {p.domain || p.url}
                        </h4>
                        <span className="text-[11px] text-brand-accent font-semibold">
                          Strategy: {p.pitch_type || 'Niche Edit'}
                        </span>
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleCopyText(`Subject: ${p.subject}\n\n${p.email}`, pIdx)}
                        icon={copiedIndex === pIdx ? <Check className="w-3.5 h-3.5 text-brand-accent" /> : <Copy className="w-3.5 h-3.5" />}
                      >
                        {copiedIndex === pIdx ? 'Copied' : 'Copy Pitch'}
                      </Button>
                    </div>

                    <div className="space-y-1">
                      <span className="text-xs font-semibold text-app-text-2">Subject:</span>
                      <p className="text-xs font-medium text-app-text bg-app-surface p-2 radius-btn border border-app-border">
                        {p.subject}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <span className="text-xs font-semibold text-app-text-2">Email Body:</span>
                      <pre className="text-xs text-app-text-2 bg-app-surface p-3 radius-btn border border-app-border whitespace-pre-wrap font-sans">
                        {p.email}
                      </pre>
                    </div>

                    {(p.suggested_anchor || p.suggested_sentence) && (
                      <div className="p-3 bg-brand/5 border border-brand/20 radius-btn text-xs space-y-1">
                        {p.suggested_anchor && (
                          <div>
                            <strong className="text-brand font-semibold">Suggested Anchor:</strong> {p.suggested_anchor}
                          </div>
                        )}
                        {p.suggested_sentence && (
                          <div>
                            <strong className="text-brand font-semibold">Suggested Sentence:</strong> "{p.suggested_sentence}"
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 4: AI CONTENT BRIEF */}
        {activeTab === 'brief' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-app-text-2">
                Editorial structure and 5 linkable asset ideas synthesized from top performing pages.
              </p>
              <Button
                variant="primary"
                size="sm"
                onClick={generateBrief}
                disabled={isLoading}
                icon={<Sparkles className="w-3.5 h-3.5" />}
              >
                {contentBrief ? 'Re-build Brief' : 'Generate Content Brief'}
              </Button>
            </div>

            {!contentBrief ? (
              <div className="p-8 text-center text-app-text-3 border border-app-border radius-card space-y-2">
                <p>No content brief generated for this run yet.</p>
                <p className="text-xs">Click "Generate Content Brief" to create 5 linkable asset ideas and winning editorial angles.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-app-bg border border-app-border radius-card space-y-2">
                  <h4 className="text-sm font-bold text-brand">Winning Angles & Structure</h4>
                  <p className="text-xs text-app-text-2 leading-relaxed">
                    {contentBrief.editorial_angle || contentBrief.structure_summary || 'Comprehensive guide covering local SEO benchmarks, verified client case studies, and transparent ROI metrics.'}
                  </p>
                </div>

                {contentBrief.content_ideas && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-app-text uppercase tracking-wider">
                      💡 5 High-Authority Linkable Asset Ideas
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {contentBrief.content_ideas.map((idea: any, iIdx: number) => (
                        <div key={iIdx} className="p-3.5 bg-app-bg border border-app-border radius-card space-y-1">
                          <span className="text-xs font-bold text-app-text">
                            {iIdx + 1}. {typeof idea === 'string' ? idea : idea.title || idea.name}
                          </span>
                          {idea.description && (
                            <p className="text-[11px] text-app-text-2">
                              {idea.description}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
