# Architecture Documentation

## System Overview

This CMS platform follows a **microservices-inspired architecture** with clear separation between the API layer (Next.js) and the presentation layer (Astro.js). This design enables:

1. Independent scaling of API and frontend
2. Technology flexibility for each layer
3. Optimal performance through SSR and Islands architecture
4. Clear API contracts through shared types

## Design Decisions

### 1. Why Next.js for the Backend API?

**Decision**: Use Next.js as an API-only backend instead of traditional frameworks like Express or Fastify.

**Rationale**:
- **TypeScript First**: Built-in TypeScript support
- **Serverless Ready**: Easy deployment to Vercel, AWS Lambda, etc.
- **Developer Experience**: File-based routing, hot reload
- **Edge Functions**: Can deploy to edge networks for lower latency
- **Middleware Support**: Easy to implement auth, logging, rate limiting

**Trade-offs**:
- ✅ Rapid development with minimal boilerplate
- ✅ Modern tooling and DX
- ❌ Slightly larger bundle size than minimal frameworks
- ❌ Tied to React ecosystem (though not used for API)

### 2. Why Astro.js for the Frontend?

**Decision**: Use Astro.js with SSR + Islands instead of pure React/Next.js or traditional SSG.

**Rationale**:
- **Zero JS by Default**: Ships no JavaScript unless needed
- **Islands Architecture**: Partial hydration for optimal performance
- **Framework Agnostic**: Can use React, Vue, Svelte in same project
- **SEO Optimized**: Server-side rendering with static optimization
- **Developer Experience**: Familiar component syntax

**Performance Benefits**:
```
Traditional SPA:  [====== Full Hydration ======]  ~300KB JS
Next.js SSR:      [====== Hydration ======]        ~150KB JS
Astro Islands:    [==React==][==React==]           ~50KB JS
```

**Trade-offs**:
- ✅ 80% faster initial load
- ✅ Better Core Web Vitals
- ✅ Lower bandwidth usage
- ❌ Learning curve for Islands pattern
- ❌ Some React features not available (e.g., Context across islands)

### 3. Database: PostgreSQL + Prisma

**Decision**: PostgreSQL with Prisma ORM instead of MongoDB or raw SQL.

**Rationale**:
- **Relational Data**: Content, users, comments have clear relationships
- **ACID Compliance**: Ensures data integrity
- **Full-Text Search**: Built-in PostgreSQL FTS
- **Type Safety**: Prisma generates TypeScript types
- **Migrations**: Automated schema migrations

**Alternative Considered**: MongoDB
- ❌ Less suitable for relational data (articles → authors → comments)
- ❌ No native full-text search (would need Elasticsearch)
- ✅ Would offer better horizontal scaling

### 4. Authentication: JWT vs Sessions

**Decision**: JWT with refresh tokens instead of session-based auth.

**Rationale**:
- **Stateless**: No server-side session storage needed
- **Scalable**: Works across multiple API instances
- **Mobile-Friendly**: Easy to use in mobile apps
- **Separation**: Frontend and backend can be on different domains

**Implementation**:
```typescript
{
  access_token: {
    expiry: "15m",
    contains: { userId, email, role }
  },
  refresh_token: {
    expiry: "7d",
    stored_in_db: true,
    allows_token_revocation: true
  }
}
```

**Trade-offs**:
- ✅ Scalable and stateless
- ✅ Works with CDN caching
- ❌ Cannot invalidate access tokens (15min max exposure)
- ❌ Slightly larger request payloads

### 5. Real-time: SSE vs WebSockets

**Decision**: Server-Sent Events (SSE) instead of WebSockets for real-time updates.

**Rationale**:
- **Unidirectional**: Dashboard only needs server→client updates
- **HTTP-Based**: Works through firewalls and proxies
- **Simpler**: No need for WebSocket infrastructure
- **Auto-Reconnect**: Built into EventSource API

**Use Cases**:
- Live visitor count
- New article notifications
- Analytics updates

