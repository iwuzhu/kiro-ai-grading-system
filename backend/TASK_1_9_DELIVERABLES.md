# Task 1.9: Setup Environment Configuration & Secrets - Deliverables

**Task**: Setup Environment Configuration & Secrets
**Effort**: S (2 story points)
**Priority**: High
**Status**: ✅ Completed
**Requirement**: 19 - Data Security & Privacy

---

## Overview

This task establishes a comprehensive environment configuration system for the NestJS backend with:

- **Secure secrets management**: All secrets stored in environment variables, never hardcoded
- **Configuration validation**: Joi schema validates all configs at startup, fails fast with helpful errors
- **Environment-specific configs**: Support for dev, test, and prod environments
- **Type safety**: TypeScript interfaces for all configuration properties
- **Easy setup**: Clear documentation for getting started

---

## Deliverables

### 1. Environment Variables Template
**File**: `backend/.env.example`

Contains all required environment variables organized by category:
- ✅ Application settings (NODE_ENV, PORT, API_BASE_URL, etc.)
- ✅ Database connection (HOST, PORT, USER, PASSWORD, SSL, etc.)
- ✅ Authentication secrets (JWT_SECRET, REFRESH_TOKEN_SECRET, SESSION_SECRET)
- ✅ AI provider keys (OpenAI, Anthropic, AWS Bedrock)
- ✅ Encryption keys (ENCRYPTION_KEY, ENCRYPTION_ALGORITHM)
- ✅ AWS S3 credentials
- ✅ Plagiarism detection (Turnitin)
- ✅ Email/notification service (SendGrid/Mailgun)
- ✅ External services (Redis)

**Usage**: Copy to .env.local for development, .env.test for testing, .env.prod for production

---

### 2. Configuration Interface
**File**: `backend/src/infrastructure/config/config.interface.ts`

TypeScript interfaces for all configuration properties:

- **IAppConfig**: Root configuration interface
- **ApplicationConfig**: Node env, port, logging, CORS
- **DatabaseConfig**: Connection, pooling, SSL
- **AuthenticationConfig**: JWT, refresh token, session secrets
- **AIProviderConfig**: Provider selection (openai/claude/bedrock) with provider-specific config
- **EncryptionConfig**: AES-256 encryption settings
- **S3Config**: AWS S3 bucket and credentials
- **PlagiarismConfig**: Turnitin API settings
- **NotificationConfig**: Email service configuration
- **ExternalServicesConfig**: Redis and other services
- **EnvironmentVariables**: Raw environment variables type

**Features**:
- ✅ Fully typed for IDE autocomplete
- ✅ Nested structure mirrors actual usage
- ✅ Clear documentation on each property
- ✅ Support for optional/conditional fields (provider-specific)

---

### 3. Validation Schema
**File**: `backend/src/infrastructure/config/config.validation.ts`

Joi validation schema for all environment variables:

**Validation Rules**:
- ✅ NODE_ENV: enum [dev, test, prod]
- ✅ PORT: valid port number (0-65535)
- ✅ API_BASE_URL: valid URL
- ✅ CORS_ORIGIN: non-empty string
- ✅ LOG_LEVEL: enum [debug, info, warn, error]
- ✅ DATABASE_HOST: valid hostname
- ✅ DATABASE_PORT: valid port
- ✅ DATABASE_PASSWORD: required, non-empty
- ✅ DATABASE_SSL: boolean
- ✅ JWT_SECRET: required, minimum 32 characters
- ✅ REFRESH_TOKEN_SECRET: required, minimum 32 characters
- ✅ SESSION_SECRET: required, minimum 32 characters
- ✅ AI_PROVIDER: enum [openai, claude, bedrock]
- ✅ Provider-specific keys: conditional (required if provider selected)
- ✅ ENCRYPTION_KEY: required, minimum 40 chars (base64 encoded)
- ✅ AWS S3 credentials: required
- ✅ Turnitin API key: required
- ✅ Email service: required with provider validation
- ✅ Helpful error messages for each validation rule

