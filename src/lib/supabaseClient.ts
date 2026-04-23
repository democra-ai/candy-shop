// ============================================================
// Cloudflare Worker-backed drop-in replacement for the Supabase client.
// ============================================================
// The rest of the codebase still imports `{ supabase }` and uses the
// familiar chained query syntax; nothing else needed to change.
//
// Routing strategy:
//   .auth.*             → /api/auth/*         (KV-backed sessions)
//   .from('skills')     → /api/skills/*       (D1-backed)
//   .from('stars')      → /api/skills/:id/stars
//   .from('ratings')    → /api/skills/:id/ratings
//   .from('cravings')   → /api/cravings
//   .from('user_profiles') → /api/profiles/:id
//   .rpc(name, args)    → /api/rpc/:name  (inlined in Worker)
//   .channel()          → no-op (realtime disabled on CF for now)
//
// Unsupported query shapes resolve with `{ data: null, error: {...} }`
// so the caller never throws.
// ============================================================

const API_BASE =
  (import.meta.env.VITE_PAYMENT_API_URL as string | undefined)?.replace(/\/+$/, '') ||
  '';

type Json = Record<string, unknown>;

// ── Auth ─────────────────────────────────────────────────────
// (User is exported at the bottom of the file; Session is internal.)
interface Session { user: User }

type AuthChangeCb = (event: string, session: Session | null) => void;
const authListeners = new Set<AuthChangeCb>();
let currentSession: Session | null = null;

async function loadSession(): Promise<Session | null> {
  try {
    const r = await fetch(`${API_BASE}/api/auth/session`, { credentials: 'include' });
    if (!r.ok) return null;
    const j = await r.json() as { user: User | null };
    return j.user ? { user: j.user } : null;
  } catch {
    return null;
  }
}

// Hydrate once on boot
const sessionReady = loadSession().then(s => {
  currentSession = s;
  for (const cb of authListeners) cb(s ? 'SIGNED_IN' : 'SIGNED_OUT', s);
  return s;
});

// Listen for OAuth callback redirect → re-fetch session if URL looks like it just landed
if (typeof window !== 'undefined' && /\?.*(code|provider|payment)=/.test(window.location.search)) {
  setTimeout(() => loadSession().then(s => {
    currentSession = s;
    for (const cb of authListeners) cb(s ? 'SIGNED_IN' : 'SIGNED_OUT', s);
  }), 100);
}

const auth = {
  async getSession() {
    const s = await sessionReady;
    return { data: { session: s }, error: null };
  },

  onAuthStateChange(cb: AuthChangeCb) {
    authListeners.add(cb);
    // Fire once with current state
    sessionReady.then(s => cb(s ? 'SIGNED_IN' : 'SIGNED_OUT', s));
    return {
      data: {
        subscription: {
          unsubscribe: () => { authListeners.delete(cb); },
        },
      },
    };
  },

  async signInWithOAuth({ provider, options }: {
    provider: string;
    options?: { redirectTo?: string };
  }) {
    try {
      if (provider === 'github') {
        const redirect = options?.redirectTo || window.location.origin;
        window.location.href = `${API_BASE}/api/auth/github/start?redirect=${encodeURIComponent(redirect)}`;
        return { error: null };
      }
      // All other providers fall through to guest sign-in (demo mode).
      // This keeps existing "Sign in with Google/Apple" buttons functional
      // without configuring a real OAuth provider for each.
      const r = await fetch(`${API_BASE}/api/auth/guest`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!r.ok) return { error: new Error(`Guest sign-in failed (${r.status})`) };
      const j = await r.json() as { user: User };
      currentSession = { user: j.user };
      for (const cb of authListeners) cb('SIGNED_IN', currentSession);
      // Mimic OAuth redirect behaviour so AuthCallback logic still runs
      const redirect = options?.redirectTo || window.location.origin;
      setTimeout(() => { window.location.href = redirect; }, 50);
      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err : new Error(String(err)) };
    }
  },

  async signOut() {
    try {
      await fetch(`${API_BASE}/api/auth/logout`, { method: 'POST', credentials: 'include' });
    } catch { /* ignore */ }
    currentSession = null;
    for (const cb of authListeners) cb('SIGNED_OUT', null);
    return { error: null };
  },
};

// ── Query builder ────────────────────────────────────────────
// A deliberately minimal PostgREST-alike: maps chained queries onto
// the Worker's purpose-built REST routes.

interface QueryResult<T = unknown> {
  data: T | null;
  error: { message: string; code?: string } | null;
  count?: number | null;
}

class Query<T = unknown> implements PromiseLike<QueryResult<T>> {
  private table: string;
  private op: 'select' | 'insert' | 'update' | 'delete' | 'upsert' = 'select';
  private body: Json | Json[] | null = null;
  private filters: Array<{ col: string; op: string; val: unknown }> = [];
  private limit_?: number;
  private range_?: { from: number; to: number };
  private single_: 'one' | 'maybeOne' | false = false;
  private orFilter_?: string;

