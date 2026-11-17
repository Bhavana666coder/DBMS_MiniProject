'use client';
import { useState } from 'react';
import { useLoad, useAction, useUser, canWrite, Badge, Notice, Empty, fmtTime, api } from '@/components/ui';

export default function Compliance() {
  const user = useUser();
  const [flt, setFlt] = useState({ result: '', standard: '' });
  const qs = new URLSearchParams(Object.entries(flt).filter(([, v]) => v)).toString();
  const { data, error, reload } = useLoad(`/api/compliance?${qs}`);
  const act = useAction(reload);
  const scanAll = () => act.run(async () => { const r = await api('/api/compliance/scan', { method: 'POST', body: {} }); act.setOk(`Scanned ${r.scanned} resources, ${r.failures} rule failures`); });
  return (<>
    <h1>Compliance</h1>
    <p className="sub">Each rule is checked against every resource using the latest open findings. Run a scan to refresh results.</p>
    <Notice error={error || act.error} ok={act.ok} />
    {data && <div className="kpis">{data.summary.map((s) => (
      <div key={s.standard_id} className={`kpi ${s.compliance_pct < 80 ? 'warn' : ''}`}><b>{s.compliance_pct ?? '-'}%</b><span>{s.standard_name}: {s.passed} pass, {s.failed} fail</span></div>))}</div>}
    <div className="toolbar">
      <select value={flt.standard} onChange={(e) => setFlt({ ...flt, standard: e.target.value })}><option value="">All standards</option>{data?.summary.map((s) => <option key={s.standard_id}>{s.standard_name}</option>)}</select>
      <select value={flt.result} onChange={(e) => setFlt({ ...flt, result: e.target.value })}><option value="">All results</option><option>FAIL</option><option>PASS</option><option>NOT_APPLICABLE</option></select>
      {canWrite(user) && <button className="btn" onClick={scanAll}>Scan all resources</button>}
    </div>
    <div className="card tablewrap">
      {data?.checks.length ? <table><thead><tr><th>Result</th><th>Standard</th><th>Rule</th><th>Resource</th><th>Remarks</th><th>Checked</th></tr></thead>
        <tbody>{data.checks.map((c) => <tr key={c.check_id} className={c.result === 'FAIL' ? `sev-${c.severity}` : ''}>
          <td><Badge v={c.result} /></td><td>{c.standard_name}</td><td>{c.rule_name}</td><td><Badge v={c.provider} /> {c.resource_name}</td><td>{c.remarks}</td><td>{fmtTime(c.check_date)}</td></tr>)}</tbody></table> : <Empty>No checks match these filters.</Empty>}
    </div>
  </>);
}
