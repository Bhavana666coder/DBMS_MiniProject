import { route } from '@/lib/api';
import { getDb } from '@/lib/mongo';

export const GET = route(['ADMIN'], async (req) => {
  const p = new URL(req.url).searchParams;
  const db = await getDb();
  const match = {};
  if (p.get('action')) match.action = p.get('action');
  if (p.get('entity')) match.entity = p.get('entity');
  const col = db.collection('audit_logs');
  const [logs, stats] = await Promise.all([
    col.find(match).sort({ ts: -1 }).limit(100).toArray(),
    col.aggregate([{ $facet: {
      byAction: [{ $group: { _id: '$action', count: { $sum: 1 } } }, { $sort: { count: -1 } }],
      byUser:   [{ $group: { _id: '$user_email', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 5 }],
      byEntity: [{ $group: { _id: '$entity', count: { $sum: 1 } } }, { $sort: { count: -1 } }],
    } }]).toArray(),
  ]);
  return { logs: logs.map(({ _id, ...l }) => l), stats: stats[0] };
});
