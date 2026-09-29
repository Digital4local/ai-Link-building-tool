import React, { useState, useEffect } from 'react';
import { Sparkles, CheckCircle2, Clock, Globe, ShieldCheck, X } from 'lucide-react';
import { Button } from './Button';

export interface RunProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export const RunProgressModal: React.FC<RunProgressModalProps> = ({
  isOpen,
  onClose,
  onComplete,
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [promptCount, setPromptCount] = useState(0);
  const [engineQueryCount, setEngineQueryCount] = useState(0);
  const [sourcesScraped, setSourcesScraped] = useState(0);
  const [gapsFound, setGapsFound] = useState(0);

  useEffect(() => {
    if (!isOpen) {
      setCurrentStep(1);
      setPromptCount(0);
      setEngineQueryCount(0);
      setSourcesScraped(0);
      setGapsFound(0);
      return;
    }

    // Step 1: Prompt Generation
    const interval1 = setInterval(() => {
      setPromptCount((prev) => {
        if (prev >= 24) {
          clearInterval(interval1);
          setCurrentStep(2);
          return 24;
        }
        return prev + 4;
      });
    }, 150);

    // Step 2: Engine Querying
    const interval2 = setInterval(() => {
      setEngineQueryCount((prev) => {
        if (prev >= 24) {
          clearInterval(interval2);
          setCurrentStep(3);
          return 24;
        }
        return prev + 2;
      });
    }, 200);

    // Step 3: Sources Scraped
    const interval3 = setInterval(() => {
      setSourcesScraped((prev) => {
        if (prev >= 142) {
          clearInterval(interval3);
          setCurrentStep(4);
          return 142;
        }
        return prev + 18;
      });
    }, 250);

    // Step 4: Gaps Found & Completion
    const interval4 = setInterval(() => {
      setGapsFound((prev) => {
        if (prev >= 34) {
          clearInterval(interval4);
          setTimeout(() => {
            onComplete();
          }, 600);
          return 34;
        }
        return prev + 5;
      });
    }, 220);

    return () => {
      clearInterval(interval1);
      clearInterval(interval2);
      clearInterval(interval3);
      clearInterval(interval4);
    };
  }, [isOpen, onComplete]);

  if (!isOpen) return null;

  const steps = [
    {
      step: 1,
      title: 'Synthesizing Target Buyer Prompts',
      description: 'Generating localized high-intent commercial & informational queries.',
      countText: `${promptCount} / 24 Prompts`,
      icon: <Sparkles className="w-4 h-4 text-brand" />,
    },
    {
      step: 2,
      title: 'Querying Grounded AI Engines',
      description: 'Executing live Google Gemini Search Grounding & citation extraction.',
      countText: `${engineQueryCount} / 24 Answers Analyzed`,
      icon: <Globe className="w-4 h-4 text-brand-accent" />,
    },
    {
      step: 3,
      title: 'Computing Citation-Worthiness (0–100)',
      description: 'Scraping on-page freshness, schema tables, and author signals.',
      countText: `${sourcesScraped} / 142 Authority Pages`,
      icon: <ShieldCheck className="w-4 h-4 text-info" />,
    },
    {
      step: 4,
      title: 'Synthesizing Competitor Gaps & Outreach',
      description: 'Identifying missing citation URLs and drafting personalized pitches.',
      countText: `${gapsFound} / 34 High-Impact Gaps`,
      icon: <CheckCircle2 className="w-4 h-4 text-success" />,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      <div className="relative w-full max-w-lg bg-app-surface border border-app-border-strong radius-panel elevation-sheet p-6 z-10 animate-fadeIn space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-success pulse-dot" />
              <span className="text-xs font-semibold text-brand tracking-wide uppercase">
                Live AI Execution
              </span>
            </div>
            <h3 className="font-h2 text-app-text">Synthesizing Citation Intelligence</h3>
          </div>

          <button
            onClick={onClose}
            className="text-app-text-3 hover:text-app-text p-1 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 4 Step Stepper */}
        <div className="space-y-4">
          {steps.map((s) => {
            const isDone = currentStep > s.step;
            const isActive = currentStep === s.step;

            return (
              <div
                key={s.step}
                className={`p-3.5 radius-card border transition-all duration-200 ${
                  isActive
                    ? 'bg-app-surface-2 border-brand shadow-sm'
                    : isDone
                    ? 'bg-app-surface-2/40 border-app-border/40 opacity-80'
                    : 'bg-app-surface-2/20 border-app-border/20 opacity-40'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold ${
                        isDone
                          ? 'bg-success/20 text-success'
                          : isActive
                          ? 'bg-brand/20 text-brand'
                          : 'bg-app-surface-3 text-app-text-3'
                      }`}
                    >
                      {isDone ? <CheckCircle2 className="w-3.5 h-3.5" /> : s.step}
                    </div>
                    <h4 className="text-xs font-semibold text-app-text">{s.title}</h4>
                  </div>

                  <span className="text-[11px] font-mono font-semibold text-brand tabular-nums">
                    {s.countText}
                  </span>
                </div>

                <p className="text-[11px] text-app-text-3 pl-8">{s.description}</p>
              </div>
            );
          })}
        </div>

        {/* Footer info */}
        <div className="pt-2 flex items-center justify-between text-xs text-app-text-3 border-t border-app-border/40">
          <span className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-brand" />
            Estimated time remaining: 6s
          </span>

          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel Run
          </Button>
        </div>
      </div>
    </div>
  );
};
