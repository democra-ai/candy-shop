# ============================================================
# Candy Shop · TEE Skill Runtime (Tier 2)
# ============================================================
# Runs a single confidential Skill inside a Phala CVM (dstack),
# AWS Nitro Enclave, or any OCI-compatible TEE runtime.
#
# Contract with platform:
#   POST /invoke  → { result, attestation: { codeHash, provider, payload, verifiedAt } }
#   GET  /health  → { ok: true }
#   GET  /attestation → raw quote (for external verifiers)
#
# The skill's system prompt is baked into the image at build time
# and NEVER exposed in any response. It's loaded from /app/skill.json
# which is excluded from logs and response payloads.
# ============================================================

FROM node:20-alpine AS build

WORKDIR /app

COPY package.json ./
COPY server.js ./
COPY skill.json ./

# Template has zero runtime deps (Node stdlib only). Run npm install
# only if a lock file exists, so users adding deps still get reproducible builds.
COPY package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; fi

# ── Record the code hash so we can compare against attestation ──
# This is not the TEE measurement — that comes from the enclave — but
# it lets the platform cross-check that the image we registered is the
# image being served.
RUN apk add --no-cache coreutils && \
    sha256sum server.js skill.json package.json | sha256sum | awk '{print $1}' > /app/code_hash.txt

# ── Runtime ──────────────────────────────────────────────────

FROM node:20-alpine

RUN adduser -S -D -H skill && mkdir -p /app && chown skill:nogroup /app
WORKDIR /app
COPY --from=build --chown=skill:nogroup /app /app

USER skill

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["node", "server.js"]
