import { route } from '@/lib/api';
import { query } from '@/lib/db';

export const GET = route(null, async (req) => {
  const p = new URL(req.url).searchParams;
  const [summary, checks] = await Promise.all([
    query('SELECT * FROM v_compliance_summary ORDER BY standard_name'),
    query(
      `SELECT c.check_id, c.check_date, c.result, c.remarks, r.name AS resource_name, a.provider,
              cr.rule_name, cr.severity, s.standard_name
         FROM v_latest_checks c
         JOIN cloud_resource r     ON r.resource_id = c.resource_id
         JOIN cloud_account a      ON a.cloud_acc_id = r.cloud_acc_id
         JOIN compliance_rule cr   ON cr.rule_id = c.rule_id
         JOIN compliance_standard s ON s.standard_id = cr.standard_id
        WHERE ($1::text IS NULL OR c.result = $1) AND ($2::text IS NULL OR s.standard_name = $2)
        ORDER BY (c.result = 'FAIL') DESC, fn_severity_rank(cr.severity) DESC, r.name`,
      [p.get('result') || null, p.get('standard') || null]),
  ]);
  return { summary: summary.rows, checks: checks.rows };
});
