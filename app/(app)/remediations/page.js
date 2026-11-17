'use client';
import { useState } from 'react';
import { useLoad, useAction, useUser, canWrite, Badge, Notice, Empty, fmtDate, api } from '@/components/ui';

export default function Remediations() {
  const user = useUser();
  const [status, setStatus] = useState('');
  const [overdue, setOverdue] = useState(false);
  const qs = new URLSearchParams({ ...(status && { status }), ...(overdue && { overdue: '1' }) }).toString();
  const { data, error, reload } = useLoad(`/api/remediations?${qs}`);
  const act = useAction(reload);
  const mine = (r) => user.role === 'ADMIN' || r.assigned_user_id === user.uid;
  return (<>
    <h1>Remediation tasks</h1>
    <p className="sub">Work assigned to fix vulnerabilities. Completing the last open task on a finding resolves it automatically.</p>
    <Notice error={error || act.error} ok={act.ok} />
    <div className="toolbar">
      <select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option><option>PENDING</option><option>IN_PROGRESS</option><option>COMPLETED</option></select>
      <label><input type="checkbox" checked={overdue} onChange={(e) => setOverdue(e.target.checked)} /> Overdue only</label>
    </div>
    <div className="card tablewrap">
      {data?.length ? <table><thead><tr><th>Action</th><th>Finding</th><th>Resource</th><th>Assignee</th><th>Due</th><th>Completed</th><th>Status</th></tr></thead>
        <tbody>{data.map((r) => <tr key={r.remediation_id} className={`sev-${r.status === 'COMPLETED' ? 'RESOLVED' : r.severity}`}>
          <td>{r.action_description}</td><td>{r.title} <Badge v={r.severity} /></td><td>{r.resource_name}</td><td>{r.assignee || '-'}</td>
          <td>{fmtDate(r.due_date)} {r.overdue && <Badge v="OVERDUE" />}</td><td>{fmtDate(r.completed_date)}</td>
          <td>{canWrite(user) && mine(r) ? <select value={r.status} onChange={(e) => act.run(() => api(`/api/remediations/${r.remediation_id}`, { method: 'PUT', body: { status: e.target.value } }), 'Status updated')}><option>PENDING</option><option>IN_PROGRESS</option><option>COMPLETED</option></select> : <Badge v={r.status} />}</td>
        </tr>)}</tbody></table> : <Empty>No remediation tasks match. Assign one from the Vulnerabilities page.</Empty>}
    </div>
  </>);
}
