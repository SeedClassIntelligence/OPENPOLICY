import React, { useState } from 'react';
import { ArrowRight, Check, ChevronDown, FileText, Lock, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { landingCopy } from '../copy/landing';

interface LandingPageProps {
  onNavigateConsumer: () => void;
  onNavigateProvider: () => void;
  onNavigateAdmin: () => void;
  onNavigateTelemetry: () => void;
  onNavigateArchitecture: () => void;
}

const fieldClass = 'w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100';

export const LandingPage: React.FC<LandingPageProps> = ({ onNavigateConsumer, onNavigateProvider }) => {
  const { isAuthenticated, userRole, signUpAsConsumer, signUpAsProvider } = useAuth();
  const [role, setRole] = useState<'CONSUMER' | 'PROVIDER'>('CONSUMER');
  const [consumer, setConsumer] = useState({ name: '', email: '', password: '', carrier: '' });
  const [provider, setProvider] = useState({ name: '', agency: '', license: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const goToSignup = (nextRole: 'CONSUMER' | 'PROVIDER') => {
    if (isAuthenticated && userRole === nextRole) {
      nextRole === 'CONSUMER' ? onNavigateConsumer() : onNavigateProvider();
      return;
    }
    setRole(nextRole);
    document.getElementById('create-account')?.scrollIntoView({ behavior: 'smooth' });
  };

  const submitConsumer = async (event: React.FormEvent) => {
    event.preventDefault(); setError(null); setLoading(true);
    try {
      if (!consumer.name.trim()) throw new Error('Enter your full name.');
      await signUpAsConsumer(consumer.name, consumer.email, consumer.password, 'NV', consumer.carrier);
      onNavigateConsumer();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Account creation was unsuccessful.'); }
    finally { setLoading(false); }
  };

  const submitProvider = async (event: React.FormEvent) => {
    event.preventDefault(); setError(null); setLoading(true);
    try {
      if (!provider.name.trim() || !provider.agency.trim() || !provider.license.trim()) throw new Error('Complete the provider identity and license fields.');
      await signUpAsProvider(provider.name, provider.agency, provider.license, 'NV', provider.email, provider.password);
      onNavigateProvider();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Provider application was unsuccessful.'); }
    finally { setLoading(false); }
  };

  const exampleRows = [
    ['Bodily injury', '$100k / $300k', 'Same', 'Same'],
    ['Property damage', '$100k', 'Same', 'Same'],
    ['Collision deductible', '$500', 'Same', '$1,000 (higher)'],
    ['Roadside assistance', 'Included', 'Included', 'Not included'],
    ['Annual premium', '$2,560', '$2,270 ($290 lower)', '$2,140 ($420 lower)'],
    ['Label', '—', 'Matches your current coverage', 'Changes your current coverage'],
  ];

  return <main className="bg-white text-slate-950">
    <section className="relative overflow-hidden bg-slate-950 px-6 py-20 text-white sm:py-28">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#064e3b55,transparent_55%)]" />
      <div className="relative mx-auto max-w-6xl">
        <p className="mb-5 font-mono text-xs uppercase tracking-[0.25em] text-emerald-300">{landingCopy.hero.kicker}</p>
        <h1 className="max-w-4xl text-4xl font-black leading-tight sm:text-6xl">{landingCopy.hero.title}</h1>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-300">{landingCopy.hero.body}</p>
        <div className="mt-9 flex flex-wrap gap-3">
          <button onClick={() => goToSignup('CONSUMER')} className="rounded-xl bg-emerald-400 px-6 py-3 font-bold text-slate-950">Share My Policy</button>
          <button onClick={() => goToSignup('PROVIDER')} className="rounded-xl border border-slate-600 px-6 py-3 font-bold">For Insurance Providers</button>
          <button onClick={() => goToSignup('CONSUMER')} className="rounded-xl border border-slate-600 px-6 py-3 font-bold">Create Account</button>
        </div>
        <div className="mt-12 grid gap-4 border-t border-slate-800 pt-7 text-sm text-slate-300 sm:grid-cols-4">
          {['You decide', 'Contact details shared only with the provider you choose', 'Offers shown side by side', 'Key actions logged in a tamper-evident record'].map(item => <div key={item} className="flex gap-2"><Check className="h-5 w-5 shrink-0 text-emerald-400" />{item}</div>)}
        </div>
      </div>
    </section>

    <section className="mx-auto max-w-6xl px-6 py-20">
      <p className="font-mono text-xs font-bold uppercase tracking-widest text-emerald-700">Example only</p>
      <h2 className="mt-3 text-3xl font-black">{landingCopy.comparison.title}</h2>
      <p className="mt-3 max-w-3xl text-slate-600">{landingCopy.comparison.body}</p>
      <div className="mt-8 overflow-x-auto rounded-2xl border border-slate-200 shadow-sm"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-slate-950 text-white"><tr><th className="p-4">Coverage detail</th><th className="p-4">Your current policy</th><th className="p-4">Offer A</th><th className="p-4">Offer B</th></tr></thead><tbody className="divide-y divide-slate-200">{exampleRows.map(row => <tr key={row[0]}>{row.map((cell, index) => <td key={`${row[0]}-${index}`} className={`p-4 ${index === 0 ? 'font-semibold' : ''}`}>{cell}</td>)}</tr>)}</tbody></table></div>
      <p className="mt-4 font-semibold text-slate-700">{landingCopy.comparison.note}</p>
      <button onClick={() => goToSignup('CONSUMER')} className="mt-6 inline-flex items-center gap-2 font-bold text-emerald-700">Share My Policy <ArrowRight className="h-4 w-4" /></button>
    </section>

    <section id="create-account" className="bg-slate-100 px-6 py-20"><div className="mx-auto max-w-6xl">
      <h2 className="text-3xl font-black">{landingCopy.signup.title}</h2><p className="mt-3 max-w-3xl text-slate-600">{landingCopy.signup.body}</p>
      <div className="mt-8 inline-flex rounded-xl border border-slate-300 bg-white p-1"><button onClick={() => setRole('CONSUMER')} className={`rounded-lg px-5 py-2 text-sm font-bold ${role === 'CONSUMER' ? 'bg-slate-950 text-white' : ''}`}>Policyholder</button><button onClick={() => setRole('PROVIDER')} className={`rounded-lg px-5 py-2 text-sm font-bold ${role === 'PROVIDER' ? 'bg-slate-950 text-white' : ''}`}>Insurance provider</button></div>
      <div className="mt-6 grid gap-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:grid-cols-[1.1fr_.9fr] lg:p-10">
        {role === 'CONSUMER' ? <form onSubmit={submitConsumer} className="space-y-4">
          <div><p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Policyholder sign-up</p><h3 className="mt-2 text-2xl font-black">Share your policy. Review offers.</h3><p className="mt-1 text-sm text-slate-600">No charge to policyholders.</p></div>
          <input className={fieldClass} aria-label="Full name" placeholder="Full name" value={consumer.name} onChange={e => setConsumer({ ...consumer, name: e.target.value })} required />
          <input className={fieldClass} type="email" aria-label="Email" placeholder="Email" value={consumer.email} onChange={e => setConsumer({ ...consumer, email: e.target.value })} required />
          <select className={fieldClass} aria-label="State" value="NV" disabled><option value="NV">Nevada</option></select>
          <input className={fieldClass} aria-label="Current insurance company" placeholder="Current insurance company (optional)" value={consumer.carrier} onChange={e => setConsumer({ ...consumer, carrier: e.target.value })} />
          <input className={fieldClass} type="password" aria-label="Password" placeholder="Password" value={consumer.password} onChange={e => setConsumer({ ...consumer, password: e.target.value })} required />
          <div className="flex gap-3 rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-600"><Lock className="mt-1 h-5 w-5 shrink-0 text-emerald-700" />Providers reviewing your policy see coverage details, not your name, phone number, email or address. Contact details are shared only with the provider you choose, after you approve.</div>
          {error && <p role="alert" className="text-sm font-semibold text-red-700">{error}</p>}<button disabled={loading} className="w-full rounded-xl bg-emerald-500 px-5 py-3 font-bold text-slate-950 disabled:opacity-50">{loading ? 'Creating account…' : 'Create account and share my policy'}</button>
        </form> : <form onSubmit={submitProvider} className="space-y-4">
          <div><p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Provider access</p><h3 className="mt-2 text-2xl font-black">Apply for provider access</h3><p className="mt-1 text-sm text-slate-600">Active Nevada license required.</p></div>
          <input className={fieldClass} aria-label="Licensed agent name" placeholder="Licensed agent name" value={provider.name} onChange={e => setProvider({ ...provider, name: e.target.value })} required />
          <input className={fieldClass} aria-label="Agency legal name" placeholder="Agency or company legal name" value={provider.agency} onChange={e => setProvider({ ...provider, agency: e.target.value })} required />
          <select className={fieldClass} aria-label="License state" value="NV" disabled><option value="NV">Nevada</option></select>
          <input className={fieldClass} aria-label="License number" placeholder="License number" value={provider.license} onChange={e => setProvider({ ...provider, license: e.target.value })} required />
          <input className={fieldClass} type="email" aria-label="Work email" placeholder="Work email" value={provider.email} onChange={e => setProvider({ ...provider, email: e.target.value })} required />
          <input className={fieldClass} type="password" aria-label="Password" placeholder="Password" value={provider.password} onChange={e => setProvider({ ...provider, password: e.target.value })} required />
          <div className="rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">Providers must supply the licenses and carrier authorizations required for the coverage they present and accept the provider terms. Open Policy does not issue insurance or set provider prices or coverage.</div>
          {error && <p role="alert" className="text-sm font-semibold text-red-700">{error}</p>}<button disabled={loading} className="w-full rounded-xl bg-emerald-500 px-5 py-3 font-bold text-slate-950 disabled:opacity-50">{loading ? 'Submitting application…' : 'Apply for provider access'}</button>
        </form>}
        <aside className="rounded-2xl bg-slate-950 p-7 text-white"><h4 className="text-xl font-black">{role === 'CONSUMER' ? 'What happens next' : 'What providers get'}</h4><ol className="mt-6 space-y-6">{(role === 'CONSUMER' ? [
          ['Share your policy', 'Upload your declarations page. Review, confirm or correct what Open Policy found before sharing.'], ['Providers review', 'Eligible providers review coverage details and decide whether to send an offer.'], ['You decide', 'Compare offers, keep your current policy, or choose a provider.'],
        ] : [['Documented coverage details', 'Review information read from a policyholder’s actual declarations page.'], ['Offers on your terms', 'You submit your own price and coverage. Open Policy does not set them.'], ['Contact details after approval', 'Contact details are released only after the policyholder chooses your offer and approves sharing.']]).map(([title, body], index) => <li key={title} className="flex gap-4"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-400 font-black text-slate-950">{index + 1}</span><div><p className="font-bold">{title}</p><p className="mt-1 text-sm leading-6 text-slate-300">{body}</p></div></li>)}</ol>{role === 'PROVIDER' && <p className="mt-7 border-t border-slate-700 pt-6 text-sm text-slate-300">You see the status of your own offers. You do not see other providers’ names or prices.</p>}</aside>
      </div>
    </div></section>

    <section className="mx-auto max-w-6xl px-6 py-20"><h2 className="text-3xl font-black">What Open Policy does, and what it does not</h2><div className="mt-8 grid gap-6 md:grid-cols-2">
      <InfoCard title="Open Policy does" positive items={['Read your declarations page and show you what it found', 'Share coverage details, not contact details, with eligible providers', 'Show offers side by side with every difference listed', 'Apply the requirements you set', 'Share contact details with the provider you choose after approval', 'Keep a tamper-evident record of key actions']} />
      <InfoCard title="Open Policy does not" items={['Sell or issue insurance', 'Set or change provider prices or coverage', 'Favor any provider or offer', 'Prepare or submit insurance applications', 'Charge policyholders']} />
    </div><p className="mt-5 text-sm text-slate-600">Insurance is offered and issued by providers with the required authority.</p></section>

    <section className="bg-slate-950 px-6 py-20 text-white"><div className="mx-auto max-w-6xl"><h2 className="text-3xl font-black">How it works</h2><div className="mt-9 grid gap-5 md:grid-cols-4">{[
      ['1. Share', 'Share your policy.', 'Upload your declarations page or renewal notice. Review and confirm what Open Policy found before sharing.'], ['2. Providers review', 'Coverage details only.', 'Eligible providers can review the shared coverage details. Each provider decides whether to send an offer.'], ['3. Compare', 'See each difference.', 'Compare price, limits, deductibles and add-ons against the requirements you set.'], ['4. You decide', 'Keep it or choose.', 'Keep your current policy or approve contact sharing with the provider whose offer you choose.'],
    ].map(([eyebrow, title, body]) => <article key={eyebrow} className="rounded-2xl border border-slate-700 p-6"><p className="text-xs font-bold uppercase tracking-wider text-emerald-300">{eyebrow}</p><h3 className="mt-3 text-xl font-black">{title}</h3><p className="mt-3 text-sm leading-6 text-slate-300">{body}</p></article>)}</div></div></section>

    <section className="mx-auto max-w-6xl px-6 py-20"><h2 className="text-3xl font-black">What you can count on</h2><div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">{landingCopy.commitments.map(([title, body]) => <article key={title} className="rounded-2xl border border-slate-200 p-6"><ShieldCheck className="h-7 w-7 text-emerald-600" /><h3 className="mt-4 text-lg font-black">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{body}</p></article>)}</div></section>

    <section className="bg-slate-100 px-6 py-20"><div className="mx-auto max-w-6xl"><h2 className="text-3xl font-black">Where to start</h2><div className="mt-8 grid gap-6 md:grid-cols-2">{[['For policyholders', 'Share a policy and review offers.', 'Share My Policy', 'CONSUMER'], ['For insurance providers', 'Apply for access to review shared policies and send offers.', 'Apply for Provider Access', 'PROVIDER']].map(([title, body, label, target]) => <article key={title} className="rounded-2xl bg-white p-7 shadow-sm"><FileText className="h-8 w-8 text-emerald-600" /><h3 className="mt-4 text-2xl font-black">{title}</h3><p className="mt-2 text-slate-600">{body}</p><button onClick={() => goToSignup(target as 'CONSUMER' | 'PROVIDER')} className="mt-6 inline-flex items-center gap-2 font-bold text-emerald-700">{label}<ArrowRight className="h-4 w-4" /></button></article>)}</div></div></section>

    <section className="mx-auto max-w-4xl px-6 py-20"><h2 className="text-3xl font-black">Questions and answers</h2><div className="mt-8 divide-y divide-slate-200 border-y border-slate-200">{landingCopy.faqs.map(([question, answer], index) => <article key={question}><button onClick={() => setOpenFaq(openFaq === index ? null : index)} className="flex w-full items-center justify-between gap-6 py-5 text-left font-bold"><span>{question}</span><ChevronDown className={`h-5 w-5 shrink-0 transition ${openFaq === index ? 'rotate-180' : ''}`} /></button>{openFaq === index && <p className="pb-6 leading-7 text-slate-600">{answer}</p>}</article>)}</div></section>

    <section className="bg-emerald-400 px-6 py-16 text-slate-950"><div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 md:flex-row md:items-center"><div><h2 className="text-3xl font-black">Ready to see what providers offer?</h2><p className="mt-2">Share your current policy and review what providers send you. You decide.</p></div><button onClick={() => goToSignup('CONSUMER')} className="shrink-0 rounded-xl bg-slate-950 px-6 py-3 font-bold text-white">Share My Policy</button></div></section>
    <footer className="bg-slate-950 px-6 py-12 text-slate-300"><div className="mx-auto max-w-6xl"><div className="grid gap-8 md:grid-cols-[1.4fr_1fr]"><div><p className="text-lg font-black text-white">OPEN POLICY</p><p className="mt-1 text-sm text-emerald-300">Policy review platform</p><p className="mt-4 max-w-2xl text-sm leading-6">Open Policy is a technology platform. It does not sell or issue insurance, set provider prices, or tell policyholders which provider to choose. Insurance is offered and issued by providers with the required authority. Currently available in Nevada for personal auto.</p></div><div><div className="flex flex-wrap gap-2 text-xs"><span className="rounded-full border border-slate-700 px-3 py-1">Nevada · Personal auto</span><span className="rounded-full border border-slate-700 px-3 py-1">No charge to policyholders</span></div><nav className="mt-5 flex flex-wrap gap-4 text-sm"><a href="#" className="hover:text-white">Terms</a><a href="#" className="hover:text-white">Privacy</a><a href="#" className="hover:text-white">Provider terms</a><a href="https://doi.nv.gov/Licensing/License_Lookup/" target="_blank" rel="noreferrer" className="hover:text-white">Nevada license lookup</a></nav></div></div><p className="mt-10 border-t border-slate-800 pt-6 text-xs text-slate-500">© 2026 Open Policy</p></div></footer>
  </main>;
};

const InfoCard = ({ title, items, positive = false }: { title: string; items: string[]; positive?: boolean }) => <div className={`rounded-2xl border p-6 ${positive ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}><h3 className="text-xl font-black">{title}</h3><ul className="mt-5 space-y-3 text-sm">{items.map(item => <li key={item} className="flex gap-2">{positive ? <Check className="h-5 w-5 shrink-0 text-emerald-700" /> : <span className="font-black text-slate-400">—</span>}{item}</li>)}</ul></div>;
