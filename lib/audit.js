import { getDb } from './mongo';

// Append-only audit trail stored in MongoDB. Never blocks or fails the main request.
export async function logAudit(session, action, entity, entityId, details = {}) {
  try {
    const db = await getDb();
    await db.collection('audit_logs').insertOne({
      ts: new Date(),
      user_id: session?.uid ?? null,
      user_email: session?.email ?? null,
      role: session?.role ?? null,
      action, entity, entity_id: entityId ?? null, details,
    });
  } catch (e) { console.error('audit log failed:', e.message); }
}
