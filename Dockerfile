# Use Node.js LTS (20) as the base image
FROM node:20-slim AS builder

# Enable pnpm
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
# We set SPACE_ID to true to ensure the base path is set to '/'
ENV SPACE_ID=true
RUN pnpm run build

# Production stage
FROM node:20-slim AS runner

WORKDIR /app

# Install simple static server
RUN npm install -g serve

# Copy built assets from builder stage
COPY --from=builder /app/dist ./dist

# Expose port 7860 (Hugging Face Spaces default)
EXPOSE 7860

# Start command
CMD ["serve", "-s", "dist", "-l", "7860"]
