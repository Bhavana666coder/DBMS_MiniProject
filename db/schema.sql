-- =====================================================================
-- Cloud Sentinel : Multi-Cloud Vulnerability & Compliance Tracker
-- PostgreSQL schema  (DDL + constraints + indexes + functions + triggers + views)
-- Run:  npm run db:setup      (or: psql "$DATABASE_URL" -f db/schema.sql)
-- =====================================================================

-- ---------- 0. DROP (clean re-run) ----------
DROP VIEW  IF EXISTS v_overdue_remediations, v_compliance_summary, v_latest_checks, v_resource_risk CASCADE;
DROP TABLE IF EXISTS compliance_check, compliance_rule, compliance_standard,
                     remediation, vulnerability, cloud_resource, cloud_account, app_user CASCADE;

-- ---------- 1. CREATE TABLES ----------
CREATE TABLE app_user (
    user_id        SERIAL        PRIMARY KEY,
    name           VARCHAR(100)  NOT NULL CHECK (length(trim(name)) >= 2),
    email          VARCHAR(150)  NOT NULL UNIQUE
                   CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
    password_hash  TEXT          NOT NULL,            -- bcrypt hash, never plain text
    role           VARCHAR(10)   NOT NULL CHECK (role IN ('ADMIN','ANALYST','VIEWER')),
    created_at     TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE TABLE cloud_account (
    cloud_acc_id   SERIAL        PRIMARY KEY,
    provider       VARCHAR(10)   NOT NULL CHECK (provider IN ('AWS','AZURE','GCP')),
    account_name   VARCHAR(100)  NOT NULL,
    region         VARCHAR(40)   NOT NULL,
    status         VARCHAR(10)   NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
    user_id        INT           NOT NULL,            -- manager (User 1 --- N Cloud Account)
    CONSTRAINT uq_account UNIQUE (provider, account_name)
);

CREATE TABLE cloud_resource (
    resource_id    SERIAL        PRIMARY KEY,
    name           VARCHAR(100)  NOT NULL,
    type           VARCHAR(20)   NOT NULL CHECK (type IN
                   ('VM','STORAGE','DATABASE','NETWORK','IAM','FUNCTION','CONTAINER')),
    ip_address     INET,
    status         VARCHAR(12)   NOT NULL DEFAULT 'RUNNING'
                   CHECK (status IN ('RUNNING','STOPPED','TERMINATED')),
    cloud_acc_id   INT           NOT NULL,            -- (Cloud Account 1 --- N Resource)
    CONSTRAINT uq_resource_name UNIQUE (cloud_acc_id, name)
);

CREATE TABLE vulnerability (
    vulnerability_id SERIAL      PRIMARY KEY,
    title            VARCHAR(200) NOT NULL CHECK (length(trim(title)) >= 3),
    description      TEXT,
    severity         VARCHAR(10) NOT NULL CHECK (severity IN ('LOW','MEDIUM','HIGH','CRITICAL')),
    status           VARCHAR(12) NOT NULL DEFAULT 'OPEN'
                     CHECK (status IN ('OPEN','IN_PROGRESS','RESOLVED')),
    detected_date    DATE        NOT NULL DEFAULT CURRENT_DATE
                     CHECK (detected_date <= CURRENT_DATE),
    resource_id      INT         NOT NULL,            -- (Resource 1 --- N Vulnerability)
    -- full-text search column, maintained automatically by PostgreSQL
    search_vector    tsvector GENERATED ALWAYS AS
                     (to_tsvector('english', coalesce(title,'') || ' ' || coalesce(description,''))) STORED
);

CREATE TABLE remediation (
    remediation_id     SERIAL     PRIMARY KEY,
    action_description TEXT       NOT NULL CHECK (length(trim(action_description)) >= 5),
    assigned_date      DATE       NOT NULL DEFAULT CURRENT_DATE,
    due_date           DATE       NOT NULL,
    completed_date     DATE,
    status             VARCHAR(12) NOT NULL DEFAULT 'PENDING'
                       CHECK (status IN ('PENDING','IN_PROGRESS','COMPLETED')),
    vulnerability_id   INT        NOT NULL,          -- (Vulnerability 1 --- N Remediation)
    assigned_user_id   INT,                           -- (User 1 --- N Remediation)
    CONSTRAINT ck_due_after_assigned CHECK (due_date >= assigned_date),
    CONSTRAINT ck_completed_after_assigned CHECK (completed_date IS NULL OR completed_date >= assigned_date)
);

CREATE TABLE compliance_standard (
    standard_id    SERIAL        PRIMARY KEY,
    standard_name  VARCHAR(100)  NOT NULL UNIQUE,
    description    TEXT
);

CREATE TABLE compliance_rule (
    rule_id        SERIAL        PRIMARY KEY,
    rule_name      VARCHAR(150)  NOT NULL,
    description    TEXT,
    severity       VARCHAR(10)   NOT NULL CHECK (severity IN ('LOW','MEDIUM','HIGH','CRITICAL')),
    standard_id    INT           NOT NULL,            -- (Standard 1 --- N Rule)
    CONSTRAINT uq_rule UNIQUE (standard_id, rule_name)
);

CREATE TABLE compliance_check (
    check_id       SERIAL        PRIMARY KEY,
    check_date     TIMESTAMPTZ   NOT NULL DEFAULT now(),
    result         VARCHAR(15)   NOT NULL CHECK (result IN ('PASS','FAIL','NOT_APPLICABLE')),
    remarks        TEXT,
    rule_id        INT           NOT NULL,            -- (Rule 1 --- N Check)
    resource_id    INT           NOT NULL             -- (Resource 1 --- N Check)
);

-- ---------- 2. ALTER (foreign keys added separately + schema evolution) ----------
ALTER TABLE cloud_account    ADD CONSTRAINT fk_account_user
      FOREIGN KEY (user_id) REFERENCES app_user(user_id) ON DELETE RESTRICT;
ALTER TABLE cloud_resource   ADD CONSTRAINT fk_resource_account
      FOREIGN KEY (cloud_acc_id) REFERENCES cloud_account(cloud_acc_id) ON DELETE CASCADE;
ALTER TABLE vulnerability    ADD CONSTRAINT fk_vuln_resource
      FOREIGN KEY (resource_id) REFERENCES cloud_resource(resource_id) ON DELETE CASCADE;
ALTER TABLE remediation      ADD CONSTRAINT fk_rem_vuln
      FOREIGN KEY (vulnerability_id) REFERENCES vulnerability(vulnerability_id) ON DELETE CASCADE;
ALTER TABLE remediation      ADD CONSTRAINT fk_rem_user
      FOREIGN KEY (assigned_user_id) REFERENCES app_user(user_id) ON DELETE SET NULL;
ALTER TABLE compliance_rule  ADD CONSTRAINT fk_rule_standard
      FOREIGN KEY (standard_id) REFERENCES compliance_standard(standard_id) ON DELETE CASCADE;
ALTER TABLE compliance_check ADD CONSTRAINT fk_check_rule
      FOREIGN KEY (rule_id) REFERENCES compliance_rule(rule_id) ON DELETE CASCADE;
ALTER TABLE compliance_check ADD CONSTRAINT fk_check_resource
      FOREIGN KEY (resource_id) REFERENCES cloud_resource(resource_id) ON DELETE CASCADE;

-- derived / operational columns added after the initial design
ALTER TABLE cloud_resource  ADD COLUMN risk_score    INT NOT NULL DEFAULT 0 CHECK (risk_score >= 0);
ALTER TABLE cloud_resource  ADD COLUMN last_scanned  TIMESTAMPTZ;
ALTER TABLE compliance_rule ADD COLUMN match_keyword VARCHAR(50);  -- term searched in open vulnerabilities

-- ---------- 3. INDEXES ----------
CREATE INDEX idx_account_user        ON cloud_account(user_id);
CREATE INDEX idx_resource_account    ON cloud_resource(cloud_acc_id);
CREATE INDEX idx_resource_type       ON cloud_resource(type);
CREATE INDEX idx_vuln_resource       ON vulnerability(resource_id);
CREATE INDEX idx_vuln_open_severity  ON vulnerability(severity) WHERE status <> 'RESOLVED';  -- partial index
CREATE INDEX idx_vuln_search         ON vulnerability USING GIN (search_vector);              -- full-text
CREATE INDEX idx_rem_vuln            ON remediation(vulnerability_id);
CREATE INDEX idx_rem_user_status     ON remediation(assigned_user_id, status);
CREATE INDEX idx_rule_standard       ON compliance_rule(standard_id);
CREATE INDEX idx_check_latest        ON compliance_check(rule_id, resource_id, check_date DESC);

-- ---------- 4. STORED FUNCTIONS ----------
CREATE OR REPLACE FUNCTION fn_severity_rank(s TEXT) RETURNS INT
LANGUAGE sql IMMUTABLE AS $$
    SELECT CASE s WHEN 'LOW' THEN 1 WHEN 'MEDIUM' THEN 2 WHEN 'HIGH' THEN 3 WHEN 'CRITICAL' THEN 4 ELSE 0 END
$$;

-- risk score = weighted sum of unresolved vulnerabilities (CRITICAL 10, HIGH 5, MEDIUM 2, LOW 1)
CREATE OR REPLACE FUNCTION fn_recalc_risk(p_resource_id INT) RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE cloud_resource
       SET risk_score = COALESCE((
            SELECT SUM(CASE severity WHEN 'CRITICAL' THEN 10 WHEN 'HIGH' THEN 5
                                     WHEN 'MEDIUM' THEN 2 ELSE 1 END)
              FROM vulnerability
             WHERE resource_id = p_resource_id AND status <> 'RESOLVED'), 0)
     WHERE resource_id = p_resource_id;
END $$;

-- Assign a remediation atomically (validates assignee, locks the vulnerability row)
CREATE OR REPLACE FUNCTION fn_assign_remediation(
    p_vuln INT, p_user INT, p_due DATE, p_action TEXT) RETURNS INT
LANGUAGE plpgsql AS $$
DECLARE v_role TEXT; v_status TEXT; v_id INT;
BEGIN
    SELECT role INTO v_role FROM app_user WHERE user_id = p_user;
    IF v_role IS NULL THEN RAISE EXCEPTION 'Assignee % does not exist', p_user; END IF;
    IF v_role = 'VIEWER' THEN RAISE EXCEPTION 'Viewers cannot be assigned remediation work'; END IF;

    SELECT status INTO v_status FROM vulnerability WHERE vulnerability_id = p_vuln FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Vulnerability % does not exist', p_vuln; END IF;
    IF v_status = 'RESOLVED' THEN RAISE EXCEPTION 'Vulnerability % is already resolved', p_vuln; END IF;

    INSERT INTO remediation(action_description, assigned_date, due_date, status, vulnerability_id, assigned_user_id)
    VALUES (p_action, CURRENT_DATE, p_due, 'PENDING', p_vuln, p_user)
    RETURNING remediation_id INTO v_id;

    UPDATE vulnerability SET status = 'IN_PROGRESS' WHERE vulnerability_id = p_vuln;
    RETURN v_id;
END $$;

-- Evaluate every compliance rule against one resource. A rule FAILS when the resource has an
-- unresolved vulnerability matching the rule's keyword (full-text match). Returns the number of failures.
CREATE OR REPLACE FUNCTION fn_run_compliance_scan(p_resource_id INT) RETURNS INT
LANGUAGE plpgsql AS $$
DECLARE r RECORD; v_fail INT := 0; v_hit TEXT;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM cloud_resource WHERE resource_id = p_resource_id) THEN
        RAISE EXCEPTION 'Resource % does not exist', p_resource_id;
    END IF;

    FOR r IN SELECT cr.rule_id, cr.match_keyword FROM compliance_rule cr LOOP
        IF r.match_keyword IS NULL THEN
            INSERT INTO compliance_check(result, remarks, rule_id, resource_id)
            VALUES ('NOT_APPLICABLE', 'Rule has no automated check', r.rule_id, p_resource_id);
            CONTINUE;
        END IF;

        v_hit := NULL;
        SELECT v.title INTO v_hit
          FROM vulnerability v
         WHERE v.resource_id = p_resource_id AND v.status <> 'RESOLVED'
           AND v.search_vector @@ plainto_tsquery('english', r.match_keyword)
         ORDER BY fn_severity_rank(v.severity) DESC LIMIT 1;

        IF v_hit IS NOT NULL THEN
            v_fail := v_fail + 1;
            INSERT INTO compliance_check(result, remarks, rule_id, resource_id)
            VALUES ('FAIL', 'Open finding: ' || v_hit, r.rule_id, p_resource_id);
        ELSE
            INSERT INTO compliance_check(result, remarks, rule_id, resource_id)
            VALUES ('PASS', 'No open finding matches "' || r.match_keyword || '"', r.rule_id, p_resource_id);
        END IF;
    END LOOP;

    UPDATE cloud_resource SET last_scanned = now() WHERE resource_id = p_resource_id;
    RETURN v_fail;