**When to Use WebSockets Instead**:
- Bidirectional communication (chat)
- Low latency required (< 50ms)
- Binary data transfer

### 6. Monorepo: Turborepo

**Decision**: Turborepo over Nx or Lerna.

**Rationale**:
- **Speed**: Intelligent caching and parallelization
- **Simple**: Less configuration than Nx
- **Remote Caching**: Share build cache across team
- **Modern**: Built by Vercel, actively maintained

**Structure**:
```
apps/           # Applications (api, web)
packages/       # Shared libraries (shared, ui)
```

**Benefits**:
- Shared types between frontend and backend
- Single command to run all apps
- Consistent tooling (ESLint, TypeScript)

## Data Flow

### 1. Article Creation Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Editor  │────>│  Astro   │────>│ Next.js  │────>│PostgreSQL│
│ (React)  │     │  Page    │     │   API    │     │          │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
     │                                  │                 │
     │  1. User types content          │                 │
     │  2. Auto-save (debounced)       │                 │
     │                                  │                 │
     │  3. POST /api/content            │                 │
     │     - Validate JWT               │                 │
     │     - Check permissions          │                 │
     │                                  │                 │
     │                                  │  4. Create      │
     │                                  │     article     │
     │                                  │     + version   │
     │                                  │                 │
     │  5. Return article              │                 │
     │  6. Update UI                    │                 │
     │  7. SSE broadcast               │                 │
```

### 2. Article Viewing Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐
│ Browser  │────>│  Astro   │────>│ Next.js  │
│          │     │  SSR     │     │   API    │
└──────────┘     └──────────┘     └──────────┘
     │                │                 │
     │  1. GET /blog/my-article        │
     │                │                 │
     │                │  2. Fetch article data
     │                │                 │
     │                │  3. Render HTML │
     │                │     (server)    │
     │                │                 │
     │  4. Return HTML with inline data
     │     + React islands (dehydrated)
     │                │                 │
     │  5. Browser parses HTML          │
     │  6. Hydrate islands:             │
     │     - ShareButtons (visible)     │
     │     - Comments (idle)            │
```

## Performance Optimizations

### 1. Caching Strategy

**Multi-Layer Caching**:
```typescript
Browser Cache
  ↓ (miss)
CDN Cache
  ↓ (miss)
Application Cache (Redis)
  ↓ (miss)
Database
```

**Cache Headers**:
```typescript
{
  // Static assets
  "Cache-Control": "public, max-age=31536000, immutable",

  // Dynamic content
  "Cache-Control": "s-maxage=3600, stale-while-revalidate=86400",

  // User-specific
  "Cache-Control": "private, max-age=0, must-revalidate"
}
```

### 2. Islands Architecture Benefits

**Traditional Approach** (Next.js):
```jsx
// Entire page hydrates as React
export default function Article({ article }) {
  return (
    <Layout>
      <ArticleContent content={article.content} />  {/* Could be static */}
      <ShareButtons url={url} />                     {/* Interactive */}
      <Comments articleId={article.id} />            {/* Interactive */}
    </Layout>
  )
}
// JS Bundle: ~200KB
```

**Islands Approach** (Astro):
```astro
---
const article = await getArticle();
---
<Layout>
  <!-- Static HTML, no JS -->
  <div set:html={article.content} />

  <!-- React island: ~8KB -->
  <ShareButtons client:visible url={url} />

  <!-- React island: ~15KB -->
  <Comments client:idle articleId={article.id} />
</Layout>
<!-- Total JS: ~23KB vs ~200KB -->
```

### 3. Database Optimization

**Indexes**:
```prisma
@@index([slug])           // Fast article lookup
@@index([status])         // Filter published articles
@@index([authorId])       // Author's articles
@@index([publishedAt])    // Sorting by date
```

**Query Optimization**:
```typescript
// ❌ N+1 Query Problem
const articles = await prisma.article.findMany();
for (const article of articles) {
  const author = await prisma.user.findUnique({ where: { id: article.authorId } });
}

// ✅ Single Query with Include
const articles = await prisma.article.findMany({
  include: { author: true, tags: true }
});
```

