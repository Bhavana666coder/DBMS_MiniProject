import { route, updateById, HttpError } from '@/lib/api';
import { query } from '@/lib/db';
import { logAudit } from '@/lib/audit';

export const PUT = route(['ADMIN', 'ANALYST'], async (req, { params }, s) => {
  const row = await updateById('vulnerability', 'vulnerability_id', params.id, await req.json(),
    ['title', 'description', 'severity', 'status']);
  const { search_vector, ...clean } = row;
  await logAudit(s, 'UPDATE', 'vulnerability', row.vulnerability_id, clean);
  return clean;
});

export const DELETE = route(['ADMIN'], async (_req, { params }, s) => {
  const { rowCount } = await query('DELETE FROM vulnerability WHERE vulnerability_id = $1', [params.id]);
  if (!rowCount) throw new HttpError(404, 'Vulnerability not found');
  await logAudit(s, 'DELETE', 'vulnerability', params.id, {});
  return { ok: true };
});
