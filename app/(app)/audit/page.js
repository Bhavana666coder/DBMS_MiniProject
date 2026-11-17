'use client';
import { useState } from 'react';
import { useLoad, Notice, Empty, fmtTime } from '@/components/ui';

export default function Audit() {
  const [flt, setFlt] = useState({ action: '', entity: '' });
  const qs = new URLSearchParams(Object.entries(flt).filter(([, v]) => v)).toString();
  const { data, error } = useLoad(`/api/audit?${qs}`);
  const S = ({ title, rows }) => <section className="card"><h2>{title}</h2>{rows?.map((r) => <div className="row" key={r._id}><span className="lbl" style={{ width: 190, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r._id || 'anonymous'}</span><span className="val">{r.count}</span></div>)}</section>;
  return (<>
    <h1>Audit trail</h1>
    <p className="sub">Every sign-in and change, stored as flexible documents in MongoDB. Visible to administrators only.</p>
    <Notice error={error} />
    {data && <div className="grid2"><S title="Events by action" rows={data.stats.byAction} /><S title="Most active users" rows={data.stats.byUser} /><S title="Events by entity" rows={data.stats.byEntity} /></div>}
    <div className="toolbar">
      <select value={flt.action} onChange={(e) => setFlt({ ...flt, action: e.target.value })}><option value="">All actions</option>{data?.stats.byAction.map((a) => <option key={a._id}>{a._id}</option>)}</select>
      <select value={flt.entity} onChange={(e) => setFlt({ ...flt, entity: e.target.value })}><option value="">All entities</option>{data?.stats.byEntity.map((a) => <option key={a._id}>{a._id}</option>)}</select>
    </div>
    <div className="card tablewrap">
      {data?.logs.length ? <table><thead><tr><th>Time</th><th>User</th><th>Action</th><th>Entity</th><th>Details</th></tr></thead>
        <tbody>{data.logs.map((l, i) => <tr key={i}><td>{fmtTime(l.ts)}</td><td>{l.user_email || '-'} <small>({l.role || '-'})</small></td><td>{l.action}</td><td>{l.entity} {l.entity_id}</td><td><code style={{ fontSize: '.78rem' }}>{JSON.stringify(l.details).slice(0, 120)}</code></td></tr>)}</tbody></table> : <Empty>No events recorded yet.</Empty>}
    </div>
  </>);
}