END $$;

-- ---------- 5. TRIGGERS ----------
-- 5a. keep remediation dates consistent with status
CREATE OR REPLACE FUNCTION trg_remediation_dates() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.status = 'COMPLETED' THEN
        IF NEW.completed_date IS NULL THEN NEW.completed_date := CURRENT_DATE; END IF;
    ELSE
        NEW.completed_date := NULL;
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER remediation_dates BEFORE INSERT OR UPDATE ON remediation
FOR EACH ROW EXECUTE FUNCTION trg_remediation_dates();

-- 5b. remediation progress drives vulnerability status
CREATE OR REPLACE FUNCTION trg_remediation_sync_vuln() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.status = 'IN_PROGRESS' THEN
        UPDATE vulnerability SET status = 'IN_PROGRESS'
         WHERE vulnerability_id = NEW.vulnerability_id AND status = 'OPEN';
    ELSIF NEW.status = 'COMPLETED' THEN
        IF NOT EXISTS (SELECT 1 FROM remediation
                        WHERE vulnerability_id = NEW.vulnerability_id AND status <> 'COMPLETED') THEN
            UPDATE vulnerability SET status = 'RESOLVED' WHERE vulnerability_id = NEW.vulnerability_id;
        END IF;
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER remediation_sync_vuln AFTER INSERT OR UPDATE OF status ON remediation
FOR EACH ROW EXECUTE FUNCTION trg_remediation_sync_vuln();

