'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../lib/api';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const r = await api<{ accessToken: string; refreshToken: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      localStorage.setItem('accessToken', r.accessToken);
      localStorage.setItem('refreshToken', r.refreshToken);
      router.push('/dashboard');
    } catch (err) {
      setError('Login failed');
    }
  }

  return (
    <main className="login card">
      <h1>Sign in</h1>
      <form onSubmit={submit}>
        <label>
          Email
          <input className="input" value={email} onChange={e => setEmail(e.target.value)} type="email" required />
        </label>
        <label>
          Password
          <input className="input" value={password} onChange={e => setPassword(e.target.value)} type="password" required />
        </label>
        {error && <p style={{ color: 'var(--bad)' }}>{error}</p>}
        <button className="button" type="submit">Sign in</button>
      </form>
    </main>
  );
}