/**
 * Open Policy Main Application
 * Consumer-Controlled Insurance Offer Review Platform
 */

import React, { useState, useEffect } from 'react';
import { Header, ActivePerspective } from './components/Header';
import { LandingPage } from './components/LandingPage';
import { ConsumerPortal } from './components/ConsumerPortal';
import { ProviderPortal } from './components/ProviderPortal';
import { AdminConsole } from './components/AdminConsole';
import { TelemetryDashboard } from './components/TelemetryDashboard';
import { ArchitectureDocs } from './components/ArchitectureDocs';
import { AuthProvider, useAuth, UserRole } from './context/AuthContext';
import { AuthModal } from './components/AuthModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Challenge, Offer } from './types/insurance';
import { canEnterMarketplaceDestination, destinationForRole } from './auth/roleAccess';
import { apiFetch } from './services/apiClient';

function MainApp() {
  const { isAuthenticated, userRole, userProfile, isDemoUser, openAuthModal } = useAuth();
  const [activePerspective, setActivePerspective] = useState<ActivePerspective>('LANDING');
  const [consumerInitialStep, setConsumerInitialStep] = useState<'UPLOAD_EXTRACT' | 'ACCOUNT_DASHBOARD'>('UPLOAD_EXTRACT');
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadData = async () => {
    try {
      const res = await apiFetch('/api/challenges');
      const challenges: Challenge[] = await res.json();
      if (challenges.length > 0) {
        const chalRes = await apiFetch(`/api/challenges/${challenges[0].id}`);
        const chalData = await chalRes.json();
        setChallenge(chalData.challenge);
        setOffers(chalData.offers);
      }
    } catch (e) {
      console.error('Failed to load initial challenges:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handlePerspectiveChange = (
    perspective: ActivePerspective, 
    step?: 'UPLOAD_EXTRACT' | 'ACCOUNT_DASHBOARD'
  ) => {
    // Protected Perspectives: Consumers and Providers require authentication
    if (!isAuthenticated && (perspective === 'CONSUMER' || perspective === 'PROVIDER')) {
      const targetRole: 'CONSUMER' | 'PROVIDER' = perspective === 'PROVIDER' ? 'PROVIDER' : 'CONSUMER';
      openAuthModal({ 
        initialRole: targetRole, 
        initialMode: 'SIGN_UP' 
      });
      showToast(
        perspective === 'PROVIDER' 
          ? 'Please register your agency or sign in to access the Provider Quoting Desk.' 
          : 'Please create an account or sign in to share your current policy for provider review.'
      );
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
    const names: Record<ActivePerspective, string> = {
      LANDING: 'Welcome to Open Policy (Platform Overview & Doctrine)',
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
    if (role === 'PROVIDER') {
      setActivePerspective('PROVIDER');
      showToast('Provider identity loaded. License verification determines desk access.');
    } else {
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
            Booting Open Policy Engine...
          </div>
        ) : (
          <>
            {activePerspective === 'LANDING' && (
              <LandingPage
                onNavigateConsumer={() => handlePerspectiveChange('CONSUMER', 'UPLOAD_EXTRACT')}
                onNavigateProvider={() => handlePerspectiveChange('PROVIDER')}
                onNavigateAdmin={() => handlePerspectiveChange('ADMIN_AUDIT')}
                onNavigateTelemetry={() => handlePerspectiveChange('TELEMETRY')}
                onNavigateArchitecture={() => handlePerspectiveChange('ARCHITECTURE_TESTS')}
              />
            )}

            {activePerspective === 'CONSUMER' && (
              <ErrorBoundary 
                fallbackTitle="Unable to Display Consumer Experience" 
                onReset={loadData}
              >
                <ConsumerPortal
                  challenge={challenge}
                  offers={offers}
                  onRefreshData={loadData}
                  onNavigateToProvider={() => handlePerspectiveChange('PROVIDER')}
                  initialStep={consumerInitialStep}
                />
              </ErrorBoundary>
            )}

            {activePerspective === 'PROVIDER' && userRole === 'PROVIDER' && !isDemoUser && userProfile?.providerStatus !== 'ACTIVE' && (
              <div className="max-w-2xl mx-auto bg-white border border-amber-200 rounded-3xl p-8 shadow-sm">
                <p className="text-xs font-mono uppercase tracking-wider text-amber-700">Provider onboarding</p>
                <h2 className="text-xl font-bold text-slate-900 mt-2">License verification pending</h2>
                <p className="text-sm text-slate-600 mt-3 leading-relaxed">
                  Your agency account exists, but the Provider Quoting Desk remains closed until Open Policy verifies the submitted license and activates the provider profile.
                </p>
              </div>
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
                />
              </ErrorBoundary>
            )}

            {activePerspective === 'ADMIN_AUDIT' && (
              <ErrorBoundary fallbackTitle="Unable to Display Audit Console">
                <AdminConsole onRefreshData={loadData} />
              </ErrorBoundary>
            )}

            {activePerspective === 'TELEMETRY' && (
              <ErrorBoundary fallbackTitle="Unable to Display Telemetry Dashboard">
                <TelemetryDashboard />
              </ErrorBoundary>
            )}

            {activePerspective === 'ARCHITECTURE_TESTS' && (
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
              Open Policy • Independent Provider Offers • Factual Policy Comparison
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
