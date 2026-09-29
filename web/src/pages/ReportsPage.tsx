import React, { useState } from 'react';
import {
  FileText,
  Download,
  Printer,
  Sparkles,
  Building,
  CheckCircle2,
  ExternalLink,
  Play,
} from 'lucide-react';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import { DomainCell } from '../components/DomainCell';
import { useAudit } from '../context/AuditContext';

export const ReportsPage: React.FC = () => {
  const {
    clientName,
    setClientName,
    clientDomain,
    service,
    markets,
    auditResult,
    pitches,
    downloadExcelReport,
    downloadHtmlReport,
    runAudit,
    isLoading,
  } = useAudit();

  const [agencyName, setAgencyName] = useState('Digital4Local AI Growth Agency');

  const handleDownloadHTML = () => {
    if (auditResult) {
      downloadHtmlReport();
    } else {
      alert('Please run an audit first to generate report deliverables!');
    }
  };

  const handleDownloadExcel = () => {
    if (auditResult) {
      downloadExcelReport();
    } else {
      alert('Please run an audit first to generate report deliverables!');
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-app-border pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 rounded-md bg-brand/15 text-brand flex items-center justify-center">
              <FileText className="w-3.5 h-3.5" />
            </div>
            <h1 className="font-h1 text-app-text">White-Label Client Reports</h1>
          </div>
          <p className="text-xs text-app-text-2">
            Generate executive HTML dashboards and multi-tab Excel workbooks ready for <strong>{clientName}</strong> delivery.
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleDownloadExcel}
            icon={<Download className="w-3.5 h-3.5" />}
          >
            Export Excel (.xlsx)
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleDownloadHTML}
            icon={<Printer className="w-3.5 h-3.5" />}
          >
            Download HTML Report
          </Button>
        </div>
      </div>

      {/* Agency Branding Input Card */}
      <div className="p-4 bg-app-surface border border-app-border radius-card grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-app-text">White-Label Agency Header</label>
          <div className="relative">
            <Building className="w-4 h-4 text-app-text-3 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={agencyName}
              onChange={(e) => setAgencyName(e.target.value)}
              className="w-full h-9 pl-9 pr-3 bg-app-surface-2 border border-app-border radius-input text-xs text-app-text focus:outline-none focus:border-brand"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-app-text">Client Target Name</label>
          <input
            type="text"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            className="w-full h-9 px-3 bg-app-surface-2 border border-app-border radius-input text-xs text-app-text focus:outline-none focus:border-brand"
          />
        </div>
      </div>

      {/* If No Audit Run Yet */}
      {!auditResult ? (
        <div className="bg-app-surface border border-app-border radius-card p-8 md:p-12 text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-brand/15 text-brand flex items-center justify-center mx-auto">
            <FileText className="w-6 h-6" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="font-h2 text-app-text">No Audit Data Available for Report</h3>
            <p className="text-xs text-app-text-2">
              Run the citation prospector for <strong>{clientName}</strong> to generate complete executive reports and link building deliverables.
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
        /* Live Preview Container (Dark Luxury Board) */
        <div className="bg-[#0b0e14] border border-app-border-strong radius-panel p-6 md:p-8 space-y-6 shadow-2xl">
          {/* Executive Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
            <div>
              <span className="px-2.5 py-0.5 radius-pill bg-brand/20 text-brand border border-brand/30 text-xs font-semibold">
                EXECUTIVE INTELLIGENCE AUDIT
              </span>
              <h2 className="text-xl md:text-2xl font-bold text-white mt-2">
                AI Visibility & Citation Benchmark Report
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Client Target: <strong className="text-white">{clientName}</strong> ({clientDomain}) · Market: {markets.join(', ')}
              </p>
            </div>

            <div className="text-right">
              <span className="text-xs text-brand-accent font-bold tracking-wide uppercase block">
                {agencyName}
              </span>
              <span className="text-[11px] text-slate-500 font-mono">
                Model: {auditResult.status || 'Active Audit'}
              </span>
            </div>
          </div>

          {/* 3 KPI Highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-white/5 border border-white/10 radius-card">
              <span className="text-xs text-slate-400 font-medium">Discovered Authority Domains</span>
              <div className="text-3xl font-extrabold text-brand-accent font-metric mt-1">
                {auditResult.summary.unique_domains}
              </div>
              <span className="text-[11px] text-success font-semibold mt-1 block">
                {auditResult.summary.total_answers} LLM queries evaluated
              </span>
            </div>

            <div className="p-4 bg-white/5 border border-white/10 radius-card">
              <span className="text-xs text-slate-400 font-medium">Share of Voice</span>
              <div className="text-3xl font-extrabold text-white font-metric mt-1">
                {auditResult.summary.client_sov_pct.toFixed(1)}%
              </div>
              <span className="text-[11px] text-brand font-semibold mt-1 block">
                Target: {clientName}
              </span>
            </div>

            <div className="p-4 bg-white/5 border border-white/10 radius-card">
              <span className="text-xs text-slate-400 font-medium">Avg Authority Score</span>
              <div className="text-3xl font-extrabold text-white font-metric mt-1">
                {Math.round(auditResult.summary.avg_priority_score || 85)} / 100
              </div>
              <span className="text-[11px] text-success font-semibold mt-1 block">
                Top citations indexed
              </span>
            </div>
          </div>

          {/* Top 5 Prioritized Link Targets Table */}
          <div className="bg-white/5 border border-white/10 radius-card p-5 space-y-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-brand-accent" />
              Top Discovered Link Building Targets for {clientName}
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-slate-400 uppercase tracking-wider text-[11px]">
                    <th className="py-2.5 px-3">Publishing Domain</th>
                    <th className="py-2.5 px-3 text-right">Citation Score</th>
                    <th className="py-2.5 px-3 text-right">LLM Cites</th>
                    <th className="py-2.5 px-3 text-center">Recommended Strategy</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-200">
                  {auditResult.table.slice(0, 5).map((s, idx) => (
                    <tr key={idx}>
                      <td className="py-3 px-3 font-semibold text-white">{s.domain}</td>
                      <td className="py-3 px-3 text-right font-bold text-success font-mono">
                        {s.priority_score || 85} / 100
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-300">
                        {s.citations} cites
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="px-2 py-0.5 radius-badge bg-brand/20 text-brand text-[11px] font-semibold border border-brand/30">
                          {s.best_pitch_type || s.action || 'Editorial Inclusion'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
