import React from 'react';
import {
  ArrowRight, BadgeCheck, Briefcase, Building2, Check, ChevronLeft,
  ChevronRight, Eye, FileCheck2,
  Lock, ReceiptText, ShieldCheck, SlidersHorizontal, Users, X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface ProviderLandingPageProps {
  onBackToPolicyholders: () => void;
  onEnterProviderDesk: () => void;
}

const STEPS = [
  ['1', 'Establish your organization', 'Complete organization onboarding, producer management, licensing, carrier relationships, jurisdictions, insurance-line authority, and Commercial V2 enrollment.'],
  ['2', 'Configure your appetite', 'Define the jurisdictions, insurance lines, risk characteristics, and operating capacity your organization is prepared to evaluate.'],
  ['3', 'Review and submit', 'Activated providers review authorized opportunity facts and independently decide whether to send their own documented offers during the open window.'],
  ['4', 'Earn the authorized connection', 'If the consumer selects your offer and authorizes disclosure, Open Polici completes the controlled connection. The licensed provider conducts the subsequent insurance transaction.']
] as const;

const COMMERCIAL_TIERS = [
  ['Solo', '$99', '1 seat · 1 jurisdiction', '5 concurrent opportunities · 25 offers/month'],
  ['Agency', '$249', '3 seats · 2 jurisdictions', '20 concurrent opportunities · 100 offers/month'],
  ['Premium', '$499', '5 seats · 3 jurisdictions', '60 concurrent opportunities · 300 offers/month'],
  ['Network', '$999', '15 seats · 5 jurisdictions', '200 concurrent opportunities · 1,000 offers/month'],
  ['Enterprise / Direct Carrier', 'From $1,999', '30 seats · 10 jurisdictions', '500 concurrent opportunities · 2,500 offers/month']
] as const;

const DASHBOARD_SLIDES = [
  ['Opportunities', 'Find work that fits your authority and appetite', 'Review privacy-preserving opportunity facts, timing, jurisdiction, requested protection, and invitation status before deciding whether your organization will participate.'],
  ['Offer Reviews', 'Keep every active policy review organized', 'See accepted opportunities, submission status, deadlines, and your organization’s activity without seeing another provider’s identity, terms, or activity.'],
  ['Offer Workspace', 'Build and document the offer in one workspace', 'Work from the authorized baseline, manage your own offer versions and supporting documents, and preserve the evidence behind every submitted term.'],
  ['Appetite & Licensing', 'Control where and what your organization can review', 'Maintain organization details, jurisdiction licenses, insurance-line authority, and appetite criteria that determine eligibility for opportunities.'],
  ['Commercial & Membership', 'See capacity, charges, invoices, and settlement evidence', 'Track membership capacity, Commercial V2 activity, rated line items, adjustments, invoices, payments, refunds, credits, and account balances.']
] as const;

export const ProviderLandingPage: React.FC<ProviderLandingPageProps> = ({
  onBackToPolicyholders, onEnterProviderDesk
}) => {
  const [dashboardSlide, setDashboardSlide] = React.useState(0);
  const { isAuthenticated, userRole, openAuthModal } = useAuth();
  const startProvider = () => {
    if (isAuthenticated && userRole === 'PROVIDER') onEnterProviderDesk();
    else openAuthModal({ initialRole: 'PROVIDER', initialMode: 'SIGN_UP' });
  };
  const previousDashboardSlide = () => setDashboardSlide(current => (current + DASHBOARD_SLIDES.length - 1) % DASHBOARD_SLIDES.length);
  const nextDashboardSlide = () => setDashboardSlide(current => (current + 1) % DASHBOARD_SLIDES.length);

  const dashboardPreview = (() => {
    if (dashboardSlide === 0) return (
      <div className="space-y-4">
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-xs leading-5 text-blue-950"><strong className="block text-sm">Privacy-preserving opportunity distribution</strong>Opportunity access reflects jurisdiction, active appetite, insurance line, authorization, and available capacity. Consumer contact details remain withheld.</div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4"><div className="flex gap-2"><span className="rounded-md border border-blue-200 bg-blue-50 px-2 py-1 font-mono text-xs font-bold text-blue-800">NV-49281</span><span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold">Nevada · Personal Auto</span></div><span className="text-xs text-slate-500">Window closes in 42 hours</span></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-4"><div className="rounded-xl bg-slate-50 p-3"><span className="text-[10px] font-bold uppercase text-slate-400">Baseline origin</span><strong className="mt-1 block text-xs">Existing policy</strong></div><div className="rounded-xl bg-slate-50 p-3"><span className="text-[10px] font-bold uppercase text-slate-400">Risk vehicle</span><strong className="mt-1 block text-xs">2022 Toyota Camry</strong></div><div className="rounded-xl bg-slate-50 p-3"><span className="text-[10px] font-bold uppercase text-slate-400">Protection baseline</span><strong className="mt-1 block text-xs">100/300 · $500 Coll.</strong></div><div className="rounded-xl bg-slate-50 p-3"><span className="text-[10px] font-bold uppercase text-slate-400">Invitation</span><strong className="mt-1 block text-emerald-700">Available</strong></div></div>
          <div className="mt-4 flex justify-end gap-2"><span className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold">Decline</span><span className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white">Accept & Review Policy</span></div>
        </div>
      </div>
    );
    if (dashboardSlide === 1) return (
      <div className="space-y-3">
        <div className="flex items-center justify-between"><h4 className="font-bold text-slate-900">Active Policy Reviews</h4><span className="text-xs text-slate-500">3 active reviews</span></div>
        {[['POLICY REVIEW-1042', '2022 Toyota Camry', 'Offer submitted', '18 hours remaining'], ['POLICY REVIEW-1038', '2021 Ford F-150', 'Documents requested', '31 hours remaining'], ['POLICY REVIEW-1029', 'Consumer-defined auto request', 'Review in progress', '44 hours remaining']].map(([ref, subject, status, timing]) => <div key={ref} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><span className="rounded border border-blue-200 bg-blue-50 px-2 py-1 font-mono text-[10px] font-bold text-blue-700">{ref}</span><h5 className="mt-2 font-bold text-slate-900">{subject}</h5><p className="mt-1 text-xs text-slate-500">{status} · {timing}</p></div><span className="w-fit rounded-lg bg-slate-950 px-3 py-2 text-xs font-semibold text-white">Open Workspace</span></div></div>)}
      </div>
    );
    if (dashboardSlide === 2) return (
      <div className="grid gap-4 lg:grid-cols-[1fr_.9fr]">
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between border-b border-slate-100 pb-3"><div><span className="font-mono text-[10px] font-bold text-blue-700">POLICY REVIEW-1042</span><h4 className="font-bold">Authorized baseline</h4></div><span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-bold text-emerald-800">SUBMISSION OPEN</span></div><div className="grid grid-cols-2 gap-3 text-xs"><div className="rounded-xl bg-slate-50 p-3"><span className="text-slate-400">Current annual premium</span><strong className="mt-1 block text-base">$2,964</strong></div><div className="rounded-xl bg-slate-50 p-3"><span className="text-slate-400">Policy term</span><strong className="mt-1 block text-base">6 months</strong></div><div className="rounded-xl bg-slate-50 p-3"><span className="text-slate-400">Bodily injury</span><strong className="mt-1 block">100k / 300k</strong></div><div className="rounded-xl bg-slate-50 p-3"><span className="text-slate-400">Deductible</span><strong className="mt-1 block">$500 collision</strong></div></div><div className="rounded-xl border border-slate-200 p-3 text-xs"><strong>Document evidence</strong><span className="mt-1 block text-slate-500">Declarations page · Version 3 · Consumer confirmed</span></div></div>
        <div className="rounded-2xl bg-slate-950 p-5 text-white shadow-sm"><span className="font-mono text-[10px] font-bold uppercase tracking-wider text-emerald-400">Your offer</span><div className="mt-4 space-y-3"><div className="rounded-xl border border-slate-700 bg-slate-900 p-3 text-xs"><span className="text-slate-400">Annual premium</span><strong className="mt-1 block text-xl">$2,580</strong></div><div className="grid grid-cols-2 gap-3"><div className="rounded-xl border border-slate-700 bg-slate-900 p-3 text-xs"><span className="text-slate-400">BI limits</span><strong className="mt-1 block">100k / 300k</strong></div><div className="rounded-xl border border-slate-700 bg-slate-900 p-3 text-xs"><span className="text-slate-400">Status</span><strong className="mt-1 block text-emerald-300">Draft v2</strong></div></div><div className="rounded-lg bg-emerald-500 px-3 py-2 text-center text-xs font-bold text-slate-950">Submit documented offer</div><p className="text-[10px] leading-4 text-slate-500">Only your organization’s offer history is visible here.</p></div></div>
      </div>
    );
    if (dashboardSlide === 3) return (
      <div className="grid gap-4 lg:grid-cols-2"><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3 border-b border-slate-100 pb-4"><Building2 className="h-6 w-6 text-blue-600"/><div><h4 className="font-bold">Silver State Insurance Group</h4><p className="text-xs text-slate-500">Independent Agency · Active</p></div></div><div className="mt-4 space-y-3 text-xs">{[['Nevada producer authority', 'Active'], ['Personal auto insurance line', 'Authorized'], ['Carrier relationships', '3 active'], ['Marketplace account', 'Eligible']].map(([label, value]) => <div key={label} className="flex items-center justify-between rounded-xl bg-slate-50 p-3"><span className="text-slate-600">{label}</span><strong className="text-emerald-700">{value}</strong></div>)}</div></div><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3 border-b border-slate-100 pb-4"><SlidersHorizontal className="h-6 w-6 text-emerald-600"/><div><h4 className="font-bold">Underwriting appetite</h4><p className="text-xs text-slate-500">Criteria used for opportunity eligibility</p></div></div><div className="mt-4 grid grid-cols-2 gap-3 text-xs"><div className="rounded-xl bg-slate-50 p-3"><span className="text-slate-400">Jurisdiction</span><strong className="mt-1 block">Nevada</strong></div><div className="rounded-xl bg-slate-50 p-3"><span className="text-slate-400">Insurance line</span><strong className="mt-1 block">Personal Auto</strong></div><div className="rounded-xl bg-slate-50 p-3"><span className="text-slate-400">Vehicle years</span><strong className="mt-1 block">2015–2026</strong></div><div className="rounded-xl bg-slate-50 p-3"><span className="text-slate-400">Operating capacity</span><strong className="mt-1 block">18 available</strong></div></div></div></div>
    );
    return (
      <div className="space-y-4"><div className="grid gap-3 sm:grid-cols-4">{[['Plan', 'Agency'], ['Seats', '2 / 3'], ['Opportunities', '12 / 20'], ['Account balance', '$75.00']].map(([label, value]) => <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><span className="text-[10px] font-bold uppercase text-slate-400">{label}</span><strong className="mt-2 block text-lg text-slate-900">{value}</strong></div>)}</div><div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3"><div><h4 className="font-bold">Invoices & Settlement Ledger</h4><p className="text-xs text-slate-500">Finalized statements and processor-confirmed activity</p></div><ReceiptText className="h-5 w-5 text-indigo-600"/></div><div className="grid grid-cols-[1.2fr_.8fr_.7fr_.8fr] border-b border-slate-100 px-4 py-2 text-[10px] font-bold uppercase text-slate-400"><span>Invoice</span><span>Status</span><span className="text-right">Total</span><span className="text-right">Balance</span></div>{[['OP-2026-1048', 'PAID', '$75.00', '$0.00'], ['OP-2026-1057', 'FINALIZED', '$90.00', '$90.00']].map(([invoice, status, total, balance]) => <div key={invoice} className="grid grid-cols-[1.2fr_.8fr_.7fr_.8fr] px-4 py-3 text-xs"><strong className="font-mono text-indigo-700">{invoice}</strong><span className={status === 'PAID' ? 'font-bold text-emerald-700' : 'font-bold text-blue-700'}>{status}</span><span className="text-right font-mono">{total}</span><span className="text-right font-mono font-bold">{balance}</span></div>)}</div></div>
    );
  })();

  return (
    <div className="w-full bg-slate-50 text-slate-900">
      <section className="relative overflow-hidden bg-slate-950 px-4 py-16 text-white sm:px-6 sm:py-24 lg:px-8">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b22_1px,transparent_1px),linear-gradient(to_bottom,#1e293b22_1px,transparent_1px)] bg-[size:4rem_4rem]" />
        <div className="absolute left-1/2 top-0 h-96 w-full max-w-5xl -translate-x-1/2 bg-emerald-500/10 blur-3xl" />
        <div className="relative mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1.2fr_.8fr] lg:items-center">
          <div>
            <button onClick={onBackToPolicyholders} className="mb-8 text-xs font-semibold text-slate-400 hover:text-white">
              ← Policyholder experience
            </button>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-800 bg-emerald-950/70 px-3 py-1.5 font-mono text-xs text-emerald-300">
              <Building2 className="h-3.5 w-3.5" /> Provider and carrier marketplace · Consumer-authorized connections
            </div>
            <h1 className="max-w-4xl text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
              Stop chasing shared contact lists.
              <span className="block bg-gradient-to-r from-emerald-400 to-cyan-300 bg-clip-text text-transparent">Start reviewing structured insurance opportunities.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
              Consumers come to Open Polici with either an existing policy they want to compare or a coverage request they created themselves. Your organization reviews the authorized facts, decides whether the opportunity fits its appetite, and submits its own documented offer. The consumer reviews before choosing whether to connect.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button onClick={startProvider} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-6 py-3.5 text-sm font-bold text-slate-950 hover:bg-emerald-400">
                {isAuthenticated && userRole === 'PROVIDER' ? 'Open Provider Desk' : 'Apply for Provider Access'}
                <ArrowRight className="h-4 w-4" />
              </button>
              <button onClick={() => openAuthModal({ initialRole: 'PROVIDER', initialMode: 'SIGN_IN' })} className="rounded-xl border border-slate-700 bg-slate-900 px-6 py-3.5 text-sm font-semibold text-white hover:bg-slate-800">
                Provider Sign In
              </button>
            </div>
            <p className="mt-5 max-w-2xl text-xs leading-5 text-slate-400">Built for licensed producers, agencies, brokerages, networks, and direct carriers seeking consumer-initiated opportunities—not another speed-to-dial contact list.</p>
          </div>

          <div className="rounded-3xl border border-slate-700 bg-slate-900/90 p-6 shadow-2xl sm:p-8">
            <p className="font-mono text-xs uppercase tracking-wider text-emerald-400">Provider access boundary</p>
            <h2 className="mt-3 text-2xl font-bold">Eligibility comes before access</h2>
            <div className="mt-6 space-y-4">
              {['Active organization and user status', 'Applicable license and carrier authority', 'Jurisdiction and insurance-line authorization', 'Available commercial capacity', 'Activation into the current provider cohort'].map(item => (
                <div key={item} className="flex items-start gap-3 text-sm text-slate-300">
                  <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" /><span>{item}</span>
                </div>
              ))}
            </div>
            <div className="mt-7 rounded-2xl border border-slate-700 bg-slate-950 p-4 text-xs leading-5 text-slate-400">
              Payment does not establish insurance authority or opportunity eligibility, and payment never changes provider order or consumer presentation. Standby status does not provide opportunity access.
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-7xl space-y-24 px-4 py-20 sm:px-6 lg:px-8">
        <section className="space-y-10">
          <div className="mx-auto max-w-3xl text-center">
            <p className="font-mono text-xs font-bold uppercase tracking-wider text-emerald-700">A different acquisition model</p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight">Move your organization closer to the consumer’s actual decision</h2>
          </div>
          <div className="grid overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl lg:grid-cols-2">
            <div className="p-8 sm:p-10">
              <p className="font-mono text-xs font-bold uppercase tracking-wider text-rose-600">The conventional shared-contact model</p>
              <h3 className="mt-3 text-2xl font-bold">Pay first. Call fast. Rebuild the file.</h3>
              <p className="mt-4 text-sm leading-7 text-slate-600">A name and phone number can arrive before the consumer has organized current coverage, reviewed your terms, or chosen to hear from you. Your team races to make contact, repeats basic intake work, and may reach someone who never expected multiple calls.</p>
            </div>
            <div className="bg-slate-950 p-8 text-white sm:p-10">
              <p className="font-mono text-xs font-bold uppercase tracking-wider text-emerald-400">The Open Polici opportunity</p>
              <h3 className="mt-3 text-2xl font-bold">Review first. Submit second. Connect by consumer choice.</h3>
              <p className="mt-4 text-sm leading-7 text-slate-300">The consumer establishes the starting point before provider review. Open Polici structures either an existing-policy baseline or a consumer-defined coverage request. Eligible providers independently review the authorized facts and decide whether to send an offer. Contact information remains controlled until the consumer selects an offer and authorizes the handoff.</p>
            </div>
          </div>
        </section>

        <section className="space-y-10">
          <div className="mx-auto max-w-3xl text-center">
            <p className="font-mono text-xs font-bold uppercase tracking-wider text-emerald-700">Two opportunity origins</p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight">One marketplace. Two sources of consumer intent.</h2>
            <p className="mt-4 text-sm leading-6 text-slate-600">Both pathways use the same provider eligibility, appetite, submission-window, consumer-selection, consent, disclosure, and Commercial V2 controls.</p>
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <article className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
              <p className="font-mono text-xs font-bold uppercase tracking-wider text-emerald-700">Existing-policy opportunities</p>
              <h3 className="mt-3 text-2xl font-bold">Start with the coverage already in place</h3>
              <p className="mt-4 text-sm leading-7 text-slate-600">The consumer uploads an active policy, reviews the extracted information, and confirms a structured baseline. Activated providers evaluate the authorized policy and risk facts against their appetite.</p>
            </article>
            <article className="rounded-3xl border border-slate-800 bg-slate-900 p-8 text-white shadow-sm">
              <p className="font-mono text-xs font-bold uppercase tracking-wider text-cyan-300">Consumer-defined coverage requests</p>
              <h3 className="mt-3 text-2xl font-bold">Start with what the consumer says they need</h3>
              <p className="mt-4 text-sm leading-7 text-slate-300">A consumer without current coverage states the insurance line, desired effective date, relevant risk facts, and any coverage preferences they choose to provide. Open Polici preserves that request without prescribing coverage. Eligible providers decide what they can offer.</p>
            </article>
          </div>
        </section>

        <section>
          <div className="mx-auto mb-10 max-w-3xl text-center">
            <p className="font-mono text-xs font-bold uppercase tracking-wider text-emerald-700">How participation works</p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight">From verified authority to consumer-authorized connection</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {STEPS.map(([number, title, description]) => (
              <article key={number} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex gap-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 font-bold text-emerald-800">{number}</span>
                  <div><h3 className="text-lg font-bold">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{description}</p></div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="space-y-10">
          <div className="mx-auto max-w-3xl text-center">
            <p className="font-mono text-xs font-bold uppercase tracking-wider text-emerald-700">Your provider operating system</p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight">See the actual workspace your organization will use</h2>
            <p className="mt-4 text-sm leading-6 text-slate-600">Explore each major provider-dashboard area below. These are interface examples derived from the working provider experience—not generic feature cards.</p>
          </div>

          <div className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-950 shadow-2xl">
            <div className="flex flex-col gap-5 border-b border-slate-800 p-6 text-white sm:p-8 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-4"><span className="flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-300"><Building2 className="h-6 w-6"/></span><div><p className="font-mono text-[10px] font-bold uppercase tracking-wider text-emerald-400">Dashboard preview {dashboardSlide + 1} of {DASHBOARD_SLIDES.length}</p><h3 className="mt-1 text-xl font-bold">{DASHBOARD_SLIDES[dashboardSlide][0]}</h3></div></div>
              <div className="flex gap-2"><button type="button" aria-label="Previous dashboard preview" onClick={previousDashboardSlide} className="rounded-xl border border-slate-700 p-3 text-slate-300 hover:border-emerald-500 hover:text-emerald-300"><ChevronLeft className="h-5 w-5"/></button><button type="button" aria-label="Next dashboard preview" onClick={nextDashboardSlide} className="rounded-xl border border-slate-700 p-3 text-slate-300 hover:border-emerald-500 hover:text-emerald-300"><ChevronRight className="h-5 w-5"/></button></div>
            </div>
            <div className="grid gap-0 lg:grid-cols-[.34fr_.66fr]">
              <div className="border-b border-slate-800 p-6 text-white sm:p-8 lg:border-b-0 lg:border-r"><p className="font-mono text-xs font-bold uppercase tracking-wider text-emerald-400">{DASHBOARD_SLIDES[dashboardSlide][0]}</p><h3 className="mt-4 text-2xl font-bold">{DASHBOARD_SLIDES[dashboardSlide][1]}</h3><p className="mt-4 text-sm leading-7 text-slate-400">{DASHBOARD_SLIDES[dashboardSlide][2]}</p><div className="mt-8 flex flex-wrap gap-2">{DASHBOARD_SLIDES.map((slide, index) => <button type="button" key={slide[0]} aria-label={`Show ${slide[0]} preview`} onClick={() => setDashboardSlide(index)} className={`h-2.5 rounded-full transition-all ${dashboardSlide === index ? 'w-8 bg-emerald-400' : 'w-2.5 bg-slate-700 hover:bg-slate-500'}`}/>)}</div></div>
              <div className="bg-slate-100 p-4 sm:p-7"><div className="mb-4 flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-950 text-emerald-400"><Briefcase className="h-4 w-4"/></span><div><strong className="block text-xs text-slate-900">Silver State Insurance Group</strong><span className="text-[10px] text-slate-500">Illustrative interface example · No consumer data</span></div></div><span className="hidden rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-bold text-emerald-800 sm:block">ACTIVE</span></div>{dashboardPreview}</div>
            </div>
          </div>
        </section>

        <section id="provider-pricing" className="space-y-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="font-mono text-xs font-bold uppercase tracking-wider text-emerald-700">Provider membership</p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight">Choose operating capacity that matches your organization</h2>
            <p className="mt-4 text-sm leading-6 text-slate-600">Membership purchases organizational software capacity, producer seats, jurisdiction capacity, opportunity concurrency, and offer-submission capacity. It does not purchase insurance authority or preferential marketplace treatment.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {COMMERCIAL_TIERS.map(([name, price, scope, capacity]) => (
              <article key={name} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-base font-bold text-slate-950">{name}</h3>
                <div className="mt-3 text-3xl font-extrabold text-emerald-700">{price}</div>
                <div className="text-xs text-slate-500">per month</div>
                <p className="mt-5 text-xs font-semibold text-slate-700">{scope}</p>
                <p className="mt-2 text-xs leading-5 text-slate-500">{capacity}</p>
              </article>
            ))}
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm leading-6 text-slate-700">
            Provider applications remain subject to organization, licensing, jurisdiction, insurance-line, carrier-relationship, commercial, capacity, and production controls. Membership activation does not override a missing authority requirement.
          </div>
        </section>

        <section className="space-y-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="font-mono text-xs font-bold uppercase tracking-wider text-emerald-700">Consumer-authorized connection pricing</p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight">Marketplace activity is free. A qualifying connection is not.</h2>
            <p className="mt-4 text-sm leading-6 text-slate-600">Opportunity availability, viewing, offer submission, consumer review, consumer selection by itself, and standby status carry no separate event charge. A line-specific transaction fee applies only after the complete connection conditions are satisfied.</p>
          </div>
          <div className="grid gap-6 lg:grid-cols-[.85fr_1.15fr]">
            <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
              <h3 className="text-xl font-bold">Published connection fees</h3>
              <div className="mt-5 divide-y divide-slate-100">
                {[
                  ['Personal auto', '$75'], ['Homeowners', '$90'], ['Renters', '$40'],
                  ['Individual health / ACA', '$90'], ['Term life', '$150'],
                  ['Commercial general liability', '$200'], ['Business owners policy', '$200'],
                  ['Commercial auto / trucking', '$225']
                ].map(([line, fee]) => <div key={line} className="flex items-center justify-between gap-4 py-3 text-sm"><span className="text-slate-700">{line}</span><span className="font-bold text-emerald-700">{fee}</span></div>)}
              </div>
              <p className="mt-5 text-xs leading-5 text-slate-500">A published price does not mean an insurance line is operational. Each line remains subject to its own production and compensation gates.</p>
            </div>
            <div className="rounded-3xl bg-slate-950 p-7 text-white shadow-sm">
              <h3 className="text-xl font-bold">When the transaction fee applies</h3>
              <ul className="mt-5 space-y-4 text-sm text-slate-300">
                {['The provider organization is eligible and activated', 'The organization submitted the offer the consumer selected', 'The consumer explicitly selected that offer', 'The consumer authorized controlled disclosure', 'The controlled connection completed successfully', 'The event is recorded once without duplication', 'Applicable compensation and insurance-line gates are satisfied'].map(item => <li key={item} className="flex gap-3"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400"/>{item}</li>)}
              </ul>
              <p className="mt-6 rounded-2xl border border-slate-700 bg-slate-900 p-4 text-xs leading-5 text-slate-400">Commercial V2 does not add a percentage of premium or a separate fee merely because a policy is later reported bound. The authorized connection remains distinct from later outcome records.</p>
            </div>
          </div>
        </section>

        <section className="grid overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl lg:grid-cols-2">
          <div className="p-8 sm:p-10">
            <div className="flex items-center gap-2 text-emerald-700"><Eye className="h-5 w-5"/><span className="font-mono text-xs font-bold uppercase tracking-wider">What activated providers receive</span></div>
            <ul className="mt-6 space-y-4 text-sm text-slate-700">
              {['Verified coverage baseline and relevant authorized risk facts', 'Submission-window status and your organization’s own offer history', 'Factual validation and immutable offer-version evidence', 'Consumer-authorized connection after selection'].map(item => <li key={item} className="flex gap-3"><Check className="h-5 w-5 shrink-0 text-emerald-600"/>{item}</li>)}
            </ul>
          </div>
          <div className="bg-slate-950 p-8 text-white sm:p-10">
            <div className="flex items-center gap-2 text-rose-300"><Lock className="h-5 w-5"/><span className="font-mono text-xs font-bold uppercase tracking-wider">What Open Polici withholds</span></div>
            <ul className="mt-6 space-y-4 text-sm text-slate-300">
              {['Consumer contact information before authorized connection', 'Other providers’ identities, prices, terms, or activity', 'Consumer decline reasons and pricing signals', 'Preferential position purchased through a commercial plan'].map(item => <li key={item} className="flex gap-3"><X className="h-5 w-5 shrink-0 text-rose-400"/>{item}</li>)}
            </ul>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <article className="rounded-2xl border border-slate-200 bg-white p-7"><Users className="h-7 w-7 text-emerald-600"/><h3 className="mt-4 text-lg font-bold">Consumer-controlled cohorts</h3><p className="mt-2 text-sm leading-6 text-slate-600">Providers enter a stable operational sequence. Additional groups activate only when the consumer requests more offers while the window remains open.</p></article>
          <article className="rounded-2xl border border-slate-200 bg-white p-7"><FileCheck2 className="h-7 w-7 text-emerald-600"/><h3 className="mt-4 text-lg font-bold">Documented offers</h3><p className="mt-2 text-sm leading-6 text-slate-600">Each offer carries its own provider documentation and immutable version history. Open Polici presents factual differences without making the consumer’s decision.</p></article>
          <article className="rounded-2xl border border-slate-200 bg-white p-7"><ShieldCheck className="h-7 w-7 text-emerald-600"/><h3 className="mt-4 text-lg font-bold">Provider-owned transaction</h3><p className="mt-2 text-sm leading-6 text-slate-600">After consumer-authorized connection, the licensed provider conducts application, underwriting, revised-term, binding, and issuance activity on its own channel.</p></article>
        </section>

        <section className="space-y-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="font-mono text-xs font-bold uppercase tracking-wider text-emerald-700">A different provider opportunity</p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight">From shared contact record to structured insurance opportunity</h2>
            <p className="mt-4 text-sm leading-6 text-slate-600">Open Polici is not a contact list. It organizes a consumer-initiated opportunity around structured facts, provider authority, documented offers, factual comparison, and a deliberate connection chosen by the consumer.</p>
          </div>
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
            <div className="grid grid-cols-[minmax(8rem,.65fr)_1fr_1fr] border-b border-slate-200 bg-slate-100 text-xs font-bold sm:text-sm">
              <div className="p-4 sm:p-5">Provider consideration</div>
              <div className="border-l border-slate-200 p-4 text-slate-600 sm:p-5">Conventional shared-contact model</div>
              <div className="border-l border-emerald-200 bg-emerald-50 p-4 text-emerald-900 sm:p-5">Open Polici</div>
            </div>
            {[
              ['Consumer starting point', 'Often a short form and a contact record.', 'An existing-policy baseline or consumer-defined coverage request.'],
              ['Provider access', 'Contact details may be distributed immediately.', 'Eligibility and cohort activation precede opportunity access.'],
              ['Contact timing', 'Several organizations may begin outreach before selection.', 'The consumer reviews offers before authorizing one connection.'],
              ['Opportunity context', 'Provider intake may begin after contact.', 'Authorized facts are structured before provider review.'],
              ['Provider decision', 'Fit is determined during outreach and repeated intake.', 'The organization evaluates the opportunity against its configured appetite.'],
              ['Offer process', 'Responses may arrive across separate channels.', 'Documented offers enter one controlled review experience.'],
              ['Provider visibility', 'Distribution and other provider activity may be unclear.', 'Each provider sees only its own activity and authorized opportunity facts.'],
              ['Commercial trigger', 'A provider may pay for access to the contact record.', 'The transaction fee follows a qualifying consumer-authorized connection.'],
              ['Subsequent transaction', 'The handoff path varies by source.', 'The licensed provider owns application, advice, underwriting, binding, and issuance.']
            ].map(([label, conventional, openPolicy]) => (
              <div key={label} className="grid grid-cols-[minmax(8rem,.65fr)_1fr_1fr] border-b border-slate-100 text-xs leading-5 last:border-b-0 sm:text-sm sm:leading-6">
                <div className="p-4 font-bold text-slate-900 sm:p-5">{label}</div>
                <div className="border-l border-slate-100 p-4 text-slate-600 sm:p-5">{conventional}</div>
                <div className="border-l border-emerald-100 bg-emerald-50/60 p-4 text-slate-800 sm:p-5">{openPolicy}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl bg-slate-900 p-8 text-white sm:p-12">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-center">
            <div><p className="font-mono text-xs uppercase tracking-wider text-emerald-400">Marketplace neutrality</p><h2 className="mt-3 text-3xl font-extrabold">Stand on the offer you can actually deliver.</h2><p className="mt-4 text-sm leading-6 text-slate-300">Commercial payment cannot purchase marketplace preference. Open Polici does not disclose another provider’s offer, provide a target price, operate revision rounds, or choose a provider for the consumer.</p></div>
            <div className="grid gap-3 sm:grid-cols-2">
              {['Existing-policy or consumer-defined baseline', 'Authorized opportunity facts', 'Independent documented offer', 'Factual consumer comparison', 'Explicit selection and authorization', 'Provider-owned insurance transaction'].map(item => (
                <div key={item} className="flex items-start gap-3 rounded-2xl border border-slate-700 bg-slate-950 p-4 text-sm text-slate-200"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400"/><span>{item}</span></div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-8 text-center sm:p-12">
          <h2 className="text-3xl font-extrabold">Build your Open Polici provider presence</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-600">Apply for the membership and operating capacity that fits your organization. Establish your producers, jurisdictions, insurance lines, carrier relationships, appetite, and commercial account before marketplace access begins.</p>
          <button onClick={startProvider} className="mt-7 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-6 py-3.5 text-sm font-bold text-white hover:bg-slate-800">Start Provider Application <ArrowRight className="h-4 w-4"/></button>
          <p className="mx-auto mt-5 max-w-2xl text-xs leading-5 text-slate-500">Applying does not automatically create marketplace authority. Access begins only after the required organization, licensing, commercial, capacity, and production controls are satisfied.</p>
        </section>
      </main>
    </div>
  );
};

