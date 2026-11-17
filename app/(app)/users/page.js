'use client';
import { useState } from 'react';
import { useLoad, useAction, Notice, fmtDate, api } from '@/components/ui';

export default function Users() {
  const { data, error, reload } = useLoad('/api/users');
  const act = useAction(reload);
  const [f, setF] = useState({ name: '', email: '', password: '', role: 'ANALYST' });
  const add = (e) => { e.preventDefault(); act.run(async () => { await api('/api/users', { method: 'POST', body: f }); setF({ name: '', email: '', password: '', role: 'ANALYST' }); }, 'User created'); };
  return (<>
    <h1>Users and roles</h1>
    <p className="sub">Admins manage everything. Analysts record findings and work remediation. Viewers have read-only access.</p>
    <Notice error={error || act.error} ok={act.ok} />
    <form className="card form" onSubmit={add}>
      <label>Name<input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
      <label>Email<input type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
      <label>Password (min 8)<input type="password" required minLength={8} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></label>
      <label>Role<select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}><option>ADMIN</option><option>ANALYST</option><option>VIEWER</option></select></label>
      <button className="btn" type="submit">Create user</button>
    </form>
    <div className="card tablewrap"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Created</th></tr></thead>
      <tbody>{data?.map((u) => <tr key={u.user_id}><td>{u.name}</td><td>{u.email}</td><td>{u.role}</td><td>{fmtDate(u.created_at)}</td></tr>)}</tbody></table></div>
  </>);
}
