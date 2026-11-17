import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const secret = () => new TextEncoder().encode(process.env.JWT_SECRET);

export async function signToken(payload) {
  return new SignJWT(payload).setProtectedHeader({ alg: 'HS256' }).setExpirationTime('8h').sign(secret());
}
export async function verifyToken(token) {
  try { return (await jwtVerify(token, secret())).payload; } catch { return null; }
}
// session = { uid, name, email, role }
export async function getSession() {
  const t = cookies().get('token')?.value;
  return t ? verifyToken(t) : null;
}
