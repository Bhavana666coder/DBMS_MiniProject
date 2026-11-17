// npm run db:setup  ->  (re)creates PostgreSQL schema + seed data, and MongoDB collections/indexes
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const { MongoClient } = require('mongodb');

async function setupPostgres() {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  for (const f of ['schema.sql', 'seed.sql']) {
    await c.query(fs.readFileSync(path.join(__dirname, '..', 'db', f), 'utf8'));
    console.log(`PostgreSQL: ${f} applied`);
  }
  await c.end();
}

async function setupMongo() {
  const client = await new MongoClient(process.env.MONGODB_URI).connect();
  const db = client.db(process.env.MONGODB_DB || 'cloud_sentinel');
  for (const n of ['audit_logs', 'scan_reports']) await db.collection(n).drop().catch(() => {});

  // JSON-schema validation = database-level validation for the NoSQL side
  await db.createCollection('audit_logs', { validator: { $jsonSchema: {
    bsonType: 'object', required: ['ts', 'action', 'entity'],
    properties: { ts: { bsonType: 'date' }, action: { bsonType: 'string' }, entity: { bsonType: 'string' },
                  user_id: { bsonType: ['number', 'null'] }, user_email: { bsonType: ['string', 'null'] } } } } });
  await db.createCollection('scan_reports', { validator: { $jsonSchema: {
    bsonType: 'object', required: ['account_id', 'provider', 'scanned_at', 'raw_findings'],
    properties: { provider: { enum: ['AWS', 'AZURE', 'GCP'] }, raw_findings: { bsonType: 'array' },
                  imported: { bsonType: 'bool' } } } } });

  await db.collection('audit_logs').createIndexes([
    { key: { ts: -1 }, name: 'ts_desc' },
    { key: { user_id: 1, ts: -1 }, name: 'user_ts' },
    { key: { entity: 1, action: 1 }, name: 'entity_action' },
  ]);
  await db.collection('scan_reports').createIndexes([
    { key: { account_id: 1, scanned_at: -1 }, name: 'account_scanned' },
    { key: { provider: 1, imported: 1 }, name: 'provider_imported' },
  ]);
  console.log('MongoDB: collections, validators and indexes created');
  await client.close();
}

(async () => {
  try { await setupPostgres(); await setupMongo(); console.log('Setup complete. Login: admin@sentinel.io / Password@123'); }
  catch (e) { console.error('Setup failed:', e.message); process.exit(1); }
})();
