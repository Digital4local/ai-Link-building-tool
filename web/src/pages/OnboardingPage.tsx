import React, { useState } from 'react';
import { Sparkles, ArrowRight, ArrowLeft, CheckCircle2, Globe, Building2, Target, Key } from 'lucide-react';
import { Button } from '../components/Button';
import type { CampaignProfile } from '../data/mockData';

export interface OnboardingPageProps {
  onComplete: (campaign: CampaignProfile) => void;
  onCancel: () => void;
}

export const OnboardingPage: React.FC<OnboardingPageProps> = ({
  onComplete,
  onCancel,
}) => {
  const [step, setStep] = useState(1);
  const [clientName, setClientName] = useState('Digital4Local');
  const [clientDomain, setClientDomain] = useState('digital4local.com');
  const [serviceNiche, setServiceNiche] = useState('AI Growth & Local SEO Agencies');
  const [markets, setMarkets] = useState('United Kingdom, United States');
  const [competitorsText, setCompetitorsText] = useState(
    'FatJoe | fatjoe.com\nSiege Media | siegemedia.com\nPage One Power | pageonepower.com'
  );
  const [apiKey, setApiKey] = useState('');

  const handleNext = () => {
    if (step < 4) {
      setStep(step + 1);
    } else {
      const parsedCompetitors = competitorsText
        .split('\n')
        .filter((l) => l.trim().length > 0)
        .map((line, idx) => {
          const parts = line.split('|').map((s) => s.trim());
          const colors = ['#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#64748B'];
          return {
            name: parts[0] || `Competitor ${idx + 1}`,
            domain: parts[1] || `comp${idx + 1}.com`,
            color: colors[idx % colors.length],
          };
        });

      const campaign: CampaignProfile = {
        clientName,
        clientDomain,
        serviceNiche,
        markets: markets.split(',').map((m) => m.trim()),
        competitors: parsedCompetitors,
        agencyName: `${clientName} Intelligence`,
      };

      onComplete(campaign);
    }
  };

  return (
    <div className="min-h-screen bg-app-bg text-app-text flex flex-col items-center justify-center p-4 md:p-8">
      {/* Centered 560px Onboarding Card */}
      <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Left 560px Wizard Form */}
        <div className="lg:col-span-7 bg-app-surface border border-app-border radius-panel p-6 md:p-8 elevation-sheet space-y-6">
          {/* Header & Progress */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-brand uppercase tracking-wider">
                Step {step} of 4
              </span>
              <button
                onClick={onCancel}
                className="text-xs text-app-text-3 hover:text-app-text transition-colors"
              >
                Back to Dashboard
              </button>
            </div>

            {/* 4 Step Progress Bar */}
            <div className="w-full h-1.5 bg-app-surface-3 rounded-full overflow-hidden flex gap-1">
              {[1, 2, 3, 4].map((s) => (
                <div
                  key={s}
                  className={`flex-1 h-full rounded-full transition-colors duration-200 ${
                    step >= s ? 'bg-brand' : 'bg-transparent'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Step 1: Brand & Domain */}
          {step === 1 && (
            <div className="space-y-4 animate-fadeIn">
              <div>
                <h2 className="font-h2 text-app-text">What brand are we optimizing?</h2>
                <p className="text-xs text-app-text-2 mt-1">
                  Enter your client’s primary brand name and canonical root domain.
                </p>
              </div>

              <div className="space-y-3 pt-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-app-text">Client Brand Name</label>
                  <div className="relative">
                    <Building2 className="w-4 h-4 text-app-text-3 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      placeholder="e.g. Digital4Local"
                      className="w-full h-10 pl-9 pr-3 bg-app-surface-2 border border-app-border radius-input text-xs text-app-text focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-app-text">Client Root Domain</label>
                  <div className="relative">
                    <Globe className="w-4 h-4 text-app-text-3 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={clientDomain}
                      onChange={(e) => setClientDomain(e.target.value)}
                      placeholder="e.g. digital4local.com"
                      className="w-full h-10 pl-9 pr-3 bg-app-surface-2 border border-app-border radius-input text-xs text-app-text font-mono focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Niche & Markets */}
          {step === 2 && (
            <div className="space-y-4 animate-fadeIn">
              <div>
                <h2 className="font-h2 text-app-text">Service Niche & Geographic Markets</h2>
                <p className="text-xs text-app-text-2 mt-1">
                  Specify what service queries to reverse-engineer and target regions.
                </p>
              </div>

              <div className="space-y-3 pt-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-app-text">Service / Niche (Plural)</label>
                  <input
                    type="text"
                    value={serviceNiche}
                    onChange={(e) => setServiceNiche(e.target.value)}
                    placeholder="e.g. Local SEO agencies, B2B link building"
                    className="w-full h-10 px-3 bg-app-surface-2 border border-app-border radius-input text-xs text-app-text focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-app-text">Target Geographic Markets</label>
                  <input
                    type="text"
                    value={markets}
                    onChange={(e) => setMarkets(e.target.value)}
                    placeholder="e.g. United Kingdom, United States, Australia"
                    className="w-full h-10 px-3 bg-app-surface-2 border border-app-border radius-input text-xs text-app-text focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                  />
                  <p className="text-[11px] text-app-text-3">Comma-separated for multi-market heatmap mode.</p>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Competitors */}
          {step === 3 && (
            <div className="space-y-4 animate-fadeIn">
              <div>
                <h2 className="font-h2 text-app-text">Identify Direct Competitors</h2>
                <p className="text-xs text-app-text-2 mt-1">
                  Enter competitors to detect citation gaps (one per line: Brand | domain.com).
                </p>
              </div>

              <div className="space-y-1.5 pt-2">
                <label className="text-xs font-semibold text-app-text">Competitor List</label>
                <textarea
                  rows={4}
                  value={competitorsText}
                  onChange={(e) => setCompetitorsText(e.target.value)}
                  placeholder="FatJoe | fatjoe.com&#10;Siege Media | siegemedia.com"
                  className="w-full p-3 bg-app-surface-2 border border-app-border radius-input text-xs text-app-text font-mono focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                />
              </div>
            </div>
          )}

          {/* Step 4: BYOK Key & Confirmation */}
          {step === 4 && (
            <div className="space-y-4 animate-fadeIn">
              <div>
                <h2 className="font-h2 text-app-text">Enter Free Google Gemini API Key</h2>
                <p className="text-xs text-app-text-2 mt-1">
                  100% free from Google AI Studio. Your key runs queries without any agency billing.
                </p>
              </div>

              <div className="space-y-3 pt-2">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-app-text">Gemini API Key</label>
                    <a
                      href="https://aistudio.google.com/app/apikey"
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-brand hover:underline font-medium"
                    >
                      Get Free Key in 30s →
                    </a>
                  </div>
                  <div className="relative">
                    <Key className="w-4 h-4 text-app-text-3 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="AIzaSy... (Leave blank for sample data mode)"
                      className="w-full h-10 pl-9 pr-3 bg-app-surface-2 border border-app-border radius-input text-xs text-app-text font-mono focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                    />
                  </div>
                </div>

                <div className="p-3 bg-brand/5 border border-brand/20 radius-input text-xs text-app-text-2">
                  <span className="font-semibold text-brand">Ready to Launch:</span> We will synthesize 24 prompt queries across Google Gemini Grounding, calculate 0-100 citation-worthiness, and discover missing competitor links.
                </div>
              </div>
            </div>
          )}

          {/* Navigation Controls */}
          <div className="pt-4 border-t border-app-border flex items-center justify-between">
            {step > 1 ? (
              <Button
                variant="secondary"
                size="md"
                onClick={() => setStep(step - 1)}
                icon={<ArrowLeft className="w-4 h-4" />}
              >
                Back
              </Button>
            ) : (
              <div />
            )}

            <Button
              variant="primary"
              size="md"
              onClick={handleNext}
              icon={step === 4 ? <Sparkles className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
              iconPosition="right"
            >
              {step === 4 ? 'Launch Intelligence Run' : 'Continue'}
            </Button>
          </div>
        </div>

        {/* Right Live Preview: "Here's what we'll track" */}
        <div className="lg:col-span-5 bg-app-surface/60 border border-app-border radius-panel p-6 space-y-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-brand-accent uppercase tracking-wider">
            <Target className="w-3.5 h-3.5" />
            <span>Here's What We'll Track</span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3 bg-app-surface-2 radius-input border border-app-border">
              <span className="text-app-text-3 block text-[10px]">Client Target</span>
              <span className="font-bold text-app-text text-sm">{clientName || 'Your Brand'}</span>
              <span className="text-brand block font-mono text-[11px]">{clientDomain || 'domain.com'}</span>
            </div>

            <div className="p-3 bg-app-surface-2 radius-input border border-app-border">
              <span className="text-app-text-3 block text-[10px]">Target Niche & Markets</span>
              <span className="font-semibold text-app-text">{serviceNiche || 'Niche'}</span>
              <span className="text-app-text-2 block text-[11px] mt-0.5">{markets || 'UK / US'}</span>
            </div>

            <div className="p-3 bg-app-surface-2 radius-input border border-app-border">
              <span className="text-app-text-3 block text-[10px]">Competitors Analyzed</span>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {competitorsText.split('\n').map((line, i) => {
                  const name = line.split('|')[0]?.trim();
                  return name ? (
                    <span
                      key={i}
                      className="px-2 py-0.5 radius-badge bg-app-surface-3 text-app-text text-[11px] border border-app-border"
                    >
                      {name}
                    </span>
                  ) : null;
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
