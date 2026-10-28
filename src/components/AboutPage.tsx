import React from 'react';
import { ArrowRight, Building2, CheckCircle2, Eye, Lock, Scale, ShieldCheck, Users } from 'lucide-react';

const go = (path: string) => {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

export const AboutPage: React.FC = () => (
  <div className="bg-white">
    <section className="bg-slate-950 text-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-5 py-20 lg:py-28 grid lg:grid-cols-[1.15fr_.85fr] gap-12 items-center">
        <div>
          <p className="text-emerald-400 text-xs font-mono font-bold uppercase tracking-[.22em]">About Open Polici</p>
          <h1 className="mt-5 text-4xl md:text-6xl font-black tracking-tight leading-[1.05]">Insurance shopping built around your permission.</h1>
          <p className="mt-6 text-lg text-slate-300 leading-8 max-w-3xl">Open Polici gives consumers a private place to define what they need, receive documented offers from eligible providers, compare factual differences, and decide who receives their contact information.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button onClick={() => go('/consumers')} className="px-5 py-3 bg-emerald-400 text-slate-950 font-bold rounded-xl inline-flex items-center gap-2">Explore the consumer experience <ArrowRight className="w-4 h-4" /></button>
            <button onClick={() => go('/providers')} className="px-5 py-3 border border-slate-700 text-white font-semibold rounded-xl">Providers and carriers</button>
          </div>
        </div>
        <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-7 shadow-2xl">
          <p className="text-sm font-bold text-white">The Open Polici sequence</p>
          <div className="mt-5 space-y-4">
            {['Consumer establishes the baseline', 'Eligible providers develop their own offers', 'Open Polici organizes factual differences', 'Consumer selects and authorizes one connection'].map((item, index) => (
              <div key={item} className="flex gap-3 items-start"><span className="w-7 h-7 shrink-0 rounded-full bg-emerald-400 text-slate-950 grid place-items-center text-xs font-black">{index + 1}</span><span className="text-sm text-slate-200 pt-1">{item}</span></div>
            ))}
          </div>
        </div>
      </div>
    </section>

    <section className="max-w-7xl mx-auto px-5 py-20">
      <div className="max-w-3xl">
        <p className="text-emerald-700 text-xs font-mono font-bold uppercase tracking-wider">Why we exist</p>
        <h2 className="mt-3 text-3xl md:text-4xl font-black text-slate-950">The consumer should see the offer before becoming the lead.</h2>
        <p className="mt-5 text-slate-600 leading-7">Traditional quote forms often begin by distributing personal contact information. Open Polici reverses that order. The marketplace begins with a coverage baseline and keeps direct identity sealed while providers determine whether they can respond. The consumer reviews first, chooses second, and authorizes disclosure last.</p>
      </div>
      <div className="mt-12 grid md:grid-cols-2 lg:grid-cols-4 gap-5">
        {[
          [Lock, 'Consumer-controlled disclosure', 'Contact information remains private until the consumer explicitly authorizes a selected provider.'],
          [Scale, 'Factual comparison', 'Premiums, limits, deductibles, inclusions, exclusions, and documented differences are organized without suitability scoring.'],
          [ShieldCheck, 'Separate authority controls', 'Licensing, jurisdiction, producer authority, carrier relationships, marketplace access, and payment are evaluated separately.'],
          [Eye, 'Traceable activity', 'Competition, consent, disclosure, connections, and commercial records are retained as distinct evidence.']
        ].map(([Icon, title, body]) => {
          const I = Icon as typeof Lock;
          return <article key={title as string} className="rounded-2xl border border-slate-200 p-6 bg-slate-50"><I className="w-6 h-6 text-emerald-600" /><h3 className="mt-4 font-bold text-slate-950">{title as string}</h3><p className="mt-2 text-sm text-slate-600 leading-6">{body as string}</p></article>;
        })}
      </div>
    </section>

    <section className="bg-slate-50 border-y border-slate-200">
      <div className="max-w-7xl mx-auto px-5 py-20 grid lg:grid-cols-2 gap-12">
        <div><Building2 className="w-8 h-8 text-blue-600" /><h2 className="mt-4 text-3xl font-black">One marketplace. Two sides with clear roles.</h2><p className="mt-4 text-slate-600 leading-7">Consumers control their baseline, selection, and disclosure. Licensed providers control the insurance products they are willing and authorized to offer. Open Polici supplies the governed workspace that connects those decisions.</p></div>
        <div className="space-y-4">
          {['Consumers use Open Polici at no cost.', 'Providers purchase marketplace membership and operating capacity.', 'Commercial payment never creates insurance authority or preferential placement.', 'A marketplace transaction is billable only when the qualifying authorized connection conditions are satisfied.'].map(x => <div key={x} className="flex gap-3 rounded-xl bg-white border border-slate-200 p-4"><CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" /><p className="text-sm text-slate-700">{x}</p></div>)}
        </div>
      </div>
    </section>

    <section className="max-w-5xl mx-auto px-5 py-20 text-center">
      <Users className="w-9 h-9 text-emerald-600 mx-auto" /><h2 className="mt-4 text-3xl font-black">Built first for Nevada, designed for governed expansion.</h2><p className="mt-4 text-slate-600 leading-7">Open Polici’s initial market is Nevada. Insurance-line availability, regulatory rules, provider authority, and document-processing readiness are independently controlled so expansion never silently inherits assumptions from another state or product line.</p>
      <button onClick={() => go('/insurance-comparison')} className="mt-7 px-5 py-3 bg-slate-950 text-white rounded-xl font-bold inline-flex gap-2 items-center">See the industry comparison <ArrowRight className="w-4 h-4" /></button>
    </section>
  </div>
);
