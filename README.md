# Cloud Sentinel — Multi-Cloud Vulnerability & Compliance Tracker

DBMS Experiential Learning – Level 3 project. One place to track vulnerabilities, remediation work and
compliance-rule results across **AWS, Azure and GCP** accounts.

| Layer | Technology | Used for |
|---|---|---|
| Frontend + API | Next.js 14 (App Router, Route Handlers) | UI, REST API, auth middleware |
| SQL (mandatory) | **PostgreSQL** | Accounts, resources, vulnerabilities, remediation, compliance (relational, integrity-critical) |
| NoSQL | **MongoDB** | Raw multi-cloud scan reports (different JSON shape per provider) and the audit trail |
| Auth | bcrypt + JWT (httpOnly cookie) | Backend authentication, roles `ADMIN` / `ANALYST` / `VIEWER` |

## Setup

Prerequisites: Node 18+, PostgreSQL 14+ and MongoDB 6+ running locally.

```bash
npm install
cp .env.example .env          # then edit DATABASE_URL / MONGODB_URI / JWT_SECRET
createdb cloud_sentinel       # or: CREATE DATABASE cloud_sentinel;
npm run db:setup              # creates tables, triggers, views, seed data + Mongo collections/indexes
npm run dev                   # http://localhost:3000
```

Demo logins (password `Password@123` for all):

| Email | Role | Can do |
|---|---|---|
| admin@sentinel.io | ADMIN | everything, plus audit trail and user management |
| riya@sentinel.io / karan@sentinel.io | ANALYST | record findings, assign/work remediation, run scans |
| meera@sentinel.io | VIEWER | read-only |

Credentials and secrets are read from environment variables only (`.env` is git-ignored).

## Run the database tests and queries

```bash
psql "$DATABASE_URL" -f tests/db_tests.sql   # 16 PASS/FAIL cases (rolled back, data untouched)
psql "$DATABASE_URL" -f db/queries.sql       # important queries for the demo
```

## Where each rubric item lives

| Requirement | Location |
|---|---|
| ER diagram / relational schema | `docs/er-diagram.jpeg`, `docs/relational-schema.jpeg`, `docs/DOCUMENTATION.md` |
| DDL: CREATE / ALTER / DROP, PK, FK, constraints, indexes, views | `db/schema.sql` |
| DML + JOIN / GROUP BY / HAVING / ORDER BY / subqueries / window / CTE | `db/queries.sql`, API routes in `app/api` |
| Advanced SQL (transactions, views, stored functions, triggers, indexing, full-text search) | `db/schema.sql` §3–6, `lib/db.js` (`withTransaction`), `app/api/scans/[id]/import`, `app/api/compliance/scan` |
| NoSQL (data model, indexes, validation, aggregation) | `scripts/setup-db.js`, `app/api/scans`, `app/api/audit`, `app/api/dashboard` |
| Database-level validation | CHECK / UNIQUE / FK / trigger rules in `db/schema.sql`; Mongo `$jsonSchema` in `scripts/setup-db.js` |
| Next.js interface | `app/(app)/*` |
| DB–app integration, env vars | `lib/db.js`, `lib/mongo.js`, `.env.example` |
| Authentication + roles | `lib/auth.js`, `middleware.js`, `lib/api.js` (`route(roles, handler)`) |
| Test cases | `tests/db_tests.sql`, table in `docs/DOCUMENTATION.md` |

## Git workflow (individual contributions)

```bash
git init && git add . && git commit -m "Initial project"
git branch -M main && git remote add origin <your-repo-url> && git push -u origin main
```
Each teammate should commit from their own account on feature branches (e.g. `feature/db-layer`, `feature/ui`) so
the history shows individual contributions.
