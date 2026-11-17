'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { UserContext } from './ui';

const NAV = [
  ['/dashboard', 'Overview'], ['/accounts', 'Cloud accounts'], ['/resources', 'Resources'],
  ['/vulnerabilities', 'Vulnerabilities'], ['/remediations', 'Remediation'], ['/compliance', 'Compliance'],
  ['/scans', 'Scan reports'], ['/audit', 'Audit trail', 'ADMIN'], ['/users', 'Users', 'ADMIN'],
];

export default function Shell({ user, children }) {
  const path = usePathname();
  const router = useRouter();
  const logout = async () => { await fetch('/api/auth/logout', { method: 'POST' }); router.push('/login'); router.refresh(); };
  return (
    <UserContext.Provider value={user}>
      <div className="shell">
        <nav className="side" aria-label="Main">
          <div className="brand">Cloud Sentinel<small>Multi-cloud risk tracker</small></div>
          {NAV.filter(([, , r]) => !r || r === user.role).map(([href, label]) => (
            <Link key={href} href={href} className={path.startsWith(href) ? 'active' : ''}>{label}</Link>
          ))}
          <div className="who"><b>{user.name}</b>{user.role.toLowerCase()}<br />
            <button className="btn ghost sm" style={{ marginTop: '.5rem', color: '#d6e4ea', borderColor: '#4b6f80' }} onClick={logout}>Sign out</button></div>
        </nav>
        <main className="main">{children}</main>
      </div>
    </UserContext.Provider>
  );
}
