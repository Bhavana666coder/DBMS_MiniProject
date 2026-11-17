-- =====================================================================
-- Important queries (JOIN / GROUP BY / HAVING / ORDER BY / aggregates / subqueries / window / CTE)
-- =====================================================================

-- Q1  JOIN (4 tables): open findings with resource, account and manager
SELECT v.title, v.severity, r.name AS resource, a.provider, a.account_name, u.name AS account_manager
FROM vulnerability v
JOIN cloud_resource r ON r.resource_id = v.resource_id
JOIN cloud_account  a ON a.cloud_acc_id = r.cloud_acc_id
JOIN app_user       u ON u.user_id = a.user_id
WHERE v.status <> 'RESOLVED'
ORDER BY fn_severity_rank(v.severity) DESC, v.detected_date;

-- Q2  GROUP BY + aggregate: open vulnerabilities per provider and severity
SELECT a.provider, v.severity, COUNT(*) AS open_count
FROM vulnerability v
JOIN cloud_resource r ON r.resource_id = v.resource_id
JOIN cloud_account  a ON a.cloud_acc_id = r.cloud_acc_id
WHERE v.status <> 'RESOLVED'
GROUP BY a.provider, v.severity
ORDER BY a.provider, fn_severity_rank(v.severity) DESC;

-- Q3  HAVING: resources with 2 or more unresolved vulnerabilities
SELECT r.name, COUNT(*) AS open_vulns, MAX(r.risk_score) AS risk
FROM cloud_resource r JOIN vulnerability v ON v.resource_id = r.resource_id
WHERE v.status <> 'RESOLVED'
GROUP BY r.resource_id, r.name
HAVING COUNT(*) >= 2
ORDER BY open_vulns DESC;

-- Q4  Correlated subquery: resources whose risk is above their own account's average
SELECT r.name, r.risk_score
FROM cloud_resource r
WHERE r.risk_score > (SELECT AVG(r2.risk_score) FROM cloud_resource r2 WHERE r2.cloud_acc_id = r.cloud_acc_id)
ORDER BY r.risk_score DESC;

-- Q5  NOT EXISTS: unresolved CRITICAL/HIGH findings nobody is working on
SELECT v.vulnerability_id, v.title, v.severity
FROM vulnerability v
WHERE v.status = 'OPEN' AND v.severity IN ('CRITICAL','HIGH')
  AND NOT EXISTS (SELECT 1 FROM remediation m WHERE m.vulnerability_id = v.vulnerability_id);

-- Q6  Full-text search with relevance ranking (uses GIN index idx_vuln_search)
SELECT title, severity, ts_rank(search_vector, q) AS rank
FROM vulnerability, websearch_to_tsquery('english', 'public access OR encrypted') q
WHERE search_vector @@ q
ORDER BY rank DESC;

-- Q7  Analyst workload and delivery (LEFT JOIN + FILTER aggregates)
SELECT u.name,
       COUNT(m.remediation_id)                                                        AS assigned,
       COUNT(*) FILTER (WHERE m.status = 'COMPLETED')                                 AS completed,
       COUNT(*) FILTER (WHERE m.status <> 'COMPLETED' AND m.due_date < CURRENT_DATE)  AS overdue,
       ROUND(AVG(m.completed_date - m.assigned_date), 1)                              AS avg_days_to_close
FROM app_user u LEFT JOIN remediation m ON m.assigned_user_id = u.user_id
WHERE u.role <> 'VIEWER'
GROUP BY u.user_id, u.name
ORDER BY assigned DESC;

-- Q8  Window function: rank resources by risk inside each provider
SELECT provider, name, risk_score,
       RANK() OVER (PARTITION BY provider ORDER BY risk_score DESC) AS rank_in_provider
FROM v_resource_risk;

-- Q9  CTE: worst-failing resource per compliance standard
WITH fails AS (
    SELECT s.standard_name, r.name AS resource, COUNT(*) AS failed_rules
    FROM v_latest_checks c
    JOIN compliance_rule cr    ON cr.rule_id = c.rule_id
    JOIN compliance_standard s ON s.standard_id = cr.standard_id
    JOIN cloud_resource r      ON r.resource_id = c.resource_id
    WHERE c.result = 'FAIL'
    GROUP BY s.standard_name, r.name)
SELECT DISTINCT ON (standard_name) standard_name, resource, failed_rules
FROM fails ORDER BY standard_name, failed_rules DESC;

-- Q10 Views
SELECT * FROM v_compliance_summary ORDER BY compliance_pct;
SELECT * FROM v_overdue_remediations ORDER BY days_overdue DESC;

-- Q11 Average days from detection to fix, by severity
SELECT v.severity, COUNT(*) AS fixed, ROUND(AVG(m.completed_date - v.detected_date), 1) AS avg_days_detect_to_fix
FROM remediation m JOIN vulnerability v ON v.vulnerability_id = m.vulnerability_id
WHERE m.status = 'COMPLETED'
GROUP BY v.severity ORDER BY fn_severity_rank(v.severity) DESC;

-- Q12 DML examples
INSERT INTO vulnerability(title, description, severity, resource_id)
VALUES ('Demo finding for DML', 'Inserted by queries.sql', 'LOW', 1);
UPDATE vulnerability SET severity = 'MEDIUM' WHERE title = 'Demo finding for DML';
DELETE FROM vulnerability WHERE title = 'Demo finding for DML';

-- Q13 Query plan (shows the GIN index is usable for full-text search)
EXPLAIN SELECT 1 FROM vulnerability WHERE search_vector @@ plainto_tsquery('english', 'encrypted');
