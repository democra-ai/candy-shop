---
name: agent-architecture
description: How the Claude Code agent backend works after the low-latency rebuild (persistent warm WS session)
metadata:
  type: project
---

The agent backend was fully rebuilt (May 2026) for low latency — the old
`cc-sandbox`/`oc-sandbox` were out-of-repo black boxes doing one-shot
`claude --print` per turn (cold start every turn). Replaced by, in-repo:

- **`agent/`** — new worker, deploys as `cc-sandbox`. WebSocket bridge to a
  **persistent** Claude Agent SDK session inside a **kept-warm** Cloudflare
  Sandbox container (`getSandbox(id, {sleepAfter:'20m'})`, one container per
  user `agent-<sub>`, started once via `ensureAgentRunning`). Pattern copied
  from Cloudflare's official `codex-app-server` example.
- **`agent/container/server.mjs`** — persistent Node WS server (port 4500)
  using `@anthropic-ai/claude-agent-sdk` streaming-input mode: ONE `query()`
  per connection, turns pushed via an async queue → no per-turn re-init.
- **Auth (anti-abuse):** main worker `POST /api/cc/ticket` mints a 120s
  HMAC ticket (secret `CC_AGENT_TICKET_SECRET`, **must be identical on both
  `worker` and `agent`**) only after validating the session. Agent worker
  verifies signature+expiry before any container/LLM work.
- **Key safety:** real `ANTHROPIC_API_KEY` lives only on the agent worker;
  injected by `Sandbox.outboundByHost['api.anthropic.com']`, never enters
  the container (placeholder `proxy-injected`).
- **Frontend:** `src/lib/cfClaudeCodeClient.ts` rewritten to keep the same
  public API (`streamClaudeCodeRun`/`CCStreamCallbacks`) but over a
  persistent WS singleton; `warmClaudeAgent()` pre-boots on cf-cc mount.

Deploy needs Docker running + `wrangler login` + the two secrets; see
`agent/README.md`. Smoke: `node scripts/agent-smoke.mjs <api-url>`.

**Known follow-up:** OpenCode runtime (`runtimeMode==='opencode'`,
`cfOpenCodeClient.ts` → removed `/api/oc/run`) is now a dead path — should
be removed from SkillExecutor as part of the frontend refactor
([[project-candy-shop]]). Claude Code is the single agent.
