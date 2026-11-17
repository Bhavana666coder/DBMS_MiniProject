'use client';
import { useLoad, Notice, Badge } from '@/components/ui';

const Bar = ({ label, value, max, color }) => (
  <div className="row"><span className="lbl">{label}</span>
    <div className="meter"><i style={{ width: `${max ? (value / max) * 100 : 0}%`, background: color }} /></div>
    <span className="val">{value}</span></div>
);
const SEV = { CRITICAL: 'var(--crit)', HIGH: 'var(--high)', MEDIUM: 'var(--med)', LOW: 'var(--low)' };

export default function Dashboard() {
  const { data: d, error } = useLoad('/api/dashboard');
  if (error) return <Notice error={error} />;
  if (!d) return <p className="empty">Loading overview…</p>;
  const k = d.kpi;
  const maxSev = Math.max(1, ...d.severity.map((s) => s.count));
  const maxAct = Math.max(1, ...d.activity.map((a) => a.count));
  return (<>
    <h1>Security overview</h1>
    <p className="sub">Live exposure and compliance posture across every connected cloud account.</p>
    <div className="kpis">
      <div className="kpi"><b>{k.accounts}</b><span>active cloud accounts</span></div>
      <div className="kpi"><b>{k.resources}</b><span>tracked resources</span></div>
      <div className="kpi warn"><b>{k.open_vulns}</b><span>open vulnerabilities</span></div>
      <div className="kpi crit"><b>{k.critical}</b><span>critical and unresolved</span></div>
      <div className="kpi crit"><b>{k.overdue}</b><span>overdue remediations</span></div>
    </div>
    <div className="grid2">
      <section className="card"><h2>Open vulnerabilities by severity</h2>
        {d.severity.length ? d.severity.map((s) => <Bar key={s.severity} label={s.severity} value={s.count} max={maxSev} color={SEV[s.severity]} />) : <p className="empty">Nothing open. Nice.</p>}
      </section>
      <section className="card"><h2>Compliance by standard</h2>
        {d.compliance.map((c) => <Bar key={c.standard_id} label={c.standard_name} value={c.compliance_pct ?? 0} max={100} color="var(--ok)" />)}
        <p className="empty" style={{ padding: 0 }}>Percent of latest rule checks passing.</p>
      </section>
      <section className="card"><h2>Exposure by provider</h2>
        <div className="tablewrap"><table><thead><tr><th>Provider</th><th>Resources</th><th>Open vulns</th><th>Avg risk score</th></tr></thead>
          <tbody>{d.providers.map((p) => <tr key={p.provider}><td><Badge v={p.provider} /></td><td className="num">{p.resources}</td><td className="num">{p.open_vulns}</td><td className="num">{p.avg_risk}</td></tr>)}</tbody></table></div>
      </section>
      <section className="card"><h2>Highest-risk resources</h2>
        <div className="tablewrap"><table><thead><tr><th>Resource</th><th>Provider</th><th>Open</th><th>Risk</th></tr></thead>
          <tbody>{d.topRisk.map((r) => <tr key={r.resource_id}><td>{r.name}</td><td><Badge v={r.provider} /></td><td className="num">{r.open_vulns}</td><td className="num"><b>{r.risk_score}</b></td></tr>)}</tbody></table></div>
      </section>
    </div>
    <section className="card"><h2>Team activity, last 7 days</h2>
      {d.activity.length ? d.activity.map((a) => <Bar key={a.day} label={a.day} value={a.count} max={maxAct} color="var(--accent)" />) : <p className="empty">No audit events recorded yet.</p>}
      <p className="empty" style={{ padding: 0 }}>Computed with a MongoDB aggregation over the audit trail.</p>
    </section>
  </>);
}