-- 5c. resource risk score follows vulnerability changes
CREATE OR REPLACE FUNCTION trg_vuln_risk() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        PERFORM fn_recalc_risk(OLD.resource_id);
        RETURN OLD;
    END IF;
    PERFORM fn_recalc_risk(NEW.resource_id);
    IF TG_OP = 'UPDATE' AND OLD.resource_id <> NEW.resource_id THEN
        PERFORM fn_recalc_risk(OLD.resource_id);
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER vuln_risk AFTER INSERT OR UPDATE OR DELETE ON vulnerability
FOR EACH ROW EXECUTE FUNCTION trg_vuln_risk();

-- ---------- 6. VIEWS ----------
CREATE VIEW v_resource_risk AS
SELECT r.resource_id, r.name, r.type, r.status, r.ip_address::text AS ip_address, r.risk_score,
       r.last_scanned, r.cloud_acc_id, a.provider, a.account_name, a.region,
       COUNT(v.vulnerability_id) FILTER (WHERE v.status <> 'RESOLVED')                             AS open_vulns,
       COUNT(v.vulnerability_id) FILTER (WHERE v.status <> 'RESOLVED' AND v.severity = 'CRITICAL') AS critical_vulns
FROM cloud_resource r
JOIN cloud_account  a ON a.cloud_acc_id = r.cloud_acc_id
LEFT JOIN vulnerability v ON v.resource_id = r.resource_id
GROUP BY r.resource_id, a.cloud_acc_id;

