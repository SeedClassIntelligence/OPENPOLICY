import React from 'react';
import { ArrowRight, Building2, GitCompareArrows, LockKeyhole, ShieldCheck, Users } from 'lucide-react';

const go = (path: string) => {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

export const HomePage: React.FC = () => (
  <div className="bg-white text-slate-950">
    <section className="relative overflow-hidden bg-slate-950 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_25%,rgba(16,185,129,.2),transparent_34%),radial-gradient(circle_at_80%_70%,rgba(37,99,235,.16),transparent_32%)]" />
      <div className="relative mx-auto max-w-7xl px-5 py-20 lg:py-28">
        <p className="text-xs font-mono font-bold uppercase tracking-[.24em] text-emerald-400">The private insurance competition marketplace</p>
        <h1 className="mt-6 max-w-6xl text-4xl font-black tracking-tight md:text-6xl lg:text-7xl">One consumer-controlled request. <span className="text-emerald-400">A market of eligible providers.</span></h1>
        <p className="mt-7 max-w-4xl text-lg leading-8 text-slate-300 md:text-xl">Open Polici gives consumers one private place to bring the insurance they have—or define the insurance they need—then lets eligible providers compete before personal contact information is disclosed.</p>
        <div className="mt-9 flex flex-wrap gap-3">
          <button onClick={() => go('/consumers')} className="inline-flex items-center gap-2 rounded-xl bg-emerald-400 px-5 py-3 font-black text-slate-950">Explore as a consumer <ArrowRight className="h-4 w-4" /></button>
          <button onClick={() => go('/providers')} className="rounded-xl border border-slate-600 px-5 py-3 font-bold text-white">Explore as a provider or carrier</button>
        </div>
      </div>
    </section>

    <section className="mx-auto max-w-7xl px-5 py-20">
      <div className="grid gap-6 lg:grid-cols-2">
        <article className="rounded-3xl border border-emerald-200 bg-emerald-50/50 p-8">
          <Users className="h-9 w-9 text-emerald-700" />
          <p className="mt-6 text-xs font-mono font-bold uppercase tracking-wider text-emerald-700">For consumers</p>
          <h2 className="mt-3 text-3xl font-black">Shop without becoming a shared lead.</h2>
          <p className="mt-4 leading-7 text-slate-600">Upload an existing policy or create a consumer-defined coverage request. Review documented provider offers privately. Choose which provider may receive your information.</p>
          <button onClick={() => go('/consumers')} className="mt-7 inline-flex items-center gap-2 font-black text-emerald-800">Open the consumer experience <ArrowRight className="h-4 w-4" /></button>
        </article>
        <article className="rounded-3xl border border-blue-200 bg-blue-50/50 p-8">
          <Building2 className="h-9 w-9 text-blue-700" />
          <p className="mt-6 text-xs font-mono font-bold uppercase tracking-wider text-blue-700">For providers and carriers</p>
          <h2 className="mt-3 text-3xl font-black">Compete for structured, consumer-initiated demand.</h2>
          <p className="mt-4 leading-7 text-slate-600">Configure appetite, review eligible opportunities, submit documented offers, manage producer capacity, and receive an actionable connection only after consumer authorization.</p>
          <button onClick={() => go('/providers')} className="mt-7 inline-flex items-center gap-2 font-black text-blue-800">Open the provider marketplace <ArrowRight className="h-4 w-4" /></button>
        </article>
      </div>
    </section>

    <section className="border-y border-slate-200 bg-slate-50 py-20">
      <div className="mx-auto max-w-7xl px-5">
        <div className="max-w-4xl"><p className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500">How the platform changes the sequence</p><h2 className="mt-3 text-3xl font-black md:text-5xl">Competition first. Contact second.</h2></div>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {[
            [LockKeyhole, 'Private baseline', 'The consumer establishes one preserved request without broadcasting direct contact information.'],
            [GitCompareArrows, 'Documented competition', 'Eligible providers answer the same baseline and factual differences remain visible.'],
            [ShieldCheck, 'Controlled connection', 'The consumer chooses an offer and explicitly authorizes the selected provider connection.']
          ].map(([Icon, title, text]) => { const I = Icon as React.ComponentType<{className?: string}>; return <article key={String(title)} className="rounded-2xl border border-slate-200 bg-white p-6"><I className="h-7 w-7 text-emerald-700" /><h3 className="mt-4 text-xl font-black">{String(title)}</h3><p className="mt-3 text-sm leading-6 text-slate-600">{String(text)}</p></article>; })}
        </div>
        <div className="mt-10 text-center"><button onClick={() => go('/insurance-comparison')} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-3 font-bold text-white">See the full industry comparison <ArrowRight className="h-4 w-4" /></button></div>
      </div>
    </section>
  </div>
);
