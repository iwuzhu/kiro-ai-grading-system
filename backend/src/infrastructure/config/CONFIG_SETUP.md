# Environment Configuration & Secrets Management

**Requirement**: 19 - Data Security & Privacy

This document explains the environment configuration system for the AI Grading System backend. It covers setup for development, testing, and production environments.

## Overview

The configuration system provides:

- **Centralized Configuration**: All environment variables in one place
- **Type Safety**: TypeScript interfaces for configuration access
- **Validation**: Joi schema validates all configs at startup
- **Security**: Secrets stored in environment variables, never hardcoded
- **Environment Support**: Separate configs for dev, test, and prod

## Quick Start

### 1. Copy .env.example to .env.local

```bash
cd backend
cp .env.example .env.local
```

### 2. Fill in required values

Edit `.env.local` and update these critical secrets:

```env
# Database (from your PostgreSQL instance)
DATABASE_HOST=localhost
DATABASE_USER=grading_user
DATABASE_PASSWORD=your_secure_password

# Authentication secrets (generate with: openssl rand -hex 32)
JWT_SECRET=your_32_char_hex_string
REFRESH_TOKEN_SECRET=your_32_char_hex_string
SESSION_SECRET=your_32_char_hex_string

# Encryption key (generate with: openssl rand -base64 32)
ENCRYPTION_KEY=your_base64_encoded_key

# AI Provider (get from provider's console)
AI_PROVIDER=openai
OPENAI_API_KEY=your_openai_api_key
```

### 3. Start the application

```bash
npm run start:dev
```

If configuration is valid, the app starts normally. If invalid, you get helpful error messages about what's missing.

## Environment Variables

