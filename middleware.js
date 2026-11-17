import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const ADMIN_ONLY_PAGES = ['/audit', '/users'];

export async function middleware(req) {
  const { pathname } = req.nextUrl;
  const isApi = pathname.startsWith('/api');
  if (pathname === '/login' || pathname === '/api/auth/login') return NextResponse.next();

  let session = null;
  const token = req.cookies.get('token')?.value;
  if (token) {
    try { session = (await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET))).payload; } catch {}
  }
  if (!session) {
    return isApi
      ? NextResponse.json({ error: 'Not signed in' }, { status: 401 })
      : NextResponse.redirect(new URL('/login', req.url));
  }
  if (!isApi && ADMIN_ONLY_PAGES.some((p) => pathname.startsWith(p)) && session.role !== 'ADMIN')
    return NextResponse.redirect(new URL('/dashboard', req.url));
  return NextResponse.next();
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