  constructor(table: string) { this.table = table; }

  select(_projection?: string, _opts?: { count?: 'exact' | 'planned' | 'estimated' }) {
    // No-op on read; after insert/upsert/update it signals "return the row",
    // which every Worker endpoint already does — so nothing to track here.
    return this;
  }
  insert(body: Json | Json[]) { this.op = 'insert'; this.body = body; return this; }
  upsert(body: Json | Json[], _opts?: { onConflict?: string }) {
    this.op = 'upsert';
    this.body = body;
    return this;
  }
  update(body: Json) { this.op = 'update'; this.body = body; return this; }
  delete() { this.op = 'delete'; return this; }

  eq(col: string, val: unknown) { this.filters.push({ col, op: 'eq', val }); return this; }
  neq(col: string, val: unknown) { this.filters.push({ col, op: 'neq', val }); return this; }
  in(col: string, vals: unknown[]) { this.filters.push({ col, op: 'in', val: vals }); return this; }
  order(_col: string, _opts?: { ascending?: boolean }) {
    // Ordering is applied server-side by the Worker (e.g. cravings/ratings
    // already ORDER BY created_at DESC). Kept here for API compatibility.
    return this;
  }
  limit(n: number) { this.limit_ = n; return this; }
  range(from: number, to: number) { this.range_ = { from, to }; return this; }
  or(filter: string) { this.orFilter_ = filter; return this; }

  single() { this.single_ = 'one'; return this as unknown as Promise<QueryResult<T>>; }
  maybeSingle() { this.single_ = 'maybeOne'; return this as unknown as Promise<QueryResult<T>>; }

  then<TR1 = QueryResult<T>, TR2 = never>(
    resolve?: ((value: QueryResult<T>) => TR1 | PromiseLike<TR1>) | null,
    reject?: ((reason: unknown) => TR2 | PromiseLike<TR2>) | null,
  ): PromiseLike<TR1 | TR2> {
    return this.execute().then(resolve ?? undefined, reject ?? undefined);
  }

  private findFilter(col: string): unknown | undefined {
    return this.filters.find(f => f.col === col && f.op === 'eq')?.val;
  }

  private async execute(): Promise<QueryResult<T>> {
    try {
      const raw = await this.dispatch();
      if (!raw.ok) {
        const body = await raw.text().catch(() => '');
        return { data: null, error: { message: `${raw.status}: ${body.slice(0, 200)}` } };
      }
      const j = await raw.json() as { data?: unknown; count?: number };
      let data = j.data ?? null;
      // Single-row semantics
      if (this.single_ && Array.isArray(data)) {
        data = data.length > 0 ? data[0] : null;
      }
      if (this.single_ === 'one' && data == null) {
        return { data: null, error: { message: 'Row not found', code: 'PGRST116' } };
      }
      return { data: data as T, error: null, count: j.count ?? null };
    } catch (err) {
      return { data: null, error: { message: err instanceof Error ? err.message : String(err) } };
    }
  }