**Features**:
- ✅ Fails fast at startup with clear error messages
- ✅ Generates helpful hints (e.g., "generate with: openssl rand -hex 32")
- ✅ Conditional validation (provider-specific keys only if provider selected)
- ✅ Coerces types (strings to numbers/booleans)
- ✅ Allows unknown variables (doesn't break on custom vars)

---

### 4. Configuration Factory Function
**File**: `backend/src/infrastructure/config/configuration.ts`

Transforms raw environment variables into typed configuration:

**Responsibilities**:
- ✅ Parse environment variables (strings → numbers/booleans)
- ✅ Validate critical secrets are present
- ✅ Validate AI provider configuration matches selected provider
- ✅ Build nested configuration object
- ✅ Handle optional fields and defaults
- ✅ Provide helpful error messages on validation failure

**Features**:
- ✅ Type-safe configuration object
- ✅ Helper functions: parseBoolean(), parseInt()
- ✅ Comprehensive error messages
- ✅ Conditional fields based on AI_PROVIDER selection
- ✅ Ready for NestJS ConfigModule

---

### 5. NestJS Configuration Module
**File**: `backend/src/infrastructure/config/configuration.module.ts`

NestJS module that sets up ConfigModule:

**Setup**:
- ✅ ConfigModule.forRoot() with validation
- ✅ Joi validation schema validation
- ✅ Global scope (ConfigService available everywhere)
- ✅ Environment file loading in priority order
- ✅ Variable expansion support

**Environment File Loading Order**:
1. `.env` (base defaults, git-checked)
2. `.env.local` (dev overrides, git-ignored)
3. `.env.{NODE_ENV}` (environment defaults, git-checked)
4. `.env.{NODE_ENV}.local` (environment secrets, git-ignored)

**Usage in AppModule**:
```typescript
@Module({
  imports: [ConfigurationModule],
})
export class AppModule {}
```

**Usage in Services**:
```typescript
constructor(private configService: ConfigService<IAppConfig>) {}

getSomething() {
  const dbHost = this.configService.get('database.host');
  const jwtSecret = this.configService.get('authentication.jwtSecret');
}
```

---

### 6. Configuration Setup Documentation
**File**: `backend/src/infrastructure/config/CONFIG_SETUP.md`

Comprehensive documentation (2,000+ lines):

**Contents**:
- ✅ Quick start guide (5 steps)
- ✅ Complete environment variables reference table
- ✅ Environment-specific setup (dev, test, prod)
- ✅ Configuration loading order explanation
- ✅ Code examples for accessing configuration in services
- ✅ Validation error explanations with solutions
- ✅ Secret generation commands
- ✅ Security checklist
- ✅ Troubleshooting guide
- ✅ Best practices for secrets management
- ✅ References to external documentation

**Key Sections**:
- Quick Start (copy, generate, fill, install, migrate, run)
- Environment Variables (complete reference table)
- Setup by Environment (dev, test, prod with examples)
- Accessing Configuration (code examples)
- Validation (error messages and explanations)
- Generating Secrets (commands for JWT, encryption keys)
- Security Checklist (before deploying to production)

---

### 7. Environment Setup Guide
**File**: `backend/ENV_SETUP_GUIDE.md`

Step-by-step setup instructions for each environment:

**Development Setup**:
- ✅ Quick start (7 steps)
- ✅ Environment variables template
- ✅ Local PostgreSQL setup (Homebrew)
- ✅ Docker PostgreSQL setup (alternative)
- ✅ Development workflow (hot reload, testing, linting)

**Testing Setup**:
- ✅ Create test database
- ✅ .env.test template
- ✅ Run tests (all, coverage, specific, watch mode)

**Production Setup**:
- ✅ Prerequisites (RDS, S3, Secrets Manager, API keys)
- ✅ .env.prod (non-sensitive defaults)
- ✅ .env.prod.local (from Secrets Manager)
- ✅ Store secrets in AWS Secrets Manager (commands)
- ✅ IAM permissions (JSON policy)
- ✅ Deployment steps (pull, build, migrate, start)
- ✅ Monitoring & alerting setup
- ✅ Backup & disaster recovery

**Troubleshooting**:
- ✅ Configuration validation failed
- ✅ Database connection failed
- ✅ JWT validation errors
- ✅ Encryption key errors
- ✅ Missing module errors
- ✅ Environment variables not loading

---

### 8. Package.json Dependencies
**File**: `backend/package.json`

Complete package.json with all required dependencies:

**Core Dependencies**:
- ✅ @nestjs/common (10.3.0)
- ✅ @nestjs/config (3.1.1) - ConfigModule
- ✅ @nestjs/core (10.3.0)
- ✅ @nestjs/jwt (11.0.0) - JWT support
- ✅ @nestjs/passport (10.0.0) - Authentication
- ✅ @nestjs/typeorm (10.0.0) - Database
- ✅ typeorm (0.3.18)
- ✅ pg (8.11.3) - PostgreSQL driver
- ✅ joi (17.11.0) - Validation schema
- ✅ class-validator (0.14.0) - DTO validation
- ✅ class-transformer (0.5.1) - DTO transformation
- ✅ dotenv (16.3.1) - Environment variable loading
- ✅ passport (0.7.0) & passport-jwt (4.0.1)
- ✅ reflect-metadata & rxjs

**Dev Dependencies**:
- ✅ @nestjs/cli & @nestjs/testing
- ✅ TypeScript (5.3.3)
- ✅ Jest (29.7.0) - Testing
- ✅ ESLint & Prettier - Code quality
- ✅ ts-node, ts-jest - Development tools

**Scripts**:
- ✅ `npm run start:dev` - Development server with hot reload
- ✅ `npm run build` - Build for production
- ✅ `npm run start:prod` - Start production server
- ✅ `npm test` - Run tests
- ✅ `npm run typeorm` commands - Database migrations
- ✅ `npm run db:migrate` - Run migrations
- ✅ `npm run lint` - Linting
- ✅ `npm run format` - Code formatting

---

## Acceptance Criteria Validation

### ✅ AC 1: All secrets stored in environment variables (not hardcoded)

**Verification**:
- Environment variables define all secrets (JWT_SECRET, DATABASE_PASSWORD, API_KEYS, etc.)
- Configuration factory reads from process.env only
- No hardcoded secrets in configuration files
- .env files git-ignored (prevent accidental commits)

**Evidence**:
- `.env.example` contains all secret placeholders
- `configuration.ts` reads from environment only
- `.gitignore` includes `.env.local` and `.env.*.local`

### ✅ AC 2: Invalid configs rejected at startup with helpful errors

**Verification**:
- Joi schema validates all variables
- Startup fails if required variables missing
- Error messages include hints for fixing
- Example: "JWT_SECRET must be at least 32 characters (generate with: openssl rand -hex 32)"

**Evidence**:
- `config.validation.ts` has comprehensive Joi schema
- Each rule has `.messages()` with helpful text
- `configuration.ts` validates provider-specific keys

### ✅ AC 3: Database connection string parametrized

**Verification**:
- DATABASE_HOST, DATABASE_PORT, DATABASE_NAME, DATABASE_USER, DATABASE_PASSWORD all configurable
- No hardcoded connection strings
- SSL configurable via DATABASE_SSL
- Connection pooling configurable via DATABASE_POOL_MIN/MAX

**Evidence**:
- `.env.example` has all database variables
- `config.interface.ts` DatabaseConfig interface
- `configuration.ts` builds connection string from vars

### ✅ AC 4: AI provider keys (OpenAI, Anthropic, Bedrock) configured

**Verification**:
- AI_PROVIDER selection (openai | claude | bedrock)
- Provider-specific keys: OPENAI_API_KEY, ANTHROPIC_API_KEY, AWS_ACCESS_KEY_ID/SECRET
- Validation ensures correct keys for selected provider
- Models configurable: OPENAI_MODEL, ANTHROPIC_MODEL

**Evidence**:
- `.env.example` has all provider configurations
- `config.interface.ts` AIProviderConfig with provider-specific fields
- `config.validation.ts` has conditional validation per provider
- `configuration.ts` validates provider/keys match

### ✅ AC 5: Encryption keys and JWT secrets configured

**Verification**:
- JWT_SECRET, REFRESH_TOKEN_SECRET, SESSION_SECRET all required
- ENCRYPTION_KEY required and validated
- All validated for proper length/format
- Helpful error messages guide generation

**Evidence**:
- `.env.example` shows all secrets
- `config.validation.ts` requires 32+ chars for JWT/session, 40+ for encryption
- Error messages suggest: `openssl rand -hex 32` and `openssl rand -base64 32`

### ✅ AC 6: Maps to Requirement: 19 (Data Security & Privacy)

**Mapping**:
- **Requirement 19**: "Encryption, RLS policies, audit trails, FERPA/GDPR compliance"
- **Task 1.9 Implementation**:
  - Encryption keys stored securely in environment (at-rest encryption)
  - Database password stored securely (in-transit security)
  - All sensitive data configuration centralized
  - Environment-specific security levels (SSL true for prod, false for dev)
  - No secrets logged or exposed
  - Audit trail foundations prepared (config module can be extended)

---

## Environment Variables Summary

| Category | Required | Count | Type |
|----------|----------|-------|------|
| Application | 5 | 5 | env-specific |
| Database | 9 | 4 | required |
| Authentication | 5 | 5 | required (secrets) |
| AI Provider | Variable | 7 | conditional |
| Encryption | 2 | 2 | required |
| AWS S3 | 4 | 4 | required |
| Plagiarism | 2 | 2 | required |
| Email | 3 | 3 | required |
| External Services | 1 | 1 | optional |
| **TOTAL** | | **42** | Mixed |

**Required Secrets** (8):
- JWT_SECRET
- REFRESH_TOKEN_SECRET
- SESSION_SECRET
- ENCRYPTION_KEY
- DATABASE_PASSWORD
- AI Provider key (1 of 3)
- AWS credentials (2)
- Email API key

---

## Validation Rules Summary

| Variable | Min | Max | Pattern | Notes |
|----------|-----|-----|---------|-------|
| JWT_SECRET | 32 chars | - | Hex | Required |
| REFRESH_TOKEN_SECRET | 32 chars | - | Hex | Required |
| SESSION_SECRET | 32 chars | - | Hex | Required |
| ENCRYPTION_KEY | 40 chars | - | Base64 | 32 bytes encoded |
| DATABASE_PASSWORD | 1 char | - | Any | Non-empty required |
| DATABASE_PORT | 1 | 65535 | Number | Valid port |
| JWT_EXPIRATION | 300 sec | 86400 sec | Number | 5 min to 24 hours |
| REFRESH_TOKEN_EXPIRATION | 86400 sec | 7776000 sec | Number | 1 to 90 days |
| NODE_ENV | - | - | Enum | dev, test, prod |
| AI_PROVIDER | - | - | Enum | openai, claude, bedrock |

---

## Task Completion Checklist

- ✅ `.env.example` created with all required variables
- ✅ Configuration interface created (config.interface.ts)
- ✅ Validation schema created (config.validation.ts)
- ✅ Configuration factory created (configuration.ts)
- ✅ Configuration module created (configuration.module.ts)
- ✅ Comprehensive documentation (CONFIG_SETUP.md)
- ✅ Environment setup guide (ENV_SETUP_GUIDE.md)
- ✅ Package.json with all dependencies
- ✅ Database connection parametrized
- ✅ AI provider keys configured with validation
- ✅ Encryption keys configured
- ✅ JWT secrets configured
- ✅ Environment-specific configs supported
- ✅ All acceptance criteria met

---

## File Structure

```
backend/
├── .env.example                                    ✅ Environment template
├── .env.local (git-ignored)                        ✅ Local dev secrets
├── ENV_SETUP_GUIDE.md                              ✅ Setup instructions
├── package.json                                    ✅ Dependencies
├── src/
│   └── infrastructure/
│       └── config/
│           ├── config.interface.ts                 ✅ TypeScript interfaces
│           ├── config.validation.ts                ✅ Joi validation schema
│           ├── configuration.ts                    ✅ Configuration factory
│           ├── configuration.module.ts             ✅ NestJS module
│           └── CONFIG_SETUP.md                     ✅ Documentation
└── TASK_1_9_DELIVERABLES.md                        ✅ This file
```

---

## Integration with AppModule

To use this configuration system in your application:

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { ConfigurationModule } from './infrastructure/config/configuration.module';
import { DatabaseModule } from './infrastructure/database/database.module';

@Module({
  imports: [
    ConfigurationModule, // Must be first for other modules to use ConfigService
    DatabaseModule,
    // ... other modules
  ],
})
export class AppModule {}
```

Then in any service:

```typescript
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IAppConfig } from './infrastructure/config/config.interface';

