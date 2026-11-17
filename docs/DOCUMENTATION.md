# Cloud Sentinel — Project Documentation

## 1. Objectives
1. Give security teams a single view of vulnerabilities and compliance status across AWS, Azure and GCP.
2. Track each finding from detection to remediation, with ownership, due dates and automatic status updates.
3. Evaluate cloud resources against compliance standards (CIS, ISO 27001, PCI DSS, NIST 800-53) and report a pass percentage.
4. Keep an immutable audit trail and preserve raw scanner output from every provider.
5. Enforce data integrity inside the database, not only in the application.

## 2. Functional requirements
| # | Requirement | Roles |
|---|---|---|
| F1 | Sign in with email and password; session kept in an httpOnly JWT cookie | all |
| F2 | Manage cloud accounts (add, activate/deactivate, delete with cascade) | ADMIN |
| F3 | Manage resources and view risk score, open vulnerability counts | ADMIN, ANALYST write; VIEWER read |
| F4 | Record vulnerabilities; full-text search and filter by severity, status, provider | ADMIN, ANALYST write; all read |
| F5 | Assign remediation (validated, atomic); update status; overdue tracking | ADMIN, ANALYST (analysts only on their own tasks) |
| F6 | Run compliance scan on one resource or all resources (single transaction) | ADMIN, ANALYST |
| F7 | Compliance dashboard per standard with latest results and filters | all |
| F8 | Simulate provider scan, store raw report in MongoDB, import normalised findings into SQL | ADMIN, ANALYST |
| F9 | Audit trail with aggregated statistics | ADMIN |
| F10 | User and role management | ADMIN |

Beyond CRUD: weighted risk scoring, rule-based compliance evaluation, cross-database import pipeline, heterogeneous-schema aggregation, auto-resolving workflow.

## 3. ER diagram
See `er-diagram.jpeg`. Entities: User, Cloud Account, Cloud Resource, Vulnerability, Remediation, Compliance Check, Compliance Rule, Compliance Standard.

| Relationship | Cardinality |
|---|---|
| User manages Cloud Account | 1 : N |
| Cloud Account contains Cloud Resource | 1 : N |
| Cloud Resource has Vulnerability | 1 : N |
| Vulnerability remediated by Remediation | 1 : N |
| User assigned to Remediation | 1 : N |
| Compliance Check performed on Cloud Resource | N : 1 |
| Compliance Check evaluated in Compliance Rule | N : 1 |
| Compliance Standard contains Compliance Rule | 1 : N |

## 4. Relational schema
See `relational-schema.jpeg`. Implemented form (PK underlined by `PK`, foreign keys marked `FK`):

```
app_user(PK user_id, name, email UNIQUE, password_hash, role, created_at)
cloud_account(PK cloud_acc_id, provider, account_name, region, status, FK user_id -> app_user)
cloud_resource(PK resource_id, name, type, ip_address, status, FK cloud_acc_id -> cloud_account, risk_score, last_scanned)
vulnerability(PK vulnerability_id, title, description, severity, status, detected_date, FK resource_id -> cloud_resource, search_vector)
remediation(PK remediation_id, action_description, assigned_date, due_date, completed_date, status,
            FK vulnerability_id -> vulnerability, FK assigned_user_id -> app_user)
compliance_standard(PK standard_id, standard_name UNIQUE, description)
compliance_rule(PK rule_id, rule_name, description, severity, FK standard_id -> compliance_standard, match_keyword)
compliance_check(PK check_id, check_date, result, remarks, FK rule_id -> compliance_rule, FK resource_id -> cloud_resource)
```

