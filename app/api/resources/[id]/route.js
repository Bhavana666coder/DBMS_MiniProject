import { route, updateById, HttpError } from '@/lib/api';
import { query } from '@/lib/db';
import { logAudit } from '@/lib/audit';

export const PUT = route(['ADMIN', 'ANALYST'], async (req, { params }, s) => {
  const row = await updateById('cloud_resource', 'resource_id', params.id, await req.json(),
    ['name', 'type', 'ip_address', 'status']);
  await logAudit(s, 'UPDATE', 'cloud_resource', row.resource_id, row);
  return row;
});

export const DELETE = route(['ADMIN'], async (_req, { params }, s) => {
  const { rowCount } = await query('DELETE FROM cloud_resource WHERE resource_id = $1', [params.id]);
  if (!rowCount) throw new HttpError(404, 'Resource not found');
  await logAudit(s, 'DELETE', 'cloud_resource', params.id, {});
  return { ok: true };
});
