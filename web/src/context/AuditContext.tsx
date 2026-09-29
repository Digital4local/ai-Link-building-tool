import React, { createContext, useContext, useState, useEffect } from 'react';
import { api, type AuditResult, type AuditTableItem, type PitchItem } from '../services/api';

interface AuditContextType {
  apiKey: string;
  setApiKey: (key: string) => void;
  clientName: string;
  setClientName: (name: string) => void;
  clientDomain: string;
  setClientDomain: (dom: string) => void;
  service: string;
  setService: (svc: string) => void;
  markets: string[];
  setMarkets: (mkts: string[]) => void;
  locationInput: string;
  setLocationInput: (val: string) => void;
  competitors: string;
  setCompetitors: (comps: string) => void;
  prompts: string[];
  setPrompts: (prompts: string[]) => void;
  model: string;
  setModel: (model: string) => void;
  auditResult: AuditResult | null;
  pitches: PitchItem[];
  contentBrief: any;
  isLoading: boolean;
  statusMessage: string;
  error: string | null;
  isKeyVerified: boolean;
  verifyApiKey: (key?: string) => Promise<boolean>;
  generatePrompts: () => Promise<void>;
  runAudit: () => Promise<void>;
  generatePitches: (selectedTargets: AuditTableItem[]) => Promise<void>;
  generateBrief: () => Promise<void>;
  downloadExcelReport: () => Promise<void>;
  downloadHtmlReport: () => Promise<void>;
}

const AuditContext = createContext<AuditContextType | undefined>(undefined);

