import React, { useState } from 'react';
import { ArrowRight, CheckCircle2, ShieldCheck } from 'lucide-react';
import { apiFetch } from '../services/apiClient';
import { recordConsumerFunnelEvent } from '../services/consumerFunnel';
import type { InsuranceLine } from '../types/jurisdiction';

interface Props {
  insuranceLine: InsuranceLine;
  onUseExistingPolicy: () => void;
  onMarketplaceStarted: () => void | Promise<void>;
}

export const ConsumerDefinedCoverageRequestForm: React.FC<Props> = ({ insuranceLine, onUseExistingPolicy, onMarketplaceStarted }) => {
  const [desiredEffectiveDate, setDesiredEffectiveDate] = useState('');
  const [vehicleYear, setVehicleYear] = useState('');
  const [vehicleMake, setVehicleMake] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [garagingZip, setGaragingZip] = useState('');
  const [bodilyInjury, setBodilyInjury] = useState('');
  const [propertyDamage, setPropertyDamage] = useState('');
  const [collisionDeductible, setCollisionDeductible] = useState('');
  const [comprehensiveDeductible, setComprehensiveDeductible] = useState('');
  const [budget, setBudget] = useState('');
  const [attested, setAttested] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmedId, setConfirmedId] = useState<string | null>(null);
  const [launching, setLaunching] = useState(false);

  const launchMarketplace = async () => {
    if (!confirmedId) return;
    setError(null);
    setLaunching(true);
    try {
      const response = await apiFetch('/api/challenges/create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consumerDefinedRequestId: confirmedId })
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.message || payload.error || 'The request could not be shared with providers.');
      void recordConsumerFunnelEvent({
        eventName: 'MARKETPLACE_REQUEST_ACTIVATED', insuranceLine,
        baselineOrigin: 'CONSUMER_DEFINED_COVERAGE_REQUEST', referenceId: payload.challenge?.id || confirmedId
      }).catch(() => undefined);
      await Promise.resolve(onMarketplaceStarted());
    } catch (caught: any) {
      setError(caught?.message || 'The request could not be shared with providers.');
    } finally {
      setLaunching(false);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const requestedCoverage = [
        { fieldCode: 'BODILY_INJURY', label: 'Bodily injury liability limits', value: bodilyInjury },
        { fieldCode: 'PROPERTY_DAMAGE', label: 'Property damage liability limit', value: propertyDamage },
        { fieldCode: 'COLLISION', label: 'Collision deductible', value: collisionDeductible },
        { fieldCode: 'COMPREHENSIVE', label: 'Comprehensive deductible', value: comprehensiveDeductible }
      ].map(item => item.value
        ? { fieldCode: item.fieldCode, label: item.label, preference: 'REQUESTED', requestedValue: item.value }
        : { fieldCode: item.fieldCode, label: item.label, preference: 'NO_PREFERENCE_STATED' });
      const response = await apiFetch('/api/consumer-defined-coverage-requests/confirm', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jurisdiction: 'NV', insuranceLine, desiredEffectiveDate,
          riskFacts: { vehicleYear: Number(vehicleYear), vehicleMake, vehicleModel, garagingZip },
          requestedCoverage,
          privateBudget: budget ? { amount: Number(budget), interval: 'MONTHLY' } : undefined,
          attested
        })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'The request could not be confirmed.');
      setConfirmedId(payload.baseline.id);
      void recordConsumerFunnelEvent({
        eventName: 'BASELINE_CONFIRMED', insuranceLine,
        baselineOrigin: 'CONSUMER_DEFINED_COVERAGE_REQUEST', referenceId: payload.baseline.id
      }).catch(() => undefined);
    } catch (caught: any) {
      setError(caught?.message || 'The request could not be confirmed.');
    } finally {
      setPending(false);
    }
  };

  if (confirmedId) return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center">
      <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
      <h2 className="mt-3 text-xl font-bold text-slate-900">Your coverage request is confirmed</h2>
      <p className="mt-2 text-sm text-slate-600">Open Polici preserved exactly what you entered. Providers determine what they can offer; Open Polici does not recommend or alter your requested terms.</p>
      <p className="mt-4 font-mono text-xs text-emerald-900">Request {confirmedId}</p>
      {error && <p role="alert" className="mt-4 text-sm font-semibold text-red-700">{error}</p>}
      <button type="button" onClick={launchMarketplace} disabled={launching} className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white disabled:opacity-50">
        <ShieldCheck className="h-4 w-4" /><span>{launching ? 'Sharing securely…' : 'Share My Request With Eligible Providers'}</span><ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );

  return (
    <form onSubmit={submit} className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 md:p-8 shadow-xs">
      <div>
        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700">NEVADA · CONSUMER-DEFINED REQUEST</span>
        <h2 className="mt-3 text-2xl font-bold text-slate-900">Tell providers what you are looking for</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">You enter the facts and coverage preferences. Open Polici records them without recommending, changing, or selecting coverage for you.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="text-xs font-semibold text-slate-700">Desired start date *
          <input required type="date" value={desiredEffectiveDate} onChange={e => setDesiredEffectiveDate(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
        </label>
        <label className="text-xs font-semibold text-slate-700">Garaging ZIP code *
          <input required pattern="[0-9]{5}" value={garagingZip} onChange={e => setGaragingZip(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
        </label>
        <label className="text-xs font-semibold text-slate-700">Vehicle year *
          <input required type="number" min="1900" max="2100" value={vehicleYear} onChange={e => setVehicleYear(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
        </label>
        <label className="text-xs font-semibold text-slate-700">Vehicle make *
          <input required value={vehicleMake} onChange={e => setVehicleMake(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
        </label>
        <label className="text-xs font-semibold text-slate-700">Vehicle model *
          <input required value={vehicleModel} onChange={e => setVehicleModel(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
        </label>
      </div>

      <div className="border-t border-slate-200 pt-5">
        <h3 className="text-sm font-bold text-slate-900">Coverage you want providers to consider</h3>
        <p className="mt-1 text-xs text-slate-500">Leave any field blank to record “No preference stated.” Open Polici will not fill it in for you.</p>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="text-xs font-semibold text-slate-700">Bodily injury limits
            <input value={bodilyInjury} onChange={e => setBodilyInjury(e.target.value)} placeholder="Example: 100,000 / 300,000" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
          </label>
          <label className="text-xs font-semibold text-slate-700">Property damage limit
            <input value={propertyDamage} onChange={e => setPropertyDamage(e.target.value)} placeholder="Example: 100,000" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
          </label>
          <label className="text-xs font-semibold text-slate-700">Collision deductible
            <input value={collisionDeductible} onChange={e => setCollisionDeductible(e.target.value)} placeholder="Example: 500" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
          </label>
          <label className="text-xs font-semibold text-slate-700">Comprehensive deductible
            <input value={comprehensiveDeductible} onChange={e => setComprehensiveDeductible(e.target.value)} placeholder="Example: 250" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
          </label>
          <label className="text-xs font-semibold text-slate-700 md:col-span-2">Optional monthly budget
            <input type="number" min="1" value={budget} onChange={e => setBudget(e.target.value)} placeholder="Optional and private—never used to rank or instruct providers" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
          </label>
        </div>
      </div>

      <label className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-xs leading-5 text-blue-950">
        <input required type="checkbox" checked={attested} onChange={e => setAttested(e.target.checked)} className="mt-1" />
        <span>I confirm these are my own requested terms and facts. I understand providers independently decide what they can offer, and Open Polici does not recommend or guarantee coverage.</span>
      </label>
      {error && <p role="alert" className="text-sm font-semibold text-red-700">{error}</p>}
      <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <button type="button" onClick={onUseExistingPolicy} className="text-xs font-semibold text-slate-600 hover:text-slate-900">I have a policy to upload instead</button>
        <button disabled={pending || !attested} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white disabled:opacity-50">
          <ShieldCheck className="h-4 w-4" /><span>{pending ? 'Confirming…' : 'Confirm My Coverage Request'}</span><ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </form>
  );
};
