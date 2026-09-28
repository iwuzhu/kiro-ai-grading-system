/**
 * Configuration Module
 *
 * NestJS module that sets up the ConfigModule with validation.
 * This module must be imported early in the application lifecycle (in AppModule).
 *
 * Requirement: 19 - Data Security & Privacy
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
import configuration from './configuration';
import { configValidationSchema } from './config.validation';

/**
 * ConfigurationModule exports NestJS ConfigModule with:
 * - Environment variable validation via Joi schema
 * - Configuration factory function for typed access
 * - Global scope so ConfigService is available everywhere
 *
 * Usage in AppModule:
 * ```typescript
 * import { ConfigurationModule } from './infrastructure/config/configuration.module';
 *
 * @Module({
 *   imports: [ConfigurationModule],
 * })
 * export class AppModule {}
 * ```
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      // Load configuration from environment variables
      load: [() => configuration(process.env)],

      // Validate all environment variables on startup
      validationSchema: configValidationSchema,

      // Return validation errors immediately instead of storing them
      validationOptions: {
        abortEarly: true,
        allowUnknown: true,
      },

      // Make ConfigService available globally
      isGlobal: true,

      // Expand environment variables (allows ${VAR_NAME} references)
      expandVariables: true,

      // Environment files to load (in order of precedence)
      envFilePath: [
        // Load from .env.{NODE_ENV}.local first (highest priority)
        // e.g., .env.prod.local for secrets
        `.env.${process.env.NODE_ENV || 'dev'}.local`,

        // Load from .env.{NODE_ENV} (environment-specific defaults)
        // e.g., .env.prod with non-secret defaults
        `.env.${process.env.NODE_ENV || 'dev'}`,

        // Load from .env.local (local overrides)
        '.env.local',

        // Load from .env (defaults)
        '.env',
      ],

      // Cache validation schema for performance
      cache: true,
    }),
  ],

  /**
   * Export ConfigModule so other modules can import it
   */
  exports: [ConfigModule],
})
export class ConfigurationModule {}

/**
 * Environment-Specific Configuration Files
 *
 * The module loads configuration files in this order (last wins):
 *
 * 1. .env
 *    - Base configuration (checked into git)
 *    - Should contain non-sensitive defaults
 *    - Example: NODE_ENV=dev, PORT=3000, LOG_LEVEL=info
 *
 * 2. .env.local
 *    - Developer overrides (.gitignore'd)
 *    - Can contain local secrets
 *    - Example: DATABASE_PASSWORD=local_dev_password
 *
 * 3. .env.{NODE_ENV}
 *    - Environment-specific defaults (checked into git)
 *    - Example: .env.prod with DATABASE_SSL=true, LOG_LEVEL=warn
 *
 * 4. .env.{NODE_ENV}.local
 *    - Environment-specific secrets (.gitignore'd)
 *    - Example: .env.prod.local with DATABASE_PASSWORD from secrets
 *
 * Recommended for development:
 * ```bash
 * # Create .env.local with your local database credentials
 * cp .env.example .env.local
 * # Edit .env.local with your local values
 * nano .env.local
 * ```
 *
 * Recommended for production:
 * ```bash
 * # Use AWS Secrets Manager or environment variables set by deployment
 * # OR create .env.prod.local with secrets from secure storage
 * ```
 */

/**
 * Validation Error Example
 *
 * If configuration is invalid, the application fails at startup with:
 *
 * ```
 * [Nest] 12345   - 01/15/2024, 3:45:00 PM   LOG [NestFactory] Starting Nest application...
 * Error: Configuration validation failed:
 * - JWT_SECRET is required (minimum 32 characters)
 * - DATABASE_PASSWORD must not be empty
 * - AI_PROVIDER must be one of: openai, claude, bedrock
 *
 * At startup validation, please provide missing environment variables.
 * ```
 *
 * This ensures the application never runs with invalid configuration.
 */

/**
 * Secrets Management Best Practices
 *
 * Development:
 * ✓ Use .env.local for local secrets (git-ignored)
 * ✓ Share default values in .env or README
 * ✗ Never commit secrets to git
 *
 * Production:
 * ✓ Use AWS Secrets Manager for secrets
 * ✓ Use environment variables set by deployment platform
 * ✓ Use AWS IAM roles for service-to-service auth
 * ✗ Never store secrets in .env files on servers
 *
 * All environments:
 * ✓ Rotate secrets regularly
 * ✓ Use strong secret generation (openssl rand -hex 32)
 * ✓ Log secret names, never log secret values
 * ✓ Restrict secret access to authorized personnel
 */
