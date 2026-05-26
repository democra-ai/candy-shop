# Candy Shop · TEE Skill Template

Tier-2 confidential runtime. Bake your Skill prompt into a container,
deploy to a TEE (Phala / AWS Nitro / GCP CS), and register the public
endpoint with Candy Shop. From that point on, **no one**— not the user,
not the platform, not the cloud provider — can read the prompt.

## Quick deploy (Phala Cloud)

```bash
# 1. Fill in your skill
cp skill.example.json skill.json
$EDITOR skill.json        # set id, systemPrompt, maxTokens

# 2. Build
docker build -t ghcr.io/<you>/candy-shop-skill-<id>:v1 .
docker push ghcr.io/<you>/candy-shop-skill-<id>:v1

# 3. Grab the code hash printed at build time (or compute locally):
docker run --rm ghcr.io/<you>/candy-shop-skill-<id>:v1 cat /app/code_hash.txt

# 4. Deploy to Phala Cloud (see https://docs.phala.network/phala-cloud)
phala cvm create \
  --image ghcr.io/<you>/candy-shop-skill-<id>:v1 \
  --env LLM_API_KEY=sk-... \
  --env TEE_PLATFORM_SIGNING_KEY=<shared-with-candy-shop>

# 5. Register with Candy Shop
# Update the skill row:
#   execution_model    = 'tee'
#   tee_provider       = 'phala'
#   tee_endpoint       = 'https://<your-cvm>.phala.network'
#   tee_code_hash      = '<hash from step 3>'
#   tee_attestation_url = 'https://<your-cvm>.phala.network/attestation'
```

## Wire protocol

Candy Shop's invoke route proxies to `POST {tee_endpoint}/invoke`:

```
POST /invoke
Headers:
  X-Platform-Signature: <hmac-sha256(body+nonce, TEE_PLATFORM_SIGNING_KEY)>
  X-Nonce: <uuid>
Body:
  { skillId, input, callerId, nonce }

Response 200:
  { result, attestation: { codeHash, provider, payload, verifiedAt } }
```

The template rejects any request without a valid HMAC signature
(dev mode: unsigned allowed when `TEE_PLATFORM_SIGNING_KEY` is unset).

## What's real vs. what's TODO

| Concern                              | Template    | Production hook                    |
|--------------------------------------|-------------|------------------------------------|
| Prompt isolation from platform ops   | ✅ real      | Prompt baked in; image is sealed   |
| Platform-signed requests             | ✅ real      | HMAC; swap for ed25519 in prod     |
| TEE attestation quote                | ⚠ stub      | Replace `getAttestation()` with dstack / NSM call |
| Full quote verification              | ⚠ stub      | Candy Shop's `verifyAttestation()` currently shape-checks only |
| Key rotation                         | ⚠ stub      | Add per-skill rotating keys        |

The stubs are intentionally explicit. The integrity story is only as
strong as the attestation source — replace before claiming "zero trust".
