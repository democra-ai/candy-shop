# Cloudflare Sandbox base image (must match @cloudflare/sandbox in
# package.json). Node + a real shell/filesystem so skills can use tools.
FROM docker.io/cloudflare/sandbox:0.10.1

# Bake the persistent Claude Agent server into the image so it starts
# instantly (no install at container boot — that would add cold-start
# latency, the exact thing we're eliminating).
WORKDIR /agent-server
COPY container/package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY container/server.mjs ./

# Long ceiling for individual skill commands; the agent also bounds turns.
ENV COMMAND_TIMEOUT_MS=600000
ENV AGENT_PORT=4500

# WebSocket port the worker bridges the browser to.
EXPOSE 4500
