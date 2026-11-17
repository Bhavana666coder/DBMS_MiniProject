'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, Notice } from '@/components/ui';

export default function Login() {
  const [f, setF] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const router = useRouter();
  const submit = async (e) => {
    e.preventDefault(); setError('');
    try { await api('/api/auth/login', { method: 'POST', body: f }); router.push('/dashboard'); router.refresh(); }
    catch (err) { setError(err.message); }
  };
  return (
    <div className="login"><div className="card">
      <h1>Cloud Sentinel</h1>
      <p className="sub">Sign in to track vulnerabilities and compliance across AWS, Azure and GCP.</p>
      <Notice error={error} />
      <form className="form" onSubmit={submit} style={{ gridTemplateColumns: '1fr' }}>
        <label>Email<input type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
        <label>Password<input type="password" required value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></label>
        <button className="btn" type="submit">Sign in</button>
      </form>
      <p className="demo">Demo logins (password <code>Password@123</code>): admin@sentinel.io, riya@sentinel.io (analyst), meera@sentinel.io (viewer)</p>
    </div></div>
  );
}