Changes made while implementing your design (mention these in the viva):
- `User.Password` became `password_hash` (bcrypt) and the table is named `app_user` because `user` is a reserved word in PostgreSQL.
- Added derived/operational columns: `cloud_resource.risk_score` (maintained by trigger), `last_scanned`, `vulnerability.search_vector` (generated tsvector) and `compliance_rule.match_keyword` (drives automated checks). The last three were added with `ALTER TABLE` to demonstrate schema evolution.
- Compliance Check keeps history. "Latest result" per (rule, resource) is exposed through the view `v_latest_checks`.
- All tables are in 3NF: every non-key attribute depends only on its table's key; reference data (standards, rules) is separated from transactional data (checks).

## 5. Database choice and justification
| Data | Database | Why |
|---|---|---|
| Accounts, resources, vulnerabilities, remediation, standards, rules, checks, users | **PostgreSQL** | Strongly related data with many integrity rules (FKs, CHECKs, cascades). Needs transactions, triggers, views, joins and aggregates. Full-text search is built in. |
| Raw scan reports | **MongoDB** | AWS Security Hub, Microsoft Defender and GCP Security Command Center return different JSON structures. Documents store them as received, without a table per provider, and the aggregation pipeline normalises them on read. |
| Audit trail | **MongoDB** | Append-only, high write volume, `details` differs per action, read mostly through aggregation. No joins or updates needed. |

Vector search was considered and not used: findings are short, structured and keyword-friendly, so tsvector full-text search meets the need without the cost of an embedding model.

## 6. Data dictionary (PostgreSQL)

**app_user** — application users
| Column | Type | Constraints |
|---|---|---|
| user_id | SERIAL | PK |
| name | VARCHAR(100) | NOT NULL, at least 2 characters |
| email | VARCHAR(150) | NOT NULL, UNIQUE, regex format CHECK |
| password_hash | TEXT | NOT NULL (bcrypt) |
| role | VARCHAR(10) | NOT NULL, IN (ADMIN, ANALYST, VIEWER) |
| created_at | TIMESTAMPTZ | NOT NULL, default now() |

**cloud_account**
| Column | Type | Constraints |
|---|---|---|
| cloud_acc_id | SERIAL | PK |
| provider | VARCHAR(10) | NOT NULL, IN (AWS, AZURE, GCP) |
| account_name, region | VARCHAR | NOT NULL; UNIQUE(provider, account_name) |
| status | VARCHAR(10) | NOT NULL, default ACTIVE, IN (ACTIVE, INACTIVE) |
| user_id | INT | FK app_user, ON DELETE RESTRICT |

**cloud_resource**
| Column | Type | Constraints |
|---|---|---|
| resource_id | SERIAL | PK |
| name | VARCHAR(100) | NOT NULL; UNIQUE(cloud_acc_id, name) |
| type | VARCHAR(20) | IN (VM, STORAGE, DATABASE, NETWORK, IAM, FUNCTION, CONTAINER) |
| ip_address | INET | optional; invalid IPs rejected by type |
| status | VARCHAR(12) | IN (RUNNING, STOPPED, TERMINATED) |
| cloud_acc_id | INT | FK cloud_account, ON DELETE CASCADE |
| risk_score | INT | CHECK >= 0, maintained by trigger |
| last_scanned | TIMESTAMPTZ | set by compliance scan function |

**vulnerability**
| Column | Type | Constraints |
|---|---|---|
| vulnerability_id | SERIAL | PK |
| title | VARCHAR(200) | NOT NULL, at least 3 characters |
| description | TEXT | optional |
| severity | VARCHAR(10) | IN (LOW, MEDIUM, HIGH, CRITICAL) |
| status | VARCHAR(12) | default OPEN, IN (OPEN, IN_PROGRESS, RESOLVED) |
| detected_date | DATE | default today, CHECK not in the future |
| resource_id | INT | FK cloud_resource, ON DELETE CASCADE |
| search_vector | TSVECTOR | generated from title + description |

