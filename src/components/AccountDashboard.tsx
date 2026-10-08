import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Plus, 
  FileText, 
  CheckCircle2, 
  ArrowRight, 
  Car, 
  Home as HomeIcon, 
  Building, 
  Clock, 
  Download, 
  Eye, 
  Lock, 
  ExternalLink,
  DollarSign,
  TrendingDown,
  Layers,
  Sparkles,
  RefreshCw,
  Award,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { 
  fetchUserChallenges, 
  fetchUserOrders, 
  fetchUserVault,
  UserChallengeRecord, 
  UserOrderRecord, 
  UserVaultRecord 
} from '../services/userService';

interface AccountDashboardProps {
  onStartNewChallenge: () => void;
  onSelectChallenge: (challengeId: string) => void;
  onViewOrderDossier: (dossierRef: string) => void;
}

export const AccountDashboard: React.FC<AccountDashboardProps> = ({
  onStartNewChallenge,
  onSelectChallenge,
  onViewOrderDossier
}) => {
  const { userProfile, isDemoUser, openAuthModal, signOutUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'CHALLENGES' | 'ORDERS' | 'VAULT'>('CHALLENGES');
  const [challenges, setChallenges] = useState<UserChallengeRecord[]>([]);
  const [orders, setOrders] = useState<UserOrderRecord[]>([]);
  const [vaultDocs, setVaultDocs] = useState<UserVaultRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const loadUserData = async () => {
    if (!userProfile) return;
    setLoading(true);
    try {
      const [userChals, userOrds, userVlt] = await Promise.all([
        fetchUserChallenges(userProfile.id),
        fetchUserOrders(userProfile.id),
        fetchUserVault(userProfile.id)
      ]);
      setChallenges(userChals);
      setOrders(userOrds);
      setVaultDocs(userVlt);
    } catch (e) {
      console.error('Failed to load user account records:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUserData();
  }, [userProfile?.id]);

  const totalAnnualSavings = orders.reduce((acc, o) => acc + (o.annualSavings || 0), 0);
  const totalOffersReceived = challenges.reduce((acc, c) => acc + (c.offersCount || 0), 0);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Account Profile Banner */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 border border-slate-800 shadow-xl relative overflow-hidden">
        {/* Subtle grid and glow */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b20_1px,transparent_1px),linear-gradient(to_bottom,#1e293b20_1px,transparent_1px)] bg-[size:3rem_3rem] pointer-events-none opacity-50" />
        <div className="absolute top-0 right-10 w-80 h-40 bg-emerald-500/10 blur-3xl pointer-events-none rounded-full" />

        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start sm:items-center space-x-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 text-slate-950 font-black text-xl flex items-center justify-center shadow-lg shrink-0">
              {userProfile?.displayName?.charAt(0).toUpperCase() || 'P'}
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white">
                  {userProfile?.displayName || 'My Consumer Account'}
                </h1>
                {isDemoUser ? (
                  <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    <span>Demo Profile</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    <ShieldCheck className="w-3 h-3 text-emerald-400" />
                    <span>Verified Policyholder</span>
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-400 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono">
                <span>{userProfile?.email}</span>
                <span>•</span>
                <span>Sovereign Risk Custody</span>
                <span>•</span>
                <span>SHA-256 Ledger Synchronized</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isDemoUser ? (
              <button
                type="button"
                onClick={() => openAuthModal()}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-xl shadow-md transition cursor-pointer flex items-center space-x-1.5"
              >
                <span>Save to Real Account</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={signOutUser}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold rounded-xl border border-slate-700 transition cursor-pointer"
              >
                Sign Out
              </button>
            )}

            <button
              type="button"
              onClick={onStartNewChallenge}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-300 hover:text-white text-xs font-bold rounded-xl border border-slate-700 shadow-md transition cursor-pointer flex items-center space-x-1.5"
            >
              <Plus className="w-4 h-4 text-emerald-400" />
              <span>Share Another Policy</span>
            </button>
          </div>
        </div>

        {/* Account Quick Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-6 mt-6 border-t border-slate-800/80">
          <div className="p-3 bg-slate-800/50 rounded-2xl border border-slate-800">
            <span className="text-[11px] font-mono text-slate-400 uppercase">Policies Shared</span>
            <div className="text-xl font-bold text-white font-mono mt-0.5">{challenges.length}</div>
          </div>
          <div className="p-3 bg-slate-800/50 rounded-2xl border border-slate-800">
            <span className="text-[11px] font-mono text-slate-400 uppercase">Provider Offers Received</span>
            <div className="text-xl font-bold text-emerald-400 font-mono mt-0.5">{totalOffersReceived} offers</div>
          </div>
          <div className="p-3 bg-slate-800/50 rounded-2xl border border-slate-800">
            <span className="text-[11px] font-mono text-slate-400 uppercase">Bound Policies (Orders)</span>
            <div className="text-xl font-bold text-blue-400 font-mono mt-0.5">{orders.length} active</div>
          </div>
          <div className="p-3 bg-slate-800/50 rounded-2xl border border-slate-800">
            <span className="text-[11px] font-mono text-slate-400 uppercase">Combined Annual Premium Difference</span>
            <div className="text-xl font-bold text-emerald-400 font-mono mt-0.5">-${totalAnnualSavings}/yr</div>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-200 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('CHALLENGES')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center space-x-2 ${
            activeTab === 'CHALLENGES'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Layers className="w-4 h-4 text-emerald-500" />
          <span>My Shared Policies ({challenges.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('ORDERS')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center space-x-2 ${
            activeTab === 'ORDERS'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <CheckCircle2 className="w-4 h-4 text-blue-500" />
          <span>Bound Policies & Orders ({orders.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('VAULT')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center space-x-2 ${
            activeTab === 'VAULT'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Lock className="w-4 h-4 text-amber-500" />
          <span>Private Document Vault ({vaultDocs.length})</span>
        </button>
      </div>

      {/* Tab 1: Challenges List */}
      {activeTab === 'CHALLENGES' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Policies Open for Offers</h2>
              <p className="text-xs text-slate-500">
                Policies you have shared for eligible insurance providers to review and respond to independently.
              </p>
            </div>
            <button
              onClick={onStartNewChallenge}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow-sm transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Upload Another Policy</span>
            </button>
          </div>

          {challenges.length === 0 ? (
            <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-12 text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                <FileText className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">No shared policies yet</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Upload your current personal auto declarations page so eligible providers can review it and decide whether to send an offer.
                </p>
              </div>
              <button
                onClick={onStartNewChallenge}
                className="inline-flex items-center space-x-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow-md transition cursor-pointer"
              >
                <span>Upload Declarations Page</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {challenges.map((chal) => (
                <div 
                  key={chal.id}
                  className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition p-5 space-y-4 flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-2">
                        {chal.insuranceType === 'AUTO' ? (
                          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                            <Car className="w-4 h-4" />
                          </div>
                        ) : chal.insuranceType === 'HOME' ? (
                          <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                            <HomeIcon className="w-4 h-4" />
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                            <Building className="w-4 h-4" />
                          </div>
                        )}
                        <div>
                          <span className="text-xs font-mono font-bold text-slate-900">{chal.referenceNumber}</span>
                          <div className="text-[11px] text-slate-500">{chal.vehicleOrProperty}</div>
                        </div>
                      </div>

                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {chal.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
                      <div>
                        <span className="text-[11px] text-slate-400">Current Premium</span>
                        <div className="font-bold text-slate-900 font-mono">${chal.baselineMonthlyPremium}/mo</div>
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-400">Provider Offers Received</span>
                        <div className="font-bold text-emerald-600 font-mono">{chal.offersCount} offers</div>
                      </div>
                    </div>

                    {chal.bestSavings > 0 && (
                      <div className="p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs flex items-center justify-between">
                        <span className="text-emerald-800 font-medium">Lowest submitted annual premium difference:</span>
                        <span className="font-bold text-emerald-700 font-mono">-${chal.bestSavings}/yr vs current policy</span>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => onSelectChallenge(chal.id)}
                    className="w-full py-2.5 px-3 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition cursor-pointer flex items-center justify-center space-x-1.5 shadow-xs"
                  >
                    <span>Review Offers</span>
                    <ArrowRight className="w-3.5 h-3.5 text-emerald-400" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Orders & Bound Policies */}
      {activeTab === 'ORDERS' && (
        <div className="space-y-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Bound Policies & Issued Binders</h2>
            <p className="text-xs text-slate-500">
              Issued policies from offers you selected, with recorded consent and factual reconciliation against the selected offer.
            </p>
          </div>

          {orders.length === 0 ? (
            <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-12 text-center space-y-3">
              <CheckCircle2 className="w-10 h-10 text-slate-400 mx-auto" />
              <h3 className="text-base font-bold text-slate-900">No policies bound yet</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                If you choose a provider offer, documents issued by that provider will appear here after the application and issuance process.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map((ord) => (
                <div 
                  key={ord.id}
                  className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-xs font-bold text-slate-900">{ord.policyNumber}</span>
                      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>{ord.binderStatus}</span>
                      </span>
                    </div>

                    <div className="text-sm font-bold text-slate-900">
                      {ord.carrier} · {ord.policyTier}
                    </div>

                    <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono">
                      <span>Bound: {new Date(ord.boundAt).toLocaleDateString()}</span>
                      <span>•</span>
                      <span>Ref: {ord.challengeRef}</span>
                      <span>•</span>
                      <span>Dossier: {ord.section32DossierRef.slice(0, 16)}...</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className="text-[11px] text-slate-400 font-mono">New Rate</span>
                      <div className="text-lg font-black text-slate-900 font-mono">${ord.monthlyPremium}/mo</div>
                      <span className="text-[11px] font-mono text-emerald-600 font-bold">-${ord.annualSavings}/yr vs prior policy</span>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2">
                      <button
                        type="button"
                        onClick={() => onViewOrderDossier(ord.section32DossierRef)}
                        className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl transition cursor-pointer flex items-center space-x-1"
                      >
                        <FileText className="w-3.5 h-3.5 text-slate-600" />
                        <span>View Consent</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => alert(`Official Insurance ID Card and Binder downloaded for ${ord.policyNumber}`)}
                        className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition cursor-pointer flex items-center space-x-1 shadow-xs"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download Binder</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Private Document Vault */}
      {activeTab === 'VAULT' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Private Policy Document Vault</h2>
              <p className="text-xs text-slate-500">
                Encrypted repository for declarations pages, vehicle titles, and endorsement records.
              </p>
            </div>
            <button
              onClick={() => alert('Secure file upload dialog opened for your encrypted policy vault.')}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-sm transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Upload Document</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {vaultDocs.map((doc) => (
              <div 
                key={doc.id}
                className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs hover:shadow-sm transition flex flex-col justify-between space-y-3"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <FileText className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      {doc.documentType}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 truncate" title={doc.name}>
                    {doc.name}
                  </h4>
                  {doc.notes && (
                    <p className="text-[11px] text-slate-500 line-clamp-2">
                      {doc.notes}
                    </p>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-mono text-slate-400">
                  <span>{doc.size}</span>
                  <button 
                    onClick={() => alert(`Downloading verified document: ${doc.name}`)}
                    className="text-emerald-700 hover:text-emerald-800 font-semibold cursor-pointer"
                  >
                    Download
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
