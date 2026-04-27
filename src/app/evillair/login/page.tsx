'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/evillair/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();
      if (res.ok) {
        router.push(data.role === 'writer' ? '/evillair/blog' : '/evillair');
      } else {
        setError(data.error || 'Login failed');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-navy">
      <div className="w-full max-w-sm mx-4">
        <div className="bg-cream rounded-lg shadow-xl p-8">
          <h1 className="font-heading text-3xl text-navy text-center mb-2">
            Splitzkrieg Admin
          </h1>
          <p className="font-body text-sm text-navy/50 text-center mb-8">
            Authorized access only
          </p>

          <form onSubmit={handleSubmit}>
            <label
              htmlFor="password"
              className="block font-body text-sm font-medium text-navy/70 mb-2"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-md border border-navy/20 bg-white font-body text-navy placeholder:text-navy/30 focus:outline-none focus:ring-2 focus:ring-red/50 focus:border-red"
              placeholder="Enter admin password"
              autoFocus
              required
            />

            {error && (
              <p className="mt-3 font-body text-sm text-red">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-6 w-full py-3 rounded-md bg-navy text-cream font-body font-medium text-sm hover:bg-navy-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Logging in...' : 'Log In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
