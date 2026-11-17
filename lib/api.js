import { NextResponse } from 'next/server';
import { getSession } from './auth';
import { query } from './db';

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export const need = (body, fields) => {
  const missing = fields.filter((f) => body[f] === undefined || body[f] === null || String(body[f]).trim() === '');
  if (missing.length) throw new HttpError(400, `Missing required field(s): ${missing.join(', ')}`);
};

// Postgres error codes -> friendly HTTP responses (database-level validation surfaced to the UI)
const PG = {
  '23505': [409, 'Duplicate value: this record already exists'],
  '23503': [409, 'Operation blocked: related records exist or the referenced record is missing'],
  '23514': [400, 'Value rejected by a database CHECK constraint'],
  '23502': [400, 'A required value is missing'],
  '22P02': [400, 'A value has an invalid format'],
  '22007': [400, 'A date has an invalid format'],
  '22001': [400, 'A value is too long'],
};

function toResponse(e) {
  if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
  if (e.code === 'P0001') return NextResponse.json({ error: e.message }, { status: 400 }); // RAISE EXCEPTION
  if (PG[e.code]) {
    const [status, msg] = PG[e.code];
    return NextResponse.json({ error: msg + (e.constraint ? ` (${e.constraint})` : '') }, { status });
  }
  console.error(e);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}

// route(roles, handler): authenticates, authorizes by role, converts errors to JSON
export function route(roles, fn) {
  return async (req, ctx) => {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
    if (roles && !roles.includes(session.role))
      return NextResponse.json({ error: `Forbidden: requires ${roles.join(' or ')} role` }, { status: 403 });
    try {
      const out = await fn(req, ctx, session);
      return out instanceof Response ? out : NextResponse.json(out);
    } catch (e) { return toResponse(e); }
  };
}

// UPDATE <table> SET <allowed fields present in body> WHERE <idCol> = id  RETURNING *
export async function updateById(table, idCol, id, body, allowed) {
  const keys = allowed.filter((k) => body[k] !== undefined);
  if (!keys.length) throw new HttpError(400, 'Nothing to update');
  const sets = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
  const vals = keys.map((k) => (body[k] === '' ? null : body[k]));
  const { rows } = await query(`UPDATE ${table} SET ${sets} WHERE ${idCol} = $${keys.length + 1} RETURNING *`, [...vals, id]);
  if (!rows.length) throw new HttpError(404, 'Record not found');
  return rows[0];
}

export const emptyToNull = (v) => (v === undefined || v === '' ? null : v);
