# Tech Stack & Deployment Standards

## Frontend Stack

### Next.js Setup

`json
{
  \"name\": \"ai-grading-system-web\",
  \"version\": \"1.0.0\",
  \"engines\": { \"node\": \">=18.0.0\" },
  \"dependencies\": {
    \"next\": \"14.0.0\",
    \"react\": \"18.2.0\",
    \"typescript\": \"5.2.0\",
    \"tailwindcss\": \"3.3.0\",
    \"zustand\": \"4.4.0\",
    \"react-query\": \"3.39.0\",
    \"axios\": \"1.6.0\"
  },
  \"devDependencies\": {
    \"jest\": \"29.7.0\",
    \"@testing-library/react\": \"14.1.0\",
    \"eslint\": \"8.50.0\",
    \"prettier\": \"3.0.0\"
  }
}
`

### Next.js Configuration

`	ypescript
// next.config.js
const config = {
  reactStrictMode: true,
  swcMinify: true,
  
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_AUTH_DOMAIN: process.env.NEXT_PUBLIC_AUTH_DOMAIN,
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: \"default-src 'self'; script-src 'self' 'unsafe-inline'\" },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
        ],
      },
    ];
  },

  async redirects() {
    return [
      { source: '/dashboard', destination: '/dashboard/courses', permanent: false },
    ];
  },
};

module.exports = config;
`

### Directory Structure

`
frontend/
  public/
    images/
    fonts/
  src/
    app/
      layout.tsx
      page.tsx
      dashboard/
        courses/
        assignments/
        grades/
      auth/
        login/
        signup/
    components/
      common/
      dashboard/
      forms/
    hooks/
      useAuth.ts
      useSubmissions.ts
      usePlagiarismDetection.ts
    lib/
      api.ts
      constants.ts
      validators.ts
    styles/
      globals.css
    middleware.ts
  __tests__/
    components/
    pages/
  jest.config.js
  tailwind.config.js
`

---

## Backend Stack

### NestJS Setup

`json
{
  \"name\": \"ai-grading-system-api\",
  \"version\": \"1.0.0\",
  \"engines\": { \"node\": \">=18.0.0\" },
  \"dependencies\": {
    \"@nestjs/common\": \"10.2.0\",
    \"@nestjs/core\": \"10.2.0\",
    \"@nestjs/jwt\": \"11.0.0\",
    \"@nestjs/passport\": \"10.0.0\",
    \"@nestjs/typeorm\": \"9.0.0\",
    \"typeorm\": \"0.3.17\",
    \"pg\": \"8.11.0\",
    \"redis\": \"4.6.0\",
    \"openai\": \"4.11.0\",
    \"@anthropic-ai/sdk\": \"0.9.0\",
    \"aws-sdk\": \"2.1500.0\",
    \"class-validator\": \"0.14.0\",
    \"class-transformer\": \"0.5.1\",
    \"helmet\": \"7.1.0\",
    \"@nestjs/throttler\": \"4.1.0\"
  },
  \"devDependencies\": {
    \"@nestjs/testing\": \"10.2.0\",
    \"jest\": \"29.7.0\",
    \"@types/jest\": \"29.5.7\",
    \"ts-jest\": \"29.1.1\",
    \"typescript\": \"5.2.0\"
  }
}
`

### NestJS Main Module

`	ypescript
// src/main.ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Security
  app.use(helmet());
  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  });

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    })
  );

  // Error handling
  app.useGlobalFilters(new GlobalExceptionFilter());

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(\API listening on \\);
}

bootstrap();
`

### Directory Structure

`
backend/
  src/
    common/
      guards/
        auth.guard.ts
        roles.guard.ts
        tenant.guard.ts
      interceptors/
        response.interceptor.ts
        error.interceptor.ts
      filters/
        exception.filter.ts
      decorators/
        @CurrentTenant.ts
        @Roles.ts
      dto/
      exceptions/
    infrastructure/
      database/
        postgres.module.ts
        migrations/
        seeds/
      cache/
        redis.module.ts
      config/
        config.service.ts
    domain/
      institutions/
        institution.entity.ts
        institution.repository.ts
        institution.service.ts
      users/
        user.entity.ts
        user.repository.ts
        user.service.ts
      assignments/
      submissions/
      grades/
      plagiarism/
      audit-logs/
    application/
      use-cases/
      services/
    features/
      assignments/
        dto/
        assignment.controller.ts
        assignment.service.ts
        assignment.module.ts
      grades/
      plagiarism/
  test/
    unit/
    integration/
    e2e/
  Dockerfile
  docker-compose.yml
`

---

## Database (PostgreSQL)

### Connection Pool

`	ypescript
// src/infrastructure/database/postgres.module.ts
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: async (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DB_HOST'),
        port: configService.get('DB_PORT'),
        username: configService.get('DB_USERNAME'),
        password: configService.get('DB_PASSWORD'),
        database: configService.get('DB_NAME'),
        
        // Connection pooling
        extra: {
          max: 20,                    // Max pool size
          min: 5,                     // Min pool size
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 5000,
        },

        entities: [__dirname + '/../../domain/**/*.entity.ts'],
        synchronize: false,           // Use migrations
        migrations: [__dirname + '/migrations/**/*{.ts,.js}'],
        logging: configService.get('NODE_ENV') === 'development',
      }),
      inject: [ConfigService],
    }),
  ],
})
export class PostgresModule {}
`

### Migration Pattern

`ash
# Generate migration
npm run typeorm migration:generate -- src/infrastructure/database/migrations/AddInitialSchema

# Run migrations
npm run typeorm migration:run

# Revert last migration
npm run typeorm migration:revert
`

### Row-Level Security (RLS)

