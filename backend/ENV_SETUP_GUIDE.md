# Environment Setup Guide

**Task**: 1.9 - Setup Environment Configuration & Secrets
**Requirement**: 19 - Data Security & Privacy

This guide provides step-by-step instructions for setting up environment configuration for different environments (development, testing, production).

## Table of Contents

1. [Quick Start (Development)](#quick-start-development)
2. [Development Setup](#development-setup)
3. [Testing Setup](#testing-setup)
4. [Production Setup](#production-setup)
5. [Troubleshooting](#troubleshooting)

---

## Quick Start (Development)

### 1. Copy .env.example

```bash
cd backend
cp .env.example .env.local
```

### 2. Generate Secrets

```bash
# JWT Secret (32 hex chars)
openssl rand -hex 32
# Copy output to JWT_SECRET in .env.local

# Refresh Token Secret (32 hex chars)
openssl rand -hex 32
# Copy output to REFRESH_TOKEN_SECRET in .env.local

# Session Secret (32 hex chars)
openssl rand -hex 32
# Copy output to SESSION_SECRET in .env.local

# Encryption Key (base64 32 bytes)
openssl rand -base64 32
# Copy output to ENCRYPTION_KEY in .env.local
```

### 3. Update Database Credentials

Edit `.env.local`:

```env
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=shared_database
DATABASE_USER=grading_user
DATABASE_PASSWORD=your_db_password
```

### 4. Get AI Provider Keys

Choose one provider and get its API key:

**OpenAI** (recommended for dev):
- Get key from: https://platform.openai.com/api-keys
- Update `.env.local`:
  ```env
  AI_PROVIDER=openai
  OPENAI_API_KEY=sk-...your_key...
  ```

**Anthropic Claude**:
- Get key from: https://console.anthropic.com/
- Update `.env.local`:
  ```env
  AI_PROVIDER=claude
  ANTHROPIC_API_KEY=sk-ant-...your_key...
  ```

**AWS Bedrock**:
- Get credentials from: AWS Console → IAM
- Update `.env.local`:
  ```env
  AI_PROVIDER=bedrock
  AWS_ACCESS_KEY_ID=AKIA...
  AWS_SECRET_ACCESS_KEY=...
  ```

### 5. Update Other Service Keys

Fill in the remaining API keys in `.env.local`:

```env
# AWS S3 credentials
AWS_S3_BUCKET_NAME=grading-dev-bucket
AWS_S3_ACCESS_KEY_ID=AKIA...
AWS_S3_SECRET_ACCESS_KEY=...

# Turnitin API
TURNITIN_API_KEY=...

# Email service (choose one: sendgrid or mailgun)
NOTIFICATION_EMAIL_PROVIDER=sendgrid
NOTIFICATION_EMAIL_API_KEY=SG....
```

### 6. Install Dependencies

```bash
npm install
```

### 7. Run Migrations

```bash
npm run db:migrate
```

### 8. Start Development Server

```bash
npm run start:dev
```

Expected output:
```
[Nest] 1234   - 01/15/2024, 3:45:00 PM   LOG [NestFactory] Starting Nest application...
[Nest] 1234   - 01/15/2024, 3:45:01 PM   LOG [InstanceLoader] AppModule dependencies initialized
[Nest] 1234   - 01/15/2024, 3:45:01 PM   LOG [NestApplication] Nest application successfully started +5ms
```

---

## Development Setup

### Environment Variables Template

Create `.env.local` with these variables:

```env
# ============================================================
# APPLICATION
# ============================================================
NODE_ENV=dev
PORT=3000
API_BASE_URL=http://localhost:3000
CORS_ORIGIN=http://localhost:3001
LOG_LEVEL=debug

# ============================================================
# DATABASE
# ============================================================
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=shared_database
DATABASE_USER=grading_user
DATABASE_PASSWORD=dev_password
DATABASE_SSL=false
DATABASE_POOL_MIN=5
DATABASE_POOL_MAX=20
DATABASE_LOGGING=true

# ============================================================
# AUTHENTICATION
# ============================================================
JWT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
JWT_EXPIRATION=3600
REFRESH_TOKEN_SECRET=yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy
REFRESH_TOKEN_EXPIRATION=2592000
SESSION_SECRET=zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz

# ============================================================
# AI PROVIDER
# ============================================================
AI_PROVIDER=openai
OPENAI_API_KEY=sk-...your_dev_key...
OPENAI_MODEL=gpt-4-turbo

# ============================================================
# ENCRYPTION
# ============================================================
ENCRYPTION_KEY=AbCdEfGhIjKlMnOpQrStUvWxYz1234567890==
ENCRYPTION_ALGORITHM=aes-256-cbc

# ============================================================
# AWS S3
# ============================================================
AWS_S3_BUCKET_NAME=grading-dev-bucket
AWS_S3_REGION=us-east-1
AWS_S3_ACCESS_KEY_ID=AKIA...your_dev_key...
AWS_S3_SECRET_ACCESS_KEY=...your_dev_secret...

# ============================================================
# PLAGIARISM DETECTION
# ============================================================
TURNITIN_API_KEY=...your_turnitin_dev_key...
TURNITIN_API_URL=https://api.turnitin.com

# ============================================================
# EMAIL & NOTIFICATIONS
# ============================================================
NOTIFICATION_EMAIL_FROM=dev@localhost
NOTIFICATION_EMAIL_PROVIDER=sendgrid
NOTIFICATION_EMAIL_API_KEY=SG....your_sendgrid_key...
```

### Local PostgreSQL Setup

If using local PostgreSQL:

```bash
# 1. Start PostgreSQL (macOS with Homebrew)
brew services start postgresql

# 2. Create database
psql -U postgres -c "CREATE DATABASE shared_database;"

# 3. Create application user
psql -U postgres -c "CREATE USER grading_user WITH PASSWORD 'dev_password';"

# 4. Grant permissions
psql -U postgres -c "GRANT CONNECT ON DATABASE shared_database TO grading_user;"
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE shared_database TO grading_user;"
```

### Docker PostgreSQL Setup (Alternative)

```bash
# Start PostgreSQL container
docker run --name postgres-grading \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=shared_database \
  -e POSTGRES_USER=grading_user \
  -e POSTGRES_INITDB_ARGS="-p 5432" \
  -p 5432:5432 \
  -d postgres:15

# Verify connection
psql -U grading_user -h localhost -d shared_database -c "SELECT 1;"
```

### Development Workflow

```bash
# Start dev server with hot reload
npm run start:dev

# In another terminal, run tests
npm test -- --watch

# Run specific test file
npm test -- migrations

# Watch for lint errors
npm run lint -- --watch

# Format code
npm run format
```

---

## Testing Setup

### Create Test Database

```bash
psql -U postgres -c "CREATE DATABASE grading_test;"
```

### Create .env.test

```env
NODE_ENV=test
PORT=3001
API_BASE_URL=http://localhost:3001
CORS_ORIGIN=http://localhost:3002
LOG_LEVEL=error

# Use test database
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=grading_test
DATABASE_USER=grading_user
DATABASE_PASSWORD=dev_password
DATABASE_SSL=false
DATABASE_LOGGING=false

# Use test/throwaway secrets
JWT_SECRET=test_jwt_secret_32_characters_xxx
REFRESH_TOKEN_SECRET=test_refresh_token_secret_32_xxx
SESSION_SECRET=test_session_secret_32_characters_x

# Test encryption key
ENCRYPTION_KEY=AbCdEfGhIjKlMnOpQrStUvWxYz1234567890==
ENCRYPTION_ALGORITHM=aes-256-cbc

# Use test AI provider keys
AI_PROVIDER=openai
OPENAI_API_KEY=test_openai_key_should_not_be_used
OPENAI_MODEL=gpt-4-turbo

# Test S3 bucket
AWS_S3_BUCKET_NAME=grading-test-bucket
AWS_S3_REGION=us-east-1
AWS_S3_ACCESS_KEY_ID=test_s3_key
AWS_S3_SECRET_ACCESS_KEY=test_s3_secret

# Test services
TURNITIN_API_KEY=test_turnitin_key
TURNITIN_API_URL=https://api.turnitin.com
NOTIFICATION_EMAIL_FROM=test@localhost
NOTIFICATION_EMAIL_PROVIDER=sendgrid
NOTIFICATION_EMAIL_API_KEY=test_sendgrid_key
```

### Run Tests

```bash
# Run all tests
npm test

# Run with coverage
npm test:cov

# Run specific test file
npm test -- migrations

# Run tests in watch mode
npm test:watch

# Run with debug output
npm test:debug
```

---

## Production Setup

### Prerequisites

- AWS RDS PostgreSQL instance
- AWS S3 bucket
- AWS Secrets Manager or similar secret storage
- Production API keys from all providers

### 1. Create Environment Files

**`.env.prod`** (git-checked, non-sensitive defaults):

```env
NODE_ENV=prod
PORT=3000
LOG_LEVEL=warn
DATABASE_PORT=5432
DATABASE_NAME=shared_database
DATABASE_SSL=true
DATABASE_POOL_MIN=10
DATABASE_POOL_MAX=50
ENCRYPTION_ALGORITHM=aes-256-cbc
OPENAI_MODEL=gpt-4-turbo
ANTHROPIC_MODEL=claude-3-opus-20240229
AWS_REGION=us-east-1
AWS_S3_REGION=us-east-1
TURNITIN_API_URL=https://api.turnitin.com
NOTIFICATION_EMAIL_PROVIDER=sendgrid
```

**`.env.prod.local`** (git-ignored, from Secrets Manager):

```env
# Database (from AWS RDS)
DATABASE_HOST=tec-bridgeaidb.csvikosmym65.us-east-1.rds.amazonaws.com
DATABASE_USER=grading_user
DATABASE_PASSWORD=***from AWS Secrets Manager***

# API URLs
API_BASE_URL=https://api.grading-system.edu
CORS_ORIGIN=https://grading-system.edu

# Secrets from AWS Secrets Manager
JWT_SECRET=***from AWS Secrets Manager***
REFRESH_TOKEN_SECRET=***from AWS Secrets Manager***
SESSION_SECRET=***from AWS Secrets Manager***
ENCRYPTION_KEY=***from AWS Secrets Manager***

# AI Provider
AI_PROVIDER=openai
OPENAI_API_KEY=***from AWS Secrets Manager***

# AWS S3
AWS_S3_BUCKET_NAME=grading-prod-bucket
AWS_S3_ACCESS_KEY_ID=***from AWS Secrets Manager***
AWS_S3_SECRET_ACCESS_KEY=***from AWS Secrets Manager***

# Services
TURNITIN_API_KEY=***from AWS Secrets Manager***
NOTIFICATION_EMAIL_FROM=grading@university.edu
NOTIFICATION_EMAIL_API_KEY=***from AWS Secrets Manager***
```

### 2. Store Secrets in AWS Secrets Manager

```bash
# Create secret in AWS Secrets Manager
aws secretsmanager create-secret \
  --name grading-system/prod \
  --description "Production secrets for AI Grading System" \
  --secret-string '{
    "JWT_SECRET": "...",
    "REFRESH_TOKEN_SECRET": "...",
    "SESSION_SECRET": "...",
    "ENCRYPTION_KEY": "...",
    "DATABASE_PASSWORD": "...",
    "OPENAI_API_KEY": "...",
    "AWS_S3_ACCESS_KEY_ID": "...",
    "AWS_S3_SECRET_ACCESS_KEY": "...",
    "TURNITIN_API_KEY": "...",
    "NOTIFICATION_EMAIL_API_KEY": "..."
  }'
```

### 3. Set IAM Permissions

Ensure deployment user/role has permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": "arn:aws:secretsmanager:us-east-1:*:secret:grading-system/prod-*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::grading-prod-bucket/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "rds:DescribeDBInstances"
      ],
      "Resource": "*"
    }
  ]
}
```

### 4. Deployment

```bash
# 1. Pull secrets from AWS Secrets Manager
aws secretsmanager get-secret-value \
  --secret-id grading-system/prod \
  --query SecretString \
  --output text > .env.prod.local

# 2. Ensure .env.prod exists
# (should already be in git)

# 3. Install dependencies
npm install --production

# 4. Build application
npm run build

# 5. Run migrations
npm run db:migrate

# 6. Start application
npm run start:prod
```

### 5. Monitoring & Alerting

Set up CloudWatch for:
- Application logs
- Database connection pool usage
- Error rates
- API response times
- Failed deployments

### 6. Backup & Disaster Recovery

- Enable automated RDS backups (7+ days retention)
- Test backup restoration quarterly
- Keep encryption keys backed up securely
- Document recovery procedures

---

## Troubleshooting

### Configuration Validation Failed

**Problem**: Application exits with validation error

**Solution**:
1. Check `.env.local` exists: `ls -la .env.local`
2. Verify all required variables: `cat .env.local | grep "^[A-Z]"`
3. Check for typos in variable names
4. Regenerate secrets: `openssl rand -hex 32`

**Common errors**:
```
JWT_SECRET must be at least 32 characters
→ Generate new: openssl rand -hex 32

DATABASE_PASSWORD must not be empty
→ Add non-empty password to .env.local

AI_PROVIDER must be one of: openai, claude, bedrock
→ Check AI_PROVIDER value (typo?)
```

### Database Connection Failed

**Problem**: "Error: connect ECONNREFUSED 127.0.0.1:5432"

**Solution**:
1. Verify PostgreSQL is running: `psql -U postgres -c "SELECT 1;"`
2. Check DATABASE_HOST: `echo $DATABASE_HOST`
3. Check DATABASE_PORT: `echo $DATABASE_PORT`
4. Check DATABASE_USER: `echo $DATABASE_USER`
5. Test connection manually:
   ```bash
   psql -U grading_user -h localhost -p 5432 -d shared_database
   ```

### JWT Validation Errors

**Problem**: "Invalid token" when accessing protected routes

**Solution**:
1. Verify JWT_SECRET is set: `echo $JWT_SECRET`
2. Check JWT_SECRET is at least 32 chars: `echo ${#JWT_SECRET}`
3. Regenerate if corrupt: `openssl rand -hex 32`
4. Clear browser cookies and re-login

### Encryption Key Errors

**Problem**: "Invalid encryption key length"

**Solution**:
1. Verify ENCRYPTION_KEY is base64-encoded
2. Check length: `echo "$ENCRYPTION_KEY" | base64 -d | wc -c` (should be 32)
3. Regenerate: `openssl rand -base64 32`

### "Cannot find module 'joi'"

**Problem**: Application crashes on startup

**Solution**:
```bash
# Reinstall dependencies
npm install

# Or specific package
npm install joi

# Verify installation
npm list joi
```

### Environment Variables Not Loading

**Problem**: Variables show as undefined

**Solution**:
1. Restart dev server: `npm run start:dev`
2. Check file exists: `ls -la .env.local`
3. Verify path is correct: `.env.local` should be in `backend/` directory
4. Try absolute path temporarily:
   ```bash
   export NODE_ENV=dev
   npm run start:dev
   ```

---

## Security Checklist

Before deploying to production:

- [ ] All secrets generated with proper randomness
- [ ] No secrets committed to git
- [ ] Database has strong password (min 16 chars, mixed case/numbers/symbols)
- [ ] Database user has limited permissions (not superuser)
- [ ] Database uses SSL connection
- [ ] JWT secrets stored securely (AWS Secrets Manager)
- [ ] Encryption keys backed up securely
- [ ] API keys from providers are restricted (IP whitelist, usage limits)
- [ ] .gitignore includes: `.env.local`, `.env.*.local`, `.env.test`
- [ ] Logging doesn't expose secrets or PII
- [ ] HTTPS/TLS configured for all external APIs

---

## References

- **NestJS Config**: https://docs.nestjs.com/techniques/configuration
- **Joi Schema**: https://joi.dev/
- **AWS Secrets Manager**: https://docs.aws.amazon.com/secretsmanager/
- **PostgreSQL**: https://www.postgresql.org/docs/
- **Environment Variables**: https://12factor.net/config

---

## Support

For issues with environment setup:
1. Check this guide's Troubleshooting section
2. Review CONFIG_SETUP.md for detailed configuration reference
3. Check .env.example for all available variables
4. Run: `npm run start:dev -- --debug` for verbose logging
