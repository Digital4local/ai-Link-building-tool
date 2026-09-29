import React, { useState } from 'react';
import {
  Key,
  ShieldCheck,
  Zap,
  Building,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Globe,
  Sliders,
} from 'lucide-react';
import { Button } from '../components/Button';
import { useAudit } from '../context/AuditContext';

export const SettingsPage: React.FC = () => {
  const {
    apiKey,
    setApiKey,
    model,
    setModel,
    isKeyVerified,
    verifyApiKey,
    clientName,
    setClientName,
    clientDomain,
    setClientDomain,
    service,
    setService,
    isLoading,
  } = useAudit();

  const [agencyName, setAgencyName] = useState('Digital4Local AI Growth Engine');
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>(
    isKeyVerified ? 'success' : 'idle'
  );
  const [errorMessage, setErrorMessage] = useState<string>('');

  const handleTestConnection = async () => {
    setTestStatus('testing');
    setErrorMessage('');
    const ok = await verifyApiKey(apiKey);
    if (ok) {
      setTestStatus('success');
    } else {
      setTestStatus('error');
      setErrorMessage('Failed to connect to Google Gemini. Please check your API key.');
    }
  };

  return (
    <div className="max-w-4xl space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="border-b border-app-border pb-5">
        <h1 className="font-h1 text-app-text">Engine & Project Settings</h1>
        <p className="text-xs text-app-text-2 mt-1">
          Configure Google Gemini BYOK API keys, active client project parameters, and white-label branding.
        </p>
      </div>

      {/* 1. Google Gemini BYOK Section */}
      <section className="bg-app-surface border border-app-border radius-card p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand/15 text-brand flex items-center justify-center">
              <Key className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-h3 text-app-text">Google Gemini API Key (BYOK)</h2>
              <p className="text-xs text-app-text-3">
                Zero hosting cost. Visitor keys run directly against Google AI Studio free tier.
              </p>
            </div>
          </div>

          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noreferrer"
            className="text-xs text-brand hover:underline font-semibold flex items-center gap-1"
          >
            Get Free Key <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        <div className="space-y-3 pt-2">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-app-text">Gemini API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                setTestStatus('idle');
              }}
              placeholder="AIzaSy..."
              className="w-full h-10 px-3 bg-app-surface-2 border border-app-border radius-input text-xs text-app-text font-mono focus:outline-none focus:border-brand"
            />
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleTestConnection}
              isLoading={isLoading || testStatus === 'testing'}
              icon={<Zap className="w-3.5 h-3.5 text-brand-accent" />}
            >
              Test API Connection
            </Button>

            {testStatus === 'success' && (
              <span className="text-xs text-success font-semibold flex items-center gap-1 animate-fadeIn">
                <CheckCircle2 className="w-4 h-4" />
                Connected to `{model}` successfully!
              </span>
            )}
            {testStatus === 'error' && (
              <span className="text-xs text-danger font-semibold flex items-center gap-1 animate-fadeIn">
                <AlertCircle className="w-4 h-4" />
                {errorMessage || 'Invalid key. Please check Google AI Studio.'}
              </span>
            )}
          </div>
        </div>

        {/* Model Selection */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-app-border/60">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-app-text">Active LLM Model</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full h-10 px-3 bg-app-surface-2 border border-app-border radius-input text-xs text-app-text focus:outline-none focus:border-brand"
            >
              <option value="gemini-3.1-flash-lite">gemini-3.1-flash-lite (Fastest & Active)</option>
              <option value="gemini-3.5-flash">gemini-3.5-flash (Balanced)</option>
              <option value="gemini-3.8-flash">gemini-3.8-flash (High Reasoning)</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-app-text">Target Service Niche</label>
            <input
              type="text"
              value={service}
              onChange={(e) => setService(e.target.value)}
              placeholder="e.g. AI growth and local SEO agencies"
              className="w-full h-10 px-3 bg-app-surface-2 border border-app-border radius-input text-xs text-app-text focus:outline-none focus:border-brand"
            />
          </div>
        </div>
      </section>

      {/* 2. Client Profile Configuration */}
      <section className="bg-app-surface border border-app-border radius-card p-6 space-y-5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-brand-accent/15 text-brand-accent flex items-center justify-center">
            <Globe className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-h3 text-app-text">Current Project / Client Target</h2>
            <p className="text-xs text-app-text-3">
              Defines the primary domain and brand name evaluated across all dashboard tabs.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-app-text">Client Brand Name</label>
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className="w-full h-10 px-3 bg-app-surface-2 border border-app-border radius-input text-xs text-app-text focus:outline-none focus:border-brand"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-app-text">Client Domain</label>
            <input
              type="text"
              value={clientDomain}
              onChange={(e) => setClientDomain(e.target.value)}
              className="w-full h-10 px-3 bg-app-surface-2 border border-app-border radius-input text-xs text-app-text font-mono focus:outline-none focus:border-brand"
            />
          </div>
        </div>
      </section>

      {/* 3. White-Label Agency Settings */}
      <section className="bg-app-surface border border-app-border radius-card p-6 space-y-5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-success/15 text-success flex items-center justify-center">
            <Building className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-h3 text-app-text">White-Label Client Delivery Branding</h2>
            <p className="text-xs text-app-text-3">
              Customize agency headers on exported HTML dashboards and multi-tab Excel workbooks.
            </p>
          </div>
        </div>

        <div className="space-y-3 pt-2">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-app-text">Agency / Consultancy Name</label>
            <input
              type="text"
              value={agencyName}
              onChange={(e) => setAgencyName(e.target.value)}
              className="w-full h-10 px-3 bg-app-surface-2 border border-app-border radius-input text-xs text-app-text focus:outline-none focus:border-brand"
            />
          </div>
        </div>
      </section>
    </div>
  );
};
