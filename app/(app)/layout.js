import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import Shell from '@/components/Shell';

export const dynamic = 'force-dynamic';
export default async function AppLayout({ children }) {
  const s = await getSession();
  if (!s) redirect('/login');
  return <Shell user={{ uid: s.uid, name: s.name, email: s.email, role: s.role }}>{children}</Shell>;
}