## Security Architecture

### 1. Authentication Flow

```
┌─────────┐         ┌─────────┐         ┌─────────┐
│ Client  │────1───>│   API   │────2───>│   DB    │
│         │<───3────│         │<───4────│         │
└─────────┘         └─────────┘         └─────────┘

1. POST /api/auth/login { email, password }
2. Verify password hash
3. Return { accessToken, refreshToken }
4. Store refreshToken in DB

Subsequent Requests:
Authorization: Bearer <accessToken>
```

### 2. Permission System

```typescript
// Hierarchical Permissions
const permissions = {
  admin: ['*'],                              // All permissions
  editor: ['content:*', 'media:*', ...],    // Content management
  author: ['content:create', ...],           // Own content
  viewer: ['content:read', ...]              // Read only
}

// Permission Check
function hasPermission(role, permission) {
  if (permissions[role].includes('*')) return true;
  return permissions[role].some(p =>
    p.endsWith(':*')
      ? permission.startsWith(p.slice(0, -2))
      : p === permission
  );
}
```

### 3. Rate Limiting

```typescript
// Per-user rate limits
const limits = {
  anonymous: 100,      // requests per hour
  authenticated: 1000,
  api_key: 10000
}

// Implementation
middleware: async (req) => {
  const identifier = getUserId(req) || req.ip;
  const limit = await checkRateLimit(identifier);

  if (!limit.allowed) {
    return Response(429, {
      resetAt: limit.resetAt
    });
  }
}
```

## Deployment Architecture

### Development
```
localhost:3000  → Next.js API (dev)
localhost:4321  → Astro frontend (dev)
localhost:5432  → PostgreSQL
```

### Production (Docker Compose)
```
nginx (port 80)
  ├─> /api/*  → api:3000 (Next.js)
  ├─> /*      → web:4321 (Astro)
  └─> /static → CDN

postgres:5432
redis:6379 (cache)
```

### Production (Cloud)
```
Vercel Edge
  ├─> /api/*  → Next.js API (Serverless)
  └─> /*      → Astro frontend (Edge)

AWS RDS (PostgreSQL)
Redis Cloud (Cache)
S3 (Media uploads)
CloudFront (CDN)
```

## Scalability Considerations

### Horizontal Scaling

**API Servers**:
- Stateless design allows unlimited instances
- Load balancer distributes traffic
- Shared PostgreSQL + Redis

**Database**:
- Read replicas for scaling reads
- Connection pooling (Prisma)
- Potential for sharding by tenant

### Vertical Scaling

**Optimization Priority**:
1. Database queries (indexes, caching)
2. API response time (Redis cache)
3. Frontend bundle size (code splitting)

### Monitoring

**Key Metrics**:
```
API:
- Request rate (req/s)
- Response time (p50, p95, p99)
- Error rate (%)
- Database query time

Frontend:
- Core Web Vitals (LCP, FID, CLS)
- Time to Interactive (TTI)
- JS bundle size
- Cache hit rate
```

## Future Enhancements

1. **GraphQL API**: Alternative to REST for flexible queries
2. **Elasticsearch**: Advanced full-text search
3. **CDN Integration**: Cloudflare/CloudFront for global distribution
4. **Multi-tenancy**: Separate content per organization
5. **A/B Testing**: Feature flags and experiments
6. **AI Integration**: Content suggestions, auto-tagging
7. **PWA Features**: Offline support, push notifications

## Conclusion

This architecture balances:
- **Performance**: Islands architecture + SSR
- **Developer Experience**: TypeScript, type-safe APIs
- **Scalability**: Stateless design, horizontal scaling
- **Maintainability**: Monorepo, shared types
- **Security**: JWT auth, RBAC, rate limiting

The multi-framework approach leverages the best of each technology while maintaining clear separation of concerns.
