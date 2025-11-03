# Deployment Guide

This guide covers deploying the CMS platform to various environments.

## Table of Contents

1. [Local Development](#local-development)
2. [Docker Deployment](#docker-deployment)
3. [Cloud Deployment](#cloud-deployment)
4. [Environment Variables](#environment-variables)
5. [Database Setup](#database-setup)
6. [Monitoring & Logging](#monitoring--logging)

## Local Development

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL 16+
- Git

### Setup Steps

1. **Clone and Install**
```bash
git clone <repository-url>
cd cms-platform
npm install
```

2. **Database Setup**
```bash
# Create PostgreSQL database
createdb cms_platform

# Set environment variables
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env

# Run migrations
cd apps/api
npx prisma migrate dev
npx prisma db seed  # Optional: seed data
```

3. **Start Development Servers**
```bash
# From root directory
npm run dev
```

Access:
- API: http://localhost:3000
- Frontend: http://localhost:4321
- API Docs: http://localhost:3000/api-docs

## Docker Deployment

### Using Docker Compose (Recommended)

1. **Build and Start**
```bash
docker-compose up -d
```

2. **Check Status**
```bash
docker-compose ps
docker-compose logs -f
```

3. **Run Migrations**
```bash
docker-compose exec api npx prisma migrate deploy
```

4. **Stop Services**
```bash
docker-compose down
docker-compose down -v  # Also remove volumes
```

### Manual Docker Build

```bash
# Build images
docker build -f apps/api/Dockerfile -t cms-api:latest .
docker build -f apps/web/Dockerfile -t cms-web:latest .

# Run containers
docker run -d -p 3000:3000 --env-file apps/api/.env cms-api:latest
docker run -d -p 4321:4321 --env-file apps/web/.env cms-web:latest
```

### Docker Compose Configuration

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: cms_platform
      POSTGRES_USER: cms_user
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data

  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    depends_on:
      - postgres
    environment:
      DATABASE_URL: postgresql://cms_user:${DB_PASSWORD}@postgres:5432/cms_platform

  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
    depends_on:
      - api
    environment:
      PUBLIC_API_URL: ${API_URL}
```

## Cloud Deployment

### Vercel (Recommended for Frontend)

**Astro Frontend:**

1. **Install Vercel CLI**
```bash
npm i -g vercel
```

2. **Deploy**
```bash
cd apps/web
vercel --prod
```

3. **Configure**
```json
// vercel.json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "astro",
  "env": {
    "PUBLIC_API_URL": "@api-url"
  }
}
```

**Next.js API:**

```bash
cd apps/api
vercel --prod
```

### Railway (Recommended for Backend)

1. **Install Railway CLI**
```bash
npm i -g @railway/cli
```

2. **Initialize**
```bash
railway login
railway init
```

3. **Deploy**
```bash
railway up
```

4. **Add Database**
```bash
railway add -d postgres
```

### AWS (Production)

**Architecture:**
```
Route 53 (DNS)
    ↓
CloudFront (CDN)
    ↓
ALB (Load Balancer)
    ├─> ECS (Next.js API)
    └─> S3 + CloudFront (Astro static)

RDS (PostgreSQL)
ElastiCache (Redis)
S3 (Media uploads)
```

**Deployment Steps:**

1. **Build Docker Images**
```bash
docker build -t <account-id>.dkr.ecr.<region>.amazonaws.com/cms-api:latest -f apps/api/Dockerfile .
docker build -t <account-id>.dkr.ecr.<region>.amazonaws.com/cms-web:latest -f apps/web/Dockerfile .
```

2. **Push to ECR**
```bash
aws ecr get-login-password --region <region> | docker login --username AWS --password-stdin <account-id>.dkr.ecr.<region>.amazonaws.com

docker push <account-id>.dkr.ecr.<region>.amazonaws.com/cms-api:latest
docker push <account-id>.dkr.ecr.<region>.amazonaws.com/cms-web:latest
```

3. **Deploy to ECS**
```bash
# Create task definition and service
aws ecs create-service \
  --cluster cms-cluster \
  --service-name cms-api \
  --task-definition cms-api:1 \
  --desired-count 2
```

### DigitalOcean App Platform

1. **Create App**
```yaml
# .do/app.yaml
name: cms-platform
services:
  - name: api
    github:
      repo: your-org/cms-platform
      branch: main
      deploy_on_push: true
    dockerfile_path: apps/api/Dockerfile
    envs:
      - key: DATABASE_URL
        value: ${db.DATABASE_URL}

  - name: web
    github:
      repo: your-org/cms-platform
      branch: main
    dockerfile_path: apps/web/Dockerfile
    envs:
      - key: PUBLIC_API_URL
        value: ${api.PUBLIC_URL}

databases:
  - name: db
    engine: PG
    version: "16"
```

2. **Deploy**
```bash
doctl apps create --spec .do/app.yaml
```

## Environment Variables

### API (.env)

```bash
# Database
DATABASE_URL="postgresql://user:password@host:5432/database"

# JWT
JWT_ACCESS_SECRET="random-secret-min-32-chars"
JWT_REFRESH_SECRET="random-secret-min-32-chars"
JWT_ACCESS_EXPIRY="15m"
JWT_REFRESH_EXPIRY="7d"

# API
API_URL="https://api.example.com"
NEXT_PUBLIC_API_URL="https://api.example.com"

# Redis (optional)
REDIS_URL="redis://host:6379"

# Upload
UPLOAD_MAX_SIZE=5242880  # 5MB
UPLOAD_DIR="./uploads"

# Environment
NODE_ENV="production"
```

### Frontend (.env)

```bash
# API
PUBLIC_API_URL="https://api.example.com"

# Analytics (optional)
PUBLIC_GA_ID="G-XXXXXXXXXX"
```

## Database Setup

### PostgreSQL

**Local Setup:**
```bash
# macOS
brew install postgresql@16
brew services start postgresql@16

# Ubuntu
sudo apt install postgresql-16
sudo systemctl start postgresql

# Create database
createdb cms_platform
```

**Cloud Options:**

1. **AWS RDS**
```bash
aws rds create-db-instance \
  --db-instance-identifier cms-db \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --engine-version 16.1 \
  --master-username admin \
  --master-user-password <password>
```

2. **DigitalOcean Managed Database**
```bash
doctl databases create cms-db \
  --engine pg \
  --version 16 \
  --region nyc1
```

3. **Supabase**
- Sign up at supabase.com
- Create new project
- Copy connection string
- Use as DATABASE_URL

### Migrations

**Apply Migrations:**
```bash
npx prisma migrate deploy
```

**Create Migration:**
```bash
npx prisma migrate dev --name add_new_field
```

**Reset Database:**
```bash
npx prisma migrate reset
```

### Backup & Restore

**Backup:**
```bash
pg_dump -Fc cms_platform > backup.dump
```

**Restore:**
```bash
pg_restore -d cms_platform backup.dump
```

## Monitoring & Logging

### Application Monitoring

**Recommended Tools:**
- **Sentry**: Error tracking
- **DataDog**: APM and infrastructure
- **New Relic**: Full-stack observability

**Setup Sentry:**
```bash
npm install @sentry/nextjs @sentry/node

# apps/api/sentry.config.js
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0,
});
```

### Logs

**Docker Logs:**
```bash
docker-compose logs -f api
docker-compose logs -f web
docker-compose logs -f postgres
```

**AWS CloudWatch:**
```bash
aws logs tail /ecs/cms-api --follow
```

**Log Aggregation:**
- **Logtail**: Simple log management
- **Papertrail**: Searchable logs
- **ELK Stack**: Self-hosted solution

### Health Checks

**API Health Endpoint:**
```typescript
// apps/api/app/api/health/route.ts
export async function GET() {
  const dbStatus = await prisma.$queryRaw`SELECT 1`;

  return Response.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      database: dbStatus ? 'up' : 'down',
      redis: 'up'  // Add actual check
    }
  });
}
```

**Monitoring:**
```bash
# Simple uptime monitor
curl https://api.example.com/api/health

