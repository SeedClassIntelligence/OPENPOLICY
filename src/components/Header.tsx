import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { apiFetch } from '../services/apiClient';
import { 
  UserCheck, 
  Briefcase, 
  Activity, 
  FileText, 
  RotateCcw,
  Sparkles,
  GitBranch,
  Bell,
  BookOpen,
  X,
  CheckCircle,
  AlertTriangle,
  Info,
  SlidersHorizontal,
  ChevronDown,
  Globe,
  Lock,
  User
} from 'lucide-react';
import { PlatformNotification } from '../types/insurance';
import { useAuth } from '../context/AuthContext';

export type ActivePerspective = 
  | 'LANDING'
  | 'CONSUMER' 
  | 'PROVIDER' 
  | 'ADMIN_AUDIT' 
  | 'TELEMETRY' 
  | 'ARCHITECTURE_TESTS';

export interface PerspectiveMeta {
  id: ActivePerspective;
  title: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  badgeBg: string;
}

export const PERSPECTIVES: PerspectiveMeta[] = [
  {
    id: 'LANDING',
    title: 'Landing Page & Doctrine',
    label: 'Overview',
    description: 'Front-facing introduction: inverted competition model, live simulator, comparison table, and product doctrine.',
    icon: Globe,
    color: 'text-teal-400',
    badgeBg: 'bg-teal-600'
  },
  {
    id: 'CONSUMER',
    title: 'Consumer Experience',
    label: 'Consumer',
    description: 'Policyholder view: baseline policy review, side-by-side carrier offers, and savings reconciliation.',
    icon: UserCheck,
    color: 'text-emerald-400',
    badgeBg: 'bg-emerald-600'
  },
  {
    id: 'PROVIDER',
    title: 'Provider Portal',
    label: 'Provider',
    description: 'Agency quoting desk: inspect consumer requirements, enter carrier quotes, and detect discrepancies.',
    icon: Briefcase,
    color: 'text-blue-400',
    badgeBg: 'bg-blue-600'
  },
  {
    id: 'ADMIN_AUDIT',
    title: 'Audit & Review Queue',
    label: 'Audit',
    description: 'Regulatory compliance: quote sheet validation, anti-steering checks, and audit trails.',
    icon: FileText,
    color: 'text-amber-400',
    badgeBg: 'bg-amber-600'
  },
  {
    id: 'TELEMETRY',
    title: 'Telemetry & Engine',
    label: 'Telemetry',
    description: 'Real-time engine operations: rating latency, Redis cache performance, and system throughput.',
    icon: Activity,
    color: 'text-purple-400',
    badgeBg: 'bg-purple-600'
  },
  {
    id: 'ARCHITECTURE_TESTS',
    title: 'Architecture & Tests',
    label: 'Architecture',
    description: 'Engineering specifications: domain modeling rules, security constraints, and automated unit tests.',
    icon: GitBranch,
    color: 'text-indigo-400',
    badgeBg: 'bg-indigo-600'
  }
];

interface HeaderProps {
  activePerspective: ActivePerspective;
  setActivePerspective: (perspective: ActivePerspective) => void;
  onReset: () => void;
  activeChallengeRef?: string;
}

