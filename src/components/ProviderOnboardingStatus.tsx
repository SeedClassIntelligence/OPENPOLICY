import React, { useEffect, useState } from 'react';
import { Building2, CheckCircle2, CreditCard, Loader2, ShieldCheck } from 'lucide-react';
import { apiFetch } from '../services/apiClient';

type MembershipState = {
  application: {
    status: 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED';
    requestedPlanCode: string;
    reviewReason?: string;
  };
  invoice?: {
    invoiceNumber: string;
    status: string;
    totalDueCents: number;
    balanceDueCents: number;
    currency: string;
  };
  paymentRequired: boolean;
  paymentComplete: boolean;
};

const PLAN_NAMES: Record<string, string> = {
  PLAN_SOLO: 'Solo',
  PLAN_AGENCY: 'Agency',
  PLAN_OPEN_POLICY_PREMIUM: 'Open Polici Premium',
  PLAN_NETWORK: 'Network',
  PLAN_ENTERPRISE: 'Enterprise'
};

export function ProviderOnboardingStatus() {
  const [state, setState] = useState<MembershipState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);

  const load = async () => {
    try {
      const response = await apiFetch('/api/provider-applications/current');
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Provider application status is unavailable.');
      setState(data);
      setError(null);
    } catch (caught: any) {
      setError(caught?.message || 'Provider application status is unavailable.');
    }
  };

  useEffect(() => { void load(); }, []);

  const payMembership = async () => {
    setPaying(true); setError(null);
    try {
      const response = await apiFetch('/api/provider-applications/current/membership-payment-session', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      if (!response.ok || !data.checkoutUrl) throw new Error(data.error || 'Secure membership checkout could not be opened.');
      window.location.assign(data.checkoutUrl);
    } catch (caught: any) {
      setError(caught?.message || 'Secure membership checkout could not be opened.');
      setPaying(false);
    }
  };

  const application = state?.application;
  const approved = application?.status === 'APPROVED';
  const rejected = application?.status === 'REJECTED';
  const amount = state?.invoice ? new Intl.NumberFormat('en-US', {
    style: 'currency', currency: state.invoice.currency || 'USD'
  }).format(state.invoice.balanceDueCents / 100) : null;

  return (
    <div className="max-w-2xl mx-auto bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
      <p className="text-xs font-mono uppercase tracking-wider text-blue-700">Provider onboarding</p>
      <h2 className="text-2xl font-bold text-slate-950 mt-2">
        {rejected ? 'Application requires attention' : approved ? 'Authority approved' : 'Verification in progress'}
      </h2>
      <p className="text-sm text-slate-600 mt-3 leading-relaxed">
        {rejected
          ? application?.reviewReason || 'Open Polici could not approve the submitted provider authority evidence.'
          : approved
            ? 'Your provider authority review is complete. Finish the selected monthly membership below. Payment purchases platform access; it does not replace licensing, appointments, line eligibility, or marketplace authorization.'
            : 'Your account and application are recorded. Open Polici is reviewing the submitted organization, licensing, insurance-line, and carrier-relationship evidence.'}
      </p>

      {application && !rejected && (
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><Building2 className="h-5 w-5 text-emerald-700"/><strong className="mt-2 block text-sm text-slate-950">Application received</strong></div>
          <div className={`rounded-2xl border p-4 ${approved?'border-emerald-200 bg-emerald-50':'border-slate-200 bg-slate-50'}`}><ShieldCheck className={`h-5 w-5 ${approved?'text-emerald-700':'text-slate-400'}`}/><strong className="mt-2 block text-sm text-slate-950">Authority review</strong></div>
          <div className={`rounded-2xl border p-4 ${state?.paymentComplete?'border-emerald-200 bg-emerald-50':'border-slate-200 bg-slate-50'}`}>{state?.paymentComplete?<CheckCircle2 className="h-5 w-5 text-emerald-700"/>:<CreditCard className="h-5 w-5 text-slate-400"/>}<strong className="mt-2 block text-sm text-slate-950">Membership payment</strong></div>
        </div>
      )}

      {approved && (
        <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-5">
          <div className="flex items-start justify-between gap-4">
            <div><p className="text-xs font-bold uppercase tracking-wide text-blue-800">Selected membership</p><h3 className="mt-1 text-lg font-bold text-slate-950">{PLAN_NAMES[application.requestedPlanCode] || application.requestedPlanCode}</h3></div>
            {state?.invoice && <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-700">{state.invoice.status}</span>}
          </div>
          {state?.paymentRequired && <><p className="mt-3 text-sm text-slate-700">Your first monthly membership invoice is ready: <strong>{amount}</strong>.</p><button onClick={payMembership} disabled={paying} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{paying?<Loader2 className="h-4 w-4 animate-spin"/>:<CreditCard className="h-4 w-4"/>} Continue to secure Stripe checkout</button></>}
          {!state?.invoice && <p className="mt-3 text-sm text-slate-700">Open Polici is preparing the approved membership agreement and first invoice. No payment is due until the secure checkout appears here.</p>}
          {state?.paymentComplete && <p className="mt-3 text-sm font-semibold text-emerald-800">Membership payment confirmed. Marketplace access remains closed until final activation checks pass.</p>}
        </div>
      )}
      {error && <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>}
    </div>
  );
}
