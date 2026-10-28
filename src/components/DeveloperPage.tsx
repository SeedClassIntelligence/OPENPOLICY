import React from 'react';
import { ArrowRight, Braces, Database, KeyRound, LockKeyhole, ShieldCheck, Workflow } from 'lucide-react';

const surfaces = [
  {
    icon: Workflow,
    title: 'Marketplace lifecycle',
    text: 'Consumer intake, structured baselines, provider eligibility, offer submission, selection, consent, controlled disclosure, and reconciliation operate as one traceable lifecycle.'
  },
  {
    icon: ShieldCheck,
    title: 'Governed provider access',
    text: 'Organization authority, producer authority, insurance-line eligibility, carrier relationships, and appointment requirements remain separate, fail-closed checks.'
  },
  {
    icon: Database,
    title: 'Durable evidence',
    text: 'Business records, immutable audit events, idempotency controls, and financial evidence are designed to remain traceable across operational handoffs.'
  },
  {
    icon: LockKeyhole,
    title: 'Controlled disclosure',
    text: 'Consumer identity and contact information are not released to every participant. Disclosure follows an explicit consumer selection and authorization event.'
  }
];

export const DeveloperPage: React.FC = () => (
  <div className="min-h-screen bg-slate-950 text-white">
    <section className="border-b border-slate-800 bg-[radial-gradient(circle_at_top_right,_rgba(16,185,129,0.16),_transparent_42%)]">
      <div className="mx-auto max-w-7xl px-6 py-20 lg:px-8 lg:py-28">
        <p className="font-mono text-xs font-bold uppercase tracking-[0.24em] text-emerald-400">Open Polici Developers</p>
        <h1 className="mt-5 max-w-4xl text-4xl font-black tracking-tight sm:text-6xl">Build against a governed insurance marketplace—not an unstructured lead feed.</h1>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-300">Open Polici’s integration architecture connects consumer-controlled insurance requests, eligible provider organizations, documented competition, controlled disclosure, and Commercial V2 accountability without collapsing regulatory or tenant boundaries.</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <a href="mailto:developers@openpolici.com" className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-emerald-400">Request developer access <ArrowRight className="h-4 w-4" /></a>
          <a href="/insurance-comparison" className="rounded-xl border border-slate-700 px-5 py-3 text-sm font-bold text-white transition hover:border-slate-500 hover:bg-slate-900">Review the marketplace model</a>
        </div>
      </div>
    </section>

    <section className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
      <div className="grid gap-5 md:grid-cols-2">
        {surfaces.map(({ icon: Icon, title, text }) => (
          <article key={title} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <Icon className="h-6 w-6 text-emerald-400" />
            <h2 className="mt-4 text-xl font-bold">{title}</h2>
            <p className="mt-3 text-sm leading-7 text-slate-300">{text}</p>
          </article>
        ))}
      </div>
    </section>

    <section className="border-y border-slate-800 bg-slate-900/50">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-16 lg:grid-cols-2 lg:px-8">
        <div>
          <div className="flex items-center gap-3"><Braces className="h-6 w-6 text-emerald-400" /><h2 className="text-2xl font-black">Integration boundaries</h2></div>
          <ul className="mt-6 space-y-4 text-sm leading-7 text-slate-300">
            <li><strong className="text-white">Authentication:</strong> consumer, provider, producer, and owner roles enter distinct authorized workspaces.</li>
            <li><strong className="text-white">Tenant isolation:</strong> provider organizations may access only opportunities and records authorized for their organization.</li>
            <li><strong className="text-white">Idempotency:</strong> marketplace and commercial events are protected against duplicate mutation.</li>
            <li><strong className="text-white">Jurisdiction gates:</strong> an insurance line is unavailable until its regulatory, ingestion, provider-authority, and operational gates are satisfied.</li>
          </ul>
        </div>
        <div className="rounded-2xl border border-emerald-900/80 bg-emerald-950/30 p-7">
          <div className="flex items-center gap-3"><KeyRound className="h-6 w-6 text-emerald-400" /><h2 className="text-2xl font-black">Developer access status</h2></div>
          <p className="mt-5 text-sm leading-7 text-slate-300">Developer and integration access is controlled. Public API credentials are not issued from this page. Approved partners receive environment-specific access, documentation, scopes, and test data through the governed onboarding process.</p>
          <p className="mt-4 text-sm leading-7 text-slate-300">Internal telemetry, architecture tests, and owner operations remain restricted to authenticated administrative users.</p>
        </div>
      </div>
    </section>
  </div>
);
