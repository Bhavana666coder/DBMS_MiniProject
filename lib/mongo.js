import { MongoClient } from 'mongodb';

const g = globalThis;
export async function getDb() {
  if (!g.__mongo) {
    g.__mongo = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 4000 }).connect()
      .catch((e) => { g.__mongo = null; throw e; });   // don't cache a failed connection
  }
  const client = await g.__mongo;
  return client.db(process.env.MONGODB_DB || 'cloud_sentinel');
}