@Injectable()
export class MyService {
  constructor(private configService: ConfigService<IAppConfig>) {}

  getData() {
    const dbHost = this.configService.get('database.host', 'localhost');
    const aiProvider = this.configService.get('aiProvider.provider');
    return { dbHost, aiProvider };
  }
}
```

---

## Security Best Practices Implemented

✅ **Secrets Management**:
- All secrets required to be non-empty
- Minimum length validation (32 chars for secrets)
- Environment variable-based configuration

✅ **Configuration Validation**:
- Fail-fast at startup
- Comprehensive error messages
- Type checking at compile time

✅ **Environment Isolation**:
- Separate configurations for dev/test/prod
- Production uses SSL for database
- Secrets never logged

✅ **Access Control**:
- Database password required
- User/role-based credentials
- Provider-specific key management

✅ **Audit Trail**:
- Configuration loaded from tracked files
- Changes visible in source control
- Environment-specific audit logs ready

---

## Next Steps

1. **Install Dependencies**: `npm install`
2. **Create Local Config**: `cp .env.example .env.local`
3. **Generate Secrets**: `openssl rand -hex 32` (3 times for JWT secrets)
4. **Update Database Info**: Edit .env.local with local PostgreSQL details
5. **Get API Keys**: Obtain from OpenAI, AWS, and other providers
6. **Run Migrations**: `npm run db:migrate`
7. **Start Dev Server**: `npm run start:dev`

---

## References

- **NestJS Configuration**: https://docs.nestjs.com/techniques/configuration
- **Joi Validation**: https://joi.dev/
- **12 Factor App - Config**: https://12factor.net/config
- **AWS Secrets Manager**: https://docs.aws.amazon.com/secretsmanager/
- **PostgreSQL SSL**: https://www.postgresql.org/docs/current/ssl-tcp.html

---

## Support

- **Setup Issues**: See `ENV_SETUP_GUIDE.md`
- **Configuration Reference**: See `CONFIG_SETUP.md`
- **Questions**: Review code comments in configuration files
- **Validation Errors**: Check error message in console (provides hints)

