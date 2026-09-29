import React, { useState, useEffect } from 'react';
import { AppLayout } from './layouts/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { OverviewPage } from './pages/OverviewPage';
import { SourcesPage } from './pages/SourcesPage';
import { CompetitorGapsPage } from './pages/CompetitorGapsPage';
import { PromptsPage } from './pages/PromptsPage';
import { AnswersPage } from './pages/AnswersPage';
import { OutreachPage } from './pages/OutreachPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';
import { DesignSystemPage } from './pages/DesignSystemPage';
import { RunProgressModal } from './components/RunProgressModal';
import { defaultCampaign } from './data/mockData';
import type { CampaignProfile } from './data/mockData';

export const App: React.FC = () => {
  const [currentRoute, setCurrentRoute] = useState<string>('/overview');
  const [isDark, setIsDark] = useState<boolean>(true);
  const [activeEngine, setActiveEngine] = useState<string>('All');
  const [isTrackingLive, setIsTrackingLive] = useState<boolean>(false);
  const [isRunModalOpen, setIsRunModalOpen] = useState<boolean>(false);
  const [campaign, setCampaign] = useState<CampaignProfile>(defaultCampaign);

  useEffect(() => {
    const path = window.location.pathname;
    if (path && path !== '/') {
      setCurrentRoute(path);
    }
  }, []);

  const handleToggleTheme = () => {
    const nextTheme = !isDark;
    setIsDark(nextTheme);
    if (nextTheme) {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    }
  };

  const handleNavigate = (route: string) => {
    setCurrentRoute(route);
    window.history.pushState({}, '', route);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Full-screen standalone routes (Login, Onboarding)
  if (currentRoute === '/login') {
    return (
      <LoginPage
        onLoginSuccess={() => handleNavigate('/overview')}
        onNavigateToOnboarding={() => handleNavigate('/onboarding')}
      />
    );
  }

  if (currentRoute === '/onboarding') {
    return (
      <OnboardingPage
        onComplete={(newCampaign) => {
          setCampaign(newCampaign);
          setIsRunModalOpen(true);
        }}
        onCancel={() => handleNavigate('/overview')}
      />
    );
  }

  return (
    <AppLayout
      currentRoute={currentRoute}
      onNavigate={handleNavigate}
      isDark={isDark}
      onToggleTheme={handleToggleTheme}
      activeEngine={activeEngine}
      onSelectEngine={setActiveEngine}
      isTrackingLive={isTrackingLive}
      onStartNewRun={() => setIsRunModalOpen(true)}
    >
      {/* Route Views */}
      {currentRoute === '/overview' || currentRoute === '/' ? (
        <OverviewPage
          onNavigate={handleNavigate}
          onStartRun={() => setIsRunModalOpen(true)}
        />
      ) : currentRoute === '/sources' ? (
        <SourcesPage onNavigateToOutreach={() => handleNavigate('/outreach')} />
      ) : currentRoute === '/gaps' ? (
        <CompetitorGapsPage onNavigateToOutreach={() => handleNavigate('/outreach')} />
      ) : currentRoute === '/prompts' ? (
        <PromptsPage onNavigateToAnswers={(prompt) => handleNavigate('/answers')} />
      ) : currentRoute === '/answers' ? (
        <AnswersPage />
      ) : currentRoute === '/outreach' ? (
        <OutreachPage />
      ) : currentRoute === '/reports' ? (
        <ReportsPage />
      ) : currentRoute === '/settings' ? (
        <SettingsPage />
      ) : currentRoute === '/design' ? (
        <DesignSystemPage />
      ) : (
        <OverviewPage
          onNavigate={handleNavigate}
          onStartRun={() => setIsRunModalOpen(true)}
        />
      )}

      {/* Global Live Run Progress Modal */}
      <RunProgressModal
        isOpen={isRunModalOpen}
        onClose={() => setIsRunModalOpen(false)}
        onComplete={() => {
          setIsRunModalOpen(false);
          setIsTrackingLive(true);
          setTimeout(() => setIsTrackingLive(false), 8000);
          handleNavigate('/overview');
        }}
      />
    </AppLayout>
  );
};

export default App;
