import React, { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, User } from 'firebase/auth';
import { getFirebaseAuth, isFirebaseConfigured } from '../lib/firebase';
import { Loader2, Lock, LogIn, LogOut } from 'lucide-react';

type AuthGateProps = {
  children: React.ReactNode;
};

const REMEMBER_EMAIL_KEY = 'auth:email';

export default function AuthGate({ children }: AuthGateProps) {
  const enabled = isFirebaseConfigured();
  const auth = useMemo(() => (enabled ? getFirebaseAuth() : null), [enabled]);

  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(enabled);
  const [email, setEmail] = useState(() => {
    try {
      return localStorage.getItem(REMEMBER_EMAIL_KEY) || '';
    } catch {
      return '';
    }
  });
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!auth) return;
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setChecking(false);
    });
    return () => unsub();
  }, [auth]);

  if (!enabled) return <>{children}</>;

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-pink-50">
        <div className="flex items-center gap-2 text-slate-700">
          <Loader2 className="w-5 h-5 animate-spin" />
          Checking access...
        </div>
      </div>
    );
  }

  if (user) {
    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => signOut(auth!)}
          className="no-print fixed bottom-4 right-4 z-50 inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/90 border border-[#e2d3a8] shadow-sm text-slate-800 hover:bg-white"
          title="Logout"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>
        {children}
      </div>
    );
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;

    setSubmitting(true);
    setError('');

    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      try {
        localStorage.setItem(REMEMBER_EMAIL_KEY, email.trim());
      } catch {
        // ignore
      }
    } catch (err: any) {
      setError(err?.message || 'Login failed');
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-pink-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl border border-[#e2d3a8] shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-[#f3ead6] border border-[#e2d3a8] flex items-center justify-center">
            <Lock className="w-5 h-5 text-slate-800" />
          </div>
          <div>
            <div className="font-bold text-slate-900">GAIAS Reimbursement</div>
            <div className="text-xs text-slate-600">Please login to continue</div>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-pink-300"
              autoComplete="username"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-pink-300"
              autoComplete="current-password"
              required
            />
          </div>

          {error && <div className="text-sm text-red-600">{error}</div>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full inline-flex items-center justify-center gap-2 bg-pink-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-pink-700 disabled:opacity-50"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
            {submitting ? 'Signing in...' : 'Login'}
          </button>
        </form>

        <div className="mt-4 text-xs text-slate-500">
          Use the shared login. If you see an error, confirm Firebase Authentication (Email/Password) is enabled.
        </div>
      </div>
    </div>
  );
}