export const AuditProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [apiKey, setApiKey] = useState<string>(() => localStorage.getItem('gemini_api_key') || '');
  const [clientName, setClientName] = useState<string>('Digital4Local');
  const [clientDomain, setClientDomain] = useState<string>('digital4local.com');
  const [service, setService] = useState<string>('AI growth and local SEO agencies');
  const [locationInput, setLocationInput] = useState<string>('the UK, the US');
  const [markets, setMarkets] = useState<string[]>(['the UK', 'the US']);
  const [competitors, setCompetitors] = useState<string>(
    'FatJoe | fatjoe.com\nSiege Media | siegemedia.com\nPage One Power | pageonepower.com'
  );
  const [prompts, setPrompts] = useState<string[]>([
    'What are the best AI growth and local SEO agencies in the UK?',
    'Top rated AI growth and local SEO agencies in the UK — who do people recommend most?',
    'How do I choose between AI growth and local SEO agencies in the UK?',
    'Which AI growth and local SEO agencies in the UK have the best verified reviews?',
    'Compare the leading AI growth and local SEO agencies in the UK'
  ]);
  const [model, setModel] = useState<string>('gemini-3.1-flash-lite');
  const [auditResult, setAuditResult] = useState<AuditResult | null>(null);
  const [pitches, setPitches] = useState<PitchItem[]>([]);
  const [contentBrief, setContentBrief] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isKeyVerified, setIsKeyVerified] = useState<boolean>(false);

  // Load config and pre-filled env key from backend on mount
  useEffect(() => {
    api.getConfig().then((cfg) => {
      if (cfg.has_env_key && !apiKey) {
        setApiKey(cfg.env_key);
        localStorage.setItem('gemini_api_key', cfg.env_key);
        setIsKeyVerified(true);
      }
      if (cfg.default_client_name) setClientName(cfg.default_client_name);
      if (cfg.default_client_domain) setClientDomain(cfg.default_client_domain);
      if (cfg.default_service) setService(cfg.default_service);
      if (cfg.default_competitors) setCompetitors(cfg.default_competitors);
    }).catch(() => {});
  }, []);

  // Sync apiKey to localStorage
  const handleSetApiKey = (key: string) => {
    setApiKey(key);
    localStorage.setItem('gemini_api_key', key);
    setIsKeyVerified(false);
  };

  const handleSetLocationInput = (val: string) => {
    setLocationInput(val);
    const split = val.split(',').map((s) => s.trim()).filter(Boolean);
    setMarkets(split.length ? split : ['the UK']);
  };

  const verifyApiKey = async (keyToVerify?: string): Promise<boolean> => {
    const key = (keyToVerify || apiKey).trim();
    if (!key) {
      setError('Please enter a Gemini API Key first.');
      return false;
    }
    setIsLoading(true);
    setStatusMessage('Connecting to Google Gemini API...');
    setError(null);
    try {
      await api.verifyKey(key, model);
      setIsKeyVerified(true);
      setStatusMessage('Google Gemini API Key verified & active!');
      setTimeout(() => setStatusMessage(''), 4000);
      return true;
    } catch (err: any) {
      setIsKeyVerified(false);
      setError(err.message || 'Key verification failed');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const generatePrompts = async () => {
    setIsLoading(true);
    setStatusMessage('Generating high-intent buyer questions with Gemini...');
    setError(null);
    try {
      const generated = await api.generatePrompts(
        service,
        markets[0] || 'the UK',
        5,
        apiKey,
        model
      );
      if (generated && generated.length) {
        setPrompts(generated);
        setStatusMessage('Generated 5 high-intent buyer questions!');
        setTimeout(() => setStatusMessage(''), 3000);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to generate prompts');
    } finally {
      setIsLoading(false);
    }
  };

  const runAudit = async () => {
    if (!apiKey.trim()) {
      setError('Please enter your Google Gemini API Key in Step 0 before running the audit.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setStatusMessage(`Running Gemini Citation Prospector across ${markets.length} market(s)...`);

    try {
      const result = await api.runAudit({
        client_name: clientName,
        client_domain: clientDomain,
        service,
        markets,
        competitors,
        prompts,
        repeats: 1,
        api_key: apiKey,
        model,
        delay_sec: 0.0,
      });

      setAuditResult(result);
      setStatusMessage(`Audit complete! Discovered ${result.summary.unique_domains} unique cited domains.`);
      setTimeout(() => setStatusMessage(''), 4000);
    } catch (err: any) {
      setError(err.message || 'Audit execution failed. Please check your API key.');
    } finally {
      setIsLoading(false);
    }
  };

  const generatePitches = async (selectedTargets: AuditTableItem[]) => {
    if (!selectedTargets.length) return;
    setIsLoading(true);
    setStatusMessage(`Generating personalized outreach pitches for ${selectedTargets.length} target(s)...`);
    setError(null);
    try {
      const newPitches = await api.generatePitches(
        selectedTargets,
        clientName,
        clientDomain,
        service,
        markets[0] || 'the UK',
        apiKey,
        model
      );
      setPitches((prev) => [...prev, ...newPitches]);
      setStatusMessage(`Successfully generated ${newPitches.length} personalized outreach pitches!`);
      setTimeout(() => setStatusMessage(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to generate pitches');
    } finally {
      setIsLoading(false);
    }
  };

  const generateBrief = async () => {
    setIsLoading(true);
    setStatusMessage('Building editorial content brief & 5 linkable assets with Gemini...');
    setError(null);
    try {
      const topPages = auditResult?.table?.slice(0, 10) || [];
      const res = await api.generateBrief(
        topPages,
        clientName,
        clientDomain,
        service,
        markets[0] || 'the UK',
        apiKey,
        model
      );
      setContentBrief(res.brief);
      setStatusMessage('Editorial content brief & linkable assets synthesized successfully!');
      setTimeout(() => setStatusMessage(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to generate content brief');
    } finally {
      setIsLoading(false);
    }
  };

  const downloadExcelReport = async () => {
    if (!auditResult) return;
    try {
      const blob = await api.exportExcel({
        run_payload: auditResult.records,
        table: auditResult.table,
        gap_pages: [],
        brand_summary: [],
        pitches,
        content_brief: contentBrief,
        agency_name: 'Digital4Local',
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ai_citation_report_${clientName.toLowerCase().replace(/\s+/g, '_')}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err: any) {
      setError('Failed to download Excel report');
    }
  };

  const downloadHtmlReport = async () => {
    if (!auditResult) return;
    try {
      const blob = await api.exportHtml({
        run_payload: auditResult.records,
        table: auditResult.table,
        gap_pages: [],
        brand_summary: [],
        pitches,
        content_brief: contentBrief,
        agency_name: 'Digital4Local',
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ai_citation_report_${clientName.toLowerCase().replace(/\s+/g, '_')}.html`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err: any) {
      setError('Failed to download HTML report');
    }
  };

  return (
    <AuditContext.Provider
      value={{
        apiKey,
        setApiKey: handleSetApiKey,
        clientName,
        setClientName,
        clientDomain,
        setClientDomain,
        service,
        setService,
        markets,
        setMarkets,
        locationInput,
        setLocationInput: handleSetLocationInput,
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
      }}
    >
      {children}
    </AuditContext.Provider>
  );
};

export const useAudit = () => {
  const context = useContext(AuditContext);
  if (!context) {
    throw new Error('useAudit must be used within an AuditProvider');
  }
  return context;
};
