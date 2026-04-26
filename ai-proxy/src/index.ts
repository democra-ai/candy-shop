// ============================================================
// Candy Shop AI proxy — runs on the `workers-paid` Cloudflare account
// ============================================================
// Sole purpose: expose env.AI so candy-shop-api (on the main account,
// Free plan) can forward Workers AI calls through *this* account
// (Paid plan, no hard cutoff at 10k Neurons/day).
//
// Auth: shared HMAC-style header. Caller sets `x-shared-secret` to the
// value of the SHARED_SECRET secret on this Worker. Anything else is
// rejected with 403.
//
// API:
//   POST /chat   { messages: [...], max_tokens?: number }
//                → returns Workers AI raw response { response: string, usage? }
//   GET  /health → { ok: true, account: "workers-paid" }
// ============================================================

interface Env {
  AI: Ai;
  SHARED_SECRET: string;
}

// Locked to the same model the upstream Worker uses. Adjust here if you
// want to expose more.
const ALLOWED_MODELS = new Set([
  '@cf/meta/llama-3.1-8b-instruct-fast',
  '@cf/meta/llama-3.1-8b-instruct',
]);
const DEFAULT_MODEL = '@cf/meta/llama-3.1-8b-instruct-fast';

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    if (url.pathname === '/health') {
      return Response.json({ ok: true, account: 'workers-paid', model: DEFAULT_MODEL });
    }

    // Constant-time-ish secret check
    const got = req.headers.get('x-shared-secret') || '';
    const want = env.SHARED_SECRET || '';
    if (!want) return new Response('SHARED_SECRET not configured', { status: 500 });
    if (got.length !== want.length || got !== want) {
      return new Response('forbidden', { status: 403 });
    }

    if (req.method !== 'POST' || url.pathname !== '/chat') {
      return new Response('use POST /chat', { status: 405 });
    }

    let body: {
      model?: string;
      messages?: { role: 'system' | 'user' | 'assistant'; content: string }[];
      max_tokens?: number;
    };
    try {
      body = await req.json();
    } catch {
      return new Response('invalid JSON', { status: 400 });
    }

    if (!body.messages?.length) {
      return new Response('messages required', { status: 400 });
    }

    const model = body.model && ALLOWED_MODELS.has(body.model) ? body.model : DEFAULT_MODEL;
    const max_tokens = Math.min(body.max_tokens ?? 512, 1024);

    try {
      const result = await env.AI.run(model as keyof AiModels, {
        messages: body.messages,
        max_tokens,
      });
      return Response.json({ ...result, model });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return Response.json({ error: msg }, { status: 502 });
    }
  },
};

// Minimal type to satisfy the `as keyof AiModels` cast above without pulling
// the full @cloudflare/workers-types ai-models union.
interface AiModels { '@cf/meta/llama-3.1-8b-instruct-fast': unknown; '@cf/meta/llama-3.1-8b-instruct': unknown }
