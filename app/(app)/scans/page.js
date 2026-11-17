'use client';
import { useState } from 'react';
import { useLoad, useAction, useUser, canWrite, Badge, Notice, Empty, fmtTime, api } from '@/components/ui';

export default function Scans() {
  const user = useUser();
  const { data, error, reload } = useLoad('/api/scans');
  const { data: accounts } = useLoad('/api/accounts');
  const act = useAction(reload);
  const [acc, setAcc] = useState('');
  return (<>
    <h1>Scan reports</h1>
    <p className="sub">Each cloud returns findings in its own JSON format. Raw reports are kept in MongoDB, then normalised and imported into the SQL vulnerability table in one transaction.</p>
    <Notice error={error || act.error} ok={act.ok} />
    {canWrite(user) && <div className="card toolbar">
      <select value={acc} onChange={(e) => setAcc(e.target.value)}><option value="">Choose account…</option>{accounts?.map((a) => <option key={a.cloud_acc_id} value={a.cloud_acc_id}>{a.provider} / {a.account_name}</option>)}</select>
      <button className="btn" disabled={!acc} onClick={() => act.run(async () => { const r = await api('/api/scans', { method: 'POST', body: { cloud_acc_id: Number(acc) } }); act.setOk(`Scan stored with ${r.finding_count} raw findings`); })}>Run scan</button>
    </div>}
    <div className="grid2">
      <section className="card tablewrap"><h2>Reports</h2>
        {data?.reports.length ? <table><thead><tr><th>Account</th><th>Scanner</th><th>Scanned</th><th>Findings</th><th></th></tr></thead>
          <tbody>{data.reports.map((r) => <tr key={r._id}>
            <td><Badge v={r.provider} /> {r.account_name}</td><td>{r.scanner}</td><td>{fmtTime(r.scanned_at)}</td><td className="num">{r.finding_count}</td>
            <td>{r.imported ? <span style={{ color: 'var(--muted)' }}>Imported ({r.inserted} new, {r.skipped} skipped)</span>
              : canWrite(user) && <button className="btn ghost sm" onClick={() => act.run(async () => { const x = await api(`/api/scans/${r._id}/import`, { method: 'POST' }); act.setOk(`Imported ${x.inserted} new vulnerabilities, skipped ${x.skipped}`); })}>Import to SQL</button>}</td></tr>)}</tbody></table> : <Empty>No scans yet. Pick an account and run one.</Empty>}
      </section>
      <section className="card tablewrap"><h2>Raw findings by provider and severity</h2>
        {data?.bySeverity.length ? <table><thead><tr><th>Provider</th><th>Severity</th><th>Findings</th></tr></thead>
          <tbody>{data.bySeverity.map((s, i) => <tr key={i}><td><Badge v={s.provider} /></td><td><Badge v={s.severity} /></td><td className="num">{s.count}</td></tr>)}</tbody></table> : <Empty>Nothing to aggregate yet.</Empty>}
        <p className="empty" style={{ padding: 0 }}>MongoDB aggregation: $unwind, $addFields with $ifNull across three provider schemas, $group.</p>
      </section>
    </div>
  </>);
}
