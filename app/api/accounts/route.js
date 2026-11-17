import { route, need } from '@/lib/api';
import { query } from '@/lib/db';
import { logAudit } from '@/lib/audit';

export const GET = route(null, async () => {
  const { rows } = await query(`
    SELECT a.*, u.name AS manager,
           (SELECT COUNT(*) FROM cloud_resource r WHERE r.cloud_acc_id = a.cloud_acc_id) AS resource_count
      FROM cloud_account a JOIN app_user u ON u.user_id = a.user_id
     ORDER BY a.provider, a.account_name`);
  return rows;
});

export const POST = route(['ADMIN'], async (req, _c, s) => {
  const b = await req.json();
  need(b, ['provider', 'account_name', 'region']);
  const { rows } = await query(
    `INSERT INTO cloud_account(provider, account_name, region, status, user_id)
     VALUES ($1,$2,$3,COALESCE($4,'ACTIVE'),$5) RETURNING *`,
    [b.provider, b.account_name, b.region, b.status || null, b.user_id || s.uid]);
  await logAudit(s, 'CREATE', 'cloud_account', rows[0].cloud_acc_id, b);
  return rows[0];
});
