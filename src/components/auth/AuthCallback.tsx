import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';

export function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Supabase automatically processes OAuth tokens from URL hash
        // Wait a moment for Supabase to process the hash, then check session
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('Error getting session:', sessionError);
          setError(sessionError.message);
          setTimeout(() => {
            navigate('/', { replace: true });
          }, 2000);
          return;
        }

        // Clear the hash from URL
        if (window.location.hash) {
          window.history.replaceState(null, '', window.location.pathname);
        }

        if (session) {
          // Successfully authenticated, redirect to home
          navigate('/', { replace: true });
        } else {
          // No session found, wait for auth state change
          const { data: { subscription } } = supabase.auth.onAuthStateChange((event: any, session: any) => {
            if (event === 'SIGNED_IN' && session) {
              window.history.replaceState(null, '', window.location.pathname);
              navigate('/', { replace: true });
              subscription.unsubscribe();
            } else if (event === 'SIGNED_OUT') {
              // Auth failed
              setError('Authentication failed. Please try again.');
              setTimeout(() => {
                navigate('/', { replace: true });
                subscription.unsubscribe();
              }, 2000);
            }
          });

          // Timeout after 5 seconds
          setTimeout(() => {
            subscription.unsubscribe();
            if (!error) {
              setError('Authentication timeout. Please try again.');
              setTimeout(() => {
                navigate('/', { replace: true });
              }, 2000);
            }
          }, 5000);
        }
      } catch (error) {
        console.error('Auth callback error:', error);
        setError('Authentication failed. Please try again.');
        setTimeout(() => {
          navigate('/', { replace: true });
        }, 2000);
      }
    };

    handleAuthCallback();
  }, [navigate, error]);

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
