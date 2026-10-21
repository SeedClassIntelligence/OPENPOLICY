import React,{useState} from 'react';
import { createUserWithEmailAndPassword,signInWithEmailAndPassword,updateProfile } from 'firebase/auth';
import { auth } from '../firebase/config';
import { createUserProfile } from '../services/userService';
import { apiFetch } from '../services/apiClient';
import { useAuth } from '../context/AuthContext';

export const ProviderInvitationAcceptance:React.FC<{token:string}>=({token})=>{
  const {currentUser}=useAuth();
  const [mode,setMode]=useState<'CREATE'|'SIGN_IN'>('CREATE');
  const [name,setName]=useState('');const [email,setEmail]=useState('');const [password,setPassword]=useState('');
  const [message,setMessage]=useState('');const [busy,setBusy]=useState(false);
  const authenticate=async(event:React.FormEvent)=>{event.preventDefault();setBusy(true);setMessage('');try{
    if(mode==='CREATE'){
      const result=await createUserWithEmailAndPassword(auth,email,password);await updateProfile(result.user,{displayName:name});
      await createUserProfile({id:result.user.uid,email,displayName:name,role:'PROVIDER',providerStatus:'PENDING_VERIFICATION',createdAt:new Date().toISOString()});
    }else await signInWithEmailAndPassword(auth,email,password);
    setMessage('Identity verified. Confirm the organization invitation below.');
  }catch(error:any){setMessage(error.message||'Authentication failed.');}finally{setBusy(false);}};
  const accept=async()=>{setBusy(true);setMessage('');try{
    const response=await apiFetch(`/api/marketplace/my-provider/user-invitations/${encodeURIComponent(token)}/accept`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({displayName:currentUser?.displayName||name})});
    const body=await response.json().catch(()=>({}));if(!response.ok)throw new Error(body.error||'Invitation acceptance failed.');
    await auth.currentUser?.getIdToken(true);setMessage('Provider organization access activated. Reloading your Provider Desk…');window.setTimeout(()=>{window.location.assign('/');},800);
  }catch(error:any){setMessage(error.message||'Invitation acceptance failed.');setBusy(false);}};
  const input='w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm';
  return <main className="min-h-screen bg-slate-100 flex items-center justify-center p-4"><section className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 shadow-xl space-y-5">
    <div><p className="text-xs font-mono uppercase tracking-wider text-emerald-700">Open Polici provider organization</p><h1 className="mt-2 text-2xl font-bold">Accept your team invitation</h1><p className="mt-2 text-sm text-slate-600">Your independent Firebase identity will be linked to the inviting organization. The invitation does not establish insurance licensing or authority.</p></div>
    {message&&<p className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">{message}</p>}
    {!currentUser?<><div className="grid grid-cols-2 rounded-xl bg-slate-100 p-1 text-sm"><button onClick={()=>setMode('CREATE')} className={`rounded-lg p-2 ${mode==='CREATE'?'bg-white font-bold shadow-sm':''}`}>Create identity</button><button onClick={()=>setMode('SIGN_IN')} className={`rounded-lg p-2 ${mode==='SIGN_IN'?'bg-white font-bold shadow-sm':''}`}>Sign in</button></div>
      <form onSubmit={authenticate} className="space-y-3">{mode==='CREATE'&&<input className={input} required value={name} onChange={e=>setName(e.target.value)} placeholder="Full name"/>}<input className={input} type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="Invited email"/><input className={input} type="password" minLength={6} required value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password"/><button disabled={busy} className="w-full rounded-xl bg-slate-950 p-3 text-sm font-bold text-white disabled:opacity-50">{busy?'Verifying…':mode==='CREATE'?'Create provider identity':'Sign in'}</button></form></>:
      <div className="space-y-3"><p className="rounded-xl bg-slate-50 p-3 text-sm">Signed in as <b>{currentUser.email}</b></p><button onClick={accept} disabled={busy} className="w-full rounded-xl bg-emerald-500 p-3 text-sm font-bold text-slate-950 disabled:opacity-50">{busy?'Accepting…':'Accept organization invitation'}</button></div>}
  </section></main>;
};
