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
import { JurisdictionSelectOptions } from './JurisdictionSelectOptions';

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
  const { 
    isAuthenticated, 
    userRole, 
    openAuthModal, 
    signUpAsConsumer, 
    signUpAsProvider, 
    useDemoAccount 
  } = useAuth();

  // Landing Page Sign Up Section State
  const [landingSignupRole, setLandingSignupRole] = useState<'CONSUMER' | 'PROVIDER'>('CONSUMER');
  const [landingConsumerName, setLandingConsumerName] = useState('');
  const [landingConsumerEmail, setLandingConsumerEmail] = useState('');
  const [landingConsumerPass, setLandingConsumerPass] = useState('');
  const [landingConsumerState, setLandingConsumerState] = useState('NV');
  const [landingConsumerCarrier, setLandingConsumerCarrier] = useState('');

  const [landingAgentName, setLandingAgentName] = useState('');
  const [landingAgencyName, setLandingAgencyName] = useState('');
  const [landingLicenseNum, setLandingLicenseNum] = useState('');
  const [landingProviderState, setLandingProviderState] = useState('NV');
  const [landingProviderEmail, setLandingProviderEmail] = useState('');
  const [landingProviderPass, setLandingProviderPass] = useState('');

  const [landingSignupLoading, setLandingSignupLoading] = useState(false);
  const [landingSignupError, setLandingSignupError] = useState<string | null>(null);

  const handleLandingConsumerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLandingSignupError(null);
    setLandingSignupLoading(true);
    try {
      if (!landingConsumerName.trim()) throw new Error('Please enter your full name or preferred alias.');
      await signUpAsConsumer(landingConsumerName, landingConsumerEmail, landingConsumerPass, landingConsumerState, landingConsumerCarrier);
      onNavigateConsumer();
    } catch (err: any) {
      setLandingSignupError(err.message || 'Error creating consumer account.');
    } finally {
      setLandingSignupLoading(false);
    }
  };

  const handleLandingProviderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLandingSignupError(null);
    setLandingSignupLoading(true);
    try {
      if (!landingAgentName.trim() || !landingAgencyName.trim() || !landingLicenseNum.trim()) {
        throw new Error('Please complete all agency registration fields.');
      }
      await signUpAsProvider(landingAgentName, landingAgencyName, landingLicenseNum, landingProviderState, landingProviderEmail, landingProviderPass);
      onNavigateProvider();
    } catch (err: any) {
      setLandingSignupError(err.message || 'Error registering provider agency.');
    } finally {
      setLandingSignupLoading(false);
    }
  };

  const handleDemoLaunch = (role: 'CONSUMER' | 'PROVIDER', alias?: string) => {
    useDemoAccount(role, alias);
    if (role === 'PROVIDER') {
      onNavigateProvider();
    } else {
      onNavigateConsumer();
    }
  };

  const handleStartChallengeClick = () => {
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
  const baseDiscount = insuranceType === 'AUTO' ? 0.22 : insuranceType === 'HOME' ? 0.18 : 0.25;
  const paritySavings = Math.round(currentPremium * baseDiscount);
  const competitivePremium = currentPremium - paritySavings;
  const annualSavings = paritySavings * 12;

  // Phantom Savings math
  const phantomStatedSavings = paritySavings + 45; // appears bigger!
  const phantomStatedPremium = currentPremium - phantomStatedSavings;

  const DOCTRINES = [
    {
      num: '01',
      title: 'Consumer Sovereignty',
      summary: 'The consumer owns the policy, the information, and the decision.',
      detail: 'Traditional brokers view consumer policy declarations as proprietary lead assets. In Open Policy, the policyholder maintains cryptographic custody of their risk record. Data is never bundled, sold, or shared without express programmatic consent.'
    },
    {
      num: '02',
      title: 'Friction Reduction',
      summary: 'Drastically minimize the work required to bring an active policy to market.',
      detail: 'Instead of re-entering 40 form fields across ten carrier websites, a single declarations page upload extracts the baseline instantly, establishing an immutable challenge specification.'
    },
    {
      num: '03',
      title: 'Inverted Competition',
      summary: 'Providers compete for the consumer rather than forcing the consumer to repeatedly shop providers.',
      detail: 'The consumer declares: "Here is what I have, here is what I pay. Match or beat this coverage." Qualified carriers enter a blind bidding round against the consumer\'s standard.'
    },
    {
      num: '04',
      title: 'Protection-Price Separation',
      summary: 'Lower price alone does not constitute a better offer.',
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
      detail: 'If a carrier quote fails to explicitly define roadside assistance or glass coverage, the engine marks it as UNVERIFIED rather than guessing. Deterministic verification precedes binding.'
    },
    {
      num: '07',
      title: 'Deliberate Progressive Disclosure',
      summary: 'Personal identification is revealed only at the point of binding.',
      detail: 'During the quoting round, carriers see only actuarial risk parameters (zip code, vehicle specs, driving history brackets). Contact details are never exposed to telemarketing.'
    },
    {
      num: '08',
      title: 'Commercial Neutrality',
      summary: 'Providers cannot purchase an undisclosed advantage in competitive results.',
      detail: 'Zero sponsored listings. Zero algorithmic bias. All participating carriers are ranked strictly by mathematical coverage parity, financial rating, and true net price.'
    },
    {
      num: '09',
      title: 'Deterministic Control',
      summary: 'The platform explains the market; the consumer controls the outcome.',
      detail: 'No automated switching without consumer signature. The policyholder selects the winning offer and executes informed consent with complete statutory disclosures.'
    }
  ];

  interface FaqEntry {
    id: string;
    category: 'PRIVACY' | 'PARITY' | 'BIDDING' | 'AUDIT';
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
      question: 'Will insurance carriers or lead brokers call, text, or spam my phone number?',
      answer: 'Never. Open Policy enforces strict Deliberate Progressive Disclosure (Doctrine 07). Conventional aggregator websites immediately auction your phone number to up to 15 aggressive telemarketing boiler rooms as "warm leads." On Open Policy, bidding carriers only receive an anonymized actuarial risk profile (garaging zip code, vehicle VIN, age bracket, claims bracket) and must submit blind electronic quotes. Your legal name, phone number, and physical street address are only transmitted to the single carrier you deliberately choose to bind after reviewing all terms.',
      keyPoints: [
        'Zero contact reselling or telemarketing lead auctions',
        'Blind actuarial risk profiles during quoting rounds',
        'Single-carrier disclosure strictly upon voluntary final binding'
      ]
    },
    {
      id: 'faq-phantom',
      category: 'PARITY',
      categoryLabel: 'Coverage Parity & Traps',
      doctrineTag: 'Doctrine 04 · Protection-Price Separation',
      question: 'How does Open Policy prevent carriers from cutting coverage to appear cheaper?',
      answer: 'The platform is anchored in Protection-Price Separation (Doctrine 04) and Visible Differences (Doctrine 05). Our deterministic comparison engine audits competing quotes against your active policy declarations page across 18 standardized coverage dimensions. Any quote that lowers premium by quietly increasing deductibles or cutting liability limits is flagged with an amber warning badge as "DEGRADED" and prohibited from masquerading as savings.',
      keyPoints: [
        '18-point deterministic coverage equivalence audit',
        'Automatic detection of phantom savings and doubled deductibles',
        'Transparent tiering: PARITY MATCH, SUPERIOR, or DEGRADED'
      ],
      actionPrompt: 'Test the Phantom Savings Trap in the Simulator',
      actionTarget: 'SIMULATOR'
    },
    {
      id: 'faq-challenge',
      category: 'BIDDING',
      categoryLabel: 'Inverted Bidding Protocol',
      doctrineTag: 'Doctrine 03 · Inverted Competition',
      question: 'What is a "Policy Challenge" and how do carriers compete for my business?',
      answer: 'A Policy Challenge inverts the traditional insurance shopping process (Doctrine 03). Instead of the consumer filling out 40 redundant form fields across ten disparate carrier websites, you upload your current declarations page once. Open Policy locks your existing coverages as an immutable challenge baseline and invites licensed carriers to enter a blind bidding round to match or beat your terms.',
      keyPoints: [
        'Single declarations page upload establishes the immutable baseline',
        'Blind bidding rounds prevent collusive carrier pricing',
        'Carriers compete to beat your current premium, not each other'
      ],
      actionPrompt: 'Launch Policy Challenge NV-49281',
      actionTarget: 'CONSUMER'
    },
    {
      id: 'faq-obligation',
      category: 'PRIVACY',
      categoryLabel: 'Consumer Sovereignty',
      doctrineTag: 'Doctrine 01 · Consumer Sovereignty',
      question: 'Does uploading my declarations page obligate me to switch or pay any fees?',
      answer: 'Absolutely not. Creating a Policy Challenge is 100% free and imposes zero obligation to switch (Doctrine 01: Consumer Sovereignty). You retain full cryptographic custody of your risk record. If competing carriers cannot beat your current rate with equal or superior protection, you simply keep your existing policy. You can archive or purge your challenge data at any time with a single click.',
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
      question: 'How does the Section 33 Cryptographic Audit Ledger prevent carrier manipulation?',
      answer: 'Every quotation event, carrier rate calculation, and consumer consent decision is hashed into a sequential SHA-256 append-only audit ledger (Doctrine 09). Once anchored, records cannot be altered or retroactively manipulated. State insurance commissioners and consumers can independently verify the cryptographic chain of custody to confirm that anti-steering statutory guidelines were mathematically respected.',
      keyPoints: [
        'Sequential SHA-256 block hashing for all quoting events',
        'Append-only immutable record preventing retroactive tampering',
        'Direct regulatory transparency for State Insurance Departments'
      ]
    },
    {
      id: 'faq-vetting',
      category: 'BIDDING',
      categoryLabel: 'Carrier Vetting & Governance',
      doctrineTag: 'Doctrine 08 · Commercial Neutrality',
      question: 'Are participating insurance carriers and brokers licensed and financially rated?',
      answer: 'Yes. Only carriers and independent agencies holding active, verified certificates of authority from State Departments of Insurance are admitted to the Provider Desk. Furthermore, the engine cross-references each carrier\'s independent A.M. Best Financial Strength Rating (e.g., A++, A+, A) and Financial Size Category so you can evaluate financial stability alongside price.',
      keyPoints: [
        'Active State Department of Insurance license verification',
        'A.M. Best Financial Strength Ratings displayed for every quote',
        'Strict commercial neutrality with zero sponsored carrier placement'
      ],
      actionPrompt: 'Inspect Provider Quoting Desk',
      actionTarget: 'PROVIDER'
    },
    {
      id: 'faq-binding',
      category: 'BIDDING',
      categoryLabel: 'Informed Consent & Binding',
      doctrineTag: 'Section 32 · Statutory Consent',
      question: 'What happens during the binding phase once I select a winning policy?',
      answer: 'When you select an offer, the platform generates a Section 32 Statutory Informed Consent Disclosure summarizing all premium savings, deductible matching, and coverage endorsements. You execute a cryptographic digital signature, and Open Policy facilitates a secure, single-channel API handoff to the issuing carrier to finalize your binder and deliver official insurance ID cards.',
      keyPoints: [
        'Section 32 Statutory Informed Consent Disclosure generated automatically',
        'Clear side-by-side comparison of old vs new policy terms',
        'Direct carrier binder issuance with digital ID card handoff'
      ]
    },
    {
      id: 'faq-unknown',
      category: 'PARITY',
      categoryLabel: 'Coverage Verification',
      doctrineTag: 'Doctrine 06 · Epistemic Humility',
      question: 'What happens if a carrier\'s quote is missing specific coverage details?',
      answer: 'Open Policy strictly enforces Epistemic Humility (Doctrine 06). AI models are strictly forbidden from hallucinating or guessing missing terms. If a carrier\'s quote sheet leaves an endorsement, roadside coverage, or glass waiver ambiguous, the platform explicitly classifies it as "UNVERIFIED" until certified by an authorized underwriter.',
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
      question: 'How is Open Policy funded if you never sell consumer leads or accept advertising?',
      answer: 'Open Policy adheres strictly to Commercial Neutrality (Doctrine 08). Traditional aggregator sites accept paid promotions that bias top rankings. Open Policy charges zero fees to consumers and charges participating carriers a flat, uniform protocol settlement fee only when a policy is successfully bound. No carrier can buy algorithmic favoritism or sponsored visibility.',
      keyPoints: [
        'Zero sponsored results or algorithmic pay-to-play',
        'Uniform flat settlement fee upon successful binding only',
        'Transparent platform economics aligned with consumer value'
      ]
    },
    {
      id: 'faq-lines',
      category: 'BIDDING',
      categoryLabel: 'Supported Insurance Lines',
      doctrineTag: 'Multi-Line Architecture',
      question: 'Which lines of insurance can be challenged on Open Policy?',
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
              Carriers Compete. You Decide.
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Stop surrendering your phone number to lead brokers who auction your contact info. Upload your current policy, lock your coverage baseline, and force licensed carriers to blindly bid on identical or superior terms.
          </p>

          {/* Primary Action Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3.5">
            <button
              id="hero-start-challenge-btn"
              onClick={handleStartChallengeClick}
              className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-6 py-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm rounded-xl shadow-lg shadow-emerald-500/20 transition-all cursor-pointer transform hover:-translate-y-0.5 active:translate-y-0"
            >
              <span>Start Policy Challenge</span>
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
              <span>Mathematically Enforced Parity</span>
            </div>
            <span aria-hidden="true" className="text-slate-700">·</span>
            <div className="flex items-center space-x-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span>Blind Competitive Rounds</span>
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
        {/* 2. Interactive Policy Parity & Blind Savings Simulator */}
        <section id="simulator" className="scroll-mt-24 space-y-6">
        <div className="text-center max-w-3xl mx-auto space-y-2">
          <span className="text-xs font-mono font-semibold uppercase tracking-wider text-emerald-600">
            Interactive Coverage Parity Simulator
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            See How Inverted Competition Protects You
          </h2>
          <p className="text-sm text-slate-600">
            Experiment with your current insurance profile. Experience how Open Policy drives real price reduction while actively blocking predatory coverage cuts.
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

            {/* The Critical "Phantom Savings Trap" Test Toggle */}
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
                /* Honest Parity Outcome */
                <div className="p-5 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center space-x-1.5 text-emerald-800 text-xs font-bold">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>PARITY VERIFIED · IDENTICAL OR SUPERIOR PROTECTION</span>
                      </div>
                      <p className="text-xs text-emerald-700 mt-1">
                        All 3 participating carrier bids match your {liabilityTier} liability limits and ${deductible} deductible with zero coverage degradation.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-emerald-200/70">
                    <div>
                      <span className="text-[11px] text-emerald-800 font-medium">New Competitive Premium</span>
                      <div className="text-2xl font-black text-slate-900 font-mono mt-0.5">
                        ${competitivePremium}
                        <span className="text-xs font-normal text-slate-500"> / mo</span>
                      </div>
                    </div>
                    <div>
                      <span className="text-[11px] text-emerald-800 font-medium">Verified Annual Savings</span>
                      <div className="text-2xl font-black text-emerald-600 font-mono mt-0.5">
                        ${annualSavings}
                        <span className="text-xs font-normal text-emerald-700"> / yr</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* Phantom Savings Trap Exposed! */
                <div className="p-5 rounded-2xl bg-rose-50 border border-rose-300 space-y-4 animate-in fade-in duration-200">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center space-x-1.5 text-rose-800 text-xs font-bold">
                        <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>REJECTED BY PROTOCOL · COVERT COVERAGE CUT DETECTED</span>
                      </div>
                      <p className="text-xs text-rose-700 mt-1">
                        Aggregator claimed you save <strong className="text-rose-900">${phantomStatedSavings}/mo</strong> ($${phantomStatedPremium}/mo quote), but inspection reveals:
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
                    Verdict: <strong>False Savings</strong>. In the event of a routine fender-bender, you would pay $1,500 more out-of-pocket, wiping out 2.5 years of premium discounts. Open Policy rejects this submission.
                  </p>
                </div>
              )}

              {/* Sample Carrier Blind Bids Preview */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-slate-700">Simulated Blind Market Bids:</span>
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="flex items-center space-x-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span className="font-medium text-slate-900">Carrier A (AM Best A+)</span>
                    </div>
                    <div className="flex items-center space-x-3 font-mono">
                      <span className="text-slate-500 line-through">${currentPremium}</span>
                      <span className="font-bold text-emerald-700">${competitivePremium} / mo</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="flex items-center space-x-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span className="font-medium text-slate-900">Carrier B (AM Best A)</span>
                    </div>
                    <div className="flex items-center space-x-3 font-mono">
                      <span className="text-slate-500 line-through">${currentPremium}</span>
                      <span className="font-bold text-emerald-700">${competitivePremium + 8} / mo</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="flex items-center space-x-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span className="font-medium text-slate-900">Carrier C (AM Best A++)</span>
                    </div>
                    <div className="flex items-center space-x-3 font-mono">
                      <span className="text-slate-500 line-through">${currentPremium}</span>
                      <span className="font-bold text-emerald-700">${competitivePremium + 14} / mo</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Launch into Portal Button */}
            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-xs text-slate-500">
                Ready to challenge your real policy?
              </div>
              <button
                id="simulator-launch-challenge-btn"
                type="button"
                onClick={handleStartChallengeClick}
                className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl shadow-xs transition cursor-pointer"
              >
                <span>Launch Live Challenge NV-49281</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 2.5: Sovereign Account Creation & Marketplace Registration Gateway */}
      <section id="create-account" className="scroll-mt-24 space-y-8 bg-gradient-to-b from-white via-slate-50 to-slate-100/80 border border-slate-200 rounded-3xl p-6 sm:p-10 lg:p-12 shadow-xl">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 text-xs font-mono font-semibold">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Sovereign Identity Gateway</span>
          </div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight">
            Create Your Sovereign Account
          </h2>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
            Directly join the inverted insurance competition platform. Sign up as a policyholder to challenge carriers, or register your agency to participate on the provider quoting desk.
          </p>

          {/* Role Switcher Pill */}
          <div className="inline-flex p-1.5 bg-slate-200/80 rounded-2xl max-w-md w-full mt-2">
            <button
              type="button"
              onClick={() => { setLandingSignupRole('CONSUMER'); setLandingSignupError(null); }}
              className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-2 cursor-pointer ${
                landingSignupRole === 'CONSUMER'
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <User className="w-4 h-4" />
              <span>Policyholder (Consumer)</span>
            </button>
            <button
              type="button"
              onClick={() => { setLandingSignupRole('PROVIDER'); setLandingSignupError(null); }}
              className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-2 cursor-pointer ${
                landingSignupRole === 'PROVIDER'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>Broker / Agency (Provider)</span>
            </button>
          </div>
        </div>

        {landingSignupError && (
          <div className="max-w-3xl mx-auto p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-xs flex items-center space-x-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="font-medium">{landingSignupError}</span>
          </div>
        )}

        {/* Dual Mode Card */}
        {landingSignupRole === 'CONSUMER' ? (
          /* Consumer Account Card */
          <div className="bg-white rounded-2xl border border-slate-200 shadow-md overflow-hidden grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
            {/* Form Column */}
            <div className="lg:col-span-7 p-6 sm:p-8 space-y-5">
              <div className="space-y-1">
                <span className="text-xs font-mono font-semibold uppercase tracking-wider text-emerald-600">
                  Consumer Onboarding
                </span>
                <h3 className="text-xl font-bold text-slate-900 tracking-tight">
                  Make Insurance Compete For You
                </h3>
                <p className="text-xs text-slate-500">
                  100% Free • Zero Spam Calls • Cryptographically Vaulted Records
                </p>
              </div>

              <form onSubmit={handleLandingConsumerSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Full Name or Preferred Alias</label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required
                        value={landingConsumerName}
                        onChange={(e) => setLandingConsumerName(e.target.value)}
                        placeholder="Jane Doe"
                        className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Personal Email Address</label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        required
                        value={landingConsumerEmail}
                        onChange={(e) => setLandingConsumerEmail(e.target.value)}
                        placeholder="jane.doe@example.com"
                        className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Vehicle / Policy State</label>
                    <select
                      value={landingConsumerState}
                      onChange={(e) => setLandingConsumerState(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                    >
                      <JurisdictionSelectOptions />
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Current Insurance Carrier (Optional)</label>
                    <input
                      type="text"
                      value={landingConsumerCarrier}
                      onChange={(e) => setLandingConsumerCarrier(e.target.value)}
                      placeholder="e.g. GEICO, State Farm, Allstate"
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Create Secure Password</label>
                  <div className="relative">
                    <Key className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      required
                      value={landingConsumerPass}
                      onChange={(e) => setLandingConsumerPass(e.target.value)}
                      placeholder="Minimum 6 characters"
                      minLength={6}
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="p-3 bg-emerald-50/60 border border-emerald-200/80 rounded-xl flex items-start space-x-2 text-[11px] text-emerald-900">
                  <Lock className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Anti-Spam Guarantee:</strong> Open Policy never auctions or sells your phone number. Competing carriers bid blind against your coverage baseline.
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={landingSignupLoading}
                  className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold text-xs sm:text-sm rounded-xl shadow-lg shadow-emerald-500/20 transition cursor-pointer flex items-center justify-center space-x-2"
                >
                  <span>{landingSignupLoading ? 'Creating Account & Setting Up Challenge...' : 'Create Consumer Account & Start Policy Challenge'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </div>

            {/* Doctrine Sidebar */}
            <div className="lg:col-span-5 p-6 sm:p-8 bg-slate-50/70 space-y-5 flex flex-col justify-between">
              <div className="space-y-4">
                <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-700">
                  What Happens Next
                </h4>

                <div className="space-y-3">
                  <div className="flex items-start space-x-3">
                    <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                      1
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-slate-900">Upload Existing Policy</h5>
                      <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                        Upload your declarations page. Our engine extracts your current premium and exact coverage limits into a tamper-evident baseline.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                      2
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-slate-900">Carriers Blindly Compete</h5>
                      <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                        Carriers submit blind offers against your baseline in structured rounds without seeing your name, address, or phone number.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                      3
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-slate-900">Decide with Zero Pressure</h5>
                      <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                        Compare side-by-side offers with mathematical parity. If nobody beats your price, keep your current policy with zero penalty.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => openAuthModal({ initialMode: 'SIGN_IN' })}
                  className="text-xs text-slate-600 hover:text-slate-900 font-medium underline cursor-pointer"
                >
                  Already have an account? Sign in to your dashboard →
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Provider / Broker Account Card */
          <div className="bg-white rounded-2xl border border-slate-200 shadow-md overflow-hidden grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
            {/* Form Column */}
            <div className="lg:col-span-7 p-6 sm:p-8 space-y-5">
              <div className="space-y-1">
                <span className="text-xs font-mono font-semibold uppercase tracking-wider text-blue-600">
                  Provider Registration
                </span>
                <h3 className="text-xl font-bold text-slate-900 tracking-tight">
                  Agency & Carrier Quoting Desk
                </h3>
                <p className="text-xs text-slate-500">
                  Verified Department of Insurance Licensure Required
                </p>
              </div>

              <form onSubmit={handleLandingProviderSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Licensed Agent Name</label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required
                        value={landingAgentName}
                        onChange={(e) => setLandingAgentName(e.target.value)}
                        placeholder="Alex Morgan"
                        className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Agency / Brokerage Legal Name</label>
                    <div className="relative">
                      <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required
                        value={landingAgencyName}
                        onChange={(e) => setLandingAgencyName(e.target.value)}
                        placeholder="Sierra Brokerage Group LLC"
                        className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Licensing State</label>
                    <select
                      value={landingProviderState}
                      onChange={(e) => setLandingProviderState(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                    >
                      <JurisdictionSelectOptions />
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Producer / Agency License #</label>
                    <input
                      type="text"
                      required
                      value={landingLicenseNum}
                      onChange={(e) => setLandingLicenseNum(e.target.value)}
                      placeholder="NV-LIC-984210"
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Professional Work Email</label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        required
                        value={landingProviderEmail}
                        onChange={(e) => setLandingProviderEmail(e.target.value)}
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
                        value={landingProviderPass}
                        onChange={(e) => setLandingProviderPass(e.target.value)}
                        placeholder="Minimum 6 characters"
                        minLength={6}
                        className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-blue-50/60 border border-blue-200/80 rounded-xl flex items-start space-x-2 text-[11px] text-blue-900">
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Statutory Compliance:</strong> Providers must hold active certificates of authority and agree to sealed anti-collusion bidding rules.
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={landingSignupLoading}
                  className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs sm:text-sm rounded-xl shadow-lg shadow-blue-600/20 transition cursor-pointer flex items-center justify-center space-x-2"
                >
                  <span>{landingSignupLoading ? 'Registering Agency...' : 'Register Agency & Open Quoting Desk'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </div>

            {/* Provider Benefits Sidebar */}
            <div className="lg:col-span-5 p-6 sm:p-8 bg-slate-50/70 space-y-5 flex flex-col justify-between">
              <div className="space-y-4">
                <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-700">
                  Provider Architecture Benefits
                </h4>

                <div className="space-y-3">
                  <div className="flex items-start space-x-3">
                    <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                      ✓
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-slate-900">Pre-Qualified Policyholder Demand</h5>
                      <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                        Quote against authenticated dec pages with verified vehicle and driver risk profiles. Zero unqualified cold leads.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                      ✓
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-slate-900">Sealed Competition Telemetry</h5>
                      <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                        Competitor prices and agency names are cryptographically sealed to prevent predatory undercut spirals and collusive bidding.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                      ✓
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-slate-900">Direct Binding Handoff</h5>
                      <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                        When chosen, receive authorized Stage C PII directly into your quoting workbench for policy binding.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => openAuthModal({ initialMode: 'SIGN_IN' })}
                  className="text-xs text-slate-600 hover:text-slate-900 font-medium underline cursor-pointer"
                >
                  Already have an agency account? Sign in to Quoting Desk →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Quick Instant Demo / Test Mode Ribbon */}
        <div className="pt-4 border-t border-slate-200/90 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-2 text-slate-600">
            <Sparkles className="w-4 h-4 text-emerald-600" />
            <span className="font-medium">Testing or Evaluating the Architecture?</span>
            <span className="text-slate-400">Launch with pre-populated canonical personas:</span>
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => handleDemoLaunch('CONSUMER', 'Jane Doe (NV Auto)')}
              className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-semibold text-xs transition cursor-pointer"
            >
              Demo Policyholder (Jane Doe)
            </button>
            <button
              type="button"
              onClick={() => handleDemoLaunch('PROVIDER', 'Sierra Brokerage (Alex Morgan)')}
              className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl bg-blue-100 hover:bg-blue-200 text-blue-800 font-semibold text-xs transition cursor-pointer"
            >
              Demo Provider (Sierra Brokerage)
            </button>
          </div>
        </div>
      </section>

      {/* 3. The Structural Breakdown: Conventional Model vs. Open Policy */}
      <section className="space-y-8">
        <div className="text-center max-w-3xl mx-auto space-y-2">
          <span className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-500">
            Market Structure Analysis
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            The Lead-Gen Cartel vs. The Sovereign Protocol
          </h2>
          <p className="text-sm text-slate-600">
            Why shopping for insurance feels like walking into a telemarketing buzzsaw—and how deterministic protocol mechanics solve it permanently.
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
                    <span>Your phone and email are auctioned to 8-15 competing brokers, triggering incessant robocalls.</span>
                  </div>
                </td>
                <td className="py-4 px-6 text-slate-600 bg-emerald-50/20">
                  <div className="flex items-start space-x-2 text-emerald-900 font-medium">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Zero contact sharing during bidding. Progressive disclosure reveals identity only to the single chosen carrier at binding.</span>
                  </div>
                </td>
              </tr>

              <tr className="hover:bg-slate-50/50">
                <td className="py-4 px-6 font-semibold text-slate-900">
                  Coverage Parity Verification
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
                    <span>Deterministic comparison algorithm strictly enforces equal-or-better coverage before any savings can be claimed.</span>
                  </div>
                </td>
              </tr>

              <tr className="hover:bg-slate-50/50">
                <td className="py-4 px-6 font-semibold text-slate-900">
                  Carrier Bidding Mechanics
                </td>
                <td className="py-4 px-6 text-slate-600 bg-rose-50/20">
                  <div className="flex items-start space-x-2 text-rose-900 font-medium">
                    <X className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                    <span>Carriers bid for "ad placement" and top search positioning rather than offering their best actuarial price.</span>
                  </div>
                </td>
                <td className="py-4 px-6 text-slate-600 bg-emerald-50/20">
                  <div className="flex items-start space-x-2 text-emerald-900 font-medium">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Blind competitive rounds. Carriers compete against your exact policy specification without knowing other bids.</span>
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
                    <span>Ephemeral verbal sales pitches with no verifiable audit trail or proof of compliance.</span>
                  </div>
                </td>
                <td className="py-4 px-6 text-slate-600 bg-emerald-50/20">
                  <div className="flex items-start space-x-2 text-emerald-900 font-medium">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Cryptographic SHA-256 event ledger and Section 32 Human Review Queue for complete statutory compliance.</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* 4. The 4-Step Inverted Competition Lifecycle */}
      <section className="space-y-8">
        <div className="text-center max-w-3xl mx-auto space-y-2">
          <span className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-500">
            How The Protocol Operates
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            The Inverted Competition Lifecycle
          </h2>
          <p className="text-sm text-slate-600">
            Four deterministic stages transforming an existing policy into a multi-carrier competitive auction.
          </p>
        </div>

        {/* Step Selector Tabs */}
        <div className="flex items-center justify-center gap-2 overflow-x-auto pb-2">
          {[
            { step: 0, title: '01. Ingestion & Baseline' },
            { step: 1, title: '02. Blind Market Round' },
            { step: 2, title: '03. Decoupled Equivalence' },
            { step: 3, title: '04. Sovereign Binding' }
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
                    <span>Baseline is locked into a tamper-evident Policy Challenge specification</span>
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
                  Stage 02 · Blind Bidding Rounds
                </span>
                <h3 className="text-2xl font-bold text-slate-900">
                  Carriers Compete Blindly. Zero Contact Harassment.
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Your challenge is broadcast to qualified carrier quoting APIs and licensed brokers. Underwriters see the exact underwriting risk profile—never your phone number or email address.
                </p>
                <div className="space-y-2 text-xs text-slate-700">
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Blind sealed rounds prevent price signaling and artificial collusion</span>
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
                  <span>MARKET_ROUND: ACTIVE</span>
                  <span className="text-blue-400">CARRIER_ACCESS: ANONYMOUS</span>
                </div>
                <div className="space-y-2">
                  <div className="p-2.5 rounded-lg bg-slate-800 border border-slate-700 flex justify-between">
                    <span>Carrier 101 (Travelers Network)</span>
                    <span className="text-emerald-400">Bid Submitted ($1,040 / 6mo)</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-800 border border-slate-700 flex justify-between">
                    <span>Carrier 204 (Pacific Specialty)</span>
                    <span className="text-emerald-400">Bid Submitted ($1,110 / 6mo)</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-800 border border-slate-700 flex justify-between">
                    <span>Carrier 308 (Cascade Casualty)</span>
                    <span className="text-emerald-400">Bid Submitted ($990 / 6mo)</span>
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
                  Decouple Price from Protection. Zero False Savings.
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  The Open Policy comparison engine runs 18 distinct deterministic parity checks. It classifies each proposal: SUPERIOR, EQUAL, SLIGHTLY_REDUCED, or SUBSTANTIALLY_DEGRADED.
                </p>
                <div className="space-y-2 text-xs text-slate-700">
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Every coverage difference is highlighted in explicit contrast</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Algorithmic disqualification of phantom savings</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>AM Best financial strength rating validation</span>
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
                    <span>True Net Savings:</span>
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
                  Stage 04 · Informed Consent & Sovereign Vault
                </span>
                <h3 className="text-2xl font-bold text-slate-900">
                  Sign Informed Consent. Bind to Your Vault.
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Review the complete Statutory Informed Consent Disclosure. Once executed, the handoff token is generated, the policy is bound, and the replacement policy is audited in your sovereign vault.
                </p>
                <div className="space-y-2 text-xs text-slate-700">
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Cryptographic SHA-256 seal anchored to Section 33 ledger</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Automated post-bind reconciliation detects carrier issuance discrepancy</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Continuous policy vault with annual renewal protection</span>
                  </div>
                </div>
              </div>
              <div className="bg-slate-900 text-white p-6 rounded-2xl border border-slate-800 space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-[11px] text-slate-400">
                  <span>BINDING_DOSSIER: BIND-NV-8821</span>
                  <span className="text-emerald-400">SEALED</span>
                </div>
                <div className="space-y-1.5 text-slate-300">
                  <div>SHA-256 Root: 9f8a32b1c4e7...</div>
                  <div>Carrier Policy Number: CAS-9821734</div>
                  <div>Effective Date: Immediately Active</div>
                  <div>Informed Consent: Timestamped & Digitally Signed</div>
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
                Policyholders upload declarations, inspect carrier bids, review coverage deltas, and bind with signed statutory informed consent.
              </p>
            </div>
            <button
              onClick={handleStartChallengeClick}
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
                State insurance auditors verify SHA-256 append-only chain continuity, inspect quote sheets, and adjudicate Section 32 review tickets.
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
                Actuaries and engineers explore system specifications, Redis caching topology, and run all 40 automated domain test suites live.
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
            Clear, verifiable answers regarding privacy protection, coverage parity algorithms, blind bidding mechanics, and the open protocol.
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
                { id: 'PARITY', label: 'Coverage Parity', count: FAQS.filter(f => f.category === 'PARITY').length },
                { id: 'BIDDING', label: 'Inverted Bidding', count: FAQS.filter(f => f.category === 'BIDDING').length },
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
                            : faq.category === 'PARITY'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : faq.category === 'BIDDING'
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
                            <span>Protocol Invariant Guarantees</span>
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
                              if (faq.actionTarget === 'CONSUMER') handleStartChallengeClick();
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
            Experience the consumer-controlled insurance competition model today with our canonical policy challenge.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            onClick={handleStartChallengeClick}
            className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg transition cursor-pointer"
          >
            <span>Launch Policy Challenge NV-49281</span>
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
                The independent, consumer-sovereign insurance competition platform. We decouple insurance protection from price through inverted blind competitive bidding, deterministic parity verification, and append-only cryptographic audit trails.
              </p>

              {/* Protocol Badges */}
              <div className="flex flex-wrap gap-2 text-[10px] font-mono">
                <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-emerald-950/80 border border-emerald-800/60 text-emerald-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Protocol v1.0 Active</span>
                </span>
                <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-300">
                  <Lock className="w-3 h-3 text-emerald-400" />
                  <span>Zero Lead Reselling</span>
                </span>
                <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-300">
                  <Database className="w-3 h-3 text-cyan-400" />
                  <span>SHA-256 Merkle Ledger</span>
                </span>
              </div>

              {/* Quick Jump Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={handleStartChallengeClick}
                  className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-xl shadow-sm transition cursor-pointer"
                >
                  <span>Start Policy Challenge</span>
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
                    onClick={handleStartChallengeClick}
                    className="hover:text-emerald-400 transition text-left flex items-center space-x-1.5 cursor-pointer text-slate-400"
                  >
                    <ChevronRight className="w-3 h-3 text-slate-600" />
                    <span>Consumer Challenge Portal</span>
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
                  <span>Inverted Competition</span>
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
                  <span>18-Point Parity Metric v1.0</span>
                </li>
                <li className="flex items-start space-x-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Section 33 SHA-256 Ledger</span>
                </li>
                <li className="flex items-start space-x-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Section 32 Statutory Consent</span>
                </li>
                <li className="flex items-start space-x-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>A.M. Best Solvency Standards</span>
                </li>
                <li className="flex items-start space-x-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Anti-Steering Legal Safeguards</span>
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
              <span>Open Policy Engine • Consumer Insurance Competition Model</span>
              <span className="hidden sm:inline text-slate-700">|</span>
              <span className="text-slate-400">Canonical Baseline NV-49281 Active</span>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 text-[11px] text-slate-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Postgres & Redis Online</span>
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
