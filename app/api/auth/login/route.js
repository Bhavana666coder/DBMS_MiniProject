import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { query } from '@/lib/db';
import { signToken } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export async function POST(req) {
  const { email, password } = await req.json().catch(() => ({}));
  if (!email || !password) return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
  const { rows } = await query('SELECT * FROM app_user WHERE lower(email) = lower($1)', [email]);
  const u = rows[0];
  if (!u || !(await bcrypt.compare(password, u.password_hash))) {
    await logAudit({ email }, 'LOGIN_FAILED', 'app_user', null, {});
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
  }
  const session = { uid: u.user_id, name: u.name, email: u.email, role: u.role };
  const res = NextResponse.json({ user: session });
  res.cookies.set('token', await signToken(session), {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 8 * 3600,
  });
  await logAudit(session, 'LOGIN', 'app_user', u.user_id, {});
  return res;
}
