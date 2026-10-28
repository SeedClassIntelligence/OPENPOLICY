import React, { useState, useMemo, useEffect } from 'react';
import {
  ShieldCheck,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  SlidersHorizontal,
  Lock,
  Eye,
  FileText,
  Sparkles,
  ChevronRight,
  ChevronDown,
  BookOpen,
  Zap,
  Check,
  X,
  UserCheck,
  Briefcase,
  Activity,
  GitBranch,
  Layers,
  Scale,
  TrendingDown,
  ExternalLink,
  ShieldAlert,
  FileCheck2,
  Car,
  Truck,
  Home as HomeIcon,
  KeyRound,
  Building,
  Building2,
  HelpCircle,
  Database,
  Award,
  Search,
  ArrowUp,
  Info,
  Mail,
  Key,
  User
} from 'lucide-react';
import { ActivePerspective } from './Header';
import { useAuth } from '../context/AuthContext';
import { INSURANCE_LINE_REGISTRY } from '../domain/insuranceLineRegistry';
import { ProviderLandingPage } from './ProviderLandingPage';

interface LandingPageProps {
  onNavigateConsumer: () => void;
  onNavigateProvider: () => void;
  onNavigateAdmin: () => void;
  onNavigateTelemetry: () => void;
  onNavigateArchitecture: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onNavigateConsumer,
  onNavigateProvider,
  onNavigateAdmin,
  onNavigateTelemetry,
  onNavigateArchitecture
}) => {
  const { isAuthenticated, userRole, openAuthModal } = useAuth();

  const processedInsuranceLines = [
    { label: 'Personal Auto', icon: Car },
    { label: 'Homeowners', icon: HomeIcon },
    { label: 'Renters', icon: KeyRound },
    { label: 'Commercial Auto', icon: Truck },
    { label: 'General Liability', icon: ShieldCheck },
    { label: 'Businessowners', icon: Building2 }
  ] as const;

  const [publicPage, setPublicPage] = useState<'CONSUMER' | 'PROVIDER'>(() =>
    window.location.pathname === '/providers' ? 'PROVIDER' : 'CONSUMER'
  );

  useEffect(() => {
    const syncFromLocation = () => setPublicPage(window.location.pathname === '/providers' ? 'PROVIDER' : 'CONSUMER');
    window.addEventListener('popstate', syncFromLocation);
    return () => window.removeEventListener('popstate', syncFromLocation);
  }, []);

  const navigatePublicPage = (page: 'CONSUMER' | 'PROVIDER') => {
    const path = page === 'PROVIDER' ? '/providers' : '/consumers';
    window.history.pushState({}, '', path);
    setPublicPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleStartPolicyReviewClick = () => {
    if (isAuthenticated && userRole === 'CONSUMER') {
      onNavigateConsumer();
    } else {
      openAuthModal({ initialRole: 'CONSUMER', initialMode: 'SIGN_UP' });
    }
  };

  const handleConsumerPathClick = (origin: 'VERIFIED_EXISTING_POLICY' | 'CONSUMER_DEFINED_COVERAGE_REQUEST') => {
    if (isAuthenticated && userRole === 'CONSUMER') {
      onNavigateConsumer();
      return;
    }
    openAuthModal({ initialRole: 'CONSUMER', initialMode: 'SIGN_UP', initialConsumerOrigin: origin });
  };

  const handleProviderDeskClick = () => {
    if (isAuthenticated && userRole === 'PROVIDER') {
      onNavigateProvider();
    } else {
      openAuthModal({ initialRole: 'PROVIDER', initialMode: 'SIGN_UP' });
    }
  };

  // Simulator State
  const [insuranceType, setInsuranceType] = useState<'AUTO' | 'HOME' | 'COMMERCIAL'>('AUTO');
  const [currentPremium, setCurrentPremium] = useState<number>(215);
  const [deductible, setDeductible] = useState<number>(500);
  const [liabilityTier, setLiabilityTier] = useState<'STANDARD' | 'PREFERRED' | 'SOVEREIGN'>('PREFERRED');
  const [simulatePhantomCut, setSimulatePhantomCut] = useState<boolean>(false);
  const [selectedPreviewOffer, setSelectedPreviewOffer] = useState<number>(1);
  const [expandedDoctrine, setExpandedDoctrine] = useState<number | null>(0);
  const [activeStepTab, setActiveStepTab] = useState<number>(0);
  // FAQ Accordion & Filtering State
  const [openFaqIds, setOpenFaqIds] = useState<string[]>(['faq-spam', 'faq-phantom']);
  const [selectedFaqCategory, setSelectedFaqCategory] = useState<string>('ALL');
  const [faqSearchQuery, setFaqSearchQuery] = useState<string>('');

  // Computed Values for Simulator
  const illustrativeDifferenceRate = insuranceType === 'AUTO' ? 0.22 : insuranceType === 'HOME' ? 0.18 : 0.25;
  const premiumDifference = Math.round(currentPremium * illustrativeDifferenceRate);
  const providerOfferPremium = currentPremium - premiumDifference;
  const annualPremiumDifference = premiumDifference * 12;

  // Misleading Price Difference math
  const phantomStatedSavings = premiumDifference + 45; // appears bigger!
  const phantomStatedPremium = currentPremium - phantomStatedSavings;

  const previewOffers = [
    {
      label: 'Offer A', carrier: 'Silver State Auto', provider: 'Independent Nevada Agency',
      monthly: 219, annual: 2628, difference: 336, classification: 'BASELINE MATCH', tone: 'emerald',
      summary: 'Exact protection match across all documented coverage categories.',
      details: ['Liability: $100k / $300k', 'Property damage: $100k', 'Deductibles: $500 / $500', 'Rental and roadside: Included']
    },
    {
      label: 'Offer B', carrier: 'Desert Mutual', provider: 'Licensed Nevada Brokerage',
      monthly: 187, annual: 2244, difference: 720, classification: 'COVERAGE CHANGED', tone: 'rose',
      summary: 'This lower-priced offer states these coverage differences:',
      details: ['Liability: $25k / $50k', 'Property damage: $20k', 'Deductibles: $1,000 / $2,000', 'Rental and roadside: Not included']
    },
    {
      label: 'Offer C', carrier: 'Mountain West Casualty', provider: 'Regional Nevada Producer',
      monthly: 231, annual: 2772, difference: 192, classification: 'ADDITIONAL COVERAGE', tone: 'blue',
      summary: 'Additional stated protection appears in the proposal:',
      details: ['Liability: $250k / $500k', 'Property damage: $100k', 'Deductibles: $500 / $500', 'Rental, roadside, and glass: Included']
    }
  ] as const;

  const DOCTRINES = [
    {
      num: '01',
      title: 'You Govern the Decision',
      summary: 'Review the proposals, request another eligible cohort, keep your policy, or close the process.',
      detail: 'No proposal becomes an authorized connection until you select it and explicitly approve the handoff.'
    },
    {
      num: '02',
      title: 'Establish Your Criteria Once',
      summary: 'Skip the multi-site grind. Confirm one policy baseline or one guided coverage request.',
      detail: 'Lock in your starting information once, review it for accuracy, and make later changes through a traceable new version.'
    },
    {
      num: '03',
      title: 'Independent Custom Proposals',
      summary: 'Providers develop their proposals without seeing another provider’s price or terms.',
      detail: 'No participant receives another provider\'s pricing, a target price, or your reasons for rejecting an earlier proposal.'
    },
    {
      num: '04',
      title: 'Compare the Substance, Not Just the Premium',
      summary: 'See documented limits, deductibles, and coverage changes beside the price.',
      detail: 'A lower premium can change the protection. Open Polici places the documented price difference beside the terms that changed.'
    },
    {
      num: '05',
      title: 'Expose Every Documented Contrast',
      summary: 'Matches, additions, reductions, and unknowns remain visible.',
      detail: 'Coverage, limits, deductibles, endorsements, price, and missing information remain available for direct review.'
    },
    {
      num: '06',
      title: 'Zero Guesswork About Missing Terms',
      summary: 'If a proposal does not document something, Open Polici leaves it unknown.',
      detail: 'Missing roadside, rental, glass, endorsement, or other terms are flagged for review instead of being replaced with an assumption.'
    },
    {
      num: '07',
      title: 'Review Before Contact',
      summary: 'Participating providers do not receive your controlled connection details merely for submitting a proposal.',
      detail: 'You review first, choose second, and authorize the handoff last. Only the selected provider receives the controlled connection.'
    },
    {
      num: '08',
      title: 'No Pay-to-Play Results',
      summary: 'Provider spending cannot purchase proposal order, exclusive placement, cohort priority, or selection influence.',
      detail: 'Membership purchases operating capacity and services—never a better position in front of the consumer.'
    },
    {
      num: '09',
      title: 'Traceable Authorization Evidence',
      summary: 'The selected proposal, consent, disclosure, and connection remain connected to your decision.',
      detail: 'Open Polici preserves the marketplace evidence while the licensed provider remains responsible for the subsequent insurance transaction.'
    }
  ];

  interface FaqEntry {
    id: string;
    category: 'PRIVACY' | 'COMPARISON' | 'OFFERS' | 'AUDIT';
    categoryLabel: string;
    doctrineTag?: string;
    question: string;
    answer: string;
    keyPoints: string[];
    actionPrompt?: string;
    actionTarget?: 'CONSUMER' | 'SIMULATOR' | 'PROVIDER' | 'DOCTRINE';
  }

  const FAQS: FaqEntry[] = [
    {
      id: 'faq-spam',
      category: 'PRIVACY',
      categoryLabel: 'Privacy & Anti-Spam',
      doctrineTag: 'Review first · Connect last',
      question: 'Will insurance providers call, text, or email me the moment I start?',
      answer: 'No. Participating providers can review only the authorized opportunity information made available through the marketplace. They do not receive your controlled connection information merely because they review the opportunity or submit a proposal. Only the provider you select and authorize receives the information needed to continue with you.',
      keyPoints: [
        'Review documented proposals before accepting provider contact',
        'Only the selected provider can receive the authorized connection',
        'Unselected providers do not receive your controlled connection information'
      ]
    },
    {
      id: 'faq-phantom',
      category: 'COMPARISON',
      categoryLabel: 'Coverage Comparison',
      doctrineTag: 'Compare price and protection',
      question: 'How can I tell whether a lower premium also means less protection?',
      answer: 'Open Polici places the documented premium difference beside the factual coverage differences. If a provider changes liability limits, deductibles, included coverage, endorsements, or other documented terms, those changes remain visible beside the price. A lower rate is presented as a factual difference—never an instruction to switch.',
      keyPoints: [
        'Changed limits and deductibles stay visible beside the price',
        'Missing terms remain unknown instead of being guessed',
        'Open Polici presents the facts without choosing for you'
      ],
      actionPrompt: 'Test the Misleading Price Difference Trap in the Simulator',
      actionTarget: 'SIMULATOR'
    },
    {
      id: 'faq-policy-review',
      category: 'OFFERS',
      categoryLabel: 'Proposals & Connections',
      doctrineTag: 'One opportunity · Independent proposals',
      question: 'How do insurance professionals submit proposals for my request?',
      answer: 'Once you approve your existing-policy baseline or new-coverage request, eligible providers receive a privacy-preserving opportunity and independently decide whether to submit a documented proposal during the open window. They cannot see another provider’s price or terms and do not receive a target price.',
      keyPoints: [
        'Providers prepare proposals independently',
        'One submission window with no provider-to-provider price signals',
        'Provider payment cannot purchase preferential presentation'
      ],
      actionPrompt: 'Compare My Current Policy',
      actionTarget: 'CONSUMER'
    },
    {
      id: 'faq-obligation',
      category: 'PRIVACY',
      categoryLabel: 'Consumer Cost & Choice',
      doctrineTag: 'Free for consumers',
      question: 'Does using Open Polici obligate me to switch or pay a fee?',
      answer: 'No. Open Polici costs consumers $0. You may review the available proposals, request another eligible provider cohort while the submission window remains open, keep your current policy when applicable, or end the process. You are not required to select a proposal.',
      keyPoints: [
        'No consumer membership, proposal-review, selection, or connection fee',
        'No obligation to replace an existing policy',
        'Your choice controls whether the process continues'
      ]
    },
    {
      id: 'faq-audit',
      category: 'AUDIT',
      categoryLabel: 'Accountability',
      doctrineTag: 'Traceable marketplace evidence',
      question: 'What does Open Polici preserve when I accept a proposal?',
      answer: 'Open Polici preserves the exact proposal version you selected, your authorization, the controlled disclosure, and the resulting connection record. Earlier proposal evidence is not silently rewritten when the process advances.',
      keyPoints: [
        'Selected proposal version remains identifiable',
        'Authorization and disclosure stay connected to your decision',
        'Subsequent provider activity remains separate from the marketplace selection'
      ]
    },
    {
      id: 'faq-vetting',
      category: 'OFFERS',
      categoryLabel: 'Provider Eligibility',
      doctrineTag: 'Authority and eligibility controls',
      question: 'Who is allowed to review my insurance opportunity?',
      answer: 'Provider access depends on the controls applicable to the opportunity, including organization status, producer and organization licensing where required, jurisdiction, insurance line, carrier relationship, role-specific appointment requirements, commercial activation, capacity, appetite, and production availability. Missing or unresolved authority fails closed.',
      keyPoints: [
        'Payment does not create licensing or insurance authority',
        'Eligibility is evaluated for the applicable jurisdiction and insurance line',
        'Commercial plans cannot buy preferential marketplace access'
      ],
      actionPrompt: 'Explore Provider Participation',
      actionTarget: 'PROVIDER'
    },
    {
      id: 'faq-binding',
      category: 'OFFERS',
      categoryLabel: 'Proposals & Connections',
      doctrineTag: 'Consumer-authorized connection',
      question: 'What happens after I select a direct coverage proposal?',
      answer: 'Selection begins the authorization step; it does not automatically release your controlled connection information. Open Polici preserves the selected proposal, records your authorization, and completes the controlled handoff. The licensed provider then conducts the subsequent insurance transaction on its own channel.',
      keyPoints: [
        'Only the selected provider receives the authorized connection',
        'Application and underwriting may still affect final terms',
        'The provider—not Open Polici—handles advice, binding, and issuance'
      ]
    },
    {
      id: 'faq-unknown',
      category: 'COMPARISON',
      categoryLabel: 'Coverage Comparison',
      doctrineTag: 'Missing information stays unknown',
      question: 'What happens if a carrier\'s quote is missing specific coverage details?',
      answer: 'Open Polici does not fill missing terms with assumptions. If a proposal leaves an endorsement, rental benefit, roadside coverage, glass waiver, or another term unclear, the platform marks it as unknown or unverified so you can review it before deciding.',
      keyPoints: [
        'No invented coverage details',
        'Ambiguous terms remain visible for review',
        'The licensed provider confirms final terms during its transaction process'
      ]
    },
    {
      id: 'faq-business',
      category: 'AUDIT',
      categoryLabel: 'Consumer Cost & Platform Economics',
      doctrineTag: 'Commercial V2 neutrality',
      question: 'If Open Polici is free for consumers, how does the platform make money?',
      answer: 'Provider organizations purchase membership capacity and optional operational services. Under Commercial V2, the only billable marketplace transaction event is a qualifying authorized connection after consumer selection, authorization, and successful controlled disclosure. Provider payments never change activation order, cohort position, proposal presentation, or consumer selection.',
      keyPoints: [
        'Consumers pay $0',
        'Opportunity access, viewing, proposal submission, and consumer selection carry no separate transaction fee',
        'No sponsored results or pay-to-play consumer placement'
      ]
    },
    {
      id: 'faq-lines',
      category: 'OFFERS',
      categoryLabel: 'Insurance Availability',
      doctrineTag: 'Jurisdiction and line gates',
      question: 'Which lines of insurance can be reviewed on Open Polici?',
      answer: 'Nevada personal auto is the current controlled launch and acceptance pathway. The platform architecture supports governed expansion, but a listed insurance type or published connection price does not mean that line is available for transactions. Every jurisdiction and insurance-line combination must pass its own operational gates.',
      keyPoints: [
        'Nevada personal auto is the current controlled pathway',
        'Homeowners, renters, commercial, life, and health require separate readiness',
        'Unavailable lines cannot enter the wrong processing pipeline'
      ]
    },
    {
      id: 'faq-no-current-policy',
      category: 'OFFERS',
      categoryLabel: 'New Insurance',
      doctrineTag: 'Consumer-defined coverage request',
      question: 'Can I use Open Polici if I do not have insurance right now?',
      answer: 'Yes, for an available insurance line and jurisdiction. Instead of uploading an existing policy, tell Open Polici the insurance you are looking for, the desired start date, relevant risk facts, and any coverage preferences you choose to state. Open Polici preserves your request without suggesting or inventing coverage for you.',
      keyPoints: [
        'No existing-policy premium or artificial savings claim is created',
        'Unstated preferences are not treated as exclusions or requirements',
        'Eligible providers independently determine what they can propose'
      ],
      actionPrompt: 'I Need New Insurance',
      actionTarget: 'CONSUMER'
    },
    {
      id: 'faq-more-offers',
      category: 'OFFERS',
      categoryLabel: 'More Proposal Options',
      doctrineTag: 'Consumer-controlled cohorts',
      question: 'What if I do not like the first proposals I receive?',
      answer: 'You can request another eligible provider cohort while the original submission window remains open and the activation ceiling has not been reached. Newly activated providers do not receive earlier proposals, your decline reasons, or pricing signals. You may also keep your current policy when applicable or end the process.',
      keyPoints: [
        'Additional provider access begins only when you request it',
        'New providers cannot see proposals submitted earlier',
        'You are never required to select a proposal'
      ]
    }
  ];

  // Filtered FAQs computed using memo
  const filteredFaqs = useMemo(() => {
    return FAQS.filter(faq => {
      const matchesCategory = selectedFaqCategory === 'ALL' || faq.category === selectedFaqCategory;
      if (!matchesCategory) return false;
      if (!faqSearchQuery.trim()) return true;
      const query = faqSearchQuery.toLowerCase();
      return (
        faq.question.toLowerCase().includes(query) ||
        faq.answer.toLowerCase().includes(query) ||
        faq.categoryLabel.toLowerCase().includes(query) ||
        (faq.doctrineTag && faq.doctrineTag.toLowerCase().includes(query)) ||
        faq.keyPoints.some(kp => kp.toLowerCase().includes(query))
      );
    });
  }, [selectedFaqCategory, faqSearchQuery]);

  const toggleFaq = (id: string) => {
    setOpenFaqIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const expandAllFaqs = () => {
    setOpenFaqIds(filteredFaqs.map(f => f.id));
  };

  const collapseAllFaqs = () => {
    setOpenFaqIds([]);
  };

  if (publicPage === 'PROVIDER') {
    return (
      <ProviderLandingPage
        onBackToPolicyholders={() => navigatePublicPage('CONSUMER')}
        onEnterProviderDesk={onNavigateProvider}
      />
    );
  }

  return (
    <div className="w-full">
      {/* 1. Full-Width Hero Section */}
      <section className="relative w-full overflow-hidden bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 text-white border-b border-slate-800 shadow-xl px-4 sm:px-6 lg:px-8 pt-12 pb-16 sm:pt-16 sm:pb-24 lg:pt-20 lg:pb-28">
        {/* Subtle architectural grid pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b18_1px,transparent_1px),linear-gradient(to_bottom,#1e293b18_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none opacity-50" />

        {/* Ambient radial glows */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-b from-emerald-500/10 via-teal-500/5 to-transparent blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 right-1/4 w-96 h-64 bg-teal-500/10 blur-[100px] pointer-events-none rounded-full" />

        <div className="relative max-w-5xl mx-auto text-center space-y-6 sm:space-y-8">
          {/* Editorial Kicker */}
          <div className="inline-flex items-center space-x-2 text-xs font-mono font-medium text-emerald-400 bg-emerald-950/70 border border-emerald-800/80 px-3.5 py-1.5 rounded-full tracking-wide shadow-inner">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Private Insurance Comparison · Free for Consumers</span>
          </div>

          {/* Primary Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-tight">
            Get Insurance Proposals<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400">
              Without the Spam Calls.
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Switching your current coverage or starting a brand-new policy from scratch? Invite eligible insurance providers to submit direct coverage proposals inside your private account. Compare the real numbers side by side, examine what changed, and choose who—if anyone—gets to speak with you.
          </p>

          {/* Insurance lines processed by the current ingestion system */}
          <div aria-label="Insurance types processed by Open Polici" className="pt-1">
            <p className="mb-3 text-[11px] font-mono font-semibold uppercase tracking-[0.18em] text-slate-500">
              Insurance we process
            </p>
            <div className="mx-auto grid max-w-3xl grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {processedInsuranceLines.map(({ label, icon: Icon }) => (
                <div
                  key={label}
                  className="group flex min-h-20 flex-col items-center justify-center gap-2 rounded-xl border border-slate-700/80 bg-slate-900/65 px-2.5 py-3 text-center shadow-sm backdrop-blur-sm transition-colors hover:border-emerald-500/60 hover:bg-slate-800/80"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-300 transition-colors group-hover:border-emerald-400/40 group-hover:text-emerald-200">
                    <Icon className="h-4.5 w-4.5" aria-hidden="true" />
                  </span>
                  <span className="text-[11px] font-semibold leading-tight text-slate-300">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* One account entry with two unmistakable intake paths. */}
          <div className="pt-2 mx-auto max-w-3xl rounded-2xl border border-slate-700/80 bg-slate-900/75 p-4 sm:p-5 shadow-xl backdrop-blur-sm">
            <button
              type="button"
              onClick={() => openAuthModal({ initialRole: 'CONSUMER', initialMode: 'SIGN_UP' })}
              className="w-full inline-flex items-center justify-center space-x-2 px-6 py-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm rounded-xl shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
            >
              <UserCheck className="w-4 h-4" />
              <span>Create Your Free Insurance Account</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <p className="mt-3 text-xs font-semibold text-slate-300">Then start with the path that fits you:</p>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              id="hero-start-policy review-btn"
              onClick={() => handleConsumerPathClick('VERIFIED_EXISTING_POLICY')}
              className="w-full rounded-xl border border-emerald-500/40 bg-emerald-950/40 px-4 py-3 text-left transition hover:border-emerald-400 hover:bg-emerald-950/70"
            >
              <span className="block text-sm font-bold text-white">I have insurance now</span>
              <span className="mt-1 block text-xs leading-5 text-slate-300">Upload your current policy once and invite eligible providers to submit proposals.</span>
            </button>

            <button
              id="hero-provider-desk-btn"
              onClick={() => handleConsumerPathClick('CONSUMER_DEFINED_COVERAGE_REQUEST')}
              className="w-full rounded-xl border border-cyan-500/30 bg-cyan-950/20 px-4 py-3 text-left transition hover:border-cyan-400 hover:bg-cyan-950/40"
            >
              <span className="block text-sm font-bold text-white">I need new insurance</span>
              <span className="mt-1 block text-xs leading-5 text-slate-300">State what you need. Providers decide independently what they can offer.</span>
            </button>
            </div>
            <p className="mt-3 text-[11px] leading-5 text-slate-400">No phone number up front. Review provider proposals privately. Only the provider you authorize receives your connection.</p>
          </div>

          {/* Protocol Invariants Bar - Unboxed metadata per frontend design rules */}
          <div className="pt-8 border-t border-slate-800/80 flex flex-wrap items-center justify-center gap-y-2 gap-x-6 text-xs text-slate-400 font-mono">
            <div className="flex items-center space-x-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span>Free for Consumers</span>
            </div>
            <span aria-hidden="true" className="text-slate-700">·</span>
            <div className="flex items-center space-x-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            <span>Review Proposals Before Connecting</span>
            </div>
            <span aria-hidden="true" className="text-slate-700">·</span>
            <div className="flex items-center space-x-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            <span>Zero Sponsored Placement</span>
            </div>
            <span aria-hidden="true" className="text-slate-700">·</span>
            <div className="flex items-center space-x-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span>You Govern the Handoff</span>
            </div>
          </div>
        </div>
      </section>

      {/* Page Sections Container */}
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-24 pb-24">
        {/* 2. Interactive Policy Comparison Simulator */}
        <section id="simulator" className="scroll-mt-24 space-y-6">
        <div className="text-center max-w-3xl mx-auto space-y-2">
          <span className="text-xs font-mono font-semibold uppercase tracking-wider text-emerald-600">
            Price Is Only Half the Quote
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            See What a Lower Insurance Price Really Changes
          </h2>
          <p className="text-sm text-slate-600">
            A cheaper premium can hide a dangerous tradeoff: higher deductibles, reduced liability limits, or removed protection that leaves more risk on you. Open Polici places the price directly beside every documented coverage difference. Use this interactive example to expose what a headline price alone can hide. This illustration is not an insurance quote or insurance advice.
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 shadow-xl sm:p-6">
          <div className="mb-5 flex flex-col gap-3 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-emerald-700">Actual offer-review format · demonstration data</p>
              <h3 className="mt-1 text-xl font-bold text-slate-950">Your current policy and provider offers</h3>
              <p className="mt-1 text-xs leading-5 text-slate-600">This preview follows the same card structure used after a consumer uploads and confirms a policy. Select an offer card to inspect its documented terms.</p>
            </div>
            <span className="w-fit rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-bold text-slate-500">PERSONAL AUTO · NEVADA</span>
          </div>

          <div className="grid gap-4 overflow-x-auto pb-2 lg:grid-cols-4">
            <article className="min-w-[260px] rounded-xl border border-slate-800 bg-slate-900 p-5 text-white shadow-md">
              <div className="flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Your Existing Policy</p><h4 className="mt-1 text-base font-bold">Current Carrier</h4><p className="mt-1 text-[11px] text-slate-400">2024 Toyota Camry</p></div><span className="rounded bg-slate-800 px-2 py-1 font-mono text-[9px] text-slate-400">CURRENT BASELINE</span></div>
              <div className="my-5 rounded-lg border border-slate-700 bg-slate-800/80 p-3"><div className="text-3xl font-extrabold">$247<span className="text-xs font-normal text-slate-400">/mo</span></div><div className="mt-0.5 font-mono text-xs text-slate-400">$2,964/year</div></div>
              <div className="space-y-2 border-t border-slate-800 pt-3 text-xs text-slate-300">
                {[['Bodily Injury', '$100k / $300k'], ['Property Damage', '$100k'], ['Comprehensive', '$500 deductible'], ['Collision', '$500 deductible'], ['Rental / Roadside', 'Included']].map(([label, value]) => <div key={label} className="flex justify-between gap-3"><span>{label}</span><strong className="text-right text-white">{value}</strong></div>)}
              </div>
              <div className="mt-6 border-t border-slate-800 pt-3 text-center font-mono text-[10px] text-slate-400">Current Policy Reference</div>
            </article>

            {previewOffers.map((offer, index) => {
              const selected = selectedPreviewOffer === index;
              const badge = offer.tone === 'emerald' ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : offer.tone === 'rose' ? 'border-rose-300 bg-rose-50 text-rose-800' : 'border-blue-300 bg-blue-50 text-blue-800';
              const notice = offer.tone === 'emerald' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : offer.tone === 'rose' ? 'border-rose-200 bg-rose-50 text-rose-900' : 'border-blue-200 bg-blue-50 text-blue-900';
              return (
                <article key={offer.label} onClick={() => setSelectedPreviewOffer(index)} className={`min-w-[260px] cursor-pointer rounded-xl border bg-white p-5 transition-all ${selected ? 'border-emerald-600 shadow-md ring-2 ring-emerald-500/20' : 'border-slate-200 shadow-sm hover:border-slate-400'}`}>
                  <div className="flex items-start justify-between gap-2"><div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{offer.label}</p><h4 className="mt-1 text-base font-bold text-slate-900">{offer.carrier}</h4><p className="mt-0.5 text-[11px] text-slate-500">{offer.provider}</p></div><span className={`rounded border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${badge}`}>{offer.classification}</span></div>
                  <div className="my-4 rounded-lg border border-slate-100 bg-slate-50 p-3"><div className="text-2xl font-bold text-slate-900">${offer.monthly}<span className="text-xs font-normal text-slate-500">/mo</span></div><div className="mt-1 flex items-center justify-between text-xs"><span className="font-mono text-slate-500">${offer.annual.toLocaleString()}/yr</span><span className="rounded bg-emerald-100/70 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">${offer.difference}/yr lower</span></div></div>
                  <div className={`rounded border p-2.5 text-[11px] leading-4 ${notice}`}><strong className="block">{offer.summary}</strong>{selected && <div className="mt-2 space-y-1">{offer.details.map(detail => <div key={detail}>• {detail}</div>)}</div>}</div>
                  <div className="mt-5 flex gap-2 border-t border-slate-100 pt-3"><button type="button" onClick={(event) => { event.stopPropagation(); setSelectedPreviewOffer(index); }} className="flex-1 rounded-lg bg-slate-100 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200">Compare Details</button><button type="button" onClick={(event) => { event.stopPropagation(); handleStartPolicyReviewClick(); }} className={`rounded-lg px-3.5 py-2 text-xs font-bold text-white ${offer.tone === 'rose' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}>{offer.tone === 'rose' ? 'Review & Select' : 'Select'}</button></div>
                </article>
              );
            })}
          </div>

          <div className="mt-5 flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-xs leading-5 text-slate-600"><Info className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700"/><p><strong className="text-slate-900">What this demonstrates:</strong> premium and coverage are shown separately, changed protection remains visible, and no provider receives your contact information merely because an offer appears here.</p></div>
        </div>

        <div className="hidden bg-white rounded-3xl border border-slate-200/90 shadow-xl overflow-hidden grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
          {/* Simulator Inputs Column */}
          <div className="lg:col-span-6 p-6 sm:p-8 space-y-6 bg-slate-50/60">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <SlidersHorizontal className="w-4 h-4 text-emerald-600" />
                <span>Build Your Illustrative Coverage Profile</span>
              </h3>
              <span className="text-xs text-slate-500 font-mono">Step 1 of 2</span>
            </div>

            {/* Insurance Line Selector */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700">Line of Business</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setInsuranceType('AUTO')}
                  className={`flex items-center justify-center space-x-2 py-2.5 px-3 rounded-xl text-xs font-medium border transition cursor-pointer ${
                    insuranceType === 'AUTO'
                      ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <Car className="w-3.5 h-3.5" />
                  <span>Personal Auto</span>
                </button>
                <button
                  type="button"
                  disabled
                  title={`${INSURANCE_LINE_REGISTRY.HOMEOWNERS.displayName} processing is in development`}
                  className={`flex items-center justify-center space-x-2 py-2.5 px-3 rounded-xl text-xs font-medium border transition cursor-pointer ${
                    insuranceType === 'HOME'
                      ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                      : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                  }`}
                >
                  <HomeIcon className="w-3.5 h-3.5" />
                  <span>Homeowners · In development</span>
                </button>
                <button
                  type="button"
                  disabled
                  title="Commercial-line processing is not yet available"
                  className={`flex items-center justify-center space-x-2 py-2.5 px-3 rounded-xl text-xs font-medium border transition cursor-pointer ${
                    insuranceType === 'COMMERCIAL'
                      ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                      : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                  }`}
                >
                  <Building className="w-3.5 h-3.5" />
                  <span>Commercial · Planned</span>
                </button>
              </div>
            </div>

            {/* Premium Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <label className="font-semibold text-slate-700">Current Monthly Premium</label>
                <span className="font-mono font-bold text-slate-900 text-sm">
                  ${currentPremium} <span className="text-slate-500 font-normal text-xs">/ mo</span>
                </span>
              </div>
              <input
                id="simulator-premium-slider"
                type="range"
                min="90"
                max="500"
                step="5"
                value={currentPremium}
                onChange={(e) => setCurrentPremium(Number(e.target.value))}
                className="w-full accent-emerald-600 cursor-pointer"
              />
              <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                <span>$90/mo</span>
                <span>$250/mo</span>
                <span>$500/mo</span>
              </div>
            </div>

            {/* Deductible Selection */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700">Current Comprehensive & Collision Deductible</label>
              <div className="grid grid-cols-3 gap-2">
                {[250, 500, 1000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setDeductible(amt)}
                    className={`py-2 px-3 text-xs font-mono font-semibold rounded-xl border transition cursor-pointer ${
                      deductible === amt
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    ${amt} Deductible
                  </button>
                ))}
              </div>
            </div>

            {/* Liability Limit Selection */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700">Bodily Injury & Property Damage Protection Tier</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'STANDARD', label: 'State Min', desc: '$25k / $50k' },
                  { id: 'PREFERRED', label: 'Standard', desc: '$100k / $300k' },
                  { id: 'SOVEREIGN', label: 'Sovereign', desc: '$250k / $500k' }
                ].map((tier) => (
                  <button
                    key={tier.id}
                    type="button"
                    onClick={() => setLiabilityTier(tier.id as any)}
                    className={`p-2 text-left rounded-xl border transition cursor-pointer ${
                      liabilityTier === tier.id
                        ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div className="text-xs font-bold">{tier.label}</div>
                    <div className={`text-[10px] font-mono ${liabilityTier === tier.id ? 'text-slate-300' : 'text-slate-500'}`}>
                      {tier.desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* The Critical "Misleading Price Difference Trap" Test Toggle */}
            <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span className="text-xs font-bold text-amber-950">
                    Expose Lower-Price Coverage Tradeoffs
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={simulatePhantomCut}
                    onChange={(e) => setSimulatePhantomCut(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-600"></div>
                </label>
              </div>
              <p className="text-[11px] text-amber-800 leading-snug">
                Turn this on to reveal how a larger advertised price difference can come from lower liability limits, higher deductibles, and removed benefits.
              </p>
            </div>
          </div>

          {/* Simulator Engine Output Column */}
          <div className="lg:col-span-6 p-6 sm:p-8 space-y-6 flex flex-col justify-between bg-white">
            <div className="space-y-5">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                  <Scale className="w-4 h-4 text-emerald-600" />
                  <span>Real-Time Engine Evaluation</span>
                </h3>
                <span className="text-[11px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Deterministic v1.0
                </span>
              </div>

              {/* Status Output Box */}
              {!simulatePhantomCut ? (
                /* Honest Comparison Outcome */
                <div className="p-5 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center space-x-1.5 text-emerald-800 text-xs font-bold">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>DOCUMENTED TERMS MATCH YOUR PROFILE BASELINE</span>
                      </div>
                      <p className="text-xs text-emerald-700 mt-1">
                        These illustrative provider proposals match the selected {liabilityTier} liability limits and ${deductible} deductible. Review every documented term before choosing.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-emerald-200/70">
                    <div>
                      <span className="text-[11px] text-emerald-800 font-medium">Illustrative Proposal Premium</span>
                      <div className="text-2xl font-black text-slate-900 font-mono mt-0.5">
                        ${providerOfferPremium}
                        <span className="text-xs font-normal text-slate-500"> / mo</span>
                      </div>
                    </div>
                    <div>
                      <span className="text-[11px] text-emerald-800 font-medium">Annual Premium Difference</span>
                      <div className="text-2xl font-black text-emerald-600 font-mono mt-0.5">
                        ${annualPremiumDifference}
                        <span className="text-xs font-normal text-emerald-700"> / yr</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* Changed-coverage illustration */
                <div className="p-5 rounded-2xl bg-rose-50 border border-rose-300 space-y-4 animate-in fade-in duration-200">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center space-x-1.5 text-rose-800 text-xs font-bold">
                        <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>ALTERED PROPOSAL DETECTED · REVIEW REQUIRED</span>
                      </div>
                      <p className="text-xs text-rose-700 mt-1">
                        This illustration shows a <strong className="text-rose-900">${phantomStatedSavings}/mo</strong> premium difference ($${phantomStatedPremium}/mo proposal) alongside these documented coverage changes:
                      </p>
                    </div>
                  </div>

                  {/* Specific Reductions list */}
                  <div className="space-y-2 bg-white/80 p-3 rounded-xl border border-rose-200 text-xs font-mono">
                    <div className="flex items-center justify-between text-rose-900">
                      <span>• Liability Protection Cut:</span>
                      <span className="font-bold text-rose-700 line-through">${liabilityTier === 'SOVEREIGN' ? '$250k' : '$100k'}</span>
                      <span className="text-rose-800 font-bold">→ $25k State Min</span>
                    </div>
                    <div className="flex items-center justify-between text-rose-900">
                      <span>• Deductible Hiked:</span>
                      <span className="font-bold text-rose-700 line-through">${deductible}</span>
                      <span className="text-rose-800 font-bold">→ $2,000 (+$1,500 Risk)</span>
                    </div>
                    <div className="flex items-center justify-between text-rose-900">
                      <span>• Roadside & Rental:</span>
                      <span className="text-rose-800 font-bold">Silently Stripped Out</span>
                    </div>
                  </div>

                  <p className="text-[11px] text-rose-800 font-medium">
                    Open Polici maps and displays these factual differences in the open. You alone decide whether the price and modified protection match your goals.
                  </p>
                </div>
              )}

              {/* Sample Carrier Independent Offers Preview */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-slate-700">Illustrative Independent Provider Proposals:</span>
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="flex items-center space-x-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span className="font-medium text-slate-900">Carrier A (Financial strength A+)</span>
                    </div>
                    <div className="flex items-center space-x-3 font-mono">
                      <span className="text-slate-500 line-through">${currentPremium}</span>
                      <span className="font-bold text-emerald-700">${providerOfferPremium} / mo</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="flex items-center space-x-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span className="font-medium text-slate-900">Carrier B (Financial strength A)</span>
                    </div>
                    <div className="flex items-center space-x-3 font-mono">
                      <span className="text-slate-500 line-through">${currentPremium}</span>
                      <span className="font-bold text-emerald-700">${providerOfferPremium + 8} / mo</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="flex items-center space-x-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span className="font-medium text-slate-900">Carrier C (Financial strength A++)</span>
                    </div>
                    <div className="flex items-center space-x-3 font-mono">
                      <span className="text-slate-500 line-through">${currentPremium}</span>
                      <span className="font-bold text-emerald-700">${providerOfferPremium + 14} / mo</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Launch into Portal Button */}
            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-xs text-slate-500">
                Ready to test real proposals against the policy you actually have?
              </div>
              <button
                id="simulator-launch-policy review-btn"
                type="button"
                onClick={handleStartPolicyReviewClick}
                className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl shadow-xs transition cursor-pointer"
              >
                <span>Compare My Current Policy</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 3. The Structural Breakdown: Conventional Model vs. Open Polici */}
      <section className="space-y-8">
        <div className="text-center max-w-3xl mx-auto space-y-2">
          <span className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-500">
            The Structural Problem We Solve
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Why Insurance Shopping Feels Like Telemarketing Spam
          </h2>
          <p className="text-sm text-slate-600">
            Traditional comparison websites can monetize your contact information before you receive anything meaningful to compare. Open Polici reverses the flow: review documented proposals first, choose your preferred terms second, and authorize one provider connection last.
          </p>
        </div>

        <div className="overflow-x-auto bg-white rounded-3xl border border-slate-200/90 shadow-lg">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600">
                <th className="py-4 px-6">Dimension</th>
                <th className="py-4 px-6 text-rose-700 bg-rose-50/40">The Legacy Aggregator Grind</th>
                <th className="py-4 px-6 text-emerald-700 bg-emerald-50/40">The Open Polici Experience</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              <tr className="hover:bg-slate-50/50">
                <td className="py-4 px-6 font-semibold text-slate-900">
                  Contact Privacy & Identity
                </td>
                <td className="py-4 px-6 text-slate-600 bg-rose-50/20">
                  <div className="flex items-start space-x-2 text-rose-900 font-medium">
                    <X className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                    <span>Your contact details may be distributed before you receive a proposal worth reviewing.</span>
                  </div>
                </td>
                <td className="py-4 px-6 text-slate-600 bg-emerald-50/20">
                  <div className="flex items-start space-x-2 text-emerald-900 font-medium">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Your controlled connection information stays sealed until you select a proposal and authorize the handoff.</span>
                  </div>
                </td>
              </tr>

              <tr className="hover:bg-slate-50/50">
                <td className="py-4 px-6 font-semibold text-slate-900">
                  Coverage Comparison Verification
                </td>
                <td className="py-4 px-6 text-slate-600 bg-rose-50/20">
                  <div className="flex items-start space-x-2 text-rose-900 font-medium">
                    <X className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                    <span>A lower headline price can distract from changed limits, deductibles, exclusions, or removed benefits.</span>
                  </div>
                </td>
                <td className="py-4 px-6 text-slate-600 bg-emerald-50/20">
                  <div className="flex items-start space-x-2 text-emerald-900 font-medium">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Documented price and coverage differences appear together so you can see what changed.</span>
                  </div>
                </td>
              </tr>

              <tr className="hover:bg-slate-50/50">
                <td className="py-4 px-6 font-semibold text-slate-900">
                  Provider Proposal Submission Mechanics
                </td>
                <td className="py-4 px-6 text-slate-600 bg-rose-50/20">
                  <div className="flex items-start space-x-2 text-rose-900 font-medium">
                    <X className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                    <span>Paid placement and speed-to-contact can influence which provider gets attention first.</span>
                  </div>
                </td>
                <td className="py-4 px-6 text-slate-600 bg-emerald-50/20">
                  <div className="flex items-start space-x-2 text-emerald-900 font-medium">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Eligible providers submit independent, documented proposals without seeing another provider's pricing.</span>
                  </div>
                </td>
              </tr>

              <tr className="hover:bg-slate-50/50">
                <td className="py-4 px-6 font-semibold text-slate-900">
                  Commercial Alignment
                </td>
                <td className="py-4 px-6 text-slate-600 bg-rose-50/20">
                  <div className="flex items-start space-x-2 text-rose-900 font-medium">
                    <X className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                    <span>Consumers may not know whether commercial relationships influence what appears first.</span>
                  </div>
                </td>
                <td className="py-4 px-6 text-slate-600 bg-emerald-50/20">
                  <div className="flex items-start space-x-2 text-emerald-900 font-medium">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Provider payments cannot purchase cohort priority, proposal placement, or influence over your selection.</span>
                  </div>
                </td>
              </tr>

              <tr className="hover:bg-slate-50/50">
                <td className="py-4 px-6 font-semibold text-slate-900">
                  Regulatory & Audit Integrity
                </td>
                <td className="py-4 px-6 text-slate-600 bg-rose-50/20">
                  <div className="flex items-start space-x-2 text-rose-900 font-medium">
                    <X className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                    <span>Important quote details may be spread across calls, emails, and separate documents.</span>
                  </div>
                </td>
                <td className="py-4 px-6 text-slate-600 bg-emerald-50/20">
                  <div className="flex items-start space-x-2 text-emerald-900 font-medium">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Proposal versions, your selection, consent, disclosure, and connection remain traceable.</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* 4. The 4-Step Independent Offer Review Lifecycle */}
      <section className="space-y-8">
        <div className="text-center max-w-3xl mx-auto space-y-2">
          <span className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-500">
            The Open Polici Process
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Review First. Choose Second. Connect Last.
          </h2>
          <p className="text-sm text-slate-600">
            Start with the coverage you have or describe the new protection you need. Open Polici opens the opportunity to eligible providers without giving them unrestricted access to your phone or email.
          </p>
        </div>

        {/* Step Selector Tabs */}
        <div className="flex items-center justify-center gap-2 overflow-x-auto pb-2">
          {[
            { step: 0, title: '01. Establish Your Starting Point' },
            { step: 1, title: '02. Private Workstation Review' },
            { step: 2, title: '03. Compare Proposals' },
            { step: 3, title: '04. Authorize Connection' }
          ].map((item) => (
            <button
              key={item.step}
              type="button"
              onClick={() => setActiveStepTab(item.step)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                activeStepTab === item.step
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              {item.title}
            </button>
          ))}
        </div>

        {/* Active Step Showcase Card */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-10 shadow-lg">
          {activeStepTab === 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              <div className="space-y-4">
                <span className="text-xs font-mono font-bold text-emerald-600 uppercase">
                  Step 01 · Start Once
                </span>
                <h3 className="text-2xl font-bold text-slate-900">
                  Establish Your Baseline Once.
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Share your current policy—or tell us what you need. Upload your declarations page for structured extraction, or complete the guided form for new coverage. Open Polici preserves the starting point you approve without pushing you toward a particular plan.
                </p>
                <div className="space-y-2 text-xs text-slate-700">
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Start from an existing policy or a consumer-defined coverage request</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Review and confirm the information before providers receive access</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Later changes create a traceable new version instead of silently rewriting the original</span>
                  </div>
                </div>
              </div>
              <div className="bg-slate-900 text-white p-6 rounded-2xl border border-slate-800 space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-[11px] text-slate-400">
                  <span>BASELINE_TOKEN: #NV-49281</span>
                  <span className="text-emerald-400">STATUS: LOCKED</span>
                </div>
                <div className="space-y-1.5 text-slate-300">
                  <div>Vehicle: 2022 Honda Accord EX-L (1HGCV1F18NA00...)</div>
                  <div>Bodily Injury: $250,000 / $500,000</div>
                  <div>Property Damage: $100,000</div>
                  <div>Comprehensive Deductible: $500</div>
                  <div>Collision Deductible: $500</div>
                  <div>Current Premium: $1,280.00 / 6 mo</div>
                </div>
              </div>
            </div>
          )}

          {activeStepTab === 1 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              <div className="space-y-4">
                <span className="text-xs font-mono font-bold text-blue-600 uppercase">
                  Step 02 · Private Workstation Review
                </span>
                <h3 className="text-2xl font-bold text-slate-900">
                  Eligible Providers Evaluate the Opportunity Privately.
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Activated providers review the authorized risk and coverage facts and independently decide whether to submit a direct proposal. They cannot see another provider's proposal, pricing targets, rejection histories, or your controlled connection information.
                </p>
                <div className="space-y-2 text-xs text-slate-700">
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Each provider develops its proposal independently</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Provider access remains limited by authority, jurisdiction, insurance line, appetite, and capacity</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Payment cannot purchase better ordering, placement, or selection influence</span>
                  </div>
                </div>
              </div>
              <div className="bg-slate-900 text-white p-6 rounded-2xl border border-slate-800 space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-[11px] text-slate-400">
                  <span>SUBMISSION_WINDOW: OPEN</span>
                  <span className="text-blue-400">CARRIER_ACCESS: ANONYMOUS</span>
                </div>
                <div className="space-y-2">
                  <div className="p-2.5 rounded-lg bg-slate-800 border border-slate-700 flex justify-between">
                    <span>Carrier 101 (Travelers Network)</span>
                    <span className="text-emerald-400">Proposal Submitted ($1,040 / 6mo)</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-800 border border-slate-700 flex justify-between">
                    <span>Carrier 204 (Pacific Specialty)</span>
                    <span className="text-emerald-400">Proposal Submitted ($1,110 / 6mo)</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-800 border border-slate-700 flex justify-between">
                    <span>Carrier 308 (Cascade Casualty)</span>
                    <span className="text-emerald-400">Proposal Submitted ($990 / 6mo)</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeStepTab === 2 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              <div className="space-y-4">
                <span className="text-xs font-mono font-bold text-purple-600 uppercase">
                  Step 03 · Side-by-Side Comparison
                </span>
                <h3 className="text-2xl font-bold text-slate-900">
                  Compare the Price—and the Substance Behind It.
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Direct proposals arrive inside your private account. Open Polici organizes the factual premium, limit, deductible, endorsement, and missing-information differences without choosing a provider for you.
                </p>
                <div className="space-y-2 text-xs text-slate-700">
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Existing-policy proposals are compared with the policy you already have</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>New-coverage proposals are compared only with preferences you actually stated</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>A lower price remains a factual difference, not a conclusion</span>
                  </div>
                </div>
              </div>
              <div className="bg-slate-900 text-white p-6 rounded-2xl border border-slate-800 space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-[11px] text-slate-400">
                  <span>COMPARISON_MATRIX: RUN_COMPLETED</span>
                  <span className="text-emerald-400">100% DETERMINISTIC</span>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="text-emerald-400 flex items-center justify-between">
                    <span>Bodily Injury: $250k/$500k vs $250k/$500k</span>
                    <span>MATCHED [1.00]</span>
                  </div>
                  <div className="text-emerald-400 flex items-center justify-between">
                    <span>Property Damage: $100k vs $100k</span>
                    <span>MATCHED [1.00]</span>
                  </div>
                  <div className="text-emerald-400 flex items-center justify-between">
                    <span>Collision Deductible: $500 vs $500</span>
                    <span>MATCHED [1.00]</span>
                  </div>
                  <div className="text-slate-400 pt-2 border-t border-slate-800 flex items-center justify-between">
                    <span>Annual Premium Difference:</span>
                    <span className="text-emerald-300 font-bold">$290.00 / 6mo ($580/yr)</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeStepTab === 3 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              <div className="space-y-4">
                <span className="text-xs font-mono font-bold text-amber-600 uppercase">
                  Step 04 · Consumer-Authorized Connection
                </span>
                <h3 className="text-2xl font-bold text-slate-900">
                  You Control the Connection Gate.
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Select a proposal only if its terms earn the opportunity to continue. Open Polici records your choice and asks you to authorize the disclosure. Only the selected provider receives the controlled connection information needed to proceed.
                </p>
                <div className="space-y-2 text-xs text-slate-700">
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>The selected proposal version and your authorization remain traceable</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Unselected providers do not receive your controlled connection information</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>The licensed provider handles application, advice, underwriting, binding, and issuance</span>
                  </div>
                </div>
              </div>
              <div className="bg-slate-900 text-white p-6 rounded-2xl border border-slate-800 space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-[11px] text-slate-400">
                  <span>HANDOFF_RECORD: NV-8821</span>
                  <span className="text-emerald-400">SEALED</span>
                </div>
                <div className="space-y-1.5 text-slate-300">
                  <div>SHA-256 Root: 9f8a32b1c4e7...</div>
                  <div>Carrier Policy Number: CAS-9821734</div>
                  <div>Effective Date: Reported by issuing provider</div>
                  <div>Consumer Consent: Timestamped & Recorded</div>
                  <div className="text-emerald-400 font-semibold pt-2">
                    Policy Vault Document Stored Successfully
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 5. The 9 Sovereign Doctrines (Interactive Principle Matrix) */}
      <section className="space-y-8">
        <div className="text-center max-w-3xl mx-auto space-y-2">
          <span className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-500">
            Why Open Polici Is Radically Different
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Nine Structural Protections Built Into the Marketplace
          </h2>
          <p className="text-sm text-slate-600">
            Insurance distribution should deliver clarity before contact—not a sales pitch before useful information. These controls govern every proposal, comparison, disclosure, and connection on the platform.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {DOCTRINES.map((d, idx) => {
            const isExpanded = expandedDoctrine === idx;
            return (
              <div
                key={d.num}
                onClick={() => setExpandedDoctrine(isExpanded ? null : idx)}
                className={`p-5 rounded-2xl border transition-all cursor-pointer ${
                  isExpanded
                    ? 'bg-slate-900 text-white border-slate-900 shadow-xl'
                    : 'bg-white text-slate-900 border-slate-200 hover:border-slate-300 hover:shadow-md'
                }`}
              >
                <div className="flex items-center justify-between pb-2">
                  <span className={`text-xs font-mono font-bold ${isExpanded ? 'text-emerald-400' : 'text-slate-400'}`}>
                    Doctrine {d.num}
                  </span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180 text-emerald-400' : 'text-slate-400'}`} />
                </div>
                <h3 className="text-base font-bold tracking-tight mt-1">
                  {d.title}
                </h3>
                <p className={`text-xs mt-2 leading-relaxed ${isExpanded ? 'text-slate-300' : 'text-slate-600'}`}>
                  {d.summary}
                </p>
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-slate-800 text-xs text-slate-300 leading-relaxed animate-in fade-in duration-150">
                    {d.detail}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 6. Stakeholder Entry Hub: 4 Key Perspectives */}
      <section className="space-y-8">
        <div className="text-center max-w-3xl mx-auto space-y-2">
          <span className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-500">
            Dual-Intent Market Routing
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Put Your Current Insurance to Work—or Start a Brand-New Line
          </h2>
          <p className="text-sm text-slate-600">
            Both pathways route into the same private marketplace. Eligible providers submit custom proposals against your approved criteria, Open Polici organizes the documented differences, and you control the next move.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Consumer Portal Card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <UserCheck className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Pathway A: Put Your Existing Policy to Work</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Upload your active declarations page to build a structured baseline. Give eligible providers an opportunity to submit a direct coverage proposal against your current premium, limits, deductibles, and documented protection.
              </p>
            </div>
            <button
              onClick={handleStartPolicyReviewClick}
              className="w-full inline-flex items-center justify-center space-x-2 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition cursor-pointer"
            >
              <span>Compare My Current Policy</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Provider Portal Card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                <Briefcase className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Pathway B: No Current Insurance? Start Fresh.</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Tell the marketplace what coverage you are looking for, when you need it, the relevant risk facts, and the preferences you choose to state. Open Polici locks those criteria into a standardized request without deciding what you should buy.
              </p>
            </div>
            <button
              onClick={handleStartPolicyReviewClick}
              className="w-full inline-flex items-center justify-center space-x-2 py-2 px-3 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl transition cursor-pointer"
            >
              <span>Set Up New Coverage</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Regulatory Audit Card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                <FileText className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Review First. Connect Second.</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Custom proposals arrive inside your private account before a provider receives your controlled connection information. You open the communication gate only when you are ready.
              </p>
            </div>
            <button
              onClick={handleStartPolicyReviewClick}
              className="w-full inline-flex items-center justify-center space-x-2 py-2 px-3 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold rounded-xl transition cursor-pointer"
            >
              <span>Create My Free Account</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Architecture & Engineering Card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                <GitBranch className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">For Providers &amp; Carriers</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Licensed organizations can apply for governed marketplace access, configure their appetite, and submit independent documented proposals without purchasing preferential placement.
              </p>
            </div>
            <button
              onClick={() => navigatePublicPage('PROVIDER')}
              className="w-full inline-flex items-center justify-center space-x-2 py-2 px-3 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition cursor-pointer"
            >
              <span>Explore Provider Participation</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </section>

      {/* 7. Frequently Asked Questions (Enhanced Accordion UI) */}
      <section id="faq-section" className="scroll-mt-24 space-y-8">
        <div className="text-center max-w-3xl mx-auto space-y-2">
          <div className="inline-flex items-center space-x-1.5 text-xs font-mono font-semibold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-3 py-1 rounded-full">
            <HelpCircle className="w-3.5 h-3.5 text-emerald-600" />
            <span>Insurance Shopping Questions</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Frequently Asked Questions
          </h2>
          <p className="text-sm text-slate-600">
            Clear answers about privacy, structured proposals, new-coverage requests, additional provider cohorts, and what happens after you choose.
          </p>
        </div>

        {/* FAQ Controls Bar: Category Filters, Search Input, and Expand/Collapse All */}
        <div className="max-w-4xl mx-auto space-y-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-white p-3 sm:p-4 rounded-2xl border border-slate-200/90 shadow-sm">
            {/* Category Filter Pills */}
            <div className="flex items-center flex-wrap gap-1.5 w-full md:w-auto">
              {[
                { id: 'ALL', label: 'All Questions', count: FAQS.length },
                { id: 'PRIVACY', label: 'Privacy & Anti-Spam', count: FAQS.filter(f => f.category === 'PRIVACY').length },
                { id: 'COMPARISON', label: 'Coverage Comparison', count: FAQS.filter(f => f.category === 'COMPARISON').length },
                { id: 'OFFERS', label: 'Proposals & Connections', count: FAQS.filter(f => f.category === 'OFFERS').length },
                { id: 'AUDIT', label: 'Cost & Accountability', count: FAQS.filter(f => f.category === 'AUDIT').length }
              ].map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedFaqCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer flex items-center space-x-1.5 ${
                    selectedFaqCategory === cat.id
                      ? 'bg-slate-900 text-white font-semibold shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
                  }`}
                >
                  <span>{cat.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    selectedFaqCategory === cat.id
                      ? 'bg-slate-800 text-emerald-400'
                      : 'bg-slate-200 text-slate-500'
                  }`}>
                    {cat.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Quick Expand / Collapse All */}
            <div className="flex items-center space-x-2 shrink-0 self-end md:self-auto text-xs text-slate-500 font-mono">
              <button
                type="button"
                onClick={expandAllFaqs}
                className="hover:text-emerald-700 transition cursor-pointer underline decoration-dotted"
              >
                Expand all
              </button>
              <span>·</span>
              <button
                type="button"
                onClick={collapseAllFaqs}
                className="hover:text-emerald-700 transition cursor-pointer underline decoration-dotted"
              >
                Collapse all
              </button>
            </div>
          </div>

          {/* Real-Time FAQ Search Bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={faqSearchQuery}
              onChange={(e) => setFaqSearchQuery(e.target.value)}
              placeholder="Search questions about privacy, proposals, coverage, providers, or cost..."
              className="w-full pl-10 pr-24 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition shadow-sm"
            />
            {faqSearchQuery && (
              <button
                type="button"
                onClick={() => setFaqSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 font-mono bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded cursor-pointer transition"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Accordion Questions List */}
        <div className="max-w-4xl mx-auto space-y-3">
          {filteredFaqs.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center space-y-3">
              <HelpCircle className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="text-sm font-semibold text-slate-700">No questions match your search or filter</p>
              <p className="text-xs text-slate-500">
                Try searching for broader terms like "privacy", "carrier", "quote", or reset your filters.
              </p>
              <button
                onClick={() => { setSelectedFaqCategory('ALL'); setFaqSearchQuery(''); }}
                className="mt-2 inline-flex items-center space-x-1.5 px-3 py-1.5 bg-slate-900 text-white text-xs font-medium rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <span>Reset search & filters</span>
              </button>
            </div>
          ) : (
            filteredFaqs.map((faq) => {
              const isOpen = openFaqIds.includes(faq.id);
              return (
                <div
                  key={faq.id}
                  className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden ${
                    isOpen
                      ? 'border-emerald-300/80 shadow-md ring-1 ring-emerald-500/10'
                      : 'border-slate-200/90 hover:border-slate-300 shadow-sm'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleFaq(faq.id)}
                    aria-expanded={isOpen}
                    aria-controls={`faq-answer-${faq.id}`}
                    className={`w-full p-4 sm:p-5 text-left flex items-start justify-between cursor-pointer transition-colors ${
                      isOpen ? 'bg-slate-50/50' : 'hover:bg-slate-50/50'
                    }`}
                  >
                    <div className="space-y-1.5 pr-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border ${
                          faq.category === 'PRIVACY'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : faq.category === 'COMPARISON'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : faq.category === 'OFFERS'
                            ? 'bg-purple-50 text-purple-700 border-purple-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                          {faq.categoryLabel}
                        </span>
                        {faq.doctrineTag && (
                          <span className="text-[10px] font-mono text-slate-500">
                            {faq.doctrineTag}
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-snug">
                        {faq.question}
                      </h3>
                    </div>

                    <div className="shrink-0 pt-0.5">
                      <div className={`w-7 h-7 rounded-xl flex items-center justify-center transition-transform duration-200 ${
                        isOpen
                          ? 'rotate-180 bg-emerald-100 text-emerald-700'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}>
                        <ChevronDown className="w-4 h-4" />
                      </div>
                    </div>
                  </button>

                  {/* Accordion Expanded Content */}
                  {isOpen && (
                    <div
                      id={`faq-answer-${faq.id}`}
                      className="px-4 pb-5 sm:px-6 sm:pb-6 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-4 space-y-4 animate-in fade-in duration-150"
                    >
                      <p className="text-slate-700 leading-relaxed">
                        {faq.answer}
                      </p>

                      {/* Key Invariants / Highlights Box */}
                      {faq.keyPoints && faq.keyPoints.length > 0 && (
                        <div className="bg-slate-50/80 rounded-xl p-3.5 border border-slate-200/80 space-y-2">
                          <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-500 flex items-center space-x-1.5">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                            <span>What This Means for You</span>
                          </span>
                          <ul className="space-y-1.5 text-xs text-slate-700">
                            {faq.keyPoints.map((point, pIdx) => (
                              <li key={pIdx} className="flex items-start space-x-2">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                                <span>{point}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Optional Contextual Action Button */}
                      {faq.actionPrompt && (
                        <div className="pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              if (faq.actionTarget === 'CONSUMER') handleStartPolicyReviewClick();
                              else if (faq.actionTarget === 'PROVIDER') handleProviderDeskClick();
                              else if (faq.actionTarget === 'SIMULATOR') {
                                document.getElementById('simulator')?.scrollIntoView({ behavior: 'smooth' });
                              }
                            }}
                            className="inline-flex items-center space-x-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-lg transition cursor-pointer"
                          >
                            <span>{faq.actionPrompt}</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* 8. Call to Action Finale */}
      <section className="bg-slate-900 text-white rounded-3xl p-8 sm:p-12 border border-slate-800 shadow-2xl text-center space-y-6 max-w-4xl mx-auto">
        <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/30">
          <ShieldCheck className="w-6 h-6" />
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Review Your Options Before Deciding Who Gets the Connection.
          </h2>
          <p className="text-sm text-slate-300 max-w-xl mx-auto">
            Upload your current policy or build a new coverage request. Eligible insurance providers independently decide whether to send their own offers inside your private account. You review factual price and coverage differences, keep your current policy if you choose, and control every connection.
          </p>
          <p className="text-xs text-slate-400 max-w-xl mx-auto">
            Open Polici organizes the review and the consumer-authorized handoff. The licensed provider conducts the subsequent insurance transaction.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            onClick={handleStartPolicyReviewClick}
            className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg transition cursor-pointer"
          >
            <span>Compare My Current Policy</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={handleStartPolicyReviewClick}
            className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition cursor-pointer"
          >
            <span>Set Up New Coverage</span>
            <BookOpen className="w-4 h-4 text-emerald-400" />
          </button>
        </div>
      </section>
      </div>

      {/* 9. Full-Width Footer Section (Edge-to-Edge like Hero) */}
      <footer className="w-full bg-slate-950 text-slate-400 border-t border-slate-800 relative overflow-hidden">
        {/* Subtle architectural grid pattern & ambient radial lighting matching Hero */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b15_1px,transparent_1px),linear-gradient(to_bottom,#1e293b15_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none opacity-40" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-48 bg-gradient-to-b from-emerald-500/10 via-teal-500/5 to-transparent blur-3xl pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-12">
          {/* Main Footer Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 lg:gap-8 pb-12 border-b border-slate-800/80">
            {/* Col 1 & 2: Brand, Architecture & Manifesto */}
            <div className="lg:col-span-2 space-y-5">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center text-slate-950 shadow-md shadow-emerald-500/20">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-extrabold text-base tracking-tight text-white leading-none">
                    OPEN POLICI
                  </div>
                  <div className="font-mono text-[10px] text-emerald-400 tracking-wider font-semibold mt-1">
                    PRIVATE INSURANCE PROPOSAL MARKETPLACE
                  </div>
                </div>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed max-w-sm">
                Shop for insurance without handing your phone number to a list of salespeople. Start with the policy you have or the coverage you need, review provider proposals in one private account, and decide who receives the connection.
              </p>

              {/* Protocol Badges */}
              <div className="flex flex-wrap gap-2 text-[10px] font-mono">
                <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-emerald-950/80 border border-emerald-800/60 text-emerald-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Free for Consumers</span>
                </span>
                <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-300">
                  <Lock className="w-3 h-3 text-emerald-400" />
                  <span>Review Before Connecting</span>
                </span>
                <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-300">
                  <Scale className="w-3 h-3 text-cyan-400" />
                  <span>No Sponsored Placement</span>
                </span>
              </div>

              {/* Quick Jump Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={handleStartPolicyReviewClick}
                  className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-xl shadow-sm transition cursor-pointer"
                >
                  <span>Compare My Current Policy</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleStartPolicyReviewClick}
                  className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold rounded-xl border border-slate-700 transition cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5 text-blue-400" />
                  <span>I Need New Insurance</span>
                </button>
              </div>
            </div>

            {/* Col 3: Get Started */}
            <div className="space-y-3">
              <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200">
                Get Started
              </h4>
              <ul className="space-y-2 text-xs">
                <li>
                  <button
                    onClick={handleStartPolicyReviewClick}
                    className="hover:text-emerald-400 transition text-left flex items-center space-x-1.5 cursor-pointer text-slate-400"
                  >
                    <ChevronRight className="w-3 h-3 text-slate-600" />
                    <span>Compare My Current Policy</span>
                  </button>
                </li>
                <li>
                  <button
                    onClick={handleStartPolicyReviewClick}
                    className="hover:text-emerald-400 transition text-left flex items-center space-x-1.5 cursor-pointer text-slate-400"
                  >
                    <ChevronRight className="w-3 h-3 text-slate-600" />
                    <span>Create a Coverage Request</span>
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => document.getElementById('faq-section')?.scrollIntoView({ behavior: 'smooth' })}
                    className="hover:text-emerald-400 transition text-left flex items-center space-x-1.5 cursor-pointer text-slate-400"
                  >
                    <ChevronRight className="w-3 h-3 text-slate-600" />
                    <span>Insurance Shopping Questions</span>
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => navigatePublicPage('PROVIDER')}
                    className="hover:text-emerald-400 transition text-left flex items-center space-x-1.5 cursor-pointer text-slate-400"
                  >
                    <ChevronRight className="w-3 h-3 text-slate-600" />
                    <span>Providers & Carriers</span>
                  </button>
                </li>
                <li>
                  <a href="/insurance-comparison" className="hover:text-emerald-400 transition text-left flex items-center space-x-1.5 text-slate-400">
                    <ChevronRight className="w-3 h-3 text-slate-600" />
                    <span>Industry Comparison</span>
                  </a>
                </li>
                <li>
                  <a href="/about" className="hover:text-emerald-400 transition text-left flex items-center space-x-1.5 text-slate-400">
                    <ChevronRight className="w-3 h-3 text-slate-600" />
                    <span>About Open Polici</span>
                  </a>
                </li>
              </ul>
            </div>

            {/* Col 4: Consumer Control */}
            <div className="space-y-3">
              <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200">
                Consumer Control
              </h4>
              <ul className="space-y-1.5 text-[11px] font-mono text-slate-400">
                <li className="flex items-center space-x-1.5">
                  <span className="text-emerald-400 font-bold">01</span>
                  <span>You Set the Starting Point</span>
                </li>
                <li className="flex items-center space-x-1.5">
                  <span className="text-emerald-400 font-bold">02</span>
                  <span>One Private Account</span>
                </li>
                <li className="flex items-center space-x-1.5">
                  <span className="text-emerald-400 font-bold">03</span>
                  <span>Independent Provider Proposals</span>
                </li>
                <li className="flex items-center space-x-1.5">
                  <span className="text-emerald-400 font-bold">04</span>
                  <span>Price and Coverage Compared</span>
                </li>
                <li className="flex items-center space-x-1.5">
                  <span className="text-emerald-400 font-bold">05</span>
                  <span>Material Differences Shown</span>
                </li>
                <li className="flex items-center space-x-1.5">
                  <span className="text-emerald-400 font-bold">06</span>
                  <span>Missing Terms Stay Unknown</span>
                </li>
                <li className="flex items-center space-x-1.5">
                  <span className="text-emerald-400 font-bold">07</span>
                  <span>Contact Details Withheld</span>
                </li>
                <li className="flex items-center space-x-1.5">
                  <span className="text-emerald-400 font-bold">08</span>
                  <span>No Pay-to-Play Placement</span>
                </li>
                <li className="flex items-center space-x-1.5">
                  <span className="text-emerald-400 font-bold">09</span>
                  <span>You Authorize the Connection</span>
                </li>
              </ul>
            </div>

            {/* Col 5: Marketplace Standards */}
            <div className="space-y-3">
              <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200">
                Marketplace Standards
              </h4>
              <ul className="space-y-2 text-xs text-slate-400">
                <li className="flex items-start space-x-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Eligible Providers Participate</span>
                </li>
                <li className="flex items-start space-x-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Providers Submit Their Own Terms</span>
                </li>
                <li className="flex items-start space-x-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Consumer Selection Is Explicit</span>
                </li>
                <li className="flex items-start space-x-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Only the Selected Provider Connects</span>
                </li>
                <li className="flex items-start space-x-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Consumer Participation Costs $0</span>
                </li>
                <li className="flex items-start space-x-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Consent and Handoff Are Recorded</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Sub-Footer Bar */}
          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-slate-500">
            <div className="flex flex-col sm:flex-row items-center gap-2 text-center sm:text-left">
              <span>Open Polici • Private Insurance Proposal Marketplace</span>
              <span className="hidden sm:inline text-slate-700">|</span>
              <span className="text-slate-400">Review First. Choose Second. Connect Last.</span>
            </div>

            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 text-[11px] text-slate-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Consumer-Controlled Connections</span>
              </div>
              <button
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="inline-flex items-center space-x-1 text-slate-400 hover:text-white transition cursor-pointer text-[11px]"
              >
                <span>Back to top</span>
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
