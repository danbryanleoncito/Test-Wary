# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app

# Copy root package files
COPY package*.json ./
COPY turbo.json ./

# Copy workspace package files
COPY apps/api/package*.json ./apps/api/
COPY packages/shared/package*.json ./packages/shared/

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

# Generate Prisma Client
WORKDIR /app/apps/api
RUN npx prisma generate

# Build the application
WORKDIR /app
RUN npm run build --workspace=apps/api

# Stage 3: Runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Create a non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy necessary files
COPY --from=builder /app/apps/api/.next/standalone ./
COPY --from=builder /app/apps/api/.next/static ./apps/api/.next/static
COPY --from=builder /app/apps/api/public ./apps/api/public
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma

# Set ownership
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Run database migrations and start the server
CMD ["sh", "-c", "cd apps/api && npx prisma migrate deploy && node server.js"]