-- most recent check per (rule, resource)
CREATE VIEW v_latest_checks AS
SELECT DISTINCT ON (rule_id, resource_id) *
FROM compliance_check
ORDER BY rule_id, resource_id, check_date DESC, check_id DESC;

CREATE VIEW v_compliance_summary AS
SELECT s.standard_id, s.standard_name,
       COUNT(c.check_id)                               AS total_checks,
       COUNT(*) FILTER (WHERE c.result = 'PASS')       AS passed,
       COUNT(*) FILTER (WHERE c.result = 'FAIL')       AS failed,
       ROUND(100.0 * COUNT(*) FILTER (WHERE c.result = 'PASS')
             / NULLIF(COUNT(*) FILTER (WHERE c.result <> 'NOT_APPLICABLE'), 0), 1) AS compliance_pct
FROM compliance_standard s
LEFT JOIN compliance_rule r ON r.standard_id = s.standard_id
LEFT JOIN v_latest_checks c ON c.rule_id = r.rule_id
GROUP BY s.standard_id, s.standard_name;

CREATE VIEW v_overdue_remediations AS
SELECT m.remediation_id, m.action_description, m.assigned_date, m.due_date,
       (CURRENT_DATE - m.due_date) AS days_overdue, v.vulnerability_id, v.title, v.severity,
       u.name AS assignee, r.name AS resource_name
FROM remediation m
JOIN vulnerability  v ON v.vulnerability_id = m.vulnerability_id
JOIN cloud_resource r ON r.resource_id = v.resource_id
LEFT JOIN app_user  u ON u.user_id = m.assigned_user_id
WHERE m.status <> 'COMPLETED' AND m.due_date < CURRENT_DATE;