### Application

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | Yes | `dev` | Environment: `dev`, `test`, or `prod` |
| `PORT` | No | `3000` | Server port |
| `API_BASE_URL` | Yes | N/A | Base URL for API (http://localhost:3000 for dev) |
| `CORS_ORIGIN` | Yes | N/A | CORS origin (http://localhost:3001 for dev frontend) |
| `LOG_LEVEL` | No | `info` | Logging level: debug, info, warn, error |

### Database

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_HOST` | Yes | N/A | PostgreSQL hostname |
| `DATABASE_PORT` | No | `5432` | PostgreSQL port |
| `DATABASE_NAME` | No | `shared_database` | Database name |
| `DATABASE_USER` | Yes | N/A | Database user (e.g., grading_user) |
| `DATABASE_PASSWORD` | Yes | N/A | Database password (MUST be non-empty) |
| `DATABASE_SSL` | No | `false` | Enable SSL (true for production) |
| `DATABASE_POOL_MIN` | No | `5` | Minimum connection pool size |
| `DATABASE_POOL_MAX` | No | `20` | Maximum connection pool size |
| `DATABASE_LOGGING` | No | `false` | Enable SQL query logging (dev only) |

### Authentication

All authentication secrets must be at least 32 characters. Generate with: `openssl rand -hex 32`

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `JWT_SECRET` | Yes | N/A | JWT secret key (32+ chars) |
| `JWT_EXPIRATION` | No | `3600` | JWT expiration in seconds (1 hour) |
| `REFRESH_TOKEN_SECRET` | Yes | N/A | Refresh token secret (32+ chars) |
| `REFRESH_TOKEN_EXPIRATION` | No | `2592000` | Refresh token expiration (30 days) |
| `SESSION_SECRET` | Yes | N/A | Session secret for cookies (32+ chars) |

### AI Provider

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `AI_PROVIDER` | Yes | `openai` | Selected provider: openai, claude, or bedrock |
| `OPENAI_API_KEY` | If openai | N/A | OpenAI API key (required if provider=openai) |
| `OPENAI_MODEL` | No | `gpt-4-turbo` | OpenAI model name |
| `ANTHROPIC_API_KEY` | If claude | N/A | Anthropic API key (required if provider=claude) |
| `ANTHROPIC_MODEL` | No | `claude-3-opus-20240229` | Anthropic model name |
| `AWS_ACCESS_KEY_ID` | If bedrock | N/A | AWS access key (required if provider=bedrock) |
| `AWS_SECRET_ACCESS_KEY` | If bedrock | N/A | AWS secret key (required if provider=bedrock) |
| `AWS_REGION` | No | `us-east-1` | AWS region |

### Encryption

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ENCRYPTION_KEY` | Yes | N/A | AES-256 encryption key (base64, 32 bytes) |
| `ENCRYPTION_ALGORITHM` | No | `aes-256-cbc` | Encryption algorithm |

**Generate encryption key**:
```bash
openssl rand -base64 32
```

### AWS S3 (File Storage)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `AWS_S3_BUCKET_NAME` | Yes | N/A | S3 bucket name for uploads |
| `AWS_S3_REGION` | No | `us-east-1` | S3 region |
| `AWS_S3_ACCESS_KEY_ID` | Yes | N/A | AWS access key |
| `AWS_S3_SECRET_ACCESS_KEY` | Yes | N/A | AWS secret key |

### Plagiarism Detection

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TURNITIN_API_KEY` | Yes | N/A | Turnitin API key |
| `TURNITIN_API_URL` | No | `https://api.turnitin.com` | Turnitin API URL |

### Email & Notifications

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NOTIFICATION_EMAIL_FROM` | Yes | N/A | Sender email address |
| `NOTIFICATION_EMAIL_PROVIDER` | Yes | N/A | Email provider: sendgrid or mailgun |
| `NOTIFICATION_EMAIL_API_KEY` | Yes | N/A | Email provider API key |

### External Services

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `REDIS_URL` | No | N/A | Redis URL for caching (optional) |

## Setup by Environment

### Development (.env.local)

```bash
# Application
NODE_ENV=dev
PORT=3000
API_BASE_URL=http://localhost:3000
CORS_ORIGIN=http://localhost:3001
LOG_LEVEL=debug

# Database (local PostgreSQL)
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=shared_database
DATABASE_USER=grading_user
DATABASE_PASSWORD=dev_password_here
DATABASE_SSL=false
DATABASE_LOGGING=true

# Secrets (generate with: openssl rand -hex 32)
JWT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
REFRESH_TOKEN_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SESSION_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Encryption (generate with: openssl rand -base64 32)
ENCRYPTION_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx=

# AI Provider
AI_PROVIDER=openai
OPENAI_API_KEY=sk-...your_dev_key...
OPENAI_MODEL=gpt-4-turbo

# AWS S3
AWS_S3_BUCKET_NAME=grading-dev-bucket
AWS_S3_REGION=us-east-1
AWS_S3_ACCESS_KEY_ID=AKIXXXXXXXXX
AWS_S3_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxxx

# Other services
TURNITIN_API_KEY=your_turnitin_dev_key
TURNITIN_API_URL=https://api.turnitin.com
NOTIFICATION_EMAIL_FROM=dev@localhost
NOTIFICATION_EMAIL_PROVIDER=sendgrid
NOTIFICATION_EMAIL_API_KEY=SG.xxx...your_dev_key...
```

### Testing (.env.test)

Create `.env.test` for test database:

```bash
NODE_ENV=test
DATABASE_NAME=grading_test
DATABASE_LOGGING=false
LOG_LEVEL=error
# Use same secrets as dev for testing
JWT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
REFRESH_TOKEN_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SESSION_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# ... other vars same as dev ...
```

### Production (.env.prod)

**DO NOT commit production secrets to git!**

Create `.env.prod` with non-secret defaults:

```bash
# .env.prod - public defaults (check into git)
NODE_ENV=prod
PORT=3000
LOG_LEVEL=warn
DATABASE_PORT=5432
DATABASE_NAME=shared_database
DATABASE_SSL=true
DATABASE_POOL_MIN=10
DATABASE_POOL_MAX=50
```

Then create `.env.prod.local` with secrets (git-ignored):

```bash
# .env.prod.local - secrets from AWS Secrets Manager (never commit!)
DATABASE_HOST=tec-bridgeaidb.csvikosmym65.us-east-1.rds.amazonaws.com
DATABASE_USER=grading_user
DATABASE_PASSWORD=***(from AWS Secrets Manager)
JWT_SECRET=***(from AWS Secrets Manager)
REFRESH_TOKEN_SECRET=***(from AWS Secrets Manager)
SESSION_SECRET=***(from AWS Secrets Manager)
ENCRYPTION_KEY=***(from AWS Secrets Manager)
# ... other secrets ...
```

## Configuration Loading Order

Environment files are loaded in this order (last one wins):

1. `.env` - Base defaults (git-checked)
2. `.env.local` - Local overrides (git-ignored)
3. `.env.{NODE_ENV}` - Environment-specific defaults (git-checked)
4. `.env.{NODE_ENV}.local` - Environment-specific secrets (git-ignored)

Example for production:

```bash
# First load defaults from .env
DATABASE_SSL=false

# Override with .env.prod
DATABASE_SSL=true

# Override with .env.prod.local (from secrets)
DATABASE_PASSWORD=secret_from_aws
```

## Accessing Configuration in Code

### In Services

```typescript
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IAppConfig } from './config.interface';

@Injectable()
export class MyService {
  constructor(private configService: ConfigService<IAppConfig>) {}

  doSomething() {
    // Access typed configuration
    const dbHost = this.configService.get('database.host');
    const jwtSecret = this.configService.get('authentication.jwtSecret');
    const aiProvider = this.configService.get('aiProvider.provider');
  }
}
```

### In Controllers

```typescript
import { Controller } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IAppConfig } from './config.interface';

