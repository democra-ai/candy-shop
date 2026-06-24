import { useState } from 'react';
import { supabaseAuth } from '../../lib/supabaseAuth';
import { Mail, Loader2, Check } from 'lucide-react';
import { ModalShell } from '../ui/ModalShell';

// Pragmatic email check — rejects the obvious junk (no @, no domain, spaces,
// missing TLD) without trying to fully implement RFC 5322. Good enough to stop
// a typo'd address from ever hitting the network.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value);
}

// Turn whatever the auth layer throws into a calm, human message. The backend
// (Supabase) can be fully down — in which case the SDK throws a bare
// "Failed to fetch" / network error — so we special-case that instead of
// leaking the raw string to the user.
function toFriendlyAuthError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err ?? '');
  const lower = raw.toLowerCase();

  if (
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('load failed') ||
    lower.includes('network request failed') ||
    lower.includes('fetch')
  ) {
    return 'Can’t reach the sign-in service right now. It may be temporarily down — please try again in a little while.';
  }
  if (lower.includes('rate limit') || lower.includes('too many')) {
    return 'Too many attempts. Please wait a moment and try again.';
  }
  if (lower.includes('invalid') && lower.includes('email')) {
    return 'That doesn’t look like a valid email address. Check for typos and try again.';
  }
  // Fallback: a trimmed, non-empty message — never a blank or undefined.
  return raw.trim() || 'Something went wrong signing you in. Please try again.';
}

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const [loading, setLoading] = useState<'google' | 'github' | 'email' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [emailSent, setEmailSent] = useState(false);

  const handleSocialLogin = async (provider: 'google' | 'github') => {
    setLoading(provider);
    setError(null);
    try {
      const redirectTo = `${window.location.origin}/auth/callback`;
      const { error } = await supabaseAuth.auth.signInWithOAuth({
        provider,
        options: { redirectTo },
      });
      // On success the browser is redirected to the provider, so this line
      // is normally never reached. If it returns with an error, surface it.
      if (error) throw error;
    } catch (err) {
      setError(toFriendlyAuthError(err));
      setLoading(null);
    }
  };

  const handleEmailLogin = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      setError('Enter your email address first.');
      return;
    }
    // Client-side validation BEFORE any network call, so an obviously-invalid
    // address (e.g. "foo", "a@b") never reaches the backend and never surfaces
    // a raw fetch error.
    if (!isValidEmail(trimmed)) {
      setError('That doesn’t look like a valid email address. Check for typos and try again.');
      return;
    }
    setLoading('email');
    setError(null);
    try {
      const { error } = await supabaseAuth.auth.signInWithOtp({
        email: trimmed,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) throw error;
      setEmailSent(true);
    } catch (err) {
      setError(toFriendlyAuthError(err));
    } finally {
      setLoading(null);
    }
  };

  return (
    <ModalShell open={isOpen} onClose={onClose} label="Sign in" maxWidth="sm">
      <div className="text-center mb-8">
        <div className="mx-auto mb-4 flex items-center justify-center text-6xl leading-none" aria-hidden="true">
          🍬
        </div>
        <h2 className="text-2xl font-candy font-bold text-foreground">
          Welcome Back
        </h2>
        <p className="text-foreground-secondary text-sm mt-2 font-body">
          Sign in to access your sweet inventory.
        </p>
      </div>

      {error && (
        <div className="mb-6 p-3 bg-error/10 border border-error/20 text-error text-xs rounded-xl font-medium text-center" role="alert">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {/* Google */}
        <button
          onClick={() => handleSocialLogin('google')}
          disabled={loading !== null}
          className="w-full h-12 flex items-center justify-center gap-3 bg-card border border-border rounded-xl text-foreground font-medium hover:bg-secondary hover:border-border-hover transition-colors duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring"
          aria-label="Continue with Google"
        >
          {loading === 'google' ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
          )}
          Continue with Google
        </button>

        {/* GitHub */}
        <button
          onClick={() => handleSocialLogin('github')}
          disabled={loading !== null}
          className="w-full h-12 flex items-center justify-center gap-3 bg-card border border-border rounded-xl text-foreground font-medium hover:bg-secondary hover:border-border-hover transition-colors duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring"
          aria-label="Continue with GitHub"
        >
          {loading === 'github' ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <svg className="w-5 h-5 text-foreground" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0022 12.017C22 6.484 17.522 2 12 2z"
              />
            </svg>
          )}
          Continue with GitHub
        </button>
      </div>

      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-card text-foreground-tertiary font-mono text-[11px] uppercase tracking-[0.18em]">or email</span>
        </div>
      </div>

      {emailSent ? (
        <div className="flex items-center justify-center gap-2 p-3 bg-success/10 border border-success/20 text-success text-sm rounded-xl font-medium" role="status">
          <Check className="w-4 h-4" />
          Magic link sent — check your inbox.
        </div>
      ) : (
        <div className="space-y-3">
          <input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              // Clear a stale validation/network error as soon as the user
              // starts correcting their input.
              if (error) setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleEmailLogin();
            }}
            placeholder="you@example.com"
            autoComplete="email"
            disabled={loading !== null}
            className="w-full h-11 px-4 bg-card border border-border rounded-xl text-foreground text-sm placeholder:text-foreground-tertiary focus:outline-none focus:ring-2 focus:ring-ring focus:border-border-hover transition-colors duration-200 disabled:opacity-50"
            aria-label="Email address"
          />
          <button
            onClick={handleEmailLogin}
            disabled={loading !== null}
            className="w-full h-10 flex items-center justify-center gap-2 text-foreground-secondary hover:bg-secondary hover:text-foreground rounded-xl transition-colors duration-200 text-sm font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Send magic link"
          >
            {loading === 'email' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Mail className="w-4 h-4" />
            )}
            Send magic link
          </button>
        </div>
      )}

      <p className="mt-8 text-center text-xs text-foreground-tertiary">
        By continuing, you agree to our Terms of Service and Privacy Policy.
      </p>
    </ModalShell>
  );
}
