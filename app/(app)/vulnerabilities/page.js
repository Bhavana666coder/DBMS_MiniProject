'use client';
import { useState } from 'react';
import { useLoad, useAction, useUser, canWrite, Badge, Notice, Empty, fmtDate, api } from '@/components/ui';

const SEVS = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

export default function Vulnerabilities() {
  const user = useUser();
  const [flt, setFlt] = useState({ q: '', severity: '', status: '', provider: '' });
  const qs = new URLSearchParams(Object.entries(flt).filter(([, v]) => v)).toString();
  const { data, error, reload } = useLoad(`/api/vulnerabilities?${qs}`);
  const { data: resources } = useLoad('/api/resources');
  const { data: users } = useLoad(canWrite(user) ? '/api/users' : null);
  const act = useAction(reload);
  const [f, setF] = useState({ title: '', description: '', severity: 'MEDIUM', resource_id: '' });
  const [assign, setAssign] = useState(null); // vulnerability being assigned
  const [a, setA] = useState({ assigned_user_id: '', due_date: '', action_description: '' });

  const add = (e) => { e.preventDefault(); act.run(async () => { await api('/api/vulnerabilities', { method: 'POST', body: f }); setF({ ...f, title: '', description: '' }); }, 'Vulnerability recorded'); };
  const doAssign = (e) => { e.preventDefault(); act.run(async () => { await api('/api/remediations', { method: 'POST', body: { ...a, vulnerability_id: assign.vulnerability_id } }); setAssign(null); setA({ assigned_user_id: '', due_date: '', action_description: '' }); }, 'Remediation assigned'); };

  return (<>
    <h1>Vulnerabilities</h1>
    <p className="sub">Search findings with full-text search (stemming and relevance ranking), then assign remediation work.</p>
    <Notice error={error || act.error} ok={act.ok} />
    {canWrite(user) && <form className="card form" onSubmit={add}>
      <label>Title<input required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
      <label>Severity<select value={f.severity} onChange={(e) => setF({ ...f, severity: e.target.value })}>{SEVS.map((s) => <option key={s}>{s}</option>)}</select></label>
      <label>Resource<select required value={f.resource_id} onChange={(e) => setF({ ...f, resource_id: e.target.value })}><option value="">Select…</option>{resources?.map((r) => <option key={r.resource_id} value={r.resource_id}>{r.name} ({r.provider})</option>)}</select></label>
      <label className="wide">Description<textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></label>
      <button className="btn" type="submit">Record vulnerability</button>
    </form>}
    {assign && <form className="card form" onSubmit={doAssign}>
      <h2 className="wide">Assign remediation for “{assign.title}”</h2>
      <label>Assign to<select required value={a.assigned_user_id} onChange={(e) => setA({ ...a, assigned_user_id: e.target.value })}><option value="">Select…</option>{users?.map((u) => <option key={u.user_id} value={u.user_id}>{u.name} ({u.role.toLowerCase()})</option>)}</select></label>
      <label>Due date<input type="date" required value={a.due_date} onChange={(e) => setA({ ...a, due_date: e.target.value })} /></label>
      <label className="wide">Action to take<textarea required value={a.action_description} onChange={(e) => setA({ ...a, action_description: e.target.value })} /></label>
      <div><button className="btn" type="submit">Assign</button> <button type="button" className="btn ghost" onClick={() => setAssign(null)}>Cancel</button></div>
    </form>}
    <div className="toolbar">
      <input placeholder="Search e.g. public bucket, encrypt, ssh" value={flt.q} onChange={(e) => setFlt({ ...flt, q: e.target.value })} style={{ minWidth: 260 }} />
      <select value={flt.severity} onChange={(e) => setFlt({ ...flt, severity: e.target.value })}><option value="">All severities</option>{SEVS.map((s) => <option key={s}>{s}</option>)}</select>
      <select value={flt.status} onChange={(e) => setFlt({ ...flt, status: e.target.value })}><option value="">All statuses</option><option>OPEN</option><option>IN_PROGRESS</option><option>RESOLVED</option></select>
      <select value={flt.provider} onChange={(e) => setFlt({ ...flt, provider: e.target.value })}><option value="">All providers</option><option>AWS</option><option>AZURE</option><option>GCP</option></select>
    </div>
    <div className="card tablewrap">
      {data?.length ? <table><thead><tr><th>Finding</th><th>Severity</th><th>Status</th><th>Resource</th><th>Detected</th><th>Tasks</th>{canWrite(user) && <th></th>}</tr></thead>
        <tbody>{data.map((v) => <tr key={v.vulnerability_id} className={`sev-${v.status === 'RESOLVED' ? 'RESOLVED' : v.severity}`}>
          <td><b>{v.title}</b><br /><span style={{ color: 'var(--muted)' }}>{v.description}</span></td>
          <td><Badge v={v.severity} /></td><td><Badge v={v.status} /></td><td><Badge v={v.provider} /> {v.resource_name}</td><td>{fmtDate(v.detected_date)}</td><td className="num">{v.remediation_count}</td>
          {canWrite(user) && <td style={{ whiteSpace: 'nowrap' }}>
            {v.status !== 'RESOLVED' && <button className="btn ghost sm" onClick={() => setAssign(v)}>Assign</button>}{' '}
            {user.role === 'ADMIN' && <button className="btn danger sm" onClick={() => confirm('Delete this vulnerability?') && act.run(() => api(`/api/vulnerabilities/${v.vulnerability_id}`, { method: 'DELETE' }), 'Vulnerability deleted')}>Delete</button>}</td>}
        </tr>)}</tbody></table> : <Empty>No vulnerabilities match. Try fewer filters or a different search term.</Empty>}
    </div>
  </>);
}
