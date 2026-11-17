import { route, updateById, HttpError } from '@/lib/api';
import { query } from '@/lib/db';
import { logAudit } from '@/lib/audit';

export const PUT = route(['ADMIN'], async (req, { params }, s) => {
  const row = await updateById('cloud_account', 'cloud_acc_id', params.id, await req.json(),
    ['account_name', 'region', 'status', 'user_id']);
  await logAudit(s, 'UPDATE', 'cloud_account', row.cloud_acc_id, row);
  return row;
});

export const DELETE = route(['ADMIN'], async (_req, { params }, s) => {
  const { rowCount } = await query('DELETE FROM cloud_account WHERE cloud_acc_id = $1', [params.id]);
  if (!rowCount) throw new HttpError(404, 'Account not found');
  await logAudit(s, 'DELETE', 'cloud_account', params.id, {});   // cascades to resources, vulnerabilities, checks
  return { ok: true };
});
