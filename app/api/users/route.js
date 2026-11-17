import bcrypt from 'bcryptjs';
import { route, need, HttpError } from '@/lib/api';
import { query } from '@/lib/db';
import { logAudit } from '@/lib/audit';

export const GET = route(['ADMIN', 'ANALYST'], async () => {
  const { rows } = await query('SELECT user_id, name, email, role, created_at FROM app_user ORDER BY user_id');
  return rows;
});

export const POST = route(['ADMIN'], async (req, _c, s) => {
  const b = await req.json();
  need(b, ['name', 'email', 'password', 'role']);
  if (String(b.password).length < 8) throw new HttpError(400, 'Password must be at least 8 characters');
  const hash = await bcrypt.hash(b.password, 10);
  const { rows } = await query(
    'INSERT INTO app_user(name, email, password_hash, role) VALUES ($1,$2,$3,$4) RETURNING user_id, name, email, role',
    [b.name, b.email, hash, b.role]);
  await logAudit(s, 'CREATE', 'app_user', rows[0].user_id, { email: b.email, role: b.role });
  return rows[0];
});
