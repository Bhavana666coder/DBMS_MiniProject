'use client';
import { useState } from 'react';
import { useLoad, useAction, useUser, Badge, Notice, Empty } from '@/components/ui';
import { api } from '@/components/ui';

export default function Accounts() {
  const user = useUser();
  const { data, error, reload } = useLoad('/api/accounts');
  const act = useAction(reload);
  const [f, setF] = useState({ provider: 'AWS', account_name: '', region: '' });
  const add = (e) => { e.preventDefault(); act.run(async () => { await api('/api/accounts', { method: 'POST', body: f }); setF({ ...f, account_name: '', region: '' }); }, 'Account added'); };
  return (<>
    <h1>Cloud accounts</h1>
    <p className="sub">Every AWS, Azure and GCP account being monitored, and who manages it.</p>
    <Notice error={error || act.error} ok={act.ok} />
    {user.role === 'ADMIN' && <form className="card form" onSubmit={add}>
      <label>Provider<select value={f.provider} onChange={(e) => setF({ ...f, provider: e.target.value })}><option>AWS</option><option>AZURE</option><option>GCP</option></select></label>
      <label>Account name<input required value={f.account_name} onChange={(e) => setF({ ...f, account_name: e.target.value })} /></label>
      <label>Region<input required value={f.region} onChange={(e) => setF({ ...f, region: e.target.value })} placeholder="ap-south-1" /></label>
      <button className="btn" type="submit">Add account</button>
    </form>}
    <div className="card tablewrap">
      {data?.length ? <table><thead><tr><th>Provider</th><th>Account</th><th>Region</th><th>Status</th><th>Manager</th><th>Resources</th>{user.role === 'ADMIN' && <th></th>}</tr></thead>
        <tbody>{data.map((a) => <tr key={a.cloud_acc_id}>
          <td><Badge v={a.provider} /></td><td>{a.account_name}</td><td>{a.region}</td><td><Badge v={a.status} /></td><td>{a.manager}</td><td className="num">{a.resource_count}</td>
          {user.role === 'ADMIN' && <td style={{ whiteSpace: 'nowrap' }}>
            <button className="btn ghost sm" onClick={() => act.run(() => api(`/api/accounts/${a.cloud_acc_id}`, { method: 'PUT', body: { status: a.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' } }))}>{a.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}</button>{' '}
            <button className="btn danger sm" onClick={() => confirm(`Delete ${a.account_name} and all its resources, vulnerabilities and checks?`) && act.run(() => api(`/api/accounts/${a.cloud_acc_id}`, { method: 'DELETE' }), 'Account deleted')}>Delete</button></td>}
        </tr>)}</tbody></table> : <Empty>No cloud accounts yet.</Empty>}
    </div>
  </>);
}