@Controller()
export class MyController {
  constructor(private configService: ConfigService<IAppConfig>) {}

  @Get()
  getInfo() {
    const nodeEnv = this.configService.get('application.nodeEnv');
    return { environment: nodeEnv };
  }
}
```

### Raw Environment Variables

```typescript
// For values not in configuration interface
const customVar = process.env.MY_CUSTOM_VAR;
```

## Validation

All environment variables are validated at application startup using Joi schema. If validation fails, the application exits immediately with helpful error messages.

### Example: Missing JWT_SECRET

```
Error: Configuration validation failed:
  JWT_SECRET must be at least 32 characters (generate with: openssl rand -hex 32)
  - any.required
```

### Example: Invalid AI_PROVIDER

```
Error: Configuration validation failed:
  AI_PROVIDER must be one of: openai, claude, bedrock
  - string.valid: 'gpt3' is not allowed
```

### Example: Missing API Key for Selected Provider

```
Error: Configuration validation failed:
  OPENAI_API_KEY is required when AI_PROVIDER=openai
  - any.required
```

## Generating Secrets

### JWT & Token Secrets

Generate 32-character hex strings:

```bash
# macOS/Linux
openssl rand -hex 32

# Windows PowerShell
[System.Security.Cryptography.RNGCryptoServiceProvider]::new().GetBytes(32) | ForEach-Object { $_.ToString('x2') } | Join-String
```

Output: `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`

### Encryption Key

Generate base64-encoded 32 bytes:

```bash
# macOS/Linux
openssl rand -base64 32

# Windows PowerShell
[Convert]::ToBase64String([System.Security.Cryptography.RNGCryptoServiceProvider]::new().GetBytes(32))
```

Output: `AbCdEfGhIjKlMnOpQrStUvWxYz1234567890==`

## Environment-Specific Notes

### Development

- Database can be local or cloud
- Debug logging enabled for troubleshooting
- Fake/test secrets acceptable
- Hot reload available with `npm run start:dev`

### Testing

- Use separate test database (`grading_test`)
- Disable logging (stderr clutter)
- Use same secrets as dev (tests run isolated)
- All tests must pass before commit

### Production

- Must use cloud database (AWS RDS recommended)
- SSL required for database connections
- All secrets from AWS Secrets Manager or similar
- No sensitive data in logs
- Monitoring and alerting required

## Troubleshooting

### Configuration validation failed

1. Check `.env.local` exists and is readable
2. Verify all required variables are present
3. Check for typos in variable names
4. Generate new secrets if they seem invalid: `openssl rand -hex 32`

### Database connection refused

```bash
# Check DATABASE_HOST, DATABASE_PORT, DATABASE_NAME
# Verify PostgreSQL is running
psql -U $DATABASE_USER -h $DATABASE_HOST -p $DATABASE_PORT -d $DATABASE_NAME
```

### JWT validation errors

```bash
# Ensure JWT_SECRET is at least 32 characters
# Generate new secret: openssl rand -hex 32
```

### Encryption key validation failed

```bash
# Ensure ENCRYPTION_KEY is base64-encoded 32 bytes
# Generate new key: openssl rand -base64 32
```

### "Cannot find module 'joi'"

```bash
# Install missing dependency
npm install joi
npm install --save-dev @types/joi
```

## Security Checklist

- ✅ All secrets stored in environment variables
- ✅ No secrets committed to git (.env.local, .env.*.local in .gitignore)
- ✅ Configuration validated at startup
- ✅ Database password required (non-empty)
- ✅ JWT secrets minimum 32 characters
- ✅ Encryption keys properly generated
- ✅ Production uses SSL for database
- ✅ No sensitive data logged to console
- ✅ Access tokens expire (1 hour default)
- ✅ Refresh tokens expire (30 days default)

## References

- [NestJS ConfigModule](https://docs.nestjs.com/techniques/configuration)
- [Joi Documentation](https://joi.dev/)
- [Environment Variables Best Practices](https://12factor.net/config)
- [AWS Secrets Manager](https://docs.aws.amazon.com/secretsmanager/)

## Next Steps

1. Copy `.env.example` to `.env.local`
2. Generate secrets: `openssl rand -hex 32`
3. Fill in database credentials
4. Run `npm install` to install dependencies
5. Run `npm run start:dev` to start development server

If you encounter validation errors, the console output tells you exactly what's wrong and how to fix it.
