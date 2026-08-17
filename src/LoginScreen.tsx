import { useEffect, useState } from 'react';
import { Lock, Eye, EyeOff, ArrowRight, UserPlus, LogIn } from 'lucide-react';
import { signIn, signUp } from './lib/auth';

interface LoginScreenProps {
  onSuccess: () => void;
}

type Mode = 'login' | 'register';

export function LoginScreen({ onSuccess }: LoginScreenProps) {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);

  useEffect(() => {
    setErr(null);
  }, [mode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setErr('Please enter your email and password.');
      setShake(true);
      setTimeout(() => setShake(false), 400);
      return;
    }
    if (password.length < 6) {
      setErr('Password must be at least 6 characters.');
      setShake(true);
      setTimeout(() => setShake(false), 400);
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      if (mode === 'register') {
        const result = await signUp(email.trim(), password);
        if (!result.ok) {
          setErr(result.error ?? 'Could not create account.');
          setShake(true);
          setTimeout(() => setShake(false), 400);
          setBusy(false);
          return;
        }
      } else {
        const result = await signIn(email.trim(), password);
        if (!result.ok) {
          setErr(result.error ?? 'Could not sign in.');
          setShake(true);
          setTimeout(() => setShake(false), 400);
          setBusy(false);
          return;
        }
      }
      onSuccess();
    } catch {
      setErr('Something went wrong. Please try again.');
      setShake(true);
      setTimeout(() => setShake(false), 400);
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center px-6 relative overflow-hidden">
      {/* Ambient background */}
      <div className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-emerald-600/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-20 h-80 w-80 rounded-full bg-emerald-500/5 blur-3xl" />

      <div className={`relative w-full max-w-sm ${shake ? 'animate-[shake_400ms_ease-in-out]' : ''}`}>
        {/* Logo / lock badge */}
        <div className="flex flex-col items-center mb-7">
          <div className="h-16 w-16 rounded-2xl bg-emerald-600/15 border border-emerald-600/30 grid place-items-center mb-4">
            <Lock className="h-7 w-7 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">HomeStock</h1>
          <p className="text-sm text-neutral-500 mt-1.5 text-center">
            {mode === 'login'
              ? 'Sign in to manage your household inventory'
              : 'Create an account to start tracking'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            autoFocus
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (err) setErr(null);
            }}
            placeholder="Email"
            className="input"
            autoComplete="email"
          />
          <div className="relative">
            <input
              type={show ? 'text' : 'password'}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (err) setErr(null);
              }}
              placeholder="Password"
              className="input pr-12"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 grid place-items-center text-neutral-500 hover:text-white rounded-lg transition"
              aria-label={show ? 'Hide password' : 'Show password'}
            >
              {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>

          {err && <p className="text-sm text-red-400 text-center">{err}</p>}

          <button
            type="submit"
            disabled={busy}
            className="btn-primary w-full flex items-center justify-center gap-2 mt-1 disabled:opacity-60"
          >
            {busy ? (
              'Please wait…'
            ) : (
              <>
                {mode === 'login' ? (
                  <>
                    <LogIn className="h-4 w-4" /> Sign in
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4" /> Create account
                  </>
                )}
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        <button
          onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
          className="w-full text-center text-sm text-neutral-400 hover:text-white mt-5 transition"
        >
          {mode === 'login'
            ? "Don't have an account? Create one"
            : 'Already have an account? Sign in'}
        </button>
      </div>
    </div>
  );
}
