import { useState } from 'react';
import useAuth from '../hooks/useAuth.js';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      await login({ email, password });
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to sign in. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="max-w-md mx-auto min-h-screen bg-[#F6F8F3] shadow-2xl flex items-center px-5">
      <form onSubmit={handleSubmit} className="w-full bg-white rounded-2xl p-6 shadow-sm border border-black/5">
        <div className="flex items-center gap-2 mb-6"><div className="relative w-6 h-6"><div className="aura-glow absolute inset-0 rounded-full" /><div className="absolute inset-[2px] rounded-full bg-white" /></div><span className="font-display italic text-sm tracking-wide">Aura Health</span></div>
        <h1 className="font-display text-2xl italic">Welcome back</h1>
        <p className="text-sm text-[#16302B]/60 mt-1 mb-5">Sign in to continue your wellness journey.</p>
        {error && <p className="mb-4 text-sm text-[#F0784A]">{error}</p>}
        <div className="space-y-3">
          <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="Email" required className="w-full rounded-lg border border-black/10 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F7A63]/30" />
          <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="Password" required className="w-full rounded-lg border border-black/10 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F7A63]/30" />
          <button disabled={submitting} className="tap w-full rounded-lg bg-[#16302B] text-white py-2.5 text-sm font-semibold disabled:opacity-60">{submitting ? 'Signing in…' : 'Sign in'}</button>
        </div>
      </form>
    </main>
  );
}
