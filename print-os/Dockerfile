# =====================================================================
# PRINT OS API — Dockerfile
# Multi-stage build untuk production deployment
# =====================================================================

# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies (including dev for TypeScript build)
COPY package.json package-lock.json* ./
RUN npm install --include=dev

# Copy source code
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript
RUN npm run build

# Stage 2: Production
FROM node:20-alpine AS production
WORKDIR /app

# Install only production dependencies
COPY package.json package-lock.json* ./
RUN npm install --omit=dev && npm cache clean --force

# Copy built artifacts from builder
COPY --from=builder /app/dist ./dist

# Expose port (Railway akan inject PORT env var)
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT:-8080}/health || exit 1

# Start server
CMD ["sh", "-c", "node dist/index.js"]
