import { useState } from 'react';
import useAuth from '../hooks/useAuth.js';
import authService from '../services/authService.js';

export default function LoginPage() {
  const { login } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const validateForm = () => {
    if (!isLogin) {
      if (!fullName.trim()) return 'Full Name is required.';
      if (fullName.trim().length < 2) return 'Full Name must be at least 2 characters.';
    }
    if (!email.trim()) return 'Email is required.';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) return 'Please enter a valid email address.';
    if (!password) return 'Password is required.';
    if (password.length < 6) return 'Password must be at least 6 characters.';
    if (!isLogin) {
      if (password !== confirmPassword) return 'Passwords do not match.';
    }
    return null;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);

    try {
      if (isLogin) {
        await login({ email: email.trim(), password });
      } else {
        await authService.register({
          fullName: fullName.trim(),
          email: email.trim(),
          password,
        });
        setSuccess('Account created successfully. Please sign in.');
        setIsLogin(true);
        setPassword('');
        setConfirmPassword('');
        setFullName('');
      }
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="max-w-md mx-auto min-h-screen bg-[#F6F8F3] shadow-2xl flex items-center px-5">
      <form onSubmit={handleSubmit} className="w-full bg-white rounded-2xl p-6 shadow-sm border border-black/5">
        <div className="flex items-center gap-2 mb-6">
          <div className="relative w-6 h-6">
            <div className="aura-glow absolute inset-0 rounded-full" />
            <div className="absolute inset-[3px] rounded-full bg-white" />
          </div>
          <span className="font-display italic text-sm tracking-wide">Aura Health</span>
        </div>
        <h1 className="font-display text-2xl italic">{isLogin ? 'Welcome back' : 'Create account'}</h1>
        <p className="text-sm text-[#16302B]/60 mt-1 mb-5">
          {isLogin ? 'Sign in to continue your wellness journey.' : 'Join Aura Health and start tracking your wellness.'}
        </p>

        {success && (
          <div className="mb-4 text-xs text-[#1F7A63] font-semibold bg-[#DCEEE7] px-3.5 py-2.5 rounded-lg border border-[#1F7A63]/10">
            {success}
          </div>
        )}

        {error && (
          <div className="mb-4 text-xs text-[#F0784A] font-semibold bg-[#F0784A]/10 px-3.5 py-2.5 rounded-lg border border-[#F0784A]/10">
            {error}
          </div>
        )}

        <div className="space-y-3">
          {!isLogin && (
            <input
              id="fullName"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              type="text"
              placeholder="Full Name"
              required
              aria-label="Full Name"
              className="w-full rounded-lg border border-black/10 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F7A63]/30"
            />
          )}
          <input
            id="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            placeholder="Email"
            required
            aria-label="Email"
            className="w-full rounded-lg border border-black/10 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F7A63]/30"
          />
          <input
            id="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            placeholder="Password"
            required
            aria-label="Password"
            className="w-full rounded-lg border border-black/10 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F7A63]/30"
          />
          {!isLogin && (
            <input
              id="confirmPassword"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              type="password"
              placeholder="Confirm Password"
              required
              aria-label="Confirm Password"
              className="w-full rounded-lg border border-black/10 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F7A63]/30"
            />
          )}
          <button
            id="submitButton"
            disabled={submitting}
            className="tap w-full rounded-lg bg-[#16302B] text-white py-2.5 text-sm font-semibold disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-[#16302B]/30"
          >
            {submitting ? (isLogin ? 'Signing in…' : 'Creating account…') : (isLogin ? 'Sign in' : 'Create account')}
          </button>
        </div>

        <p className="text-xs text-center text-[#16302B]/60 mt-5">
          {isLogin ? "Don't have an account? " : 'Already have an account? '}
          <button
            id="toggleModeButton"
            type="button"
            onClick={() => {
              setIsLogin(!isLogin);
              setError('');
              setSuccess('');
              setPassword('');
              setConfirmPassword('');
              setFullName('');
            }}
            className="font-semibold text-[#1F7A63] hover:underline focus:outline-none"
          >
            {isLogin ? 'Create Account' : 'Sign In'}
          </button>
        </p>
      </form>
    </main>
  );
}
