# Candy Shop Agent (`cc-sandbox`)

Persistent, low-latency Claude Code agent. The browser holds **one warm
WebSocket** to this worker, which bridges to a **persistent Claude Agent
SDK session inside a kept-warm Cloudflare Sandbox container**. The session
is created once and reused for every turn — no per-turn cold start, no
re-init. It feels exactly like using Claude Code directly.

```
browser ──wss (HMAC ticket)──► cc-sandbox worker ──► Sandbox DO (warm, sleepAfter 20m)
                                                        └► node /agent-server/server.mjs
                                                             └► @anthropic-ai/claude-agent-sdk
                                                                  └► api.anthropic.com (key injected egress-side)
```

## Layout

| Path | Role |
|---|---|
| `src/index.ts` | Worker: ticket auth, WS bridge, container lifecycle, `/warm`, egress key injection |
| `container/server.mjs` | Persistent Claude Agent SDK WS server (runs **inside** the container) |
| `container/package.json` | Container deps (`@anthropic-ai/claude-agent-sdk`, `ws`) |
| `Dockerfile` | Sandbox base image + baked-in agent server |
| `wrangler.jsonc` | Deploys as `cc-sandbox` (container + Durable Object) |

## Anti-abuse

The WS / `/warm` endpoints reject anything without a valid, unexpired,
HMAC-signed **ticket**. Tickets are minted only by the main API worker
(`POST /api/cc/ticket`) **after** it validates the user's session, using a
secret shared with this worker (`CC_AGENT_TICKET_SECRET`). The endpoint
cannot be scanned or freeloaded. The real `ANTHROPIC_API_KEY` is injected
by the worker's outbound proxy and never enters the container.

## Deploy

**Prerequisites:** Docker running locally (Wrangler builds the container
image), and `wrangler login`.

```bash
cd agent
npm install

# 1. Anthropic credential (pick one) — agent worker only
wrangler secret put ANTHROPIC_API_KEY            # or CLAUDE_CODE_OAUTH_TOKEN

# 2. Shared ticket secret — MUST be the SAME value on BOTH workers
openssl rand -hex 32                              # generate once
wrangler secret put CC_AGENT_TICKET_SECRET        # paste it here

# 3. Deploy the agent (builds + pushes the container image)
npm run deploy
```

Then set the **same** ticket secret on the main API worker:

```bash
cd ../worker
wrangler secret put CC_AGENT_TICKET_SECRET        # same value as step 2
npm run deploy
```

If the agent is not on `cc-sandbox.<your-subdomain>.workers.dev`, set the
main worker var `CC_SANDBOX_URL` to its real URL (see `worker/wrangler.toml`).

## Smoke test

```bash
# From repo root, after both workers are deployed:
node scripts/agent-smoke.mjs https://candy-shop-api.<subdomain>.workers.dev
```

It mints a guest session, requests a ticket, opens the WS, sends one turn,
and asserts streamed `stream_event` + a final `result`.

## Local dev

```bash
cd agent
cp .dev.vars.example .dev.vars   # fill ANTHROPIC_API_KEY + CC_AGENT_TICKET_SECRET
npm run dev                      # needs Docker
```

Point the main worker / frontend at the local agent via `CC_SANDBOX_URL`
(e.g. `http://127.0.0.1:8787/`).
