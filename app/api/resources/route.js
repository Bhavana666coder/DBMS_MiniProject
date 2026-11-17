import { route, need, emptyToNull } from '@/lib/api';
import { query } from '@/lib/db';
import { logAudit } from '@/lib/audit';

export const GET = route(null, async (req) => {
  const p = new URL(req.url).searchParams;
  const { rows } = await query(
    `SELECT * FROM v_resource_risk
      WHERE ($1::text IS NULL OR provider = $1)
        AND ($2::text IS NULL OR type = $2)
        AND ($3::text IS NULL OR name ILIKE '%' || $3 || '%')
      ORDER BY risk_score DESC, name`,
    [p.get('provider') || null, p.get('type') || null, p.get('q') || null]);
  return rows;
});

export const POST = route(['ADMIN', 'ANALYST'], async (req, _c, s) => {
  const b = await req.json();
  need(b, ['name', 'type', 'cloud_acc_id']);
  const { rows } = await query(
    `INSERT INTO cloud_resource(name, type, ip_address, status, cloud_acc_id)
     VALUES ($1,$2,$3,COALESCE($4,'RUNNING'),$5) RETURNING *`,
    [b.name, b.type, emptyToNull(b.ip_address), emptyToNull(b.status), b.cloud_acc_id]);
  await logAudit(s, 'CREATE', 'cloud_resource', rows[0].resource_id, b);
  return rows[0];
});
