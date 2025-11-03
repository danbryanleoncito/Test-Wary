# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app

# Copy root package files
COPY package*.json ./
COPY turbo.json ./

# Copy workspace package files
COPY apps/web/package*.json ./apps/web/
COPY packages/shared/package*.json ./packages/shared/
COPY packages/ui/package*.json ./packages/ui/

# Install dependencies
RUN npm ci

# Stage 2: Builder
FROM node:20-alpine AS builder
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package*.json ./

# Copy source code
COPY . .

# Build the Astro application
RUN npm run build --workspace=apps/web

# Stage 3: Runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Create a non-root user
RUN addgroup --system --gid 1001 astro
RUN adduser --system --uid 1001 astrouser

# Copy built application
COPY --from=builder /app/apps/web/dist ./dist
COPY --from=builder /app/apps/web/package*.json ./

# Install production dependencies only
RUN npm ci --production

# Set ownership
RUN chown -R astrouser:astro /app

USER astrouser

EXPOSE 4321

ENV PORT=4321
ENV HOST="0.0.0.0"

CMD ["node", "./dist/server/entry.mjs"]
