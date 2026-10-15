import React from 'react';
import {
  ArrowRight, BadgeCheck, Building2, Check, Eye, FileCheck2,
  Lock, ShieldCheck, Users, X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface ProviderLandingPageProps {
  onBackToPolicyholders: () => void;
  onEnterProviderDesk: () => void;
}

const STEPS = [
  ['1', 'Verify the organization', 'Open Policy verifies the provider organization, users, licenses, carrier relationships, jurisdictions, and insurance lines before opportunity access.'],
  ['2', 'Review authorized policy facts', 'Activated providers see the verified policy and risk information authorized for the opportunity—not consumer contact details or another provider’s offer.'],
  ['3', 'Submit an independent offer', 'Your organization determines the price, coverage, and terms it is willing and authorized to offer during the open submission window.'],
  ['4', 'Connect only by consumer choice', 'If the consumer selects your documented offer and authorizes disclosure, Open Policy creates a controlled connection. Your licensed channel handles subsequent insurance activity.']
] as const;

export const ProviderLandingPage: React.FC<ProviderLandingPageProps> = ({
  onBackToPolicyholders, onEnterProviderDesk
}) => {
  const { isAuthenticated, userRole, openAuthModal } = useAuth();
  const startProvider = () => {
    if (isAuthenticated && userRole === 'PROVIDER') onEnterProviderDesk();
    else openAuthModal({ initialRole: 'PROVIDER', initialMode: 'SIGN_UP' });
  };

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
              <Building2 className="h-3.5 w-3.5" /> Provider and carrier participation
            </div>
            <h1 className="max-w-4xl text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
              Verified policy opportunities.
              <span className="block bg-gradient-to-r from-emerald-400 to-cyan-300 bg-clip-text text-transparent">Independent offers. Consumer-authorized connections.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
              Open Policy gives licensed providers a structured way to review authorized policy information and submit their own documented offers—without buying consumer contact lists or seeing other providers’ terms.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button onClick={startProvider} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-6 py-3.5 text-sm font-bold text-slate-950 hover:bg-emerald-400">
                {isAuthenticated && userRole === 'PROVIDER' ? 'Open Provider Desk' : 'Create Provider Account'}
                <ArrowRight className="h-4 w-4" />
              </button>
              <button onClick={() => openAuthModal({ initialRole: 'PROVIDER', initialMode: 'SIGN_IN' })} className="rounded-xl border border-slate-700 bg-slate-900 px-6 py-3.5 text-sm font-semibold text-white hover:bg-slate-800">
                Provider Sign In
              </button>
            </div>
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
              Being eligible or waiting in standby does not provide policy access. Access begins only after activation, and payment never changes provider order or consumer presentation.
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-7xl space-y-24 px-4 py-20 sm:px-6 lg:px-8">
        <section>
          <div className="mx-auto mb-10 max-w-3xl text-center">
            <p className="font-mono text-xs font-bold uppercase tracking-wider text-emerald-700">How participation works</p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight">One governed path from verification to connection</h2>
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

        <section className="grid overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl lg:grid-cols-2">
          <div className="p-8 sm:p-10">
            <div className="flex items-center gap-2 text-emerald-700"><Eye className="h-5 w-5"/><span className="font-mono text-xs font-bold uppercase tracking-wider">What activated providers receive</span></div>
            <ul className="mt-6 space-y-4 text-sm text-slate-700">
              {['Verified coverage baseline and relevant authorized risk facts', 'Submission-window status and your organization’s own offer history', 'Factual validation and immutable offer-version evidence', 'Consumer-authorized connection after selection'].map(item => <li key={item} className="flex gap-3"><Check className="h-5 w-5 shrink-0 text-emerald-600"/>{item}</li>)}
            </ul>
          </div>
          <div className="bg-slate-950 p-8 text-white sm:p-10">
            <div className="flex items-center gap-2 text-rose-300"><Lock className="h-5 w-5"/><span className="font-mono text-xs font-bold uppercase tracking-wider">What Open Policy withholds</span></div>
            <ul className="mt-6 space-y-4 text-sm text-slate-300">
              {['Consumer contact information before authorized connection', 'Other providers’ identities, prices, terms, or activity', 'Consumer decline reasons and pricing signals', 'Preferential position purchased through a commercial plan'].map(item => <li key={item} className="flex gap-3"><X className="h-5 w-5 shrink-0 text-rose-400"/>{item}</li>)}
            </ul>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <article className="rounded-2xl border border-slate-200 bg-white p-7"><Users className="h-7 w-7 text-emerald-600"/><h3 className="mt-4 text-lg font-bold">Consumer-controlled cohorts</h3><p className="mt-2 text-sm leading-6 text-slate-600">Providers enter a stable operational sequence. Additional groups activate only when the consumer requests more offers while the window remains open.</p></article>
          <article className="rounded-2xl border border-slate-200 bg-white p-7"><FileCheck2 className="h-7 w-7 text-emerald-600"/><h3 className="mt-4 text-lg font-bold">Documented offers</h3><p className="mt-2 text-sm leading-6 text-slate-600">Each offer carries its own provider documentation and immutable version history. Open Policy presents factual differences without making the consumer’s decision.</p></article>
          <article className="rounded-2xl border border-slate-200 bg-white p-7"><ShieldCheck className="h-7 w-7 text-emerald-600"/><h3 className="mt-4 text-lg font-bold">Provider-owned transaction</h3><p className="mt-2 text-sm leading-6 text-slate-600">After consumer-authorized connection, the licensed provider conducts application, underwriting, revised-term, binding, and issuance activity on its own channel.</p></article>
        </section>

        <section className="space-y-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="font-mono text-xs font-bold uppercase tracking-wider text-emerald-700">A different provider opportunity</p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight">From shared contact inquiry to verified policy opportunity</h2>
            <p className="mt-4 text-sm leading-6 text-slate-600">Open Policy is not a contact list. It organizes a consumer-authorized opportunity around policy evidence, provider authority, documented offers, factual comparison, and a deliberate connection chosen by the consumer.</p>
          </div>
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
            <div className="grid grid-cols-[minmax(8rem,.65fr)_1fr_1fr] border-b border-slate-200 bg-slate-100 text-xs font-bold sm:text-sm">
              <div className="p-4 sm:p-5">Provider consideration</div>
              <div className="border-l border-slate-200 p-4 text-slate-600 sm:p-5">Conventional shared-contact model</div>
              <div className="border-l border-emerald-200 bg-emerald-50 p-4 text-emerald-900 sm:p-5">Open Policy</div>
            </div>
            {[
              ['Consumer readiness', 'An inquiry may arrive before the consumer has organized current-policy information.', 'The consumer has shared a current policy and confirmed the extracted coverage baseline.'],
              ['Opportunity information', 'Information may be limited to contact details and a short questionnaire.', 'An activated provider reviews authorized policy facts and relevant risk information without receiving early contact access.'],
              ['Provider access', 'The same inquiry may be distributed broadly and immediately.', 'Access is limited by organization status, licensing, carrier authority, jurisdiction, insurance line, capacity, and cohort activation.'],
              ['Offer process', 'Follow-up begins with calls, messages, or separate intake before a documented offer exists.', 'The provider independently prepares and submits its own documented offer during the open window.'],
              ['Consumer review', 'The consumer may have to assemble and compare responses across separate channels.', 'Open Policy displays factual price and coverage differences against the verified existing-policy baseline.'],
              ['Connection', 'Contact information may be distributed before the consumer chooses a provider.', 'Identity and connection details are disclosed only after the consumer selects an offer and authorizes the handoff.'],
              ['After selection', 'The handoff path and evidence may vary by source.', 'The licensed provider conducts the subsequent insurance transaction on its own channel while Open Policy preserves selection, consent, and reconciliation evidence.']
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
            <div><p className="font-mono text-xs uppercase tracking-wider text-emerald-400">What the opportunity represents</p><h2 className="mt-3 text-3xl font-extrabold">A governed path to earn a consumer-authorized connection.</h2><p className="mt-4 text-sm leading-6 text-slate-300">Providers do not purchase the consumer’s decision. They receive a controlled opportunity to evaluate verified policy information, determine what they can offer, document it, and be considered on the facts.</p></div>
            <div className="grid gap-3 sm:grid-cols-2">
              {['Verified existing-policy baseline', 'Authorized policy and risk facts', 'Independent documented offer', 'Factual consumer comparison', 'Consumer-controlled continuation', 'Consumer-authorized provider connection'].map(item => (
                <div key={item} className="flex items-start gap-3 rounded-2xl border border-slate-700 bg-slate-950 p-4 text-sm text-slate-200"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400"/><span>{item}</span></div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-8 text-center sm:p-12">
          <h2 className="text-3xl font-extrabold">Ready to establish your provider account?</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-600">Create the organization account, submit provider information, and enter verification. Opportunity access stays closed until the applicable authority checks pass.</p>
          <button onClick={startProvider} className="mt-7 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-6 py-3.5 text-sm font-bold text-white hover:bg-slate-800">Start provider onboarding <ArrowRight className="h-4 w-4"/></button>
        </section>
      </main>
    </div>
  );
};