  // ── Route each (table, op) combo to the right Worker endpoint ──
  private async dispatch(): Promise<Response> {
    const t = this.table;
    const skillId = this.findFilter('skill_id') as string | undefined;
    const userId = this.findFilter('user_id') as string | undefined;
    const id = this.findFilter('id') as string | undefined;

    const qs = new URLSearchParams();

    // ── stars ──
    if (t === 'stars') {
      if (!skillId) throw new Error('stars query requires skill_id filter');
      if (this.op === 'select') {
        if (userId) qs.set('user_id', userId);
        const r = await fetch(`${API_BASE}/api/skills/${skillId}/stars?${qs}`, { credentials: 'include' });
        const j = await r.json() as { count: number; starred: boolean };
        // Shape response so that both "is starred?" and "count" queries work:
        // if caller asked for count, they expect {count, data: []}
        // if caller asked for membership row (.maybeSingle), they expect data = [{id}] or null
        const data = j.starred ? [{ id: 'ok', user_id: userId, skill_id: skillId }] : [];
        return new Response(JSON.stringify({ data, count: j.count }), {
          status: 200, headers: { 'content-type': 'application/json' },
        });
      }
      if (this.op === 'insert') {
        return fetch(`${API_BASE}/api/skills/${skillId}/stars`, {
          method: 'POST', credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({}),
        });
      }
      if (this.op === 'delete') {
        return fetch(`${API_BASE}/api/skills/${skillId}/stars`, {
          method: 'DELETE', credentials: 'include',
        });
      }
    }

    // ── ratings ──
    if (t === 'ratings') {
      if (this.op === 'select' && skillId) {
        return fetch(`${API_BASE}/api/skills/${skillId}/ratings`, { credentials: 'include' });
      }
      if ((this.op === 'upsert' || this.op === 'insert') && this.body) {
        const row = Array.isArray(this.body) ? this.body[0] : this.body;
        const sid = row?.skill_id as string;
        return fetch(`${API_BASE}/api/skills/${sid}/ratings`, {
          method: 'POST', credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ score: row.score, comment: row.comment ?? '' }),
        });
      }
    }

    // ── skills ──
    if (t === 'skills') {
      if (this.op === 'select') {
        if (id) return fetch(`${API_BASE}/api/skills/${id}`, { credentials: 'include' });
        if (this.limit_) qs.set('limit', String(this.limit_));
        const cat = this.findFilter('category') as string | undefined;
        if (cat) qs.set('category', cat);
        return fetch(`${API_BASE}/api/skills?${qs}`, { credentials: 'include' });
      }
      if (this.op === 'insert' && this.body) {
        const rows = Array.isArray(this.body) ? this.body : [this.body];
        // Worker POST /api/skills only handles one row at a time; loop.
        const results = [];
        for (const row of rows) {
          const r = await fetch(`${API_BASE}/api/skills`, {
            method: 'POST', credentials: 'include',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(row),
          });
          if (r.ok) {
            const j = await r.json() as { data: unknown };
            results.push(j.data);
          }
        }
        return new Response(JSON.stringify({ data: results }), {
          status: 200, headers: { 'content-type': 'application/json' },
        });
      }
    }

    // ── cravings ──
    if (t === 'cravings') {
      if (this.op === 'select') {
        const status = this.findFilter('status') as string | undefined;
        if (status) qs.set('status', status);
        if (this.limit_) qs.set('limit', String(this.limit_));
        if (this.range_) {
          qs.set('offset', String(this.range_.from));
          qs.set('limit', String(this.range_.to - this.range_.from + 1));
        }
        // Extract ilike search from .or('title.ilike.%x%,description.ilike.%x%')
        if (this.orFilter_) {
          const m = this.orFilter_.match(/ilike\.%([^%,]+)%/);
          if (m) qs.set('search', m[1]);
        }
        return fetch(`${API_BASE}/api/cravings?${qs}`, { credentials: 'include' });
      }
      if (this.op === 'insert' && this.body) {
        const row = Array.isArray(this.body) ? this.body[0] : this.body;
        return fetch(`${API_BASE}/api/cravings`, {
          method: 'POST', credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(row),
        });
      }
    }

    // ── user_profiles ──
    if (t === 'user_profiles') {
      const uid = id || userId;
      if (!uid) throw new Error('user_profiles query requires id filter');
      if (this.op === 'select') {
        return fetch(`${API_BASE}/api/profiles/${uid}`, { credentials: 'include' });
      }
      if (this.op === 'update' && this.body) {
        return fetch(`${API_BASE}/api/profiles/${uid}`, {
          method: 'PATCH', credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(this.body),
        });
      }
    }

    throw new Error(`Unsupported query: ${t}.${this.op}`);
  }
}

// ── Realtime stub ────────────────────────────────────────────
// The single caller (useRealtimeSkills) just wants .channel().on().subscribe()
// to return *something* that won't throw. We return a no-op channel; the hook
// also reads from localStorage so the UI degrades gracefully.
interface Channel {
  on: (...args: unknown[]) => Channel;
  subscribe: (...args: unknown[]) => Channel;
  unsubscribe: () => Channel;
}
function makeChannel(_name: string): Channel {
  const ch: Channel = {
    on: () => ch,
    subscribe: () => ch,
    unsubscribe: () => ch,
  };
  return ch;
}

// ── RPC inlining ─────────────────────────────────────────────
async function rpc<T = unknown>(fn: string, args?: Json): Promise<QueryResult<T>> {
  // The three RPCs used in this codebase all map to Worker side-effects that
  // already happen in-line when we POST the parent resource — so these become
  // no-ops client-side and we return a benign success.
  //   increment_download   → /api/skills/:id/download (already hit by useDownloads)
  //   refresh_star_count   → /api/skills/:id/stars POST/DELETE updates it
  //   refresh_avg_rating   → /api/skills/:id/ratings POST updates it
  if (fn === 'increment_download' && args && 'p_skill_id' in args) {
    const sid = args.p_skill_id as string;
    try {
      await fetch(`${API_BASE}/api/skills/${sid}/download`, {
        method: 'POST', credentials: 'include',
      });
    } catch { /* ignore */ }
  }
  return { data: null as T, error: null };
}

// ── Public client ────────────────────────────────────────────
export const supabase = {
  auth,
  from<T = unknown>(table: string) { return new Query<T>(table); },
  rpc,
  channel: makeChannel,
  removeChannel: (ch: Channel) => ch.unsubscribe?.() ?? null,
} as any;  // `as any` keeps the existing SupabaseClient-typed callers happy

// ── Types re-export ──────────────────────────────────────────
// Callers still `import type { User } from '@supabase/supabase-js'` — we
// provide a compatible shape from our own client so that import can be
// replaced without touching the call sites.
// Supabase's own User type is famously loose (anything can be in
// user_metadata). We mirror that looseness so existing call sites that do
// `user.user_metadata?.full_name` don't need type gymnastics.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface User {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [k: string]: any;
}
