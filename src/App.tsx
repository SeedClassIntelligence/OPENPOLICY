/**
 * Open Polici Main Application
 * Consumer-Controlled Insurance Offer Review Platform
 */

import React, { useState, useEffect } from 'react';
import { Header, ActivePerspective } from './components/Header';
import { LandingPage } from './components/LandingPage';
import { ConsumerPortal, type ConsumerStep } from './components/ConsumerPortal';
import { ProviderPortal } from './components/ProviderPortal';
import { AdminConsole } from './components/AdminConsole';
import { TelemetryDashboard } from './components/TelemetryDashboard';
import { ArchitectureDocs } from './components/ArchitectureDocs';
import { AuthProvider, useAuth, UserRole } from './context/AuthContext';
import { AuthModal } from './components/AuthModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Challenge, Offer } from './types/insurance';
import { canEnterMarketplaceDestination, canEnterOwnerDestination, destinationForRole } from './auth/roleAccess';
import { apiFetch } from './services/apiClient';
import { canEnterPolicyPipeline, getInsuranceLineDefinition } from './domain/insuranceLineRegistry';
import { ProviderInvitationAcceptance } from './components/ProviderInvitationAcceptance';
import { ProviderOnboardingStatus } from './components/ProviderOnboardingStatus';
import { AboutPage } from './components/AboutPage';
import { ComparisonAnalysisPage } from './components/ComparisonAnalysisPage';
import { recordConsumerFunnelEvent } from './services/consumerFunnel';

