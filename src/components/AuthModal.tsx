import React, { useState, useEffect } from 'react';
import { 
  X, 
  Lock, 
  ShieldCheck, 
  Mail, 
  Key, 
  User, 
  ArrowRight, 
  AlertCircle, 
  CheckCircle2, 
  Sparkles,
  Zap,
  Building2,
  FileCheck2,
  Compass,
  Briefcase
} from 'lucide-react';
import { useAuth, UserRole } from '../context/AuthContext';
import { JurisdictionSelectOptions } from './JurisdictionSelectOptions';
import { INSURANCE_LINES } from '../domain/insuranceLineRegistry';
import type { InsuranceLine } from '../types/jurisdiction';

interface AuthModalProps {
  onSuccess?: (role: UserRole) => void;
  variant?: 'modal' | 'inline';
  initialRole?: 'CONSUMER' | 'PROVIDER';
  initialMode?: 'SIGN_IN' | 'SIGN_UP' | 'DEMO';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  onSuccess,
  variant = 'modal',
  initialRole,
  initialMode
}) => {
  const demoIdentitiesEnabled = import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEMO_IDENTITIES === 'true';
  const { 
    authModalOpen, 
    closeAuthModal, 
    authModalInitialRole,
    authModalInitialMode,
    signInWithEmail, 
    sendPasswordReset,
    signUpAsConsumer,
    signUpAsProvider,
    useDemoAccount 
  } = useAuth();

  const isInline = variant === 'inline';
  const [mode, setMode] = useState<'SIGN_IN' | 'SIGN_UP' | 'DEMO'>(initialMode || authModalInitialMode || 'SIGN_UP');
  const [role, setRole] = useState<'CONSUMER' | 'PROVIDER'>(initialRole || authModalInitialRole || 'CONSUMER');

  // Consumer form state
  const [consumerName, setConsumerName] = useState('');
  const [consumerEmail, setConsumerEmail] = useState('');
  const [consumerPassword, setConsumerPassword] = useState('');
  const [consumerState, setConsumerState] = useState('NV');
  const [currentCarrier, setCurrentCarrier] = useState('');
  const [requestedInsuranceLine, setRequestedInsuranceLine] = useState<InsuranceLine>('PERSONAL_AUTO');
  const [consumerIntakeOrigin, setConsumerIntakeOrigin] = useState<'VERIFIED_EXISTING_POLICY' | 'CONSUMER_DEFINED_COVERAGE_REQUEST'>('VERIFIED_EXISTING_POLICY');

  // Provider form state
  const [agentName, setAgentName] = useState('');
  const [agencyName, setAgencyName] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [providerState, setProviderState] = useState('NV');
  const [providerEmail, setProviderEmail] = useState('');
  const [providerPassword, setProviderPassword] = useState('');
  const [providerOrganizationType, setProviderOrganizationType] = useState('INDEPENDENT_AGENCY');
  const [providerPlanCode, setProviderPlanCode] = useState('PLAN_SOLO');
  const [providerInsuranceLine, setProviderInsuranceLine] = useState<InsuranceLine>('PERSONAL_AUTO');
  const [providerNpn, setProviderNpn] = useState('');
  const [carrierAuthorityReference, setCarrierAuthorityReference] = useState('');

  // Sign In form state
  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [resetStatus, setResetStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (authModalOpen || isInline) {
      setMode(initialMode || authModalInitialMode || 'SIGN_UP');
      setRole(initialRole || authModalInitialRole || 'CONSUMER');
      setError(null);
      setResetStatus(null);
    }
  }, [authModalOpen, authModalInitialRole, authModalInitialMode, initialMode, initialRole, isInline]);

  if (!isInline && !authModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'SIGN_IN') {
        const resolvedRole = await signInWithEmail(signInEmail, signInPassword);
        if (onSuccess) onSuccess(resolvedRole);
      } else if (mode === 'SIGN_UP') {
        if (role === 'CONSUMER') {
          if (!consumerName.trim()) {
            throw new Error('Please enter your full name or preferred alias.');
          }
          const createdRole = await signUpAsConsumer(
            consumerName, consumerEmail, consumerPassword, consumerState,
            consumerIntakeOrigin === 'VERIFIED_EXISTING_POLICY' ? currentCarrier : '',
            requestedInsuranceLine, consumerIntakeOrigin
          );
          if (onSuccess) onSuccess(createdRole);
        } else {
          if (!agentName.trim() || !agencyName.trim() || (providerOrganizationType !== 'DIRECT_CARRIER' && !licenseNumber.trim())) {
            throw new Error('Please complete all required provider application fields.');
          }
          const createdRole = await signUpAsProvider(
            agentName, agencyName, licenseNumber, providerState, providerEmail, providerPassword,
            providerOrganizationType, providerPlanCode, [providerInsuranceLine], providerNpn,
            carrierAuthorityReference
          );
          if (onSuccess) onSuccess(createdRole);
        }
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        setError('This email address is already registered. Please sign in instead.');
      } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        setError('Invalid email or password combination.');
      } else if (err.code === 'auth/weak-password') {
        setError('Password must be at least 6 characters.');
      } else {
        setError(err.message || 'An error occurred during authentication.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDemoSelect = (selectedRole: 'CONSUMER' | 'PROVIDER', alias?: string) => {
    useDemoAccount(selectedRole, alias);
    if (onSuccess) onSuccess(selectedRole);
  };

  const handlePasswordReset = async () => {
    setError(null);
    setResetStatus(null);
    setLoading(true);
    try {
      await sendPasswordReset(signInEmail);
      setResetStatus('If an Open Polici account exists for this email, Firebase sent a password-reset link.');
    } catch (err: any) {
      if (err?.code === 'auth/invalid-email') {
        setError('Enter a valid account email address.');
      } else {
        setError(err?.message || 'Password reset could not be requested. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={isInline
      ? 'flex w-full items-center justify-center'
      : 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fade-in'}>
      <div 
        className={`relative w-full max-w-lg bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col ${isInline ? '' : 'animate-scale-up max-h-[92vh]'}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Ribbon */}
        <div className="bg-slate-900 px-6 py-4.5 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-slate-950 shadow-sm ${role === 'PROVIDER' ? 'bg-blue-400' : 'bg-emerald-400'}`}>
              {role === 'PROVIDER' ? <Building2 className="w-5 h-5 text-slate-950" /> : <ShieldCheck className="w-5 h-5 text-slate-950" />}
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight text-white leading-none">
                {mode === 'SIGN_UP' ? 'Create Open Polici Account' : mode === 'SIGN_IN' ? 'Sign In to Open Polici' : 'Instant Demonstration Access'}
              </h2>
              <span className={`font-mono text-[10px] ${role === 'PROVIDER' ? 'text-blue-400' : 'text-emerald-400'}`}>
                {role === 'PROVIDER' ? 'Licensed Provider & Broker Desk' : 'Sovereign Consumer Identity'}
              </span>
            </div>
          </div>
          {!isInline && (
            <button
              onClick={closeAuthModal}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Production exposes only real account creation and sign in. */}
        <div className={`grid ${demoIdentitiesEnabled ? 'grid-cols-3' : 'grid-cols-2'} p-2 bg-slate-50 border-b border-slate-200 text-xs font-medium shrink-0`}>
          {demoIdentitiesEnabled && <button
            type="button"
            onClick={() => { setMode('SIGN_UP'); setError(null); }}
            className={`py-2 text-center rounded-xl transition cursor-pointer ${
              mode === 'SIGN_UP'
                ? 'bg-white font-bold text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Create Account
          </button>}
          <button
            type="button"
            onClick={() => { setMode('SIGN_IN'); setError(null); }}
            className={`py-2 text-center rounded-xl transition cursor-pointer ${
              mode === 'SIGN_IN'
                ? 'bg-white font-bold text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setMode('DEMO'); setError(null); }}
            className={`py-2 text-center rounded-xl transition cursor-pointer flex items-center justify-center space-x-1 ${
              mode === 'DEMO'
                ? 'bg-white font-bold text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            <span>Fast Demo</span>
          </button>
        </div>

        {/* Role Toggle for Sign Up */}
        {mode === 'SIGN_UP' && (
          <div className="px-6 pt-4 pb-1 shrink-0">
            <label className="text-[11px] font-mono uppercase tracking-wider text-slate-500 font-semibold block mb-1.5">
              Choose Your Account Type
            </label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => setRole('CONSUMER')}
                className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center space-x-1.5 transition cursor-pointer ${
                  role === 'CONSUMER'
                    ? 'bg-white text-emerald-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>Policyholder (Consumer)</span>
              </button>
              <button
                type="button"
                onClick={() => setRole('PROVIDER')}
                className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center space-x-1.5 transition cursor-pointer ${
                  role === 'PROVIDER'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Briefcase className="w-3.5 h-3.5" />
                <span>Broker / Carrier (Provider)</span>
              </button>
            </div>
          </div>
        )}

        {/* Content Body */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {resetStatus && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-start space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{resetStatus}</span>
            </div>
          )}

          {mode === 'DEMO' && demoIdentitiesEnabled ? (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-1.5">
                <div className="flex items-center space-x-2 text-emerald-900 text-xs font-bold">
                  <Zap className="w-4 h-4 text-emerald-600" />
                  <span>Instant Evaluation Personas</span>
                </div>
                <p className="text-xs text-emerald-700 leading-relaxed">
                  Skip registration to test the end-to-end offer review flow with pre-seeded demonstration profiles.
                </p>
              </div>

              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={() => handleDemoSelect('CONSUMER', 'Jane Doe (NV Auto)')}
                  className="w-full flex items-center justify-between p-3.5 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/30 transition text-left cursor-pointer group"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                      <User className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 group-hover:text-emerald-700">
                        Consumer: Jane Doe · 2024 Toyota Camry
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        Shared Policy #NV-49281 • $2,964 Current Premium • 3 Provider Offers
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 transition-transform group-hover:translate-x-0.5" />
                </button>

                <button
                  type="button"
                  onClick={() => handleDemoSelect('PROVIDER', 'Sierra Brokerage (Alex Morgan)')}
                  className="w-full flex items-center justify-between p-3.5 rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50/30 transition text-left cursor-pointer group"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 group-hover:text-blue-700">
                        Provider: Sierra Brokerage Group LLC
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        Nevada personal auto provider • Offer workspace
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-transform group-hover:translate-x-0.5" />
                </button>
              </div>
            </div>
          ) : mode === 'SIGN_IN' ? (
            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Account Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={signInEmail}
                    onChange={(e) => setSignInEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={handlePasswordReset}
                    disabled={loading}
                    className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 disabled:opacity-50 cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Password</label>
                <div className="relative">
                  <Key className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    value={signInPassword}
                    onChange={(e) => setSignInPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer flex items-center justify-center space-x-2"
              >
                <span>{loading ? 'Authenticating...' : 'Sign In to Workbench'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          ) : role === 'CONSUMER' ? (
            /* Consumer Sign Up Form */
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-700">How are you starting?</p>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setConsumerIntakeOrigin('VERIFIED_EXISTING_POLICY')}
                    className={`rounded-xl border p-3 text-left transition ${consumerIntakeOrigin === 'VERIFIED_EXISTING_POLICY' ? 'border-emerald-500 bg-emerald-50 text-emerald-950' : 'border-slate-200 bg-white text-slate-600'}`}>
                    <span className="block text-xs font-bold">I have insurance</span>
                    <span className="mt-1 block text-[10px] leading-4">Upload and confirm the policy you have.</span>
                  </button>
                  <button type="button" onClick={() => setConsumerIntakeOrigin('CONSUMER_DEFINED_COVERAGE_REQUEST')}
                    className={`rounded-xl border p-3 text-left transition ${consumerIntakeOrigin === 'CONSUMER_DEFINED_COVERAGE_REQUEST' ? 'border-emerald-500 bg-emerald-50 text-emerald-950' : 'border-slate-200 bg-white text-slate-600'}`}>
                    <span className="block text-xs font-bold">I need insurance</span>
                    <span className="mt-1 block text-[10px] leading-4">Tell providers what you are looking for.</span>
                  </button>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Full Name or Alias</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={consumerName}
                    onChange={(e) => setConsumerName(e.target.value)}
                    placeholder="Jane Doe"
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
              </div>


              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Email Address (Kept Private)</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={consumerEmail}
                    onChange={(e) => setConsumerEmail(e.target.value)}
                    placeholder="jane.doe@example.com"
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">State (Jurisdiction)</label>
                  <select
                    value={consumerState}
                    onChange={(e) => setConsumerState(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                  >
                    <JurisdictionSelectOptions />
                  </select>
                </div>

                {consumerIntakeOrigin === 'VERIFIED_EXISTING_POLICY' && <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Current Carrier (Opt.)</label>
                  <input
                    type="text"
                    value={currentCarrier}
                    onChange={(e) => setCurrentCarrier(e.target.value)}
                    placeholder="e.g. GEICO, State Farm"
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                  />
                </div>}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Insurance Type</label>
                <select
                  value={requestedInsuranceLine}
                  onChange={(e) => setRequestedInsuranceLine(e.target.value as InsuranceLine)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                >
                  {INSURANCE_LINES.filter(line => line.implementationStatus !== 'LOCKED').map(line => (
                    <option key={line.code} value={line.code}>
                      {line.displayName}{line.implementationStatus === 'ACCEPTANCE' ? '' : ' — availability pending'}
                    </option>
                  ))}
                </select>
                {requestedInsuranceLine !== 'PERSONAL_AUTO' && (
                  <p className="text-[11px] leading-relaxed text-amber-700">
                    This insurance type is represented in Open Polici but is not yet accepted by the live document-processing pipeline. It will not be sent through personal-auto processing.
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Create Password</label>
                <div className="relative">
                  <Key className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    value={consumerPassword}
                    onChange={(e) => setConsumerPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    minLength={6}
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-xl shadow-md transition cursor-pointer flex items-center justify-center space-x-2"
              >
                <span>{loading ? 'Creating Account...' : 'Create My Free Consumer Account'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          ) : (
            /* Provider / Broker Sign Up Form */
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-[11px] leading-5 text-blue-900">
                This creates a provider application—not marketplace authority. Open Polici must verify the organization, applicable authority, requested line, and commercial activation before the Provider Desk opens.
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Organization Type</label>
                  <select value={providerOrganizationType} onChange={(e) => setProviderOrganizationType(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-500">
                    <option value="INDEPENDENT_AGENCY">Independent agency</option><option value="BROKERAGE">Brokerage</option><option value="CAPTIVE_AGENCY">Captive agency</option><option value="DIRECT_CARRIER">Direct carrier</option><option value="OTHER_AUTHORIZED_PROVIDER">Other authorized provider</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Requested V2 Plan</label>
                  <select value={providerPlanCode} onChange={(e) => setProviderPlanCode(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-500">
                    <option value="PLAN_SOLO">Solo — $99/month</option><option value="PLAN_AGENCY">Agency — $249/month</option><option value="PLAN_OPEN_POLICY_PREMIUM">Premium — $499/month</option><option value="PLAN_NETWORK">Network — $999/month</option><option value="PLAN_ENTERPRISE">Enterprise / Direct Carrier — from $1,999/month</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Requested Insurance Line</label>
                <select value={providerInsuranceLine} onChange={(e) => setProviderInsuranceLine(e.target.value as InsuranceLine)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-500">
                  {INSURANCE_LINES.map(line => <option key={line.code} value={line.code}>{line.displayName}{line.implementationStatus === 'ACCEPTANCE' ? '' : ' — production availability pending'}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Licensed Agent Name</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={agentName}
                    onChange={(e) => setAgentName(e.target.value)}
                    placeholder="Alex Morgan"
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="space-y-1"><label className="text-xs font-semibold text-slate-700">National Producer Number (optional)</label><input type="text" value={providerNpn} onChange={(e) => setProviderNpn(e.target.value)} placeholder="NPN" className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-500" /></div>
              {providerOrganizationType === 'DIRECT_CARRIER' && <div className="space-y-1"><label className="text-xs font-semibold text-slate-700">Certificate-of-Authority Reference</label><input type="text" required value={carrierAuthorityReference} onChange={(e) => setCarrierAuthorityReference(e.target.value)} placeholder="Regulator record or certificate reference" className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-500" /><p className="text-[11px] leading-5 text-amber-700">Submission records evidence for review. It does not establish carrier authority automatically.</p></div>}

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Organization Legal Name</label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={agencyName}
                    onChange={(e) => setAgencyName(e.target.value)}
                    placeholder="Legal provider or carrier name"
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Licensing State</label>
                  <select
                    value={providerState}
                    onChange={(e) => setProviderState(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                  >
                    <JurisdictionSelectOptions />
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">{providerOrganizationType === 'DIRECT_CARRIER' ? 'Producer License (if applicable)' : 'License Number'}</label>
                  <input
                    type="text"
                    required={providerOrganizationType !== 'DIRECT_CARRIER'}
                    value={licenseNumber}
                    onChange={(e) => setLicenseNumber(e.target.value)}
                    placeholder="NV-LIC-984210"
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Professional Work Email</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={providerEmail}
                    onChange={(e) => setProviderEmail(e.target.value)}
                    placeholder="agent@agencydomain.com"
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Create Password</label>
                <div className="relative">
                  <Key className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    value={providerPassword}
                    onChange={(e) => setProviderPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    minLength={6}
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer flex items-center justify-center space-x-2"
              >
                <span>{loading ? 'Submitting Application...' : 'Submit Provider Application'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* Privacy & Anti-Spam Protocol Guarantee */}
          <div className="pt-2 border-t border-slate-100 flex items-start space-x-2 text-[11px] text-slate-500 leading-snug shrink-0">
            <Lock className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
            <span>
              <strong>Zero Telemarketing Selling:</strong> Open Polici uses Deliberate Progressive Disclosure. Contact details are never sold to lead aggregators or spam call centers.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
