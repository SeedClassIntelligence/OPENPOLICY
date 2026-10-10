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
  const { 
    authModalOpen, 
    closeAuthModal, 
    authModalInitialRole,
    authModalInitialMode,
    signInWithEmail, 
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

  // Provider form state
  const [agentName, setAgentName] = useState('');
  const [agencyName, setAgencyName] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [providerState, setProviderState] = useState('NV');
  const [providerEmail, setProviderEmail] = useState('');
  const [providerPassword, setProviderPassword] = useState('');

  // Sign In form state
  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (authModalOpen || isInline) {
      setMode(initialMode || authModalInitialMode || 'SIGN_UP');
      setRole(initialRole || authModalInitialRole || 'CONSUMER');
      setError(null);
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
          const createdRole = await signUpAsConsumer(consumerName, consumerEmail, consumerPassword, consumerState, currentCarrier);
          if (onSuccess) onSuccess(createdRole);
        } else {
          if (!agentName.trim() || !agencyName.trim() || !licenseNumber.trim()) {
            throw new Error('Please complete all agency registration fields.');
          }
          const createdRole = await signUpAsProvider(agentName, agencyName, licenseNumber, providerState, providerEmail, providerPassword);
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
                {mode === 'SIGN_UP' ? 'Create Open Policy Account' : mode === 'SIGN_IN' ? 'Sign In to Open Policy' : 'Instant Demonstration Access'}
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

        {/* Tab Selector (Sign In vs Create Account vs Fast Demo) */}
        <div className="grid grid-cols-3 p-2 bg-slate-50 border-b border-slate-200 text-xs font-medium shrink-0">
          <button
            type="button"
            onClick={() => { setMode('SIGN_UP'); setError(null); }}
            className={`py-2 text-center rounded-xl transition cursor-pointer ${
              mode === 'SIGN_UP'
                ? 'bg-white font-bold text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Create Account
          </button>
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

          {mode === 'DEMO' ? (
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

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Current Carrier (Opt.)</label>
                  <input
                    type="text"
                    value={currentCarrier}
                    onChange={(e) => setCurrentCarrier(e.target.value)}
                    placeholder="e.g. GEICO, State Farm"
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
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
                <span>{loading ? 'Creating Account...' : 'Create Policyholder Account'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          ) : (
            /* Provider / Broker Sign Up Form */
            <form onSubmit={handleSubmit} className="space-y-3">
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

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Agency / Brokerage Name</label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={agencyName}
                    onChange={(e) => setAgencyName(e.target.value)}
                    placeholder="Sierra Brokerage Group LLC"
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
                  <label className="text-xs font-semibold text-slate-700">License / NPN #</label>
                  <input
                    type="text"
                    required
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
                <span>{loading ? 'Registering Agency...' : 'Register Agency & Open Quoting Desk'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* Privacy & Anti-Spam Protocol Guarantee */}
          <div className="pt-2 border-t border-slate-100 flex items-start space-x-2 text-[11px] text-slate-500 leading-snug shrink-0">
            <Lock className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
            <span>
              <strong>Zero Telemarketing Selling:</strong> Open Policy uses Deliberate Progressive Disclosure. Contact details are never sold to lead aggregators or spam call centers.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
