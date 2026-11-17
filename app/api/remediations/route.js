import { route, need } from '@/lib/api';
import { query } from '@/lib/db';
import { logAudit } from '@/lib/audit';

export const GET = route(null, async (req) => {
  const p = new URL(req.url).searchParams;
  const { rows } = await query(
    `SELECT m.*, v.title, v.severity, r.name AS resource_name, u.name AS assignee,
            (m.status <> 'COMPLETED' AND m.due_date < CURRENT_DATE) AS overdue
       FROM remediation m
       JOIN vulnerability v  ON v.vulnerability_id = m.vulnerability_id
       JOIN cloud_resource r ON r.resource_id = v.resource_id
       LEFT JOIN app_user u  ON u.user_id = m.assigned_user_id
      WHERE ($1::text IS NULL OR m.status = $1)
        AND ($2::boolean IS NOT TRUE OR (m.status <> 'COMPLETED' AND m.due_date < CURRENT_DATE))
      ORDER BY overdue DESC, m.due_date`,
    [p.get('status') || null, p.get('overdue') === '1']);
  return rows;
});

// Uses the stored function fn_assign_remediation (validation + row lock + status change in one atomic call)
export const POST = route(['ADMIN', 'ANALYST'], async (req, _c, s) => {
  const b = await req.json();
  need(b, ['vulnerability_id', 'assigned_user_id', 'due_date', 'action_description']);
  const { rows } = await query('SELECT fn_assign_remediation($1,$2,$3,$4) AS id',
    [b.vulnerability_id, b.assigned_user_id, b.due_date, b.action_description]);
  await logAudit(s, 'ASSIGN', 'remediation', rows[0].id, b);
  return { remediation_id: rows[0].id };
});