`sql
-- Enable RLS on all tables
ALTER TABLE institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Example RLS policy for assignments
CREATE POLICY tenant_isolation ON assignments
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Set tenant context before queries
SET app.current_tenant_id = 'institution-uuid-here';
SELECT * FROM assignments; -- Only sees assignments for this tenant
`

---

## AI Integration

### Environment Configuration

`ash
# .env.local (for development)
# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o
OPENAI_TEMPERATURE=0.2

# Claude
ANTHROPIC_API_KEY=sk-ant-...
CLAUDE_MODEL=claude-opus

# AWS Bedrock
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
BEDROCK_MODEL=anthropic.claude-3-opus

# Selected provider
AI_PROVIDER=openai
`

### AI Provider Factory

`	ypescript
@Injectable()
export class AIProviderFactory {
  constructor(
    private openaiService: OpenAIService,
    private claudeService: ClaudeService,
    private bedrockService: BedrockService,
  ) {}

  create(provider: string): AIProvider {
    switch (provider) {
      case 'openai':
        return this.openaiService;
      case 'claude':
        return this.claudeService;
      case 'bedrock':
        return this.bedrockService;
      default:
        throw new Error(\Unknown AI provider: \\);
    }
  }
}
`

---

## Caching (Redis)

### Redis Configuration

`	ypescript
@Module({
  imports: [
    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: async (configService: ConfigService) => ({
        store: redisStore,
        host: configService.get('REDIS_HOST'),
        port: configService.get('REDIS_PORT'),
        auth_pass: configService.get('REDIS_PASSWORD'),
        ttl: 600, // 10 minutes
      }),
      inject: [ConfigService],
    }),
  ],
})
export class CacheModule {}
`

### Cache Strategy

`	ypescript
@Injectable()
export class GradeService {
  constructor(private cacheManager: Cache) {}

  async getGrade(gradeId: string, tenantId: string) {
    const cacheKey = \grade:\:\\;
    const cached = await this.cacheManager.get(cacheKey);

    if (cached) return cached;

    const grade = await this.gradeRepository.findById(gradeId, tenantId);
    await this.cacheManager.set(cacheKey, grade, 3600); // 1 hour TTL

    return grade;
  }

  async invalidateGradeCache(gradeId: string, tenantId: string) {
    const cacheKey = \grade:\:\\;
    await this.cacheManager.del(cacheKey);
  }
}
`

---

## Deployment (AWS)

### Docker Configuration

`dockerfile
# Dockerfile.backend
FROM node:18-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

FROM node:18-alpine
WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3001
CMD [\"node\", \"dist/main.js\"]
`

### docker-compose.yml

`yaml
version: '3.9'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: \
      POSTGRES_PASSWORD: \
      POSTGRES_DB: \
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - \"5432:5432\"

  redis:
    image: redis:7-alpine
    ports:
      - \"6379:6379\"

  api:
    build:
      context: ./backend
      dockerfile: Dockerfile
    environment:
      NODE_ENV: production
      DB_HOST: postgres
      REDIS_HOST: redis
      PORT: 3001
    ports:
      - \"3001:3001\"
    depends_on:
      - postgres
      - redis

  web:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:3001/api
    ports:
      - \"3000:3000\"
    depends_on:
      - api

volumes:
  postgres_data:
`

### AWS ECS Deployment

`ash
# Build and push to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin \.dkr.ecr.us-east-1.amazonaws.com

docker build -t ai-grading-api:latest ./backend
docker tag ai-grading-api:latest \.dkr.ecr.us-east-1.amazonaws.com/ai-grading-api:latest
docker push \.dkr.ecr.us-east-1.amazonaws.com/ai-grading-api:latest

# Deploy with CloudFormation or Terraform
# See infrastructure/ directory for IaC configs
`

---

## Environment Variables

`ash
# Application
NODE_ENV=production
PORT=3001

# Database
DB_HOST=postgres.rds.amazonaws.com
DB_PORT=5432
DB_USERNAME=admin
DB_PASSWORD=***
DB_NAME=grading_system

# Redis
REDIS_HOST=grading-redis.cache.amazonaws.com
REDIS_PORT=6379
REDIS_PASSWORD=***

# JWT
JWT_SECRET=***
JWT_EXPIRATION=3600

# AI Providers
AI_PROVIDER=openai
OPENAI_API_KEY=***
ANTHROPIC_API_KEY=***
AWS_REGION=us-east-1

# Plagiarism
TURNITIN_API_KEY=***

# Monitoring
SENTRY_DSN=***
LOG_LEVEL=info

# CORS
CORS_ORIGIN=https://grading-system.example.com

# Feature Flags
ENABLE_AI_GRADING=true
ENABLE_PLAGIARISM_DETECTION=true
ENABLE_INCREMENTAL_SUBMISSIONS=true
`

---

## Monitoring & Logging

### Structured Logging

`	ypescript
@Injectable()
export class LoggerService {
  private logger = new Logger();

  log(context: string, message: string, data?: any) {
    this.logger.log(
      JSON.stringify({ timestamp: new Date(), context, message, data }),
      context
    );
  }

  error(context: string, message: string, error: Error) {
    this.logger.error(
      JSON.stringify({
        timestamp: new Date(),
        context,
        message,
        error: error.message,
        stack: error.stack,
      }),
      error.stack,
      context
    );
  }
}
`

### Health Checks

`	ypescript
@Controller('health')
export class HealthController {
  @Get()
  health() {
    return {
      status: 'ok',
      timestamp: new Date(),
      uptime: process.uptime(),
    };
  }

  @Get('ready')
  ready() {
    // Check database, Redis, external services
    return { ready: true };
  }
}
`

