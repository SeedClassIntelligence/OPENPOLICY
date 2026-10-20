import React, { useEffect, useState } from 'react';
import { apiFetch } from '../services/apiClient';

interface Props { providerUserId: string; entitlements: any[]; }

export const ProviderPremiumServices: React.FC<Props> = ({ providerUserId, entitlements }) => {
  const enabled = (type: string) => entitlements.some(item => item.entitlementType === type);
  const headers = { 'Content-Type': 'application/json', 'x-provider-user-id': providerUserId };
  const [report, setReport] = useState<any>(null);
  const [rules, setRules] = useState<any[]>([]);
  const [credentials, setCredentials] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [revealedToken, setRevealedToken] = useState('');
  const [message, setMessage] = useState('');

  const request = async (url: string, options?: RequestInit) => {
    const response = await apiFetch(url, { ...options, headers: { ...headers, ...(options?.headers || {}) } });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'Premium service request failed.');
    return body;
  };

  const reload = async () => {
    setMessage('');
    const tasks: Promise<void>[] = [];
    if (enabled('ENTERPRISE_REPORTING')) tasks.push(request('/api/commercial/premium/report').then(body => setReport(body.report)));
    if (enabled('AUTOMATED_APPETITE_MATCHING')) tasks.push(request('/api/commercial/premium/workflow-rules').then(body => setRules(body.rules)));
    if (enabled('API_ACCESS')) tasks.push(request('/api/commercial/premium/api-credentials').then(body => setCredentials(body.credentials)).catch(error => setMessage(error.message)));
    if (enabled('MULTI_LOCATION_ADMIN')) {
      tasks.push(request('/api/commercial/premium/locations').then(body => setLocations(body.locations)));
      tasks.push(request('/api/marketplace/my-provider/users').then(body => setUsers(body.users)).catch(error => setMessage(error.message)));
    }
    await Promise.all(tasks);
  };
  useEffect(() => { if (providerUserId) void reload(); }, [providerUserId, entitlements.map(item => item.id).join('|')]);

  const addRule = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    await request('/api/commercial/premium/workflow-rules', { method: 'POST', body: JSON.stringify({
      name: form.get('name'), jurisdictions: [form.get('jurisdiction')], insuranceLines: [form.get('insuranceLine')],
      riskMarkets: [], action: form.get('action') }) });
    event.currentTarget.reset(); await reload();
  };
  const addCredential = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const body = await request('/api/commercial/premium/api-credentials', { method: 'POST', body: JSON.stringify({
      label: form.get('label'), scopes: ['opportunities:read','offers:read','reports:read'] }) });
    setRevealedToken(body.credential.token); event.currentTarget.reset(); await reload();
  };
  const addLocation = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    await request('/api/commercial/premium/locations', { method: 'POST', body: JSON.stringify(Object.fromEntries(form)) });
    event.currentTarget.reset(); await reload();
  };

  const card = 'border border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50';
  const input = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs';
  const button = 'rounded-lg bg-slate-950 px-3 py-2 text-xs font-bold text-white disabled:bg-slate-300';
  return <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
    <div><h3 className="text-base font-bold text-slate-900">Premium Provider Services</h3>
      <p className="text-xs text-slate-500">Services operate only under the active organization’s purchased entitlements. They never affect marketplace ordering or consumer selection.</p></div>
    {message && <p className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">{message}</p>}
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <section className={card}><h4 className="font-bold text-sm">Workflow automation</h4>
        {!enabled('AUTOMATED_APPETITE_MATCHING') ? <p className="text-xs text-slate-500">Not included in the active agreement.</p> : <>
          <form onSubmit={addRule} className="grid grid-cols-2 gap-2"><input className={input} name="name" required placeholder="Rule name" />
            <input className={input} name="jurisdiction" required placeholder="Jurisdiction, e.g. NV" />
            <input className={input} name="insuranceLine" required placeholder="Insurance line" />
            <select className={input} name="action"><option>PRIORITIZE</option><option>STANDARD_REVIEW</option><option>DO_NOT_PURSUE</option></select>
            <button className={button} type="submit">Add workflow rule</button></form>
          <div className="space-y-1">{rules.map(rule => <div key={rule.id} className="text-xs bg-white border rounded p-2"><b>{rule.name}</b> · {rule.action}</div>)}</div></>}
      </section>
      <section className={card}><h4 className="font-bold text-sm">Enterprise reporting</h4>
        {!enabled('ENTERPRISE_REPORTING') ? <p className="text-xs text-slate-500">Not included in the active agreement.</p> : report && <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-white p-3 rounded border">Activated opportunities<br/><b className="text-lg">{report.marketplace.activatedOpportunities}</b></div>
          <div className="bg-white p-3 rounded border">Engagements<br/><b className="text-lg">{report.marketplace.engagements}</b></div>
          <div className="bg-white p-3 rounded border">Offers submitted<br/><b className="text-lg">{report.marketplace.offersSubmitted}</b></div>
          <div className="bg-white p-3 rounded border">Outstanding balance<br/><b className="text-lg">${((report.commercial.balance?.outstandingBalanceCents || 0)/100).toFixed(2)}</b></div>
        </div>}
      </section>
      <section className={card}><h4 className="font-bold text-sm">API integration</h4>
        {!enabled('API_ACCESS') ? <p className="text-xs text-slate-500">Not included in the active agreement.</p> : <>
          <form onSubmit={addCredential} className="flex gap-2"><input className={input} name="label" required placeholder="Credential label"/><button className={button}>Create</button></form>
          {revealedToken && <div className="rounded border border-rose-200 bg-rose-50 p-2 text-xs"><b>Copy now—shown once:</b><code className="block break-all mt-1">{revealedToken}</code></div>}
          {credentials.map(item => <div key={item.id} className="flex justify-between text-xs bg-white border rounded p-2"><span>{item.label} · {item.tokenPrefix}… · {item.status}</span>
            {item.status === 'ACTIVE' && <button className="text-rose-700 font-bold" onClick={async()=>{await request(`/api/commercial/premium/api-credentials/${item.id}/revoke`,{method:'POST'});await reload();}}>Revoke</button>}</div>)}</>}
      </section>
      <section className={card}><h4 className="font-bold text-sm">Multi-location administration</h4>
        {!enabled('MULTI_LOCATION_ADMIN') ? <p className="text-xs text-slate-500">Not included in the active agreement.</p> : <>
          <form onSubmit={addLocation} className="grid grid-cols-2 gap-2"><input className={input} name="name" required placeholder="Office name"/><input className={input} name="jurisdiction" required placeholder="State"/>
            <input className={input} name="addressLine1" required placeholder="Address"/><input className={input} name="city" required placeholder="City"/><input className={input} name="postalCode" required placeholder="Postal code"/><button className={button}>Add office</button></form>
          {locations.map(location => <div key={location.id} className="text-xs bg-white border rounded p-2"><b>{location.name}</b> · {location.city}, {location.jurisdiction} · {location.assignedUsers} assigned
            {users.length > 0 && <select className={`${input} mt-2`} defaultValue="" onChange={async e=>{if(e.target.value){await request(`/api/commercial/premium/locations/${location.id}/assign`,{method:'POST',body:JSON.stringify({providerUserId:e.target.value})});await reload();}}}><option value="">Assign producer…</option>{users.map(user=><option key={user.id} value={user.id}>{user.name} ({user.role})</option>)}</select>}</div>)}</>}
      </section>
    </div>
  </div>;
};
