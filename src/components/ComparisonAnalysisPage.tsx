import React from 'react';
import { ArrowRight, Check, FileSearch, Minus, ShieldCheck, X } from 'lucide-react';

const go = (path: string) => { window.history.pushState({}, '', path); window.dispatchEvent(new PopStateEvent('popstate')); window.scrollTo({ top: 0, behavior: 'smooth' }); };

export const ComparisonAnalysisPage: React.FC = () => (
  <div className="bg-white">
    <section className="bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 text-white">
      <div className="max-w-6xl mx-auto px-5 py-20 lg:py-28 text-center">
        <p className="text-emerald-400 text-xs font-mono font-bold uppercase tracking-[.22em]">Insurance offer comparison</p>
        <h1 className="mt-5 text-4xl md:text-6xl font-black tracking-tight">See what changed—not just what got cheaper.</h1>
        <p className="mt-6 text-lg text-slate-300 max-w-3xl mx-auto leading-8">Open Polici compares each provider offer against the consumer’s actual baseline, organizes documented differences, and preserves unknowns. It does not declare a winner or decide what coverage a consumer should buy.</p>
      </div>
    </section>

    <section className="max-w-7xl mx-auto px-5 py-20">
      <div className="grid lg:grid-cols-[.75fr_1.25fr] gap-10 items-start">
        <div><p className="text-emerald-700 text-xs font-mono font-bold uppercase tracking-wider">The comparison baseline</p><h2 className="mt-3 text-3xl font-black text-slate-950">Every offer answers the same documented request.</h2><p className="mt-4 text-slate-600 leading-7">A baseline begins in one of two ways: the consumer uploads an existing declarations document, or the consumer defines a new coverage request. The original baseline is preserved so the platform can show what each offer changes.</p></div>
        <div className="grid sm:grid-cols-2 gap-4">
          <article className="rounded-2xl border border-blue-200 bg-blue-50 p-6"><span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">Existing-policy baseline</span><h3 className="mt-2 font-bold text-slate-950">Start with current coverage</h3><p className="mt-2 text-sm text-slate-600 leading-6">Structured from the uploaded policy document: current premium, limits, deductibles, vehicles or property, listed protections, and document evidence.</p></article>
          <article className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6"><span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Requested-coverage baseline</span><h3 className="mt-2 font-bold text-slate-950">Start without a current policy</h3><p className="mt-2 text-sm text-slate-600 leading-6">Structured from the consumer’s stated insurance type, desired limits, deductibles, preferences, and optional budget—without Open Polici changing the request.</p></article>
        </div>
      </div>
    </section>

    <section className="bg-slate-50 border-y border-slate-200 py-20">
      <div className="max-w-7xl mx-auto px-5">
        <div className="max-w-3xl"><p className="text-blue-700 text-xs font-mono font-bold uppercase tracking-wider">Illustrative personal-auto analysis</p><h2 className="mt-3 text-3xl font-black">A lower premium is only one line in the comparison.</h2><p className="mt-4 text-slate-600">This example demonstrates the format. Actual offers are based on provider documents and the consumer’s baseline.</p></div>
        <div className="mt-10 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-slate-950 text-white"><tr><th className="p-4 text-left">Documented term</th><th className="p-4 text-left">Current baseline</th><th className="p-4 text-left">Provider offer A</th><th className="p-4 text-left">Provider offer B</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {[
                ['Annual premium', '$2,964', '$2,580', '$2,340'],
                ['Bodily injury liability', '$100k / $300k', '$100k / $300k', '$50k / $100k'],
                ['Property damage', '$100k', '$100k', '$50k'],
                ['Collision deductible', '$500', '$500', '$1,000'],
                ['Rental reimbursement', 'Included', 'Included', 'Not documented'],
                ['Roadside assistance', 'Included', 'Not included', 'Included']
              ].map((row, i) => <tr key={row[0]} className={i === 0 ? 'font-bold' : ''}>{row.map((cell, j) => <td key={j} className={`p-4 ${j === 0 ? 'text-slate-500' : 'text-slate-900'}`}>{cell}</td>)}</tr>)}
            </tbody>
          </table>
        </div>
        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><strong>What this means:</strong> Offer B has the lowest illustrated premium, but it also documents lower liability limits, a higher collision deductible, and an unresolved rental-reimbursement field. Open Polici surfaces those facts; the consumer decides what matters.</div>
      </div>
    </section>

    <section className="max-w-7xl mx-auto px-5 py-20">
      <h2 className="text-3xl font-black text-center">What the analysis does—and does not do</h2>
      <div className="mt-10 grid md:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-emerald-200 p-7"><h3 className="font-bold text-emerald-800 flex items-center gap-2"><Check className="w-5 h-5" /> It does</h3><ul className="mt-4 space-y-3 text-sm text-slate-700">{['Normalize comparable policy terms', 'Show premium and protection differences', 'Label missing or unresolved information', 'Link findings to submitted documents', 'Preserve consumer selection and consent'].map(x => <li key={x} className="flex gap-2"><ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />{x}</li>)}</ul></div>
        <div className="rounded-2xl border border-rose-200 p-7"><h3 className="font-bold text-rose-800 flex items-center gap-2"><X className="w-5 h-5" /> It does not</h3><ul className="mt-4 space-y-3 text-sm text-slate-700">{['Recommend a specific insurance policy', 'Rank providers by commercial payment', 'Treat unknown terms as equivalent', 'Bind or underwrite insurance', 'Share contact information before authorization'].map(x => <li key={x} className="flex gap-2"><Minus className="w-4 h-4 text-rose-600 shrink-0" />{x}</li>)}</ul></div>
      </div>
    </section>

    <section className="bg-slate-950 text-white"><div className="max-w-5xl mx-auto px-5 py-16 text-center"><FileSearch className="w-9 h-9 text-emerald-400 mx-auto" /><h2 className="mt-4 text-3xl font-black">Bring the policy you have—or define the coverage you need.</h2><p className="mt-4 text-slate-300">Build one private baseline and let eligible providers respond to the same facts.</p><button onClick={() => go('/consumers')} className="mt-7 px-5 py-3 bg-emerald-400 text-slate-950 font-bold rounded-xl inline-flex items-center gap-2">Start as a consumer <ArrowRight className="w-4 h-4" /></button></div></section>
  </div>
);
