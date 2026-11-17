import { route, need, HttpError } from '@/lib/api';
import { query } from '@/lib/db';
import { getDb } from '@/lib/mongo';
import { simulateScan, normalize } from '@/lib/scanner';
import { logAudit } from '@/lib/audit';

export const GET = route(null, async () => {
  const col = (await getDb()).collection('scan_reports');
  const reports = await col.find({}, { projection: { raw_findings: 0 } }).sort({ scanned_at: -1 }).limit(30).toArray();
  // Aggregation over heterogeneous provider documents: normalise severity from three different field paths
  const bySeverity = await col.aggregate([
    { $unwind: '$raw_findings' },
    { $addFields: { sev: { $toUpper: { $ifNull: ['$raw_findings.Severity.Label',
        { $ifNull: ['$raw_findings.properties.severity', '$raw_findings.severity'] }] } } } },
    { $group: { _id: { provider: '$provider', severity: '$sev' }, count: { $sum: 1 } } },
    { $sort: { '_id.provider': 1, count: -1 } },
    { $project: { _id: 0, provider: '$_id.provider', severity: '$_id.severity', count: 1 } },
  ]).toArray();
  return { reports: reports.map((r) => ({ ...r, _id: String(r._id) })), bySeverity };
});

// Simulate a provider scan -> store RAW provider JSON in MongoDB
export const POST = route(['ADMIN', 'ANALYST'], async (req, _c, s) => {
  const { cloud_acc_id } = await req.json();
  need({ cloud_acc_id }, ['cloud_acc_id']);
  const acc = (await query('SELECT * FROM cloud_account WHERE cloud_acc_id = $1', [cloud_acc_id])).rows[0];
  if (!acc) throw new HttpError(404, 'Account not found');
  const resources = (await query("SELECT name, type FROM cloud_resource WHERE cloud_acc_id = $1 AND status <> 'TERMINATED'", [cloud_acc_id])).rows;
  if (!resources.length) throw new HttpError(400, 'This account has no resources to scan');
  const raw_findings = simulateScan(acc, resources);
  const doc = { account_id: acc.cloud_acc_id, account_name: acc.account_name, provider: acc.provider,
    scanner: { AWS: 'AWS Security Hub', AZURE: 'Microsoft Defender for Cloud', GCP: 'Security Command Center' }[acc.provider],
    scanned_at: new Date(), scanned_by: s.email, finding_count: raw_findings.length, imported: false, raw_findings };
  const r = await (await getDb()).collection('scan_reports').insertOne(doc);
  await logAudit(s, 'SCAN', 'scan_reports', String(r.insertedId), { account: acc.account_name, findings: raw_findings.length });
  return { id: String(r.insertedId), finding_count: raw_findings.length };
});