function MainApp() {
  const { isAuthenticated, userRole, userProfile, isDemoUser, loading: authLoading, openAuthModal, useDemoAccount } = useAuth();
  const [activePerspective, setActivePerspective] = useState<ActivePerspective>('LANDING');
  const [consumerInitialStep, setConsumerInitialStep] = useState<ConsumerStep>('UPLOAD_EXTRACT');
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [publicPath, setPublicPath] = useState(() => window.location.pathname);
  const requestedLine = userProfile?.requestedInsuranceLine || 'PERSONAL_AUTO';
  const requestedLineAvailable = canEnterPolicyPipeline(requestedLine);
  const providerInvitationMatch = window.location.pathname.match(/^\/provider-invitation\/([^/]+)$/);

  useEffect(() => {
    const localOwnerDemo = import.meta.env.DEV
      && import.meta.env.VITE_ENABLE_DEMO_IDENTITIES === 'true'
      && window.location.pathname === '/admin'
      && new URLSearchParams(window.location.search).get('demo') === 'owner';
    if (localOwnerDemo && (!isAuthenticated || userRole !== 'ADMIN')) {
      useDemoAccount('ADMIN', 'Open Polici Owner Demo');
    }
  }, [isAuthenticated, userRole, useDemoAccount]);

  useEffect(() => {
    const syncRoute = () => {
      const path = window.location.pathname;
      setPublicPath(path);
      if (path === '/' || path === '/consumers' || path === '/providers' || path === '/about' || path === '/insurance-comparison') {
        setActivePerspective('LANDING');
      } else if (path === '/account' && isAuthenticated && userRole === 'CONSUMER') {
        setActivePerspective('CONSUMER');
      } else if (path === '/provider-account' && isAuthenticated && userRole === 'PROVIDER') {
        setActivePerspective('PROVIDER');
      } else if (path === '/admin' && isAuthenticated && userRole === 'ADMIN') {
        setActivePerspective('ADMIN_AUDIT');
      }
    };
    syncRoute();
    window.addEventListener('popstate', syncRoute);
    return () => window.removeEventListener('popstate', syncRoute);
  }, [isAuthenticated, userRole]);


  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadData = async () => {
    try {
      const res = await apiFetch('/api/challenges');
      if (!res.ok) throw new Error(`Could not load consumer policy reviews (${res.status})`);
      const challenges: Challenge[] = await res.json();
      if (challenges.length > 0) {
        const latestChallenge = [...challenges].sort((left, right) =>
          Date.parse(right.openingTimestamp) - Date.parse(left.openingTimestamp)
        )[0];
        const chalRes = await apiFetch(`/api/challenges/${latestChallenge.id}`);
        const chalData = await chalRes.json();
        setChallenge(chalData.challenge);
        setOffers(chalData.offers);
        setConsumerInitialStep('COMPETITION_ROOM');
      } else {
        setChallenge(null);
        setOffers([]);
        setConsumerInitialStep('UPLOAD_EXTRACT');
      }
    } catch (e) {
      console.error('Failed to load initial challenges:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || userRole !== 'CONSUMER') {
      setChallenge(null);
      setOffers([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    void loadData();
  }, [authLoading, isAuthenticated, userRole, userProfile?.id]);

  useEffect(() => {
    if (!authLoading && isAuthenticated && userRole === 'CONSUMER' && userProfile?.id) {
      void recordConsumerFunnelEvent({
        eventName: 'ACCOUNT_CREATED',
        insuranceLine: requestedLine,
        baselineOrigin: userProfile.consumerIntakeOrigin
      }).catch(() => undefined);
    }
  }, [authLoading, isAuthenticated, userRole, userProfile?.id, userProfile?.consumerIntakeOrigin, requestedLine]);

  if (providerInvitationMatch) {
    return <ProviderInvitationAcceptance token={decodeURIComponent(providerInvitationMatch[1])} />;
  }

  const handlePerspectiveChange = (
    perspective: ActivePerspective, 
    step?: ConsumerStep
  ) => {
    const ownerDestination = perspective === 'ADMIN_AUDIT' || perspective === 'TELEMETRY' || perspective === 'ARCHITECTURE_TESTS';
    if (ownerDestination && !canEnterOwnerDestination(userRole, perspective)) {
      if (!isAuthenticated) openAuthModal({ initialMode: 'SIGN_IN' });
      showToast('Owner operations require an authenticated Open Polici administrator account.');
      return;
    }

    // Before authentication, the Consumer and Provider tabs select the matching
    // public landing experience. Authenticated users retain direct portal access.
    if (!isAuthenticated && (perspective === 'CONSUMER' || perspective === 'PROVIDER')) {
      const path = perspective === 'PROVIDER' ? '/providers' : '/consumers';
      window.history.pushState({}, '', path);
      window.dispatchEvent(new PopStateEvent('popstate'));
      setActivePerspective('LANDING');
      window.setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 0);
      return;
    }

    if (
      (perspective === 'CONSUMER' || perspective === 'PROVIDER') &&
      !canEnterMarketplaceDestination(userRole, perspective)
    ) {
      showToast(`This account belongs to the ${userRole === 'PROVIDER' ? 'Provider' : 'Consumer'} pipeline.`);
      setActivePerspective(userRole ? destinationForRole(userRole) : 'LANDING');
      return;
    }

    if (step) {
      setConsumerInitialStep(step);
    }

    setActivePerspective(perspective);
    if (perspective === 'CONSUMER') window.history.pushState({}, '', '/account');
    if (perspective === 'PROVIDER') window.history.pushState({}, '', '/provider-account');
    if (perspective === 'ADMIN_AUDIT') window.history.pushState({}, '', '/admin');
    const names: Record<ActivePerspective, string> = {
      LANDING: 'Welcome to Open Polici (Platform Overview & Doctrine)',
      CONSUMER: 'Switched to Consumer Perspective (Policyholder Comparison)',
      PROVIDER: 'Switched to Provider Portal (Broker & Quoting Workbench)',
      ADMIN_AUDIT: 'Switched to Audit & Review Queue (Regulatory Compliance)',
      TELEMETRY: 'Switched to Telemetry & Health Metrics (Engine Operations)',
      ARCHITECTURE_TESTS: 'Switched to Architecture & Tests (System Specification)'
    };
    showToast(names[perspective]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAuthSuccess = (role: UserRole) => {
    if (role === 'ADMIN') {
      window.history.pushState({}, '', '/admin');
      setActivePerspective('ADMIN_AUDIT');
      showToast('Owner identity loaded. Administrative controls are available.');
    } else if (role === 'PROVIDER') {
      window.history.pushState({}, '', '/provider-account');
      setActivePerspective('PROVIDER');
      showToast('Provider identity loaded. License verification determines desk access.');
    } else {
      window.history.pushState({}, '', '/account');
      setConsumerInitialStep('UPLOAD_EXTRACT');
      setActivePerspective('CONSUMER');
      showToast('Authenticated as Policyholder. Ready to upload declarations page.');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleResetCanonical = async () => {
    try {
      await apiFetch('/api/reset', { method: 'POST' });
      await loadData();
      showToast('Database reset to canonical initial baseline and offers');
    } catch (e) {
      console.error(e);
    }
  };

  const handleOfferSubmitted = () => {
    loadData();
    showToast('Provider offer submitted and validated against quote sheet');
  };

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 font-sans antialiased flex flex-col selection:bg-emerald-500 selection:text-white">
      {/* Top Header */}
      <Header
        activePerspective={activePerspective}
        setActivePerspective={(p) => handlePerspectiveChange(p)}
        onReset={handleResetCanonical}
        activeChallengeRef={challenge?.referenceNumber}
      />

      {/* Main Content Area */}
      <main className={`flex-1 w-full ${activePerspective === 'LANDING' ? '' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6'}`}>
        {loading ? (
          <div className="flex items-center justify-center py-24 text-slate-500 text-xs font-mono">
            Booting Open Polici Engine...
          </div>
        ) : (
          <>
            {activePerspective === 'LANDING' && (
              publicPath === '/about' ? <AboutPage /> : publicPath === '/insurance-comparison' ? <ComparisonAnalysisPage /> : <LandingPage
                onNavigateConsumer={() => handlePerspectiveChange('CONSUMER', 'UPLOAD_EXTRACT')}
                onNavigateProvider={() => handlePerspectiveChange('PROVIDER')}
                onNavigateAdmin={() => handlePerspectiveChange('ADMIN_AUDIT')}
                onNavigateTelemetry={() => handlePerspectiveChange('TELEMETRY')}
                onNavigateArchitecture={() => handlePerspectiveChange('ARCHITECTURE_TESTS')}
              />
            )}

            {activePerspective === 'CONSUMER' && !requestedLineAvailable && (
              <div className="max-w-2xl mx-auto bg-white border border-amber-200 rounded-3xl p-8 shadow-sm">
                <p className="text-xs font-mono uppercase tracking-wider text-amber-700">Insurance-line availability</p>
                <h2 className="text-xl font-bold text-slate-900 mt-2">
                  {getInsuranceLineDefinition(requestedLine).displayName} processing is not open yet
                </h2>
                <p className="text-sm text-slate-600 mt-3 leading-relaxed">
                  Your account and requested insurance type are recorded. Open Polici will not send this document type through the personal-auto pipeline. Availability requires line-specific document intelligence, regulatory approval, provider authority, and jurisdiction activation.
                </p>
              </div>
            )}

            {activePerspective === 'CONSUMER' && requestedLineAvailable && (
              <ErrorBoundary 
                fallbackTitle="Unable to Display Consumer Experience" 
                onReset={loadData}
              >
                <ConsumerPortal
                  insuranceLine={requestedLine}
                  challenge={challenge}
                  offers={offers}
                  onRefreshData={loadData}
                  onNavigateToProvider={() => handlePerspectiveChange('PROVIDER')}
                  initialStep={consumerInitialStep}
                />
              </ErrorBoundary>
            )}

            {activePerspective === 'PROVIDER' && userRole === 'PROVIDER' && !isDemoUser && userProfile?.providerStatus !== 'ACTIVE' && (
              <ProviderOnboardingStatus />
            )}

            {activePerspective === 'PROVIDER' && (isDemoUser || userProfile?.providerStatus === 'ACTIVE') && (
              <ErrorBoundary 
                fallbackTitle="Unable to Display Provider Quoting Desk" 
                onReset={loadData}
              >
                <ProviderPortal
                  challenge={challenge}
                  onOfferSubmitted={handleOfferSubmitted}
                  onNavigateToConsumer={() => handlePerspectiveChange('CONSUMER', 'UPLOAD_EXTRACT')}
                  fixtureProviderUserId={isDemoUser ? userProfile?.id : undefined}
                />
              </ErrorBoundary>
            )}

            {activePerspective === 'ADMIN_AUDIT' && userRole === 'ADMIN' && (
              <ErrorBoundary fallbackTitle="Unable to Display Audit Console">
                <AdminConsole onRefreshData={loadData} />
              </ErrorBoundary>
            )}

            {activePerspective === 'TELEMETRY' && userRole === 'ADMIN' && (
              <ErrorBoundary fallbackTitle="Unable to Display Telemetry Dashboard">
                <TelemetryDashboard />
              </ErrorBoundary>
            )}

            {activePerspective === 'ARCHITECTURE_TESTS' && userRole === 'ADMIN' && (
              <ErrorBoundary fallbackTitle="Unable to Display System Specifications">
                <ArchitectureDocs />
              </ErrorBoundary>
            )}
          </>
        )}
      </main>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white text-xs font-semibold px-4 py-2.5 rounded-lg shadow-lg border border-slate-800 animate-fade-in flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Footer (Rendered on workbench perspectives; LandingPage renders its own dedicated full-width footer) */}
      {activePerspective !== 'LANDING' && (
        <footer className="w-full bg-slate-900 border-t border-slate-800 py-4 text-center text-xs text-slate-400">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
            <p className="font-mono text-[11px]">
              Open Polici • Independent Provider Offers • Factual Policy Comparison
            </p>
            <div className="flex items-center space-x-3 text-[11px] text-slate-400">
              <span>PostgreSQL Integrity</span>
              <span>•</span>
              <span>Redis Rating Cache</span>
              <span>•</span>
              <span>Deterministic Comparison v1.0</span>
            </div>
          </div>
        </footer>
      )}

      {/* Global Authentication Modal */}
      <AuthModal onSuccess={handleAuthSuccess} />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
