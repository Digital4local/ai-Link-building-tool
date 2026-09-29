import React, { useState } from 'react';
import { ShieldCheck, ArrowRight, Sparkles, Key } from 'lucide-react';
import { Button } from '../components/Button';

export interface LoginPageProps {
  onLoginSuccess: () => void;
  onNavigateToOnboarding: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onLoginSuccess,
  onNavigateToOnboarding,
}) => {
  const [email, setEmail] = useState('admin@digital4local.com');
  const [apiKey, setApiKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      onLoginSuccess();
    }, 600);
  };

  return (
    <div className="min-h-screen bg-app-bg text-app-text flex flex-col md:flex-row">
      {/* Left Panel: Form (50% or 480px) */}
      <div className="w-full md:w-[480px] lg:w-[540px] p-8 md:p-14 flex flex-col justify-between border-r border-app-border bg-app-surface z-10">
        {/* Top Brand Logo */}
        <div>
          <div className="flex items-center gap-2 mb-8">
            <img
              src="/brand/logo.svg"
              alt="Digital4Local Logo"
              className="h-8 w-auto object-contain"
            />
          </div>

          <div className="space-y-2 mb-8">
            <h1 className="font-display text-2xl md:text-3xl font-extrabold text-app-text">
              Sign In to AI Citation Intelligence
            </h1>
            <p className="text-xs md:text-sm text-app-text-2">
              Enter your agency credentials to monitor and engineer #1 AI citations.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-app-text">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full h-10 px-3 bg-app-surface-2 border border-app-border radius-input text-xs text-app-text placeholder:text-app-text-3 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-app-text">
                  Google Gemini API Key (BYOK)
                </label>
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-brand hover:underline font-medium"
                >
                  Get Free Key →
                </a>
              </div>
              <div className="relative">
                <Key className="w-3.5 h-3.5 text-app-text-3 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="AIzaSy... (Optional for Demo Mode)"
                  className="w-full h-10 pl-9 pr-3 bg-app-surface-2 border border-app-border radius-input text-xs text-app-text font-mono placeholder:text-app-text-3 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-all"
                />
              </div>
              <p className="text-[11px] text-app-text-3">
                100% free tier key from Google AI Studio. Stored strictly in your browser session.
              </p>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full mt-2"
              isLoading={isLoading}
              icon={<ArrowRight className="w-4 h-4" />}
              iconPosition="right"
            >
              Access Dashboard
            </Button>
          </form>

          {/* New Campaign Onboarding CTA */}
          <div className="mt-6 pt-6 border-t border-app-border text-center">
            <span className="text-xs text-app-text-3 mr-1.5">Setting up a new brand?</span>
            <button
              onClick={onNavigateToOnboarding}
              className="text-xs text-brand font-semibold hover:underline"
            >
              Start 4-Step Campaign Setup →
            </button>
          </div>
        </div>

        {/* Bottom Trust Badge */}
        <div className="pt-6 flex items-center gap-2 text-xs text-app-text-3">
          <ShieldCheck className="w-4 h-4 text-brand-accent" />
          <span>Enterprise Rate Pacing · Client Session Isolation</span>
        </div>
      </div>

      {/* Right Panel: Dark Live Dashboard Preview with One Line Value Copy */}
      <div className="flex-1 bg-[#07090D] relative overflow-hidden hidden md:flex flex-col justify-between p-12 border-l border-app-border">
        {/* Subtle Background Glow */}
        <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-brand/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/3 right-1/4 w-80 h-80 bg-brand-accent/10 rounded-full blur-3xl pointer-events-none" />

        {/* Value Copy Top */}
        <div className="max-w-md z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 radius-pill bg-brand-accent/15 text-brand-accent border border-brand-accent/30 text-xs font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>GEO & AI Citation Dominance</span>
          </div>
          <h2 className="text-2xl font-bold text-app-text tracking-tight">
            The intelligent engine that reverse-engineers LLM citations for top B2B & local search queries.
          </h2>
        </div>

        {/* Live Mock Metric Card Preview */}
        <div className="relative z-10 max-w-lg bg-app-surface/80 backdrop-blur-md border border-app-border-strong radius-panel p-6 shadow-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-app-border/60 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-md bg-brand/20 text-brand flex items-center justify-center font-bold text-xs">
                D4
              </div>
              <div>
                <h4 className="text-xs font-semibold text-app-text">Digital4Local Live Citation Track</h4>
                <p className="text-[10px] text-app-text-3">5x5 GEO Grid · Google Gemini & ChatGPT</p>
              </div>
            </div>
            <span className="px-2 py-0.5 radius-pill bg-success/15 text-success text-[11px] font-semibold border border-success/25">
              #1 Market Rank
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-2.5 bg-app-surface-2 radius-input border border-app-border">
              <span className="text-[10px] text-app-text-3 block">Visibility Score</span>
              <span className="text-lg font-bold font-metric text-brand-accent">86/100</span>
            </div>
            <div className="p-2.5 bg-app-surface-2 radius-input border border-app-border">
              <span className="text-[10px] text-app-text-3 block">Share of Voice</span>
              <span className="text-lg font-bold font-metric text-app-text">48.2%</span>
            </div>
            <div className="p-2.5 bg-app-surface-2 radius-input border border-app-border">
              <span className="text-[10px] text-app-text-3 block">Citation Gaps</span>
              <span className="text-lg font-bold font-metric text-warning">34 Targets</span>
            </div>
          </div>
        </div>

        {/* Bottom Agency Tag */}
        <div className="text-xs text-app-text-3 z-10">
          Trusted by top digital PR and local search growth teams across London, Austin & Global hubs.
        </div>
      </div>
    </div>
  );
};
