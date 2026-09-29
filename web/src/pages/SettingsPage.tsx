import React, { useState } from 'react';
import {
  Key,
  ShieldCheck,
  Zap,
  Building,
  CheckCircle2,
  AlertCircle,
  Sliders,
  ExternalLink,
} from 'lucide-react';
import { Button } from '../components/Button';
import { defaultCampaign } from '../data/mockData';

export const SettingsPage: React.FC = () => {
  const [apiKey, setApiKey] = useState('AIzaSyD4L_Local_Demo_SessionKey');
  const [selectedModel, setSelectedModel] = useState('gemini-3.1-flash-lite');
  const [pacingDelay, setPacingDelay] = useState(6.0);
  const [agencyName, setAgencyName] = useState(defaultCampaign.agencyName);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');

  const handleTestConnection = () => {
    setTestStatus('testing');
    setTimeout(() => {
      if (apiKey.trim().length > 5) {
        setTestStatus('success');
      } else {
        setTestStatus('error');
      }
    }, 800);
  };

  return (
    <div className="max-w-4xl space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="border-b border-app-border pb-5">
        <h1 className="font-h1 text-app-text">Engine & API Settings</h1>
        <p className="text-xs text-app-text-2 mt-1">
          Configure Google Gemini BYOK API keys, rate limit pacing, and white-label agency branding.
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
              isLoading={testStatus === 'testing'}
              icon={<Zap className="w-3.5 h-3.5 text-brand-accent" />}
            >
              Test API Connection
            </Button>

            {testStatus === 'success' && (
              <span className="text-xs text-success font-semibold flex items-center gap-1 animate-fadeIn">
                <CheckCircle2 className="w-4 h-4" />
                Connected to `{selectedModel}` successfully!
              </span>
            )}
            {testStatus === 'error' && (
              <span className="text-xs text-danger font-semibold flex items-center gap-1 animate-fadeIn">
                <AlertCircle className="w-4 h-4" />
                Invalid key. Please check Google AI Studio.
              </span>
            )}
          </div>
        </div>

        {/* Model Selection */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-app-border/60">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-app-text">Default Model</label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full h-10 px-3 bg-app-surface-2 border border-app-border radius-input text-xs text-app-text focus:outline-none focus:border-brand"
            >
              <option value="gemini-3.1-flash-lite">gemini-3.1-flash-lite (Fast & Reliable)</option>
              <option value="gemini-3.8-flash">gemini-3.8-flash (Recommended)</option>
              <option value="gemini-3.7-flash">gemini-3.7-flash</option>
              <option value="gemini-2.5-flash">gemini-2.5-flash</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-app-text">
                Pacing Delay (Free Tier Safety)
              </label>
              <span className="text-xs font-mono font-bold text-brand">{pacingDelay}s</span>
            </div>
            <input
              type="range"
              min="1.0"
              max="15.0"
              step="0.5"
              value={pacingDelay}
              onChange={(e) => setPacingDelay(parseFloat(e.target.value))}
              className="w-full accent-brand"
            />
            <span className="text-[11px] text-app-text-3 block">
              Sequential delay between prompt grounding calls to stay under 15 RPM.
            </span>
          </div>
        </div>
      </section>

      {/* 2. White-Label Agency Settings */}
      <section className="bg-app-surface border border-app-border radius-card p-6 space-y-5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-brand-accent/15 text-brand-accent flex items-center justify-center">
            <Building className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-h3 text-app-text">White-Label Client Delivery Branding</h2>
            <p className="text-xs text-app-text-3">
              Customize headers on exported HTML dashboards and multi-tab Excel sheets.
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
