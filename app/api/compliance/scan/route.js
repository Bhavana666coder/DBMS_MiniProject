import { route } from '@/lib/api';
import { query, withTransaction } from '@/lib/db';
import { logAudit } from '@/lib/audit';

// Scan one resource, or ALL resources inside a single transaction (all-or-nothing)
export const POST = route(['ADMIN', 'ANALYST'], async (req, _c, s) => {
  const { resource_id } = await req.json().catch(() => ({}));
  let failures = 0, scanned = 0;
  if (resource_id) {
    const { rows } = await query('SELECT fn_run_compliance_scan($1) AS f', [resource_id]);
    failures = rows[0].f; scanned = 1;
  } else {
    await withTransaction(async (c) => {
      const { rows: res } = await c.query("SELECT resource_id FROM cloud_resource WHERE status <> 'TERMINATED'");
      for (const r of res) { failures += (await c.query('SELECT fn_run_compliance_scan($1) AS f', [r.resource_id])).rows[0].f; scanned++; }
    });
  }
  await logAudit(s, 'COMPLIANCE_SCAN', 'compliance_check', resource_id ?? 'ALL', { scanned, failures });
  return { scanned, failures };
});
