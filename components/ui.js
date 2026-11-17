'use client';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';

export const UserContext = createContext(null);
export const useUser = () => useContext(UserContext);
export const canWrite = (u) => u && (u.role === 'ADMIN' || u.role === 'ANALYST');

export async function api(url, { method = 'GET', body } = {}) {
  const res = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) { window.location.href = '/login'; throw new Error('Session expired'); }
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export function useLoad(url) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const reload = useCallback(() => {
    if (!url) return;
    api(url).then((d) => { setData(d); setError(''); }).catch((e) => setError(e.message));
  }, [url]);
  useEffect(() => { reload(); }, [reload]);
  return { data, error, reload };
}

export const Badge = ({ v }) => <span className={`badge b-${v}`}>{String(v).replace('_', ' ')}</span>;

export function Notice({ error, ok }) {
  if (error) return <div className="notice err" role="alert">{error}</div>;
  if (ok) return <div className="notice ok" role="status">{ok}</div>;
  return null;
}

export const Empty = ({ children }) => <div className="empty">{children}</div>;

// run an action, show success/error, then reload data
export function useAction(reload) {
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const run = async (fn, msg) => {
    setError(''); setOk('');
    try { await fn(); if (msg) setOk(msg); reload && reload(); return true; }
    catch (e) { setError(e.message); return false; }
  };
  return { error, ok, run, setError, setOk };
}

export const fmtDate = (d) => (d ? String(d).slice(0, 10) : '-');
export const fmtTime = (d) => (d ? new Date(d).toLocaleString() : '-');