export const Header: React.FC<HeaderProps> = ({
  activePerspective,
  setActivePerspective,
  onReset,
  activeChallengeRef = '#NV-49281'
}) => {
  const { userProfile, userRole, isAuthenticated, isDemoUser, openAuthModal } = useAuth();
  const [notifications, setNotifications] = useState<PlatformNotification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showDoctrineModal, setShowDoctrineModal] = useState(false);
  const [showPerspectiveMenu, setShowPerspectiveMenu] = useState(false);
  const perspectiveMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (perspectiveMenuRef.current && !perspectiveMenuRef.current.contains(e.target as Node)) {
        setShowPerspectiveMenu(false);
      }
    };
    if (showPerspectiveMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showPerspectiveMenu]);

  const fetchNotifications = async () => {
    try {
      const res = await apiFetch('/api/notifications');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 8000);
    return () => clearInterval(interval);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleMarkRead = async (id: string) => {
    try {
      await apiFetch(`/api/notifications/${id}/read`, { method: 'POST' });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    } catch {
      // ignore
    }
  };

  return (
    <>
    <header id="main-header" className="bg-slate-900/95 backdrop-blur-md border-b border-slate-800 text-white sticky top-0 z-50 shadow-md">
      <div className="w-full mx-auto px-3 sm:px-5 lg:px-6">
        <div className="flex items-center justify-between h-16 gap-3 lg:gap-5">
          {/* Brand */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              id="brand-home-btn"
              onClick={() => {
                setActivePerspective('LANDING');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="flex items-center gap-2 group cursor-pointer focus:outline-none"
              title="Return to Open Policy Landing Page"
            >
              <span className="font-black text-lg tracking-tight text-white select-none group-hover:text-emerald-300 transition-colors">
                OPEN<span className="text-emerald-400 font-black ml-0.5">POLICY</span>
              </span>
              <span className="text-[10px] font-mono font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 px-1.5 py-0.5 rounded-full hidden sm:inline-block">
                v1.0
              </span>
            </button>
          </div>

          {/* Perspective Switcher */}
          <div className="relative min-w-0 flex-1" ref={perspectiveMenuRef}>
            <div className="bg-slate-950/80 p-1 rounded-xl border border-slate-800/90 shadow-inner flex items-center gap-1">
              {/* Perspective Trigger */}
              <button
                id="perspective-menu-trigger-btn"
                type="button"
                onClick={() => setShowPerspectiveMenu(prev => !prev)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono font-medium transition cursor-pointer border-r border-slate-800/90 pr-2.5 shrink-0 ${
                  showPerspectiveMenu 
                    ? 'bg-slate-800 text-white shadow-xs' 
                    : 'text-slate-300 hover:text-white hover:bg-slate-900/80'
                }`}
                title="Click to view perspective guide or switch roles"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="tracking-wider uppercase text-[10px] font-semibold hidden lg:inline">Perspective</span>
                <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${showPerspectiveMenu ? 'rotate-180 text-emerald-400' : ''}`} />
              </button>

              {/* Direct Fast-Access Segmented Tabs */}
              <nav aria-label="Perspective Switcher" className="flex items-center gap-0.5 sm:gap-1 overflow-x-auto scrollbar-none">
                {PERSPECTIVES.map((p) => {
                  const isActive = activePerspective === p.id;
                  const Icon = p.icon;
                  const buttonId = p.id === 'ARCHITECTURE_TESTS' 
                    ? 'nav-arch-btn' 
                    : `nav-${p.label.toLowerCase()}-btn`;

                  if (isAuthenticated && p.id === 'CONSUMER' && userRole !== 'CONSUMER') return null;
                  if (isAuthenticated && p.id === 'PROVIDER' && userRole !== 'PROVIDER') return null;

                  // Primary perspectives always visible; secondary hidden below xl unless active
                  const isPrimary = p.id === 'LANDING' || p.id === 'CONSUMER' || p.id === 'PROVIDER';
                  const visibilityClass = isPrimary ? 'flex' : (isActive ? 'flex' : 'hidden xl:flex');

                  return (
                    <button
                      key={p.id}
                      id={buttonId}
                      type="button"
                      onClick={() => {
                        setActivePerspective(p.id);
                        setShowPerspectiveMenu(false);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className={`${visibilityClass} items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                        isActive
                          ? `${p.badgeBg} text-white shadow-sm ring-1 ring-white/20 font-semibold`
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                      }`}
                      title={`Switch to ${p.title}`}
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      <span>{p.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Interactive Perspective Menu Popover */}
            {showPerspectiveMenu && (
              <div 
                id="perspective-dropdown-menu"
                className="absolute left-0 mt-3 w-80 sm:w-96 bg-slate-900 text-white rounded-2xl shadow-2xl border border-slate-700/80 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100"
              >
                <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <SlidersHorizontal className="w-4 h-4 text-emerald-400" />
                    <span className="font-bold text-xs uppercase tracking-wider text-slate-200">
                      Switch Role Perspective
                    </span>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setShowPerspectiveMenu(false)}
                    className="text-slate-400 hover:text-white p-1 rounded-md transition"
                    title="Close"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-2 space-y-1 max-h-[70vh] overflow-y-auto">
                  {PERSPECTIVES.map((p) => {
                    const isActive = activePerspective === p.id;
                    const Icon = p.icon;
                    if (isAuthenticated && p.id === 'CONSUMER' && userRole !== 'CONSUMER') return null;
                    if (isAuthenticated && p.id === 'PROVIDER' && userRole !== 'PROVIDER') return null;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setActivePerspective(p.id);
                          setShowPerspectiveMenu(false);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className={`w-full flex items-start space-x-3 p-3 rounded-xl transition text-left cursor-pointer ${
                          isActive 
                            ? 'bg-slate-800/90 border border-slate-700 shadow-xs' 
                            : 'hover:bg-slate-800/50 text-slate-300'
                        }`}
                      >
                        <div className={`p-2 rounded-lg shrink-0 ${p.badgeBg} text-white shadow-xs`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className={`text-xs font-semibold ${isActive ? 'text-white' : 'text-slate-200'}`}>
                              {p.title}
                            </span>
                            {isActive && (
                              <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                Current
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                            {p.description}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="p-3 bg-slate-950/80 border-t border-slate-800/80 text-center">
                  <span className="text-[10px] text-slate-400 font-mono">
                    Select any role to experience the platform through that stakeholder's lens
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Quick Actions: Doctrine, Notifications, Auth, Reset */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Product Doctrine */}
            <button
              id="doctrine-btn"
              onClick={() => setShowDoctrineModal(true)}
              title="The Product Doctrine (Section 40)"
              className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-2.5 py-1.5 rounded-lg border border-slate-700 transition"
            >
              <BookOpen className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="hidden lg:inline">Product Doctrine</span>
            </button>

            {/* Notifications Bell */}
            <div className="relative">
              <button
                id="notifications-bell-btn"
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 p-2 rounded-lg border border-slate-700 transition"
                title="Platform Notifications Stream (Section 28)"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-emerald-500 text-white font-bold text-[9px] w-4 h-4 rounded-full flex items-center justify-center animate-pulse">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Popover Dropdown */}
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white text-slate-900 rounded-xl shadow-2xl border border-slate-200 z-[60] overflow-hidden">
                  <div className="p-3 bg-slate-900 text-white flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Bell className="w-4 h-4 text-emerald-400" />
                      <span className="font-bold text-xs uppercase tracking-wider">Platform Notifications</span>
                    </div>
                    <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded">
                      {unreadCount} Unread
                    </span>
                  </div>

                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                    {notifications.length === 0 ? (
                      <p className="p-4 text-xs text-slate-500 text-center">No notifications</p>
                    ) : (
                      notifications.map(notif => (
                        <div 
                          key={notif.id} 
                          onClick={() => handleMarkRead(notif.id)}
                          className={`p-3 text-xs transition cursor-pointer hover:bg-slate-50 ${!notif.read ? 'bg-emerald-50/40 border-l-4 border-l-emerald-600' : ''}`}
                        >
                          <div className="flex items-start justify-between gap-1">
                            <span className="font-semibold text-slate-900">{notif.title}</span>
                            <span className="text-[10px] text-slate-400 font-mono whitespace-nowrap">
                              {new Date(notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-slate-600 text-[11px] mt-1 leading-snug">
                            {notif.message}
                          </p>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="p-2.5 bg-slate-50 border-t border-slate-100 text-center">
                    <button
                      onClick={() => setShowNotifications(false)}
                      className="text-xs text-slate-600 hover:text-slate-900 font-medium"
                    >
                      Close Stream
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* User Account / Identity Badge */}
            {isAuthenticated ? (
              <button
                type="button"
                onClick={() => openAuthModal()}
                title={isDemoUser ? "Using Demo Profile — Click to Manage Account" : "Signed in as " + userProfile?.displayName}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-xs text-slate-200 border border-slate-700 transition cursor-pointer"
              >
                <div className="w-4 h-4 rounded-full bg-emerald-500 text-slate-950 font-bold text-[9px] flex items-center justify-center shrink-0">
                  {userProfile?.displayName?.charAt(0).toUpperCase() || 'U'}
                </div>
                <span className="hidden sm:inline text-[11px] font-medium truncate max-w-[80px]">
                  {userProfile?.displayName?.split(' ')[0] || 'Account'}
                </span>
                {isDemoUser ? (
                  <span className="text-[9px] font-mono bg-amber-500/20 text-amber-300 px-1 rounded">
                    Demo
                  </span>
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                )}
              </button>
            ) : (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => openAuthModal({ initialMode: 'SIGN_IN' })}
                  className="px-2.5 py-1.5 rounded-lg text-xs text-slate-300 hover:text-white hover:bg-slate-800 transition cursor-pointer font-medium"
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => openAuthModal({ initialMode: 'SIGN_UP', initialRole: 'CONSUMER' })}
                  className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-xs transition cursor-pointer whitespace-nowrap"
                >
                  Create Account
                </button>
              </div>
            )}

            {/* Reset Button */}
            <button
              id="reset-canonical-btn"
              onClick={onReset}
              title="Reset state to canonical baseline and sample offers"
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 bg-slate-800/80 hover:bg-slate-700 px-2.5 py-1.5 rounded-lg border border-slate-700 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Reset</span>
            </button>
          </div>
        </div>
      </div>
    </header>

    {/* Product Doctrine Modal — portaled to document.body to escape header stacking context */}
    {showDoctrineModal && ReactDOM.createPortal(
      <div 
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 sm:p-8"
        onClick={(e) => {
          if (e.target === e.currentTarget) setShowDoctrineModal(false);
        }}
      >
        <div className="bg-white rounded-2xl max-w-2xl w-full flex flex-col max-h-[85vh] shadow-2xl border border-slate-200 text-slate-900 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-5 sm:p-6 border-b border-slate-200 shrink-0 bg-white">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 tracking-tight">The Product Doctrine</h3>
                <p className="text-xs text-slate-500 font-mono">Auto Insurance v1.0 • Section 40</p>
              </div>
            </div>
            <button 
              type="button"
              onClick={() => setShowDoctrineModal(false)}
              className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-2 rounded-lg transition cursor-pointer"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Scrollable Body */}
          <div className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1">
            <p className="text-sm text-slate-600 leading-relaxed italic border-l-2 border-emerald-500 pl-3">
              "This platform reverses the conventional insurance-shopping relationship. The consumer begins with: Here is the insurance I already have. Here is what I am paying. Compete for my business without disguising reduced protection as savings."
            </p>

            <div className="space-y-2 text-sm">
              {[
                { n: 1, title: 'Consumer Sovereignty', desc: 'The consumer owns the policy, the information and the decision.' },
                { n: 2, title: 'Friction Reduction', desc: 'The platform reduces the work required to bring that policy to market.' },
                { n: 3, title: 'Inverted Competition', desc: 'Providers compete for the consumer rather than forcing the consumer to repeatedly shop providers.' },
                { n: 4, title: 'Protection-Price Separation', desc: 'Lower price alone does not constitute a better offer.' },
                { n: 5, title: 'Visible Differences', desc: 'Coverage differences must be visible.' },
                { n: 6, title: 'Epistemic Humility', desc: 'Unknown information must remain unknown. AI may never invent missing coverage.' },
                { n: 7, title: 'Deliberate Progressive Disclosure', desc: 'Personal information is disclosed deliberately rather than indiscriminately distributed.' },
                { n: 8, title: 'Commercial Neutrality', desc: 'Providers cannot purchase an undisclosed advantage in competitive results.' },
                { n: 9, title: 'Deterministic Control', desc: 'The platform explains the market; the consumer controls the outcome.' },
              ].map(({ n, title, desc }) => (
                <div key={n} className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-start space-x-2.5">
                  <span className="font-bold text-emerald-700 font-mono text-xs">{n}.</span>
                  <p className="text-slate-800 text-xs">
                    <strong className="text-slate-900">{title}:</strong> {desc}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 bg-slate-50 border-t border-slate-200 text-right shrink-0">
            <button
              type="button"
              onClick={() => setShowDoctrineModal(false)}
              className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-5 py-2.5 rounded-lg shadow-xs transition cursor-pointer"
            >
              Close Doctrine Reader
            </button>
          </div>
        </div>
      </div>,
      document.body
    )}
    </>
  );
};
