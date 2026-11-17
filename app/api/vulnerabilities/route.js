import { route, need } from '@/lib/api';
import { query } from '@/lib/db';
import { logAudit } from '@/lib/audit';

// Full-text search (tsvector + GIN index) + filters, ranked by relevance then severity
export const GET = route(null, async (req) => {
  const p = new URL(req.url).searchParams;
  const { rows } = await query(
    `SELECT v.vulnerability_id, v.title, v.description, v.severity, v.status, v.detected_date,
            v.resource_id, r.name AS resource_name, a.provider,
            (SELECT COUNT(*) FROM remediation m WHERE m.vulnerability_id = v.vulnerability_id) AS remediation_count
       FROM vulnerability v
       JOIN cloud_resource r ON r.resource_id = v.resource_id
       JOIN cloud_account  a ON a.cloud_acc_id = r.cloud_acc_id
      WHERE ($1::text IS NULL OR v.search_vector @@ websearch_to_tsquery('english', $1))
        AND ($2::text IS NULL OR v.severity = $2)
        AND ($3::text IS NULL OR v.status = $3)
        AND ($4::text IS NULL OR a.provider = $4)
      ORDER BY (CASE WHEN $1::text IS NULL THEN 0
                     ELSE ts_rank(v.search_vector, websearch_to_tsquery('english', $1)) END) DESC,
               fn_severity_rank(v.severity) DESC, v.detected_date`,
    [p.get('q') || null, p.get('severity') || null, p.get('status') || null, p.get('provider') || null]);
  return rows;
});

export const POST = route(['ADMIN', 'ANALYST'], async (req, _c, s) => {
  const b = await req.json();
  need(b, ['title', 'severity', 'resource_id']);
  const { rows } = await query(
    `INSERT INTO vulnerability(title, description, severity, detected_date, resource_id)
     VALUES ($1,$2,$3,COALESCE($4::date, CURRENT_DATE),$5) RETURNING *`,
    [b.title, b.description || null, b.severity, b.detected_date || null, b.resource_id]);
  await logAudit(s, 'CREATE', 'vulnerability', rows[0].vulnerability_id, { title: b.title, severity: b.severity });
  return rows[0];
});
