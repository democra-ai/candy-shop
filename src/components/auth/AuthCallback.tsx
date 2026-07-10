import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authClient } from '../../lib/authClient';

/**
 * Legacy landing route.
 *
 * The organization's identity hub (auth.democra.ai) owns the OAuth callback and
 * sends the user straight back to `/` with the `.democra.ai` session cookie
 * already set — nothing is exchanged here any more. This page survives only so
 * an old bookmark still lands somewhere sane: confirm the session, then move on.
 */
export function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    authClient
      .getSession()
      .then((r) => {
        if (cancelled) return;
        if (r.data?.user) {
          navigate('/', { replace: true });
        } else {
          setError('We could not confirm your sign-in.');
          setTimeout(() => navigate('/', { replace: true }), 2000);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setError('Could not reach the sign-in service.');
        setTimeout(() => navigate('/', { replace: true }), 2000);
      });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-white">
      <div className="text-center">
        {error ? (
          <>
            <div className="text-red-500 text-4xl mb-4">⚠️</div>
            <p className="text-red-600 font-mono text-sm mb-2">{error}</p>
            <p className="text-gray-500 font-mono text-xs">Redirecting...</p>
          </>
        ) : (
          <>
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-600 font-mono text-sm">Completing sign in...</p>
          </>
        )}
      </div>
    </div>
  );
}
