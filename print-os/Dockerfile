# =====================================================================
# PRINT OS API — Production Dockerfile
# Multi-stage build, optimized for Railway
# =====================================================================

# Stage 1: Build TypeScript
FROM node:20-alpine AS builder
WORKDIR /app

# Install ALL dependencies (including dev for TypeScript)
COPY package.json package-lock.json* ./
RUN npm ci --include=dev || npm install --include=dev

# Copy TypeScript config and source
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript → JavaScript
RUN npm run build

# Stage 2: Production runtime
FROM node:20-alpine AS runtime
WORKDIR /app

# Set production environment
ENV NODE_ENV=production

# Install ONLY production dependencies
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm install --omit=dev

# Copy built JavaScript from builder
COPY --from=builder /app/dist ./dist

# Copy public assets (dashboard HTML)
COPY public ./public

# Expose port (Railway will inject PORT)
EXPOSE 8080

# Health check using Node.js (no wget needed)
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://localhost:'+ (process.env.PORT || 8080) +'/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Start the application
CMD ["node", "dist/index.js"]
