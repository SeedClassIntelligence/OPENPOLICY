import React, { useState, useMemo } from 'react';
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
  Home as HomeIcon,
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
import { AuthModal } from './AuthModal';

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

  const [landingSignupRole, setLandingSignupRole] = useState<'CONSUMER' | 'PROVIDER'>('CONSUMER');

  const handleInlineAuthSuccess = (role: 'CONSUMER' | 'PROVIDER' | 'ADMIN') => {
    role === 'PROVIDER' ? onNavigateProvider() : onNavigateConsumer();
  };

  const handleStartPolicyReviewClick = () => {
    if (isAuthenticated && userRole === 'CONSUMER') {
      onNavigateConsumer();
    } else {
      const el = document.getElementById('create-account');
      if (el) {
        setLandingSignupRole('CONSUMER');
        el.scrollIntoView({ behavior: 'smooth' });
      } else {
        openAuthModal({ initialRole: 'CONSUMER', initialMode: 'SIGN_UP' });
      }
    }
  };

  const handleProviderDeskClick = () => {
    if (isAuthenticated && userRole === 'PROVIDER') {
      onNavigateProvider();
    } else {
      const el = document.getElementById('create-account');
      if (el) {
        setLandingSignupRole('PROVIDER');
        el.scrollIntoView({ behavior: 'smooth' });
      } else {
        openAuthModal({ initialRole: 'PROVIDER', initialMode: 'SIGN_UP' });
      }
    }
  };

  // Simulator State
  const [insuranceType, setInsuranceType] = useState<'AUTO' | 'HOME' | 'COMMERCIAL'>('AUTO');
  const [currentPremium, setCurrentPremium] = useState<number>(215);
  const [deductible, setDeductible] = useState<number>(500);
  const [liabilityTier, setLiabilityTier] = useState<'STANDARD' | 'PREFERRED' | 'SOVEREIGN'>('PREFERRED');
  const [simulatePhantomCut, setSimulatePhantomCut] = useState<boolean>(false);
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

  const DOCTRINES = [
    {
      num: '01',
      title: 'Consumer Sovereignty',
      summary: 'The consumer owns the policy, the information, and the decision.',
      detail: 'Traditional brokers view consumer policy declarations as proprietary contact assets. In Open Policy, the policyholder maintains cryptographic custody of their risk record. Data is never bundled, sold, or shared without express programmatic consent.'
    },
    {
      num: '02',
      title: 'Friction Reduction',
      summary: 'Drastically minimize the work required to bring an active policy to market.',
      detail: 'Instead of re-entering 40 form fields across ten carrier websites, a single declarations page upload extracts the baseline instantly, establishing an immutable policy review specification.'
    },
    {
      num: '03',
      title: 'Independent Offer Review',
      summary: 'Providers independently decide whether to send their own offers after reviewing authorized policy information.',
      detail: 'The consumer shares the policy they currently have. Each licensed provider determines the price, coverage, and terms it is willing and authorized to offer during one submission window.'
    },
    {
      num: '04',
      title: 'Protection-Price Separation',
      summary: 'Price is displayed separately from every factual coverage change.',
      detail: 'A quote that cuts premium by $30/month while secretly doubling the comprehensive deductible from $500 to $1,000 or dropping bodily injury liability is not a saving—it is an underinsured liability trap.'
    },
    {
      num: '05',
      title: 'Visible Differences',
      summary: 'Every coverage variance, deductible alteration, and exclusion must be explicitly surfaced.',
      detail: 'The deterministic comparison engine highlights every delta in bold relief: limits, deductibles, endorsements, and carrier financial strength ratings.'
    },
    {
      num: '06',
      title: 'Epistemic Humility',
      summary: 'Unknown information must remain unknown. AI may never hallucinate missing terms.',
      detail: 'If an offer fails to define roadside assistance or glass coverage, the engine marks that information as UNVERIFIED rather than guessing.'
    },
    {
      num: '07',
      title: 'Deliberate Progressive Disclosure',
      summary: 'Personal identification is disclosed only with the consumer’s authorization.',
      detail: 'During offer review, providers receive only authorized policy and risk information. Contact details are not distributed for marketing.'
    },
    {
      num: '08',
      title: 'Commercial Neutrality',
      summary: 'Providers cannot purchase an undisclosed advantage in provider offer results.',
      detail: 'Zero sponsored listings. Zero algorithmic bias. All participating carriers are displayed strictly by mathematical coverage comparison, financial rating, and true net price.'
    },
    {
      num: '09',
      title: 'Deterministic Control',
      summary: 'The platform explains the market; the consumer controls the outcome.',
      detail: 'Open Policy displays factual price and coverage differences without selecting for the consumer. The policyholder may choose an offer or keep the current policy.'
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
      doctrineTag: 'Doctrine 07 · Progressive Disclosure',
      question: 'Will insurance carriers or contact brokers call, text, or spam my phone number?',
      answer: 'Open Policy uses Deliberate Progressive Disclosure (Doctrine 07). Providers review only the policy and risk information the consumer authorizes during the submission window. Contact details are not distributed for marketing. When the consumer selects an offer and authorizes handoff, the selected licensed provider receives the information needed to continue the insurance transaction on its own channel.',
      keyPoints: [
        'Contact information is not distributed for marketing',
        'Authorized policy information is used during offer review',
        'Consumer-approved disclosure supports the selected-provider handoff'
      ]
    },
    {
      id: 'faq-phantom',
      category: 'COMPARISON',
      categoryLabel: 'Coverage Comparison & Traps',
      doctrineTag: 'Doctrine 04 · Protection-Price Separation',
      question: 'How does Open Policy prevent carriers from cutting coverage to appear cheaper?',
      answer: 'The platform is anchored in Protection-Price Separation (Doctrine 04) and Visible Differences (Doctrine 05). It compares documented offer terms with the verified existing-policy baseline and shows changed limits, deductibles, endorsements, and exclusions beside the price difference. The consumer reviews those facts and decides what to do.',
      keyPoints: [
        '18-point deterministic coverage equivalence audit',
        'Automatic detection of misleading price differences and doubled deductibles',
        'Transparent tiering: COMPARISON MATCH, ADDITIONAL, or CHANGED COVERAGE'
      ],
      actionPrompt: 'Test the Misleading Price Difference Trap in the Simulator',
      actionTarget: 'SIMULATOR'
    },
    {
      id: 'faq-policy review',
      category: 'OFFERS',
      categoryLabel: 'Inverted Offer Submission Protocol',
      doctrineTag: 'Doctrine 03 · Independent Offer Review',
      question: 'What is a "Policy Review" and how do carriers submit offers for my business?',
      answer: 'A Policy Review starts with the insurance policy you already have. Instead of repeatedly entering the same information, you upload your declarations page once, confirm the extracted baseline, and authorize eligible licensed providers to review it. Each provider independently decides whether to send its own documented offer during one submission window.',
      keyPoints: [
        'Single declarations page upload establishes the immutable baseline',
        'One submission window keeps each provider focused on its own offer',
        'Open Policy does not prompt providers to change their prices or terms'
      ],
      actionPrompt: 'Launch Policy Review NV-49281',
      actionTarget: 'CONSUMER'
    },
    {
      id: 'faq-obligation',
      category: 'PRIVACY',
      categoryLabel: 'Consumer Sovereignty',
      doctrineTag: 'Doctrine 01 · Consumer Sovereignty',
      question: 'Does uploading my declarations page obligate me to switch or pay any fees?',
      answer: 'No. Creating a Policy Review does not obligate you to switch. Every valid documented offer remains available for factual review, and you alone decide whether to select one or keep your current policy. Account and data controls remain subject to the platform privacy and retention terms.',
      keyPoints: [
        '100% free with zero consumer fees or lock-in',
        'Complete policyholder custody of declarations data',
        'Instant archive or data purge with zero residual trace'
      ]
    },
    {
      id: 'faq-audit',
      category: 'AUDIT',
      categoryLabel: 'Cryptographic Audit Trail',
      doctrineTag: 'Doctrine 09 · Deterministic Control',
      question: 'How does the audit record preserve offer and consent history?',
      answer: 'Open Policy records sensitive lifecycle events in durable audit history. Offer versions remain immutable, and the selected version, disclosure, and consumer consent can be traced without rewriting earlier evidence.',
      keyPoints: [
        'Sequential SHA-256 block hashing for all quoting events',
        'Append-only immutable record preventing retroactive tampering',
        'Direct regulatory transparency for State Insurance Departments'
      ]
    },
    {
      id: 'faq-vetting',
      category: 'OFFERS',
      categoryLabel: 'Carrier Vetting & Governance',
      doctrineTag: 'Doctrine 08 · Commercial Neutrality',
      question: 'Are participating insurance carriers and brokers licensed and financially rated?',
      answer: 'Provider access is subject to licensing and organization checks for the applicable jurisdiction. When authoritative financial-strength information is available, Open Policy displays it as factual provider information alongside the submitted offer.',
      keyPoints: [
        'Active State Department of Insurance license verification',
        'Available financial-strength information is shown as provider information',
        'Strict commercial neutrality with zero sponsored carrier placement'
      ],
      actionPrompt: 'Inspect Provider Quoting Desk',
      actionTarget: 'PROVIDER'
    },
    {
      id: 'faq-binding',
      category: 'OFFERS',
      categoryLabel: 'Consent & Provider Handoff',
      doctrineTag: 'Consumer-authorized handoff',
      question: 'What happens after I select an offer?',
      answer: 'Open Policy preserves the exact offer version you selected, records your consent, and provides a controlled handoff. The licensed provider conducts the subsequent insurance transaction, including any application, underwriting, revised terms, binding, and issuance activity on its own channel.',
      keyPoints: [
        'Consumer disclosure and consent are preserved durably',
        'Clear side-by-side comparison of old vs new policy terms',
        'The provider owns subsequent underwriting and issuance activity'
      ]
    },
    {
      id: 'faq-unknown',
      category: 'COMPARISON',
      categoryLabel: 'Coverage Verification',
      doctrineTag: 'Doctrine 06 · Epistemic Humility',
      question: 'What happens if a carrier\'s quote is missing specific coverage details?',
      answer: 'Open Policy applies Epistemic Humility (Doctrine 06): missing terms remain unknown rather than being guessed. If an offer document leaves an endorsement, roadside coverage, or glass waiver ambiguous, the platform marks that information as UNVERIFIED for consumer review.',
      keyPoints: [
        'Zero AI hallucination or speculative coverage filling',
        'Ambiguous terms explicitly marked as UNVERIFIED',
        'Mandatory underwriter certification before binding'
      ]
    },
    {
      id: 'faq-business',
      category: 'AUDIT',
      categoryLabel: 'Platform Economics',
      doctrineTag: 'Doctrine 08 · Commercial Neutrality',
      question: 'How is Open Policy funded if you never sell consumer contact information or accept advertising?',
      answer: 'Open Policy adheres strictly to Commercial Neutrality (Doctrine 08). Traditional aggregator sites accept paid promotions that bias top placements. Open Policy charges zero fees to consumers and charges participating carriers a flat, uniform protocol settlement fee only when a policy is successfully bound. No carrier can buy algorithmic favoritism or sponsored visibility.',
      keyPoints: [
        'Zero sponsored results or algorithmic pay-to-play',
        'Uniform flat settlement fee upon successful binding only',
        'Transparent platform economics aligned with consumer value'
      ]
    },
    {
      id: 'faq-lines',
      category: 'OFFERS',
      categoryLabel: 'Supported Insurance Lines',
      doctrineTag: 'Multi-Line Architecture',
      question: 'Which lines of insurance can be reviewed on Open Policy?',
      answer: 'Open Policy currently supports Personal Auto, Homeowners (HO-3 / HO-5), and Commercial General Liability / Business Owner Policies (BOP). The underlying deterministic comparison engine adapts its 18-point rubric based on the specific statutory coverage requirements of each insurance category.',
      keyPoints: [
        'Personal Auto (Liability, Comp, Collision, UM/UIM, PIP)',
        'Homeowners (Dwelling, Personal Property, Liability, Deductibles)',
        'Commercial Lines (General Liability, Property, Business Interruption)'
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
            <span>Open Policy Protocol v1.0 · Independent Insurance Exchange</span>
          </div>

          {/* Primary Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-tight">
            Turn Insurance Inside Out.<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400">
              Carriers Submit Offers. You Decide.
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Share the policy you currently have, verify the extracted coverage baseline, and allow eligible licensed providers to independently decide whether to submit their own offers.
          </p>

          {/* Primary Action Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3.5">
            <button
              id="hero-start-policy review-btn"
              onClick={handleStartPolicyReviewClick}
              className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-6 py-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm rounded-xl shadow-lg shadow-emerald-500/20 transition-all cursor-pointer transform hover:-translate-y-0.5 active:translate-y-0"
            >
              <span>Start Policy Review</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              id="hero-provider-desk-btn"
              onClick={handleProviderDeskClick}
              className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-6 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-semibold text-sm rounded-xl border border-slate-700 transition cursor-pointer"
            >
              <Briefcase className="w-4 h-4 text-blue-400" />
              <span>Provider Quoting Desk</span>
            </button>

            <a
              href="#create-account"
              onClick={(e) => {
                const el = document.getElementById('create-account');
                if (el) {
                  e.preventDefault();
                  el.scrollIntoView({ behavior: 'smooth' });
                }
              }}
              className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-5 py-3.5 bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-500/50 text-emerald-300 font-semibold text-sm rounded-xl transition cursor-pointer"
            >
              <UserCheck className="w-4 h-4 text-emerald-400" />
              <span>Create Account</span>
            </a>
          </div>

          {/* Protocol Invariants Bar - Unboxed metadata per frontend design rules */}
          <div className="pt-8 border-t border-slate-800/80 flex flex-wrap items-center justify-center gap-y-2 gap-x-6 text-xs text-slate-400 font-mono">
            <div className="flex items-center space-x-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span>Zero Contact Reselling</span>
            </div>
            <span aria-hidden="true" className="text-slate-700">·</span>
            <div className="flex items-center space-x-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            <span>Factual Coverage Comparison</span>
            </div>
            <span aria-hidden="true" className="text-slate-700">·</span>
            <div className="flex items-center space-x-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            <span>Independent Provider Offers</span>
            </div>
            <span aria-hidden="true" className="text-slate-700">·</span>
            <div className="flex items-center space-x-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span>SHA-256 Audit Trail</span>
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
            Interactive Coverage Comparison Simulator
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            See How Independent Offer Review Protects You
          </h2>
          <p className="text-sm text-slate-600">
            Explore how documented provider offers can differ from an existing policy in both price and coverage. This illustration is not an insurance quote or advice.
          </p>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
          {/* Simulator Inputs Column */}
          <div className="lg:col-span-6 p-6 sm:p-8 space-y-6 bg-slate-50/60">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <SlidersHorizontal className="w-4 h-4 text-emerald-600" />
                <span>Your Current Policy Baseline</span>
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
                  onClick={() => setInsuranceType('HOME')}
                  className={`flex items-center justify-center space-x-2 py-2.5 px-3 rounded-xl text-xs font-medium border transition cursor-pointer ${
                    insuranceType === 'HOME'
                      ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <HomeIcon className="w-3.5 h-3.5" />
                  <span>Homeowners</span>
                </button>
                <button
                  type="button"
                  onClick={() => setInsuranceType('COMMERCIAL')}
                  className={`flex items-center justify-center space-x-2 py-2.5 px-3 rounded-xl text-xs font-medium border transition cursor-pointer ${
                    insuranceType === 'COMMERCIAL'
                      ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <Building className="w-3.5 h-3.5" />
                  <span>Commercial</span>
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
                    Simulate Conventional Aggregator Trap
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
                Toggle this to see how conventional broker aggregators pretend to save you money by secretly gutting your coverage behind the scenes.
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
                        <span>COMPARISON VERIFIED · IDENTICAL OR ADDITIONAL PROTECTION</span>
                      </div>
                      <p className="text-xs text-emerald-700 mt-1">
                        All 3 participating carrier offers match your {liabilityTier} liability limits and ${deductible} deductible with zero coverage degradation.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-emerald-200/70">
                    <div>
                      <span className="text-[11px] text-emerald-800 font-medium">Illustrative Provider Premium</span>
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
                        <span>CHANGED COVERAGE · REVIEW REQUIRED</span>
                      </div>
                      <p className="text-xs text-rose-700 mt-1">
                        This illustration shows a <strong className="text-rose-900">${phantomStatedSavings}/mo</strong> premium difference ($${phantomStatedPremium}/mo offer) alongside these documented coverage changes:
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
                    Open Policy preserves the offer and displays these factual differences. The consumer alone decides whether the price and changed protection are acceptable.
                  </p>
                </div>
              )}

              {/* Sample Carrier Independent Offers Preview */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-slate-700">Illustrative Independent Provider Offers:</span>
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
                Ready to policy review your real policy?
              </div>
              <button
                id="simulator-launch-policy review-btn"
                type="button"
                onClick={handleStartPolicyReviewClick}
                className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl shadow-xs transition cursor-pointer"
              >
                <span>Start a Policy Review</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 2.5: Canonical Account Creation & Sign-In Gateway */}
      <section id="create-account" className="scroll-mt-24 space-y-8 bg-gradient-to-b from-white via-slate-50 to-slate-100/80 border border-slate-200 rounded-3xl p-6 sm:p-10 lg:p-12 shadow-xl">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <div className="inline-flex items-center space-x-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
            <ShieldCheck className="w-3 h-3" />
            <span>Secure Account Access</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Create or Access Your Open Policy Account</h2>
          <p className="text-sm text-slate-600 leading-relaxed">Policyholders share their current policy and review provider offers. Licensed providers register for authorized access and independently submit their own offers.</p>
        </div>
        <AuthModal
          variant="inline"
          initialRole={landingSignupRole}
          initialMode="SIGN_UP"
          onSuccess={handleInlineAuthSuccess}
        />
      </section>
      {/* 3. The Structural Breakdown: Conventional Model vs. Open Policy */}
      <section className="space-y-8">
        <div className="text-center max-w-3xl mx-auto space-y-2">
          <span className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-500">
            Market Structure Analysis
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Conventional Insurance Shopping vs. Open Policy
          </h2>
          <p className="text-sm text-slate-600">
            How consumer-controlled disclosure and factual comparison change the insurance-shopping experience.
          </p>
        </div>

        <div className="overflow-x-auto bg-white rounded-3xl border border-slate-200/90 shadow-lg">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600">
                <th className="py-4 px-6">Dimension</th>
                <th className="py-4 px-6 text-rose-700 bg-rose-50/40">The Legacy Aggregator Model</th>
                <th className="py-4 px-6 text-emerald-700 bg-emerald-50/40">The Open Policy Architecture</th>
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
                    <span>Your contact information may be distributed to multiple brokers, leading to repeated sales calls.</span>
                  </div>
                </td>
                <td className="py-4 px-6 text-slate-600 bg-emerald-50/20">
                  <div className="flex items-start space-x-2 text-emerald-900 font-medium">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Contact information is not distributed for marketing. Consumer-authorized disclosure supports the selected-provider handoff.</span>
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
                    <span>Quotes are sorted strictly by lowest dollar figure, concealing slashed liability limits and inflated deductibles.</span>
                  </div>
                </td>
                <td className="py-4 px-6 text-slate-600 bg-emerald-50/20">
                  <div className="flex items-start space-x-2 text-emerald-900 font-medium">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Factual price and coverage differences are displayed without hiding changed limits or deductibles.</span>
                  </div>
                </td>
              </tr>

              <tr className="hover:bg-slate-50/50">
                <td className="py-4 px-6 font-semibold text-slate-900">
                  Carrier Offer Submission Mechanics
                </td>
                <td className="py-4 px-6 text-slate-600 bg-rose-50/20">
                  <div className="flex items-start space-x-2 text-rose-900 font-medium">
                    <X className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                    <span>Carriers offer for "ad placement" and top search positioning rather than offering their independently determined price.</span>
                  </div>
                </td>
                <td className="py-4 px-6 text-slate-600 bg-emerald-50/20">
                  <div className="flex items-start space-x-2 text-emerald-900 font-medium">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Providers submit independently prepared offers without seeing another provider's offer.</span>
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
                    <span>Steering towards carriers that pay the highest broker commission percentages.</span>
                  </div>
                </td>
                <td className="py-4 px-6 text-slate-600 bg-emerald-50/20">
                  <div className="flex items-start space-x-2 text-emerald-900 font-medium">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Absolute commercial neutrality. No sponsored placements. Transparent protocol compensation.</span>
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
                    <span>Ephemeral verbal sales pitches with no verifiable audit trail or proof of regulatory review.</span>
                  </div>
                </td>
                <td className="py-4 px-6 text-slate-600 bg-emerald-50/20">
                  <div className="flex items-start space-x-2 text-emerald-900 font-medium">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Durable audit history preserves offer versions, disclosures, consent, and lifecycle decisions.</span>
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
            How The Protocol Operates
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            The Independent Offer Review Lifecycle
          </h2>
          <p className="text-sm text-slate-600">
            Four stages from verified existing policy to consumer review and provider handoff.
          </p>
        </div>

        {/* Step Selector Tabs */}
        <div className="flex items-center justify-center gap-2 overflow-x-auto pb-2">
          {[
            { step: 0, title: '01. Ingestion & Baseline' },
            { step: 1, title: '02. Submission Window' },
            { step: 2, title: '03. Decoupled Equivalence' },
            { step: 3, title: '04. Consent & Handoff' }
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
                  Stage 01 · Baseline Extraction
                </span>
                <h3 className="text-2xl font-bold text-slate-900">
                  Upload Declarations Page. Create the Immutable Standard.
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Simply upload your existing insurance declarations page or PDF renewal notice. Our high-precision document extraction engine identifies every driver, vehicle VIN, coverage limit, deductible, and endorsement.
                </p>
                <div className="space-y-2 text-xs text-slate-700">
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>OCR confidence scoring on every extracted field</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Policyholder retains right to edit or affirm any extracted parameter</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Baseline is locked into a tamper-evident Policy Review specification</span>
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
                  Stage 02 · Single Submission Window
                </span>
                <h3 className="text-2xl font-bold text-slate-900">
                  Providers Independently Submit Their Own Offers.
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Eligible licensed providers review only the policy information you authorize. They decide independently whether to submit a documented offer, without seeing another provider's offer.
                </p>
                <div className="space-y-2 text-xs text-slate-700">
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Providers cannot see another provider's price or terms</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Carriers must quote against the standardized specification</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Direct API submission with quote-sheet file attachment verification</span>
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
                    <span className="text-emerald-400">Offer Submitted ($1,040 / 6mo)</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-800 border border-slate-700 flex justify-between">
                    <span>Carrier 204 (Pacific Specialty)</span>
                    <span className="text-emerald-400">Offer Submitted ($1,110 / 6mo)</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-800 border border-slate-700 flex justify-between">
                    <span>Carrier 308 (Cascade Casualty)</span>
                    <span className="text-emerald-400">Offer Submitted ($990 / 6mo)</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeStepTab === 2 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              <div className="space-y-4">
                <span className="text-xs font-mono font-bold text-purple-600 uppercase">
                  Stage 03 · Deterministic Comparison
                </span>
                <h3 className="text-2xl font-bold text-slate-900">
                  Review Price and Coverage as Separate Facts.
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  The Open Policy comparison engine runs 18 distinct deterministic comparison checks. It classifies each proposal: ADDITIONAL, EQUAL, SLIGHTLY_REDUCED, or SUBSTANTIALLY_CHANGED COVERAGE.
                </p>
                <div className="space-y-2 text-xs text-slate-700">
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Every coverage difference is highlighted in explicit contrast</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Changed limits and deductibles remain visible beside price differences</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Available provider financial-strength information is shown factually</span>
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
                  Stage 04 · Consent, Handoff & Policy Vault
                </span>
                <h3 className="text-2xl font-bold text-slate-900">
                  Authorize the Selected-Provider Handoff.
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Review the selected offer and disclosure, then authorize the handoff. The licensed provider conducts the subsequent application, underwriting, binding, and issuance activity on its own channel.
                </p>
                <div className="space-y-2 text-xs text-slate-700">
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Selected offer version and consumer consent are preserved durably</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Issued-policy reconciliation displays differences from the selected offer</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Issued documents and reconciliation evidence remain available in the Policy Vault</span>
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
            Section 40 Product Doctrine
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            The 9 Sovereign Doctrines
          </h2>
          <p className="text-sm text-slate-600">
            The non-negotiable architectural constitution governing every line of code, rating algorithm, and quoting handoff in Open Policy.
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
            Ecosystem Portals
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Designed for Every Market Stakeholder
          </h2>
          <p className="text-sm text-slate-600">
            Launch directly into any specialized platform perspective to experience the protocol in action.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Consumer Portal Card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <UserCheck className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Consumer Experience</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Policyholders upload declarations, confirm the baseline, review factual offer differences, and decide whether to keep the current policy or select an offer for provider handoff.
              </p>
            </div>
            <button
              onClick={handleStartPolicyReviewClick}
              className="w-full inline-flex items-center justify-center space-x-2 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition cursor-pointer"
            >
              <span>Launch Consumer Portal</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Provider Portal Card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                <Briefcase className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Provider & Broker Desk</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Licensed agencies and carriers review consumer specifications, submit certified quote sheets, and eliminate coverage mismatches.
              </p>
            </div>
            <button
              onClick={handleProviderDeskClick}
              className="w-full inline-flex items-center justify-center space-x-2 py-2 px-3 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl transition cursor-pointer"
            >
              <span>Launch Provider Desk</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Regulatory Audit Card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                <FileText className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Audit & Review Queue</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Authorized reviewers inspect durable lifecycle evidence, offer documents, disclosures, consent, and review-queue decisions.
              </p>
            </div>
            <button
              onClick={onNavigateAdmin}
              className="w-full inline-flex items-center justify-center space-x-2 py-2 px-3 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold rounded-xl transition cursor-pointer"
            >
              <span>Launch Audit Console</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Architecture & Engineering Card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                <GitBranch className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Engine & Test Suite</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Engineers inspect system specifications, domain invariants, telemetry, and validation evidence.
              </p>
            </div>
            <button
              onClick={onNavigateArchitecture}
              className="w-full inline-flex items-center justify-center space-x-2 py-2 px-3 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition cursor-pointer"
            >
              <span>Explore Architecture</span>
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
            <span>Knowledge Base & Protocol FAQ</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Frequently Asked Questions
          </h2>
          <p className="text-sm text-slate-600">
            Clear, verifiable answers regarding privacy protection, coverage comparison algorithms, independent offer submission mechanics, and the open protocol.
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
                { id: 'OFFERS', label: 'Inverted Offer Submission', count: FAQS.filter(f => f.category === 'OFFERS').length },
                { id: 'AUDIT', label: 'Cryptographic Audit', count: FAQS.filter(f => f.category === 'AUDIT').length }
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
              placeholder="Search FAQ by keywords (e.g. 'spam', 'deductible', 'audit', 'licensing', 'fees')..."
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
                            <span>Protocol Invariant Commitments</span>
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
            Ready to Reverse the Insurance Equation?
          </h2>
          <p className="text-sm text-slate-300 max-w-xl mx-auto">
            Experience the consumer-controlled insurance offer review model today with our canonical policy review.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            onClick={handleStartPolicyReviewClick}
            className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg transition cursor-pointer"
          >
            <span>Launch Policy Review NV-49281</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={onNavigateArchitecture}
            className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition cursor-pointer"
          >
            <span>Review Product Doctrine & Tests</span>
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
                    OPEN POLICY
                  </div>
                  <div className="font-mono text-[10px] text-emerald-400 tracking-wider font-semibold mt-1">
                    CONSUMER INSURANCE PROTOCOL
                  </div>
                </div>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed max-w-sm">
                The independent, consumer-sovereign insurance offer review platform. We decouple insurance protection from price through inverted independent provider submissions, deterministic comparison verification, and append-only cryptographic audit trails.
              </p>

              {/* Protocol Badges */}
              <div className="flex flex-wrap gap-2 text-[10px] font-mono">
                <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-emerald-950/80 border border-emerald-800/60 text-emerald-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Protocol v1.0 Active</span>
                </span>
                <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-300">
                  <Lock className="w-3 h-3 text-emerald-400" />
                  <span>Zero Contact Reselling</span>
                </span>
                <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-300">
                  <Database className="w-3 h-3 text-cyan-400" />
                  <span>SHA-256 Merkle Ledger</span>
                </span>
              </div>

              {/* Quick Jump Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={handleStartPolicyReviewClick}
                  className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-xl shadow-sm transition cursor-pointer"
                >
                  <span>Start Policy Review</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleProviderDeskClick}
                  className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold rounded-xl border border-slate-700 transition cursor-pointer"
                >
                  <Briefcase className="w-3.5 h-3.5 text-blue-400" />
                  <span>Provider Desk</span>
                </button>
              </div>
            </div>

            {/* Col 3: Ecosystem Portals */}
            <div className="space-y-3">
              <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200">
                Ecosystem Portals
              </h4>
              <ul className="space-y-2 text-xs">
                <li>
                  <button
                    onClick={handleStartPolicyReviewClick}
                    className="hover:text-emerald-400 transition text-left flex items-center space-x-1.5 cursor-pointer text-slate-400"
                  >
                    <ChevronRight className="w-3 h-3 text-slate-600" />
                    <span>Consumer Policy Review Portal</span>
                  </button>
                </li>
                <li>
                  <button
                    onClick={handleProviderDeskClick}
                    className="hover:text-emerald-400 transition text-left flex items-center space-x-1.5 cursor-pointer text-slate-400"
                  >
                    <ChevronRight className="w-3 h-3 text-slate-600" />
                    <span>Provider Quoting Desk</span>
                  </button>
                </li>
                <li>
                  <button
                    onClick={onNavigateAdmin}
                    className="hover:text-emerald-400 transition text-left flex items-center space-x-1.5 cursor-pointer text-slate-400"
                  >
                    <ChevronRight className="w-3 h-3 text-slate-600" />
                    <span>Regulatory Audit Console</span>
                  </button>
                </li>
                <li>
                  <button
                    onClick={onNavigateTelemetry}
                    className="hover:text-emerald-400 transition text-left flex items-center space-x-1.5 cursor-pointer text-slate-400"
                  >
                    <ChevronRight className="w-3 h-3 text-slate-600" />
                    <span>Telemetry & Engine Metrics</span>
                  </button>
                </li>
                <li>
                  <button
                    onClick={onNavigateArchitecture}
                    className="hover:text-emerald-400 transition text-left flex items-center space-x-1.5 cursor-pointer text-slate-400"
                  >
                    <ChevronRight className="w-3 h-3 text-slate-600" />
                    <span>System Specs & 40 Tests</span>
                  </button>
                </li>
              </ul>
            </div>

            {/* Col 4: The 9 Sovereign Doctrines */}
            <div className="space-y-3">
              <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200">
                The 9 Doctrines
              </h4>
              <ul className="space-y-1.5 text-[11px] font-mono text-slate-400">
                <li className="flex items-center space-x-1.5">
                  <span className="text-emerald-400 font-bold">01</span>
                  <span>Consumer Sovereignty</span>
                </li>
                <li className="flex items-center space-x-1.5">
                  <span className="text-emerald-400 font-bold">02</span>
                  <span>Friction Reduction</span>
                </li>
                <li className="flex items-center space-x-1.5">
                  <span className="text-emerald-400 font-bold">03</span>
                  <span>Independent Offer Review</span>
                </li>
                <li className="flex items-center space-x-1.5">
                  <span className="text-emerald-400 font-bold">04</span>
                  <span>Protection-Price Separation</span>
                </li>
                <li className="flex items-center space-x-1.5">
                  <span className="text-emerald-400 font-bold">05</span>
                  <span>Visible Differences</span>
                </li>
                <li className="flex items-center space-x-1.5">
                  <span className="text-emerald-400 font-bold">06</span>
                  <span>Epistemic Humility</span>
                </li>
                <li className="flex items-center space-x-1.5">
                  <span className="text-emerald-400 font-bold">07</span>
                  <span>Progressive Disclosure</span>
                </li>
                <li className="flex items-center space-x-1.5">
                  <span className="text-emerald-400 font-bold">08</span>
                  <span>Commercial Neutrality</span>
                </li>
                <li className="flex items-center space-x-1.5">
                  <span className="text-emerald-400 font-bold">09</span>
                  <span>Deterministic Control</span>
                </li>
              </ul>
            </div>

            {/* Col 5: Governance & Technical Specifications */}
            <div className="space-y-3">
              <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200">
                Integrity Standards
              </h4>
              <ul className="space-y-2 text-xs text-slate-400">
                <li className="flex items-start space-x-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>18-Point Comparison Metric v1.0</span>
                </li>
                <li className="flex items-start space-x-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Durable Audit History</span>
                </li>
                <li className="flex items-start space-x-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Consumer Disclosure & Consent</span>
                </li>
                <li className="flex items-start space-x-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Independent Financial-Strength Information</span>
                </li>
                <li className="flex items-start space-x-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Commercial Neutrality Legal Safeguards</span>
                </li>
                <li className="flex items-start space-x-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Zero Generative Hallucination</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Sub-Footer Bar */}
          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-slate-500">
            <div className="flex flex-col sm:flex-row items-center gap-2 text-center sm:text-left">
              <span>Open Policy Engine • Consumer Insurance Offer Review Model</span>
              <span className="hidden sm:inline text-slate-700">|</span>
              <span className="text-slate-400">Canonical Baseline NV-49281 Active</span>
            </div>

            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 text-[11px] text-slate-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Durable Marketplace State</span>
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
