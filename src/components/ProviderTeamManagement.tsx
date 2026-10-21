import React, { useEffect, useState } from 'react';
import { apiFetch } from '../services/apiClient';

export const ProviderTeamManagement: React.FC = () => {
  const [users,setUsers]=useState<any[]>([]);
  const [invitations,setInvitations]=useState<any[]>([]);
  const [message,setMessage]=useState('');
  const [acceptanceLink,setAcceptanceLink]=useState('');

  const load=async()=>{
    setMessage('');
    const [usersResponse,invitationsResponse]=await Promise.all([
      apiFetch('/api/marketplace/my-provider/users'),
      apiFetch('/api/marketplace/my-provider/user-invitations')
    ]);
    if(!usersResponse.ok||!invitationsResponse.ok){
      const body=await (!usersResponse.ok?usersResponse:invitationsResponse).json().catch(()=>({}));
      throw new Error(body.error||'Provider team administration requires owner or administrator authority.');
    }
    setUsers((await usersResponse.json()).users||[]);
    setInvitations((await invitationsResponse.json()).invitations||[]);
  };
  useEffect(()=>{void load().catch(error=>setMessage(error.message));},[]);

  const invite=async(event:React.FormEvent<HTMLFormElement>)=>{
    event.preventDefault();setMessage('');setAcceptanceLink('');
    const form=new FormData(event.currentTarget);
    const response=await apiFetch('/api/marketplace/my-provider/user-invitations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
      fullName:form.get('fullName'),email:form.get('email'),role:form.get('role')
    })});
    const body=await response.json().catch(()=>({}));
    if(!response.ok){setMessage(body.error||'Invitation could not be created.');return;}
    const link=new URL(body.acceptancePath,window.location.origin).toString();
    setAcceptanceLink(link);setMessage('Invitation created. Copy the secure link now; its secret is not stored or shown again.');
    event.currentTarget.reset();await load();
  };
  const input='rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs';
  return <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
    <div><h3 className="text-base font-bold text-slate-900">Provider team</h3><p className="text-xs text-slate-500">Owners and administrators invite independently authenticated users into this organization. Invitations never create licensing authority.</p></div>
    {message&&<p className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">{message}</p>}
    {acceptanceLink&&<div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs"><b>One-time acceptance link</b><code className="mt-1 block break-all select-all">{acceptanceLink}</code></div>}
    <form onSubmit={invite} className="grid grid-cols-1 md:grid-cols-4 gap-2">
      <input className={input} name="fullName" required placeholder="Producer name"/><input className={input} name="email" type="email" required placeholder="Producer email"/>
      <select className={input} name="role" defaultValue="AGENT"><option value="AGENT">Agent</option><option value="QUOTER">Quoter</option><option value="VIEW_ONLY">View only</option><option value="ADMIN">Administrator</option></select>
      <button className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-bold text-white">Create secure invitation</button>
    </form>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div><h4 className="text-xs font-bold text-slate-700 mb-2">Organization users</h4>{users.map(user=><div key={user.id} className="mb-2 rounded-lg border p-3 text-xs"><b>{user.name}</b><span className="ml-2 text-slate-500">{user.role} · {user.status}</span><div className="text-slate-500">{user.email}</div></div>)}</div>
      <div><h4 className="text-xs font-bold text-slate-700 mb-2">Invitation history</h4>{invitations.map(invitation=><div key={invitation.id} className="mb-2 rounded-lg border p-3 text-xs"><b>{invitation.fullName}</b><span className="ml-2 text-slate-500">{invitation.role} · {invitation.status}</span><div className="text-slate-500">{invitation.email} · expires {new Date(invitation.expiresAt).toLocaleString()}</div></div>)}</div>
    </div>
  </section>;
};