# With UptimeRobot, Pingdom, or StatusCake
```

### Performance Monitoring

**Metrics to Track:**
- API response time (p50, p95, p99)
- Database query time
- Error rate
- Request rate
- Memory/CPU usage

**Setup DataDog:**
```bash
# Install DataDog agent
DD_AGENT_MAJOR_VERSION=7 DD_API_KEY=<api-key> DD_SITE="datadoghq.com" bash -c "$(curl -L https://s3.amazonaws.com/dd-agent/scripts/install_script.sh)"
```

## CI/CD Pipeline

### GitHub Actions (Included)

The project includes a GitHub Actions workflow (`.github/workflows/ci-cd.yml`) that:

1. **Lint & Type Check**: Ensures code quality
2. **Run Tests**: Unit and E2E tests
3. **Build**: Creates production builds
4. **Deploy**: Pushes to Docker registry

**Required Secrets:**
```bash
# GitHub Repository Settings > Secrets
DOCKER_REGISTRY=<registry-url>
DOCKER_USERNAME=<username>
DOCKER_PASSWORD=<password>
DATABASE_URL=<production-db-url>
```

### Manual Deployment

**Production Checklist:**

- [ ] Set environment variables
- [ ] Run database migrations
- [ ] Build Docker images
- [ ] Test in staging environment
- [ ] Deploy to production
- [ ] Verify health checks
- [ ] Monitor logs for errors
- [ ] Test critical user flows

## Security Checklist

Before deploying to production:

- [ ] Change all default passwords
- [ ] Use strong JWT secrets (32+ random characters)
- [ ] Enable HTTPS/SSL
- [ ] Set up firewall rules
- [ ] Configure CORS properly
- [ ] Enable rate limiting
- [ ] Set up database backups
- [ ] Implement logging and monitoring
- [ ] Review environment variables
- [ ] Test authentication flows
- [ ] Enable Content Security Policy
- [ ] Set secure cookie flags

## Troubleshooting

### Common Issues

**Database Connection Failed:**
```bash
# Check if PostgreSQL is running
pg_isready

# Test connection
psql $DATABASE_URL

# Check firewall rules
```

**Build Fails:**
```bash
# Clear cache and rebuild
npm run clean
npm install
npm run build
```

**Port Already in Use:**
```bash
# Find process using port
lsof -i :3000
lsof -i :4321

# Kill process
kill -9 <PID>
```

**Prisma Issues:**
```bash
# Regenerate client
npx prisma generate

# Reset database
npx prisma migrate reset
```

## Support

For issues and questions:
- GitHub Issues: [repository]/issues
- Documentation: [link-to-docs]
- Email: support@example.com