**remediation**
| Column | Type | Constraints |
|---|---|---|
| remediation_id | SERIAL | PK |
| action_description | TEXT | NOT NULL, at least 5 characters |
| assigned_date, due_date | DATE | CHECK due_date >= assigned_date |
| completed_date | DATE | NULL or >= assigned_date; set by trigger |
| status | VARCHAR(12) | default PENDING, IN (PENDING, IN_PROGRESS, COMPLETED) |
| vulnerability_id | INT | FK vulnerability, ON DELETE CASCADE |
| assigned_user_id | INT | FK app_user, ON DELETE SET NULL |

**compliance_standard**: `standard_id` PK, `standard_name` UNIQUE NOT NULL, `description`.
**compliance_rule**: `rule_id` PK, `rule_name`, `description`, `severity` (CHECK), `standard_id` FK CASCADE, `match_keyword`; UNIQUE(standard_id, rule_name).
**compliance_check**: `check_id` PK, `check_date` default now(), `result` IN (PASS, FAIL, NOT_APPLICABLE), `remarks`, `rule_id` FK CASCADE, `resource_id` FK CASCADE.

## 7. Database implementation

### 7.1 PostgreSQL (`db/schema.sql`)
| Concept | Implementation |
|---|---|
| CREATE / ALTER / DROP | Tables created, FKs and three columns added with ALTER, clean re-run with DROP ... CASCADE |
| Indexes | FK indexes, partial index on open severities, GIN index on `search_vector`, composite index `(rule_id, resource_id, check_date DESC)` |
| Views | `v_resource_risk`, `v_latest_checks`, `v_compliance_summary`, `v_overdue_remediations` |
| Stored functions | `fn_severity_rank`, `fn_recalc_risk`, `fn_assign_remediation`, `fn_run_compliance_scan` |
| Triggers | `remediation_dates` (BEFORE), `remediation_sync_vuln` (AFTER), `vuln_risk` (AFTER INSERT/UPDATE/DELETE) |
| Transactions | `withTransaction()` in `lib/db.js`: bulk compliance scan and scan import commit or roll back as one unit; `fn_assign_remediation` locks the vulnerability row with `FOR UPDATE` |
| Full-text search | Generated tsvector + GIN index + `websearch_to_tsquery` + `ts_rank` |

Risk score: CRITICAL = 10, HIGH = 5, MEDIUM = 2, LOW = 1, summed over unresolved vulnerabilities of a resource.

Compliance rule: a rule FAILS for a resource when an unresolved vulnerability on it matches the rule's `match_keyword` by full-text search; otherwise PASS; rules without a keyword are NOT_APPLICABLE.

### 7.2 MongoDB (`scripts/setup-db.js`)
**scan_reports** document:
```json
{ "account_id": 1, "account_name": "prod-core", "provider": "AWS", "scanner": "AWS Security Hub",
  "scanned_at": "ISODate", "scanned_by": "riya@sentinel.io", "finding_count": 5, "imported": false,
  "raw_findings": [ { "Title": "...", "Severity": { "Label": "HIGH" }, "Resources": [ { "Id": "prod-web-01" } ] } ] }
```
Azure findings keep `properties.displayName / severity`; GCP findings keep `category / severity / resourceName`.

**audit_logs** document: `{ ts, user_id, user_email, role, action, entity, entity_id, details }`.

| Item | Detail |
|---|---|
| Indexes | `audit_logs`: `{ts:-1}`, `{user_id:1, ts:-1}`, `{entity:1, action:1}`; `scan_reports`: `{account_id:1, scanned_at:-1}`, `{provider:1, imported:1}` |
| Validation | `$jsonSchema` validators on both collections (required fields, provider enum, array type) |
| Aggregation | Dashboard: `$match` → `$group` (events per day). Audit page: `$facet` with three `$group` pipelines. Scans page: `$unwind` → `$addFields` with `$ifNull` over three provider paths → `$group` |
| Retrieval strategy | List by recency (index), filter by action/entity, aggregate for statistics |
| Embeddings | Not used (see section 5) |

