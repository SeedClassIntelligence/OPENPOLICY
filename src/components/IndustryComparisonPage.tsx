import React from 'react';
import {
  ArrowRight, BadgeCheck, Building2, Check, CircleDollarSign, EyeOff,
  GitCompareArrows, Landmark, LockKeyhole, Network, PhoneCall, Scale,
  ShieldCheck, Users
} from 'lucide-react';

const go = (path: string) => {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

const legacyFlow = [
  ['01', 'Enter personal information', 'A consumer starts by identifying themselves and completing a quote or lead form.'],
  ['02', 'Get matched or redirected', 'The platform may return quotes, route the request, display paid placements, or connect the consumer to agents and carriers.'],
  ['03', 'Repeat the buying process', 'Different providers may require new forms, follow-up calls, or separate underwriting conversations.'],
  ['04', 'Reconstruct the comparison', 'The consumer is often left to determine whether a lower price also changed limits, deductibles, exclusions, or services.']
];

const policiFlow = [
  ['01', 'Build one consumer-controlled baseline', 'Upload existing policy evidence or define a new insurance request without Open Polici prescribing the coverage.'],
  ['02', 'Open private, eligibility-gated competition', 'Qualified providers decide whether the same anonymized opportunity fits their authority and appetite.'],
  ['03', 'Receive documented provider offers', 'Offers return to one private workspace and are organized against the same baseline.'],
  ['04', 'Choose first. Authorize disclosure second.', 'The consumer selects an offer before one chosen provider receives the authorized connection.']
];

const matrix = [
  ['Starting point', 'One company’s quote funnel', 'A consumer lead or match request', 'A human agent’s available markets', 'One consumer-controlled baseline'],
  ['Market access', 'One carrier', 'Participating or advertising partners', 'Carriers represented by that agency', 'Eligible providers admitted to the activated market'],
  ['Consumer identity', 'Known during quoting', 'Commonly collected during the match process', 'Known to the agent', 'Shielded during competition; disclosed only after authorization'],
  ['How options appear', 'That carrier’s products', 'Quotes, matches, ads, or partner handoffs', 'Agent-developed options', 'Provider-submitted offers against the same baseline'],
  ['Comparison discipline', 'Consumer compares elsewhere', 'Varies by platform and partner', 'Depends on agent process', 'Factual term-by-term differences with unknowns preserved'],
  ['Provider economics', 'Carrier acquisition and distribution cost', 'Lead, advertising, referral, commission, or partnership economics', 'Carrier commission and agency economics', 'Membership access plus one line-specific authorized connection'],
  ['Who controls the handoff', 'Carrier funnel', 'Platform and partner workflow', 'Agent relationship', 'Consumer’s explicit selection and consent'],
  ['Commercial influence', 'Carrier controls its own presentation', 'Partner inventory and placement models vary', 'Limited to represented markets', 'Payment cannot buy ranking, authority, or preference']
];

const benefits = [
  {
    label: 'For consumers', title: 'Stop becoming the product just to discover the price.', icon: Users, tone: 'emerald',
    points: [
      ['One starting point', 'Use the policy you already have or describe the insurance you need once.'],
      ['Private competition', 'Providers compete around the request before gaining direct access to you.'],
      ['A comparison you can inspect', 'See documented price and protection differences—not a bare premium detached from coverage.'],
      ['A controlled handoff', 'Choose the offer first, then authorize one provider to receive the connection.'],
      ['Free consumer access', 'Consumers do not pay Open Polici to create a baseline, receive offers, compare, or choose.']
    ]
  },
  {
    label: 'For providers and agencies', title: 'Compete for declared demand—not recycled contact data.', icon: Building2, tone: 'blue',
    points: [
      ['Consumer-initiated opportunities', 'Review structured needs created by people actively seeking or reconsidering insurance.'],
      ['Appetite control', 'Choose jurisdictions, insurance lines, capacity, and opportunity criteria instead of chasing every lead.'],
      ['A real operating desk', 'Manage opportunities, offers, producer seats, connections, capacity, membership, and account activity.'],
      ['Fair marketplace visibility', 'Commercial payment does not establish regulatory authority or purchase favorable ranking.'],
      ['Governed economics', 'Membership funds access and capacity; a connection charge occurs only at the defined consumer-authorized event.']
    ]
  },
  {
    label: 'For carriers and networks', title: 'Turn distribution into a governed demand channel.', icon: Landmark, tone: 'violet',
    points: [
      ['Structured market demand', 'See consistent opportunity data instead of fragmented, differently formatted referral intake.'],
      ['Controlled distribution', 'Align agencies, producer seats, authority, appointments, appetite, and capacity before participation.'],
      ['Cleaner market signals', 'Study submitted demand and competition outcomes without buying preferred placement.'],
      ['Auditable connections', 'Preserve selection, consent, disclosure, connection, billing, and reconciliation evidence.'],
      ['Enterprise administration', 'Use included reporting and multi-location controls where the Commercial V2 plan provides them.']
    ]
  }
];

export const IndustryComparisonPage: React.FC = () => (
  <div className="bg-white text-slate-950">
    <section className="relative overflow-hidden bg-slate-950 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(16,185,129,.20),transparent_32%),radial-gradient(circle_at_82%_70%,rgba(59,130,246,.15),transparent_30%)]" />
      <div className="relative max-w-7xl mx-auto px-5 py-20 lg:py-28">
        <p className="text-emerald-400 text-xs font-mono font-bold uppercase tracking-[.24em]">Insurance marketplace competitive analysis</p>
        <h1 className="mt-6 max-w-6xl text-4xl md:text-6xl lg:text-7xl font-black tracking-tight leading-[1.03]">Insurance shopping was built to distribute leads. <span className="text-emerald-400">Open Polici was built to organize competition.</span></h1>
        <p className="mt-7 text-lg md:text-xl text-slate-300 max-w-4xl leading-8">The prevailing system asks consumers to surrender their identity while they are still trying to understand their options. Open Polici reverses the order: establish the need, let eligible providers compete privately, compare the documented differences, then let the consumer authorize one connection.</p>
        <div className="mt-9 flex flex-wrap gap-3"><button onClick={() => go('/consumers')} className="px-5 py-3 bg-emerald-400 text-slate-950 font-black rounded-xl inline-flex items-center gap-2">See the consumer experience <ArrowRight className="w-4 h-4" /></button><button onClick={() => go('/providers')} className="px-5 py-3 border border-slate-600 text-white font-bold rounded-xl">See the provider marketplace</button></div>
        <div className="mt-14 grid sm:grid-cols-3 gap-3 max-w-5xl">{[
          ['Consumer control', 'Identity and disclosure move on the consumer’s decision.'],
          ['Provider competition', 'Eligible organizations compete against one consistent request.'],
          ['Commercial neutrality', 'Payment buys neither authority nor marketplace preference.']
        ].map(([title, text]) => <div key={title} className="rounded-2xl border border-white/10 bg-white/[.04] p-5"><Check className="w-5 h-5 text-emerald-400" /><h2 className="mt-3 font-black">{title}</h2><p className="mt-2 text-sm leading-6 text-slate-400">{text}</p></div>)}</div>
      </div>
    </section>

    <section className="max-w-7xl mx-auto px-5 py-20">
      <div className="grid lg:grid-cols-2 gap-12 items-end"><div><p className="text-rose-700 text-xs font-mono font-bold uppercase tracking-wider">The inherited model</p><h2 className="mt-3 text-3xl md:text-5xl font-black tracking-tight">The market optimized the handoff. It did not fix the shopping experience.</h2></div><p className="text-slate-600 leading-7">Direct carriers, independent agents, comparison sites, advertising marketplaces, and lead generators are not identical. But much of the digital journey still begins with identity capture and ends with the consumer reconstructing the comparison across disconnected conversations. The system measures distribution efficiently while the consumer carries the coordination burden.</p></div>
      <div className="mt-12 grid md:grid-cols-4 gap-4">{legacyFlow.map(([n, title, text]) => <article key={n} className="rounded-2xl border border-rose-200 bg-rose-50/60 p-6"><span className="font-mono text-xs font-black text-rose-700">{n}</span><h3 className="mt-3 font-black">{title}</h3><p className="mt-3 text-sm text-slate-600 leading-6">{text}</p></article>)}</div>
      <div className="mt-8 rounded-2xl bg-slate-950 text-white p-6 md:p-8 grid md:grid-cols-[auto_1fr] gap-5 items-center"><PhoneCall className="w-10 h-10 text-rose-400" /><div><h3 className="text-xl font-black">The structural conflict</h3><p className="mt-2 text-slate-300 leading-7">When a marketplace is rewarded primarily for transferring consumer access, the handoff can become the product. Open Polici makes the consumer-authorized connection the conclusion of a documented competition—not the opening move.</p></div></div>
    </section>

    <section className="border-y border-slate-200 bg-emerald-50/50 py-20"><div className="max-w-7xl mx-auto px-5">
      <div className="max-w-4xl"><p className="text-emerald-700 text-xs font-mono font-bold uppercase tracking-wider">The Open Polici reversal</p><h2 className="mt-3 text-3xl md:text-5xl font-black tracking-tight">Move the competition before the contact.</h2><p className="mt-5 text-slate-600 leading-7">Open Polici does not sell insurance, choose coverage, underwrite risk, or declare a winner. It creates governed infrastructure in which consumers define the opportunity, eligible providers develop the offers, and factual differences become visible before disclosure.</p></div>
      <div className="mt-12 grid md:grid-cols-4 gap-4">{policiFlow.map(([n, title, text]) => <article key={n} className="rounded-2xl border border-emerald-200 bg-white p-6 shadow-sm"><span className="font-mono text-xs font-black text-emerald-700">{n}</span><h3 className="mt-3 font-black">{title}</h3><p className="mt-3 text-sm text-slate-600 leading-6">{text}</p></article>)}</div>
      <div className="mt-8 grid md:grid-cols-3 gap-4">{[[EyeOff, 'Private by sequence', 'Evaluation is separated from personal disclosure.'], [GitCompareArrows, 'Comparable by design', 'Every offer is organized against one preserved baseline.'], [LockKeyhole, 'Consumer authorized', 'Only the selected provider receives the controlled connection.']].map(([Icon, title, text]) => { const I = Icon as React.ComponentType<{className?: string}>; return <div key={String(title)} className="flex gap-4 p-5"><I className="w-7 h-7 text-emerald-700 shrink-0" /><div><h3 className="font-black">{String(title)}</h3><p className="mt-1 text-sm text-slate-600">{String(text)}</p></div></div>; })}</div>
    </div></section>

    <section className="max-w-7xl mx-auto px-5 py-20">
      <div className="max-w-4xl"><p className="text-blue-700 text-xs font-mono font-bold uppercase tracking-wider">System-to-system comparison</p><h2 className="mt-3 text-3xl md:text-5xl font-black tracking-tight">Not another quote form. A different market architecture.</h2><p className="mt-5 text-slate-600 leading-7">This describes common operating structures. Individual companies vary, and some modern services already provide strong privacy or direct-quote controls. Open Polici’s distinction is the complete sequence: consumer baseline, gated competition, documented comparison, explicit selection, and controlled disclosure.</p></div>
      <div className="mt-10 overflow-x-auto rounded-2xl border border-slate-200 shadow-sm"><table className="w-full min-w-[1060px] text-sm"><thead className="bg-slate-950 text-white"><tr><th className="p-4 text-left">Market dimension</th><th className="p-4 text-left">Direct carrier</th><th className="p-4 text-left">Lead / quote marketplace</th><th className="p-4 text-left">Independent agency</th><th className="p-4 text-left bg-emerald-700">Open Polici</th></tr></thead><tbody className="divide-y divide-slate-100">{matrix.map(row => <tr key={row[0]} className="align-top"><th className="p-4 text-left text-slate-600 bg-slate-50">{row[0]}</th>{row.slice(1).map((cell, i) => <td key={cell} className={`p-4 leading-6 ${i === 3 ? 'bg-emerald-50 font-semibold text-slate-950' : 'text-slate-600'}`}>{cell}</td>)}</tr>)}</tbody></table></div>
    </section>

    <section className="bg-slate-950 text-white py-20"><div className="max-w-7xl mx-auto px-5">
      <div className="max-w-4xl"><p className="text-emerald-400 text-xs font-mono font-bold uppercase tracking-wider">The three-sided benefit</p><h2 className="mt-3 text-3xl md:text-5xl font-black tracking-tight">A better market has to work for every legitimate participant.</h2><p className="mt-5 text-slate-300 leading-7">Consumer protection alone does not create supply. Provider access alone does not create trust. Carrier scale alone does not create neutrality. Open Polici aligns all three without giving any one side control of the marketplace.</p></div>
      <div className="mt-12 space-y-6">{benefits.map(({label, title, icon: Icon, tone, points}) => <article key={label} className="rounded-3xl border border-white/10 bg-white/[.04] p-6 md:p-9"><div className="grid lg:grid-cols-[.75fr_1.25fr] gap-8"><div><div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${tone === 'emerald' ? 'bg-emerald-400 text-slate-950' : tone === 'blue' ? 'bg-blue-500' : 'bg-violet-500'}`}><Icon className="w-6 h-6" /></div><p className="mt-5 text-xs uppercase tracking-widest font-mono font-bold text-slate-400">{label}</p><h3 className="mt-3 text-2xl md:text-3xl font-black">{title}</h3></div><div className="grid sm:grid-cols-2 gap-3">{points.map(([point, copy]) => <div key={point} className="rounded-xl border border-white/10 bg-slate-950/50 p-4"><h4 className="font-bold flex gap-2"><Check className="w-4 h-4 text-emerald-400 shrink-0" />{point}</h4><p className="mt-2 text-sm text-slate-400 leading-6">{copy}</p></div>)}</div></div></article>)}</div>
    </div></section>

    <section className="max-w-7xl mx-auto px-5 py-20"><div className="grid lg:grid-cols-2 gap-12">
      <div><p className="text-amber-700 text-xs font-mono font-bold uppercase tracking-wider">Commercial alignment</p><h2 className="mt-3 text-3xl md:text-5xl font-black tracking-tight">Open Polici gets paid without selling marketplace preference.</h2><p className="mt-5 text-slate-600 leading-7">Commercial V2 separates access, capacity, optional services, and the consumer-authorized marketplace transaction. Payment can activate purchased entitlements, but it cannot establish a license, appointment, insurance-line eligibility, ranking advantage, or consumer authorization.</p></div>
      <div className="space-y-4">{[[CircleDollarSign, 'Membership', 'Providers and carriers purchase the organization capacity and operating access defined by their plan. The membership trial applies to membership only.'], [Network, 'Capacity and services', 'Producer seats, locations, optional services, and included plan capabilities follow Commercial V2.'], [BadgeCheck, 'Authorized connection', 'Selection and consent are free. The applicable line-specific connection charge is created only when controlled disclosure satisfies the defined event.'], [Scale, 'Neutrality invariant', 'No payment can establish authority, alter factual offer presentation, or create marketplace preference.']].map(([Icon,title,text]) => { const I = Icon as React.ComponentType<{className?: string}>; return <div key={String(title)} className="rounded-2xl border border-slate-200 p-5 flex gap-4"><I className="w-6 h-6 text-emerald-700 shrink-0" /><div><h3 className="font-black">{String(title)}</h3><p className="mt-2 text-sm text-slate-600 leading-6">{String(text)}</p></div></div>; })}</div>
    </div></section>

    <section className="border-y border-slate-200 bg-slate-50 py-20"><div className="max-w-7xl mx-auto px-5"><p className="text-slate-500 text-xs font-mono font-bold uppercase tracking-wider">The operating boundary</p><h2 className="mt-3 max-w-4xl text-3xl md:text-5xl font-black tracking-tight">Infrastructure for a fairer transaction—not an insurance decision-maker.</h2><div className="mt-10 grid md:grid-cols-2 lg:grid-cols-4 gap-4">{[
      ['Open Polici does not prescribe coverage', 'The consumer defines the request or supplies the existing policy baseline.'], ['Open Polici does not develop provider offers', 'Licensed providers remain responsible for advice, quotation, underwriting, and binding.'], ['Open Polici does not hide uncertainty', 'Missing, unresolved, or non-comparable terms remain visibly unknown.'], ['Open Polici does not sell the winner’s position', 'The consumer chooses; commercial payment cannot determine the outcome.']
    ].map(([title,text]) => <article key={title} className="rounded-2xl bg-white border border-slate-200 p-6"><ShieldCheck className="w-6 h-6 text-emerald-700" /><h3 className="mt-4 font-black">{title}</h3><p className="mt-3 text-sm leading-6 text-slate-600">{text}</p></article>)}</div></div></section>

    <section className="max-w-7xl mx-auto px-5 py-20"><div className="rounded-3xl bg-gradient-to-br from-emerald-700 to-slate-950 text-white p-8 md:p-12 grid lg:grid-cols-[1fr_auto] gap-8 items-center"><div><p className="text-emerald-200 text-xs font-mono font-bold uppercase tracking-wider">The paradigm shift</p><h2 className="mt-3 text-3xl md:text-5xl font-black">The consumer is not the lead. The consumer is the market maker.</h2><p className="mt-5 max-w-3xl text-emerald-50/80 leading-7">Open Polici gives the demand side a private, structured way to call the market—and gives legitimate providers a governed way to answer.</p></div><div className="flex lg:flex-col gap-3 flex-wrap"><button onClick={() => go('/consumers')} className="px-5 py-3 bg-white text-slate-950 rounded-xl font-black inline-flex items-center justify-center gap-2">Start as a consumer <ArrowRight className="w-4 h-4" /></button><button onClick={() => go('/providers')} className="px-5 py-3 border border-white/40 rounded-xl font-bold">Join as a provider</button></div></div></section>

    <section className="max-w-5xl mx-auto px-5 pb-16 text-center"><p className="text-xs leading-5 text-slate-500">Methodology note: this page compares common distribution structures, not every company’s individual practice. Marketplace and privacy practices vary by operator and can change. Open Polici’s claims describe its product contract: baseline preservation, eligibility gating, factual comparison, consumer selection, controlled disclosure, and Commercial V2 neutrality.</p></section>
  </div>
);
