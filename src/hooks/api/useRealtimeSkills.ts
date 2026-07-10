/**
 * Real-time skill/craving notifications.
 *
 * DISABLED. candy-shop's data layer is `src/lib/supabaseClient.ts` — a Cloudflare
 * Worker-backed shim whose `.channel()` is an explicit no-op ("realtime disabled
 * on CF for now"). The old implementation subscribed to `postgres_changes` behind
 * an `isSupabaseConnected()` gate, which read VITE_SUPABASE_* — the last thing in
 * the app that touched the retired Supabase project. Identity now lives on the org
 * hub (auth.democra.ai) and data on candy-api.democra.ai, so the gate and the
 * subscription are both gone; this never fired either way.
 *
 * Kept as a stable mount point (App.tsx calls it) so re-enabling realtime later
 * means filling this in rather than re-threading a hook through the tree.
 */
export function useRealtimeNotifications() {
  // no-op — see above.
}
