// ============================================================
// Identity — the organization's hub, not our own user store.
// ============================================================
// Every Democra AI product signs users in at auth.democra.ai. Candy Shop keeps
// no passwords, no OAuth secrets and no user table: it asks the hub who the
// caller is. The hub sets its session cookie on `.democra.ai`, so a user who
// signed in on any sibling product is already signed in here.
//
// This module replaces the old `supabaseAuth` (a real Supabase project). The
// DATA shim in ./supabaseClient is unrelated — it talks to our own Worker and
// stays exactly as it is.
// ============================================================

import { createAuthClient } from 'better-auth/react';
import { emailOTPClient } from 'better-auth/client/plugins';
import { passkeyClient } from '@better-auth/passkey/client';

const HUB =
  (import.meta.env.VITE_AUTH_HUB_URL as string | undefined)?.replace(/\/+$/, '') ||
  'https://auth.democra.ai';

export const authClient = createAuthClient({
  baseURL: `${HUB}/api/auth`,
  plugins: [emailOTPClient(), passkeyClient()],
});

/** The hub's user, shaped like the rest of the app already expects. */
export interface User {
  id: string;
  email: string | null;
  user_metadata: {
    full_name?: string;
    avatar_url?: string;
  };
}

type HubUser = { id: string; email?: string | null; name?: string | null; image?: string | null };

/** Adapt a Better Auth user to the shape the components read (avatar_url / full_name). */
export function toAppUser(u: HubUser | null | undefined): User | null {
  if (!u) return null;
  return {
    id: u.id,
    email: u.email ?? null,
    user_metadata: {
      full_name: u.name ?? undefined,
      avatar_url: u.image ?? undefined,
    },
  };
}

/** Where the hub sends the user back to after a social login. */
const returnTo = () => `${window.location.origin}/`;

export const hubAuth = {
  /** Google / GitHub / Apple — the hub owns the single registered OAuth callback. */
  signInWithProvider: (provider: 'google' | 'github' | 'apple') =>
    authClient.signIn.social({ provider, callbackURL: returnTo() }),

  /** Step 1 of the passwordless email flow: mail a 6-digit code. */
  sendEmailCode: (email: string) =>
    authClient.emailOtp.sendVerificationOtp({ email, type: 'sign-in' }),

  /** Step 2: exchange the code for a session. */
  verifyEmailCode: (email: string, otp: string) => authClient.signIn.emailOtp({ email, otp }),

  /** Sign in with a passkey the user registered on any Democra AI product. */
  signInWithPasskey: () => authClient.signIn.passkey(),

  signOut: () => authClient.signOut(),
};

export const useSession = authClient.useSession;
