import { ObjectId } from 'mongodb';
import { route, HttpError } from '@/lib/api';
import { withTransaction } from '@/lib/db';
import { getDb } from '@/lib/mongo';
import { normalize } from '@/lib/scanner';
import { logAudit } from '@/lib/audit';

// Import a Mongo scan report into PostgreSQL: normalise -> de-duplicate -> insert, all in ONE SQL transaction.
export const POST = route(['ADMIN', 'ANALYST'], async (_req, { params }, s) => {
  if (!ObjectId.isValid(params.id)) throw new HttpError(400, 'Invalid report id');
  const col = (await getDb()).collection('scan_reports');
  const report = await col.findOne({ _id: new ObjectId(params.id) });
  if (!report) throw new HttpError(404, 'Report not found');
  if (report.imported) throw new HttpError(409, 'This report was already imported');

  let inserted = 0, skipped = 0;
  await withTransaction(async (c) => {
    for (const raw of report.raw_findings) {
      const f = normalize(report.provider, raw);
      const res = await c.query('SELECT resource_id FROM cloud_resource WHERE cloud_acc_id = $1 AND name = $2',
        [report.account_id, f.resource_name]);
      if (!res.rows.length) { skipped++; continue; }
      const dup = await c.query(
        "SELECT 1 FROM vulnerability WHERE resource_id = $1 AND title = $2 AND status <> 'RESOLVED'",
        [res.rows[0].resource_id, f.title]);
      if (dup.rows.length) { skipped++; continue; }
      await c.query('INSERT INTO vulnerability(title, description, severity, resource_id) VALUES ($1,$2,$3,$4)',
        [f.title, f.description, f.severity, res.rows[0].resource_id]);   // CHECK constraints validate severity
      inserted++;
    }
  });
  await col.updateOne({ _id: report._id }, { $set: { imported: true, imported_at: new Date(), inserted, skipped } });
  await logAudit(s, 'IMPORT_SCAN', 'scan_reports', params.id, { inserted, skipped });
  return { inserted, skipped };
});
