# Multi-stage Dockerfile for Frostreaver Loot Buckets (Next.js 16 + React 19)
#
# Build: docker build -t frostreaver:latest .
# Run:   docker run -p 3000:3000 frostreaver:latest
#
# Stages:
#   1. deps: Install production dependencies
#   2. builder: Build Next.js app with all dependencies
#   3. runtime: Minimal runtime image with only necessary files

# ============================================================================
# Stage 1: Dependencies
# ============================================================================
FROM node:22-alpine AS deps

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install production dependencies only (no devDependencies)
RUN npm ci --omit=dev

# ============================================================================
# Stage 2: Builder
# ============================================================================
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install all dependencies (including devDependencies needed for build)
RUN npm ci

# Copy source code
COPY . .

# Build the Next.js app
# This generates the .next folder and standalone output
RUN npm run build

# ============================================================================
# Stage 3: Runtime
# ============================================================================
FROM node:22-alpine AS runtime

WORKDIR /app

# Install dumb-init to properly handle signals (PID 1 issue in containers)
RUN apk add --no-cache dumb-init curl

# Copy production dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy package files (needed for runtime)
COPY package.json package-lock.json ./

# Copy built Next.js app from builder stage
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public

# Copy data files if they exist (static data bundled into app)
# In production, this data is pre-rendered into HTML at build time
COPY --from=builder /app/data ./data

# Non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

USER nextjs

# Expose port for Next.js server
EXPOSE 3000

# Environment variables for Next.js
ENV NODE_ENV=production
ENV PORT=3000

# Health check: Verify the app is responding
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:3000/ || exit 1

# Use dumb-init to avoid zombie processes and handle signals gracefully
ENTRYPOINT ["dumb-init", "--"]

# Start Next.js server
# The .next folder contains the production-optimized build
CMD ["node_modules/.bin/next", "start"]