### 7.3 Cross-database flow
Run scan → raw JSON saved in MongoDB → *Import to SQL* normalises each provider shape, maps the resource by name, skips duplicates, and inserts vulnerabilities inside one PostgreSQL transaction → report marked `imported` in MongoDB. Triggers then update risk scores automatically.

## 8. Important queries
Thirteen annotated queries are in `db/queries.sql`: multi-table JOIN, GROUP BY, HAVING, correlated subquery, NOT EXISTS, full-text ranking, FILTER aggregates, window function `RANK() OVER (PARTITION BY ...)`, CTE with `DISTINCT ON`, view usage, average time-to-fix, INSERT/UPDATE/DELETE and EXPLAIN.

## 9. System architecture
```
Browser (Next.js pages, React client components)
        │  fetch() JSON, httpOnly JWT cookie
        ▼
Next.js middleware ── verifies JWT, blocks anonymous users, guards admin pages
        ▼
Route Handlers (app/api/*) ── route(roles, handler): role check, error mapping, audit log
        │                                   │
        ▼ pg (parameterised queries)        ▼ mongodb driver
PostgreSQL: relational data, triggers,      MongoDB: scan_reports, audit_logs
functions, views, full-text search
```
Security measures: parameterised SQL everywhere (no string concatenation of user input), bcrypt hashing, httpOnly + SameSite cookie, role checks in the backend (UI hiding is only cosmetic), ownership check on remediation updates, secrets only in environment variables.

## 10. Application screenshots
Add screenshots here after running the app: login, overview dashboard, vulnerabilities with full-text search, assign-remediation form, compliance page, scan reports (Mongo), audit trail (admin), viewer role showing read-only UI.

## 11. Testing results
Automated database tests: `tests/db_tests.sql` — **16 of 16 passed**. API behaviour was also checked by calling the running app.

| ID | Test | Expected | Result |
|---|---|---|---|
| T01–T08 | Invalid role, email, duplicate email, severity, future date, FK, due date, IP | Rejected by the database | Pass |
| T09 | Insert CRITICAL vulnerability | Resource risk +10 via trigger | Pass |
| T10 | Assign remediation to a VIEWER | Function raises exception | Pass |
| T11–T12 | Complete the only remediation | Vulnerability RESOLVED, completed_date filled | Pass |
| T13 | Search "encrypt" | Matches "encrypted" titles (stemming) | Pass |
| T14 | Compliance scan on resource with public bucket | Rule marked FAIL | Pass |
| T15 | Delete a cloud account | Resources and vulnerabilities cascade | Pass |
| T16 | Delete a user who manages an account | Blocked by RESTRICT | Pass |
| A01 | Wrong password | 401, LOGIN_FAILED audit event | Pass |
| A02 | API call with no cookie | 401 | Pass |
| A03 | Viewer POSTs a vulnerability | 403 | Pass |
| A04 | Viewer opens /users | Redirect to dashboard | Pass |
| A05 | Analyst edits another analyst's remediation | Rejected | Pass |
| A06 | Create vulnerability with severity `SEVERE` | 400 with constraint name | Pass |
| A07 | Scan all resources | One transaction, 12 resources scanned | Pass |

MongoDB-backed features (scan reports, audit trail, activity chart) are implemented and the app degrades gracefully when MongoDB is unreachable; run them against your local MongoDB and record the screenshots in section 10.

## 12. Conclusion
The project applies each database paradigm where it fits: PostgreSQL for related, rule-heavy data enforced by constraints, triggers and functions, and MongoDB for provider-specific scan documents and the audit stream. The web application is a thin, role-checked layer over those database features rather than a simple CRUD front end.

Possible extensions: pgvector similarity search to find previously fixed, similar findings and suggest remediation steps; scheduled scans; email alerts for overdue tasks.

## Team responsibilities (fill in)
| Member | Database | Application |
|---|---|---|
| Member 1 | | |
| Member 2 | | |
