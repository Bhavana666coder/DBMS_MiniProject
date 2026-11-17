import { route, HttpError } from '@/lib/api';
import { query } from '@/lib/db';
import { logAudit } from '@/lib/audit';

// Analysts may only update remediations assigned to them; admins may update any.
// Triggers then set completed_date and resolve the parent vulnerability automatically.
export const PUT = route(['ADMIN', 'ANALYST'], async (req, { params }, s) => {
  const { status } = await req.json();
  const { rows } = await query(
    `UPDATE remediation SET status = $1
      WHERE remediation_id = $2 AND ($3 = 'ADMIN' OR assigned_user_id = $4) RETURNING *`,
    [status, params.id, s.role, s.uid]);
  if (!rows.length) throw new HttpError(403, 'Not found, or not assigned to you');
  await logAudit(s, 'STATUS_CHANGE', 'remediation', params.id, { status });
  return rows[0];
});
