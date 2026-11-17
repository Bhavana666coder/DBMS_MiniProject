import { route } from '@/lib/api';
import { query } from '@/lib/db';
import { getDb } from '@/lib/mongo';

export const GET = route(null, async () => {
  const [kpi, sev, prov, top, comp] = await Promise.all([
    query(`SELECT (SELECT COUNT(*) FROM cloud_account WHERE status='ACTIVE') AS accounts,
                  (SELECT COUNT(*) FROM cloud_resource) AS resources,
                  (SELECT COUNT(*) FROM vulnerability WHERE status <> 'RESOLVED') AS open_vulns,
                  (SELECT COUNT(*) FROM vulnerability WHERE status <> 'RESOLVED' AND severity='CRITICAL') AS critical,
                  (SELECT COUNT(*) FROM v_overdue_remediations) AS overdue`),
    query(`SELECT severity, COUNT(*) AS count FROM vulnerability WHERE status <> 'RESOLVED'
            GROUP BY severity ORDER BY fn_severity_rank(severity) DESC`),
    query(`SELECT provider, SUM(open_vulns)::int AS open_vulns, ROUND(AVG(risk_score),1) AS avg_risk, COUNT(*) AS resources
             FROM v_resource_risk GROUP BY provider HAVING COUNT(*) > 0 ORDER BY open_vulns DESC`),
    query('SELECT * FROM v_resource_risk ORDER BY risk_score DESC, name LIMIT 5'),
    query('SELECT * FROM v_compliance_summary ORDER BY standard_name'),
  ]);
  let activity = [];
  try {   // MongoDB aggregation: audit events per day, last 7 days
    const db = await getDb();
    activity = await db.collection('audit_logs').aggregate([
      { $match: { ts: { $gte: new Date(Date.now() - 7 * 864e5) } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$ts' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } }, { $project: { _id: 0, day: '$_id', count: 1 } },
    ]).toArray();
  } catch {}
  return { kpi: kpi.rows[0], severity: sev.rows, providers: prov.rows, topRisk: top.rows, compliance: comp.rows, activity };
});
