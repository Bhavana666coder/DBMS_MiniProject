'use client';
import { useState } from 'react';
import { useLoad, useAction, useUser, canWrite, Badge, Notice, Empty, api } from '@/components/ui';

const TYPES = ['VM', 'STORAGE', 'DATABASE', 'NETWORK', 'IAM', 'FUNCTION', 'CONTAINER'];

export default function Resources() {
  const user = useUser();
  const [flt, setFlt] = useState({ q: '', provider: '', type: '' });
  const qs = new URLSearchParams(Object.entries(flt).filter(([, v]) => v)).toString();
  const { data, error, reload } = useLoad(`/api/resources?${qs}`);
  const { data: accounts } = useLoad('/api/accounts');
  const act = useAction(reload);
  const [f, setF] = useState({ name: '', type: 'VM', ip_address: '', cloud_acc_id: '' });
  const add = (e) => { e.preventDefault(); act.run(async () => { await api('/api/resources', { method: 'POST', body: f }); setF({ ...f, name: '', ip_address: '' }); }, 'Resource added'); };
  return (<>
    <h1>Resources</h1>
    <p className="sub">Servers, buckets, databases and identities, ranked by risk score (weighted sum of unresolved vulnerabilities).</p>
    <Notice error={error || act.error} ok={act.ok} />
    {canWrite(user) && <form className="card form" onSubmit={add}>
      <label>Name<input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
      <label>Type<select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
      <label>IP address (optional)<input value={f.ip_address} onChange={(e) => setF({ ...f, ip_address: e.target.value })} placeholder="10.0.0.5" /></label>
      <label>Cloud account<select required value={f.cloud_acc_id} onChange={(e) => setF({ ...f, cloud_acc_id: e.target.value })}><option value="">Select…</option>{accounts?.map((a) => <option key={a.cloud_acc_id} value={a.cloud_acc_id}>{a.provider} / {a.account_name}</option>)}</select></label>
      <button className="btn" type="submit">Add resource</button>
    </form>}
    <div className="toolbar">
      <input placeholder="Search by name" value={flt.q} onChange={(e) => setFlt({ ...flt, q: e.target.value })} />
      <select value={flt.provider} onChange={(e) => setFlt({ ...flt, provider: e.target.value })}><option value="">All providers</option><option>AWS</option><option>AZURE</option><option>GCP</option></select>
      <select value={flt.type} onChange={(e) => setFlt({ ...flt, type: e.target.value })}><option value="">All types</option>{TYPES.map((t) => <option key={t}>{t}</option>)}</select>
    </div>
    <div className="card tablewrap">
      {data?.length ? <table><thead><tr><th>Resource</th><th>Type</th><th>Provider / account</th><th>IP</th><th>Status</th><th>Open vulns</th><th>Risk</th>{canWrite(user) && <th></th>}</tr></thead>
        <tbody>{data.map((r) => <tr key={r.resource_id} className={r.critical_vulns ? 'sev-CRITICAL' : r.open_vulns ? 'sev-MEDIUM' : ''}>
          <td>{r.name}</td><td>{r.type}</td><td><Badge v={r.provider} /> {r.account_name}</td><td>{r.ip_address || '-'}</td><td><Badge v={r.status} /></td>
          <td className="num">{r.open_vulns}</td><td className="num"><b>{r.risk_score}</b></td>
          {canWrite(user) && <td style={{ whiteSpace: 'nowrap' }}>
            <button className="btn ghost sm" onClick={() => act.run(async () => { const x = await api('/api/compliance/scan', { method: 'POST', body: { resource_id: r.resource_id } }); }, `Compliance scan finished for ${r.name}`)}>Scan</button>{' '}
            {user.role === 'ADMIN' && <button className="btn danger sm" onClick={() => confirm(`Delete ${r.name}?`) && act.run(() => api(`/api/resources/${r.resource_id}`, { method: 'DELETE' }), 'Resource deleted')}>Delete</button>}</td>}
        </tr>)}</tbody></table> : <Empty>No resources match these filters.</Empty>}
    </div>
  </>);
}
