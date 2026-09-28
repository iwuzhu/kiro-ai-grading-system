/**
 * Configuration Validation Schema
 *
 * Defines validation rules for all environment variables using Joi.
 * This ensures all critical configurations are valid at application startup.
 * Invalid or missing configurations cause immediate startup failure.
 *
 * Requirement: 19 - Data Security & Privacy
 */

import * as Joi from 'joi';
import { EnvironmentVariables } from './config.interface';

/**
 * Joi validation schema for environment variables
 *
 * Rules:
 * - All required secrets have no defaults (must be explicitly provided)
 * - Invalid configs cause startup failure with helpful error messages
 * - Numbers are coerced from string environment variables
 * - Sensitive data (passwords, keys) are not logged
 */
export const configValidationSchema = Joi.object<EnvironmentVariables>({
  // ============================================================
  // APPLICATION
  // ============================================================

  NODE_ENV: Joi.string()
    .valid('dev', 'test', 'prod')
    .default('dev')
    .required()
    .messages({
      'string.valid': 'NODE_ENV must be one of: dev, test, prod',
    }),

  PORT: Joi.number()
    .port()
    .default(3000)
    .messages({
      'number.port': 'PORT must be a valid port number (0-65535)',
    }),

  API_BASE_URL: Joi.string()
    .uri()
    .required()
    .messages({
      'string.uri': 'API_BASE_URL must be a valid URL',
      'any.required': 'API_BASE_URL is required',
    }),

  CORS_ORIGIN: Joi.string()
    .required()
    .messages({
      'any.required': 'CORS_ORIGIN is required',
    }),

  LOG_LEVEL: Joi.string()
    .valid('debug', 'info', 'warn', 'error')
    .default('info')
    .messages({
      'string.valid': 'LOG_LEVEL must be one of: debug, info, warn, error',
    }),

  // ============================================================
  // DATABASE
  // ============================================================

  DATABASE_HOST: Joi.string()
    .hostname()
    .required()
    .messages({
      'string.hostname': 'DATABASE_HOST must be a valid hostname',
      'any.required': 'DATABASE_HOST is required',
    }),

  DATABASE_PORT: Joi.number()
    .port()
    .default(5432)
    .messages({
      'number.port': 'DATABASE_PORT must be a valid port number',
    }),

  DATABASE_NAME: Joi.string()
    .alphanum()
    .min(1)
    .max(63) // PostgreSQL limit
    .default('shared_database')
    .messages({
      'string.alphanum': 'DATABASE_NAME must be alphanumeric',
      'string.min': 'DATABASE_NAME must not be empty',
    }),

  DATABASE_USER: Joi.string()
    .alphanum()
    .required()
    .messages({
      'string.alphanum': 'DATABASE_USER must be alphanumeric',
      'any.required': 'DATABASE_USER is required',
    }),

  DATABASE_PASSWORD: Joi.string()
    .min(1)
    .required()
    .messages({
      'string.min': 'DATABASE_PASSWORD must not be empty',
      'any.required': 'DATABASE_PASSWORD is required (for security)',
    }),

  DATABASE_SSL: Joi.boolean()
    .default(false)
    .messages({
      'boolean.base': 'DATABASE_SSL must be true or false',
    }),

  DATABASE_POOL_MIN: Joi.number()
    .min(1)
    .default(5)
    .messages({
      'number.min': 'DATABASE_POOL_MIN must be at least 1',
    }),

  DATABASE_POOL_MAX: Joi.number()
    .min(1)
    .default(20)
    .messages({
      'number.min': 'DATABASE_POOL_MAX must be at least 1',
    }),

  DATABASE_LOGGING: Joi.boolean()
    .default(false)
    .messages({
      'boolean.base': 'DATABASE_LOGGING must be true or false',
    }),

  // ============================================================
  // AUTHENTICATION
  // ============================================================

  JWT_SECRET: Joi.string()
    .min(32)
    .required()
    .messages({
      'string.min':
        'JWT_SECRET must be at least 32 characters (generate with: openssl rand -hex 32)',
      'any.required': 'JWT_SECRET is required',
    }),

  JWT_EXPIRATION: Joi.number()
    .min(300) // At least 5 minutes
    .max(86400) // At most 24 hours
    .default(3600)
    .messages({
      'number.min': 'JWT_EXPIRATION must be at least 300 seconds (5 minutes)',
      'number.max': 'JWT_EXPIRATION must not exceed 86400 seconds (24 hours)',
    }),

  REFRESH_TOKEN_SECRET: Joi.string()
    .min(32)
    .required()
    .messages({
      'string.min':
        'REFRESH_TOKEN_SECRET must be at least 32 characters (generate with: openssl rand -hex 32)',
      'any.required': 'REFRESH_TOKEN_SECRET is required',
    }),

  REFRESH_TOKEN_EXPIRATION: Joi.number()
    .min(86400) // At least 1 day
    .max(7776000) // At most 90 days
    .default(2592000)
    .messages({
      'number.min':
        'REFRESH_TOKEN_EXPIRATION must be at least 86400 seconds (1 day)',
      'number.max':
        'REFRESH_TOKEN_EXPIRATION must not exceed 7776000 seconds (90 days)',
    }),

  SESSION_SECRET: Joi.string()
    .min(32)
    .required()
    .messages({
      'string.min':
        'SESSION_SECRET must be at least 32 characters (generate with: openssl rand -hex 32)',
      'any.required': 'SESSION_SECRET is required',
    }),

  // ============================================================
  // AI PROVIDER
  // ============================================================

  AI_PROVIDER: Joi.string()
    .valid('openai', 'claude', 'bedrock')
    .default('openai')
    .required()
    .messages({
      'string.valid': 'AI_PROVIDER must be one of: openai, claude, bedrock',
    }),

  OPENAI_API_KEY: Joi.string()
    .when('AI_PROVIDER', {
      is: 'openai',
      then: Joi.string().min(1).required(),
      otherwise: Joi.string().optional(),
    })
    .messages({
      'any.required': 'OPENAI_API_KEY is required when AI_PROVIDER=openai',
    }),

  OPENAI_MODEL: Joi.string()
    .default('gpt-4-turbo')
    .messages({
      'string.base': 'OPENAI_MODEL must be a string',
    }),

  ANTHROPIC_API_KEY: Joi.string()
    .when('AI_PROVIDER', {
      is: 'claude',
      then: Joi.string().min(1).required(),
      otherwise: Joi.string().optional(),
    })
    .messages({
      'any.required': 'ANTHROPIC_API_KEY is required when AI_PROVIDER=claude',
    }),

  ANTHROPIC_MODEL: Joi.string()
    .default('claude-3-opus-20240229')
    .messages({
      'string.base': 'ANTHROPIC_MODEL must be a string',
    }),

  AWS_ACCESS_KEY_ID: Joi.string()
    .when('AI_PROVIDER', {
      is: 'bedrock',
      then: Joi.string().min(1).required(),
      otherwise: Joi.string().optional(),
    })
    .messages({
      'any.required':
        'AWS_ACCESS_KEY_ID is required when AI_PROVIDER=bedrock',
    }),

  AWS_SECRET_ACCESS_KEY: Joi.string()
    .when('AI_PROVIDER', {
      is: 'bedrock',
      then: Joi.string().min(1).required(),
      otherwise: Joi.string().optional(),
    })
    .messages({
      'any.required':
        'AWS_SECRET_ACCESS_KEY is required when AI_PROVIDER=bedrock',
    }),

  AWS_REGION: Joi.string()
    .default('us-east-1')
    .messages({
      'string.base': 'AWS_REGION must be a string',
    }),

  // ============================================================
  // ENCRYPTION
  // ============================================================

  ENCRYPTION_KEY: Joi.string()
    .min(40) // Base64 encoded 32 bytes = ~44 chars
    .required()
    .messages({
      'string.min':
        'ENCRYPTION_KEY must be base64-encoded 32 bytes (generate with: openssl rand -base64 32)',
      'any.required': 'ENCRYPTION_KEY is required',
    }),

  ENCRYPTION_ALGORITHM: Joi.string()
    .default('aes-256-cbc')
    .messages({
      'string.base': 'ENCRYPTION_ALGORITHM must be a string',
    }),

  // ============================================================
  // AWS S3
  // ============================================================

  AWS_S3_BUCKET_NAME: Joi.string()
    .min(3)
    .max(63)
    .lowercase()
    .required()
    .messages({
      'string.min': 'AWS_S3_BUCKET_NAME must be at least 3 characters',
      'string.max': 'AWS_S3_BUCKET_NAME must not exceed 63 characters',
      'any.required': 'AWS_S3_BUCKET_NAME is required',
    }),

  AWS_S3_REGION: Joi.string()
    .default('us-east-1')
    .messages({
      'string.base': 'AWS_S3_REGION must be a string',
    }),

  AWS_S3_ACCESS_KEY_ID: Joi.string()
    .min(1)
    .required()
    .messages({
      'any.required': 'AWS_S3_ACCESS_KEY_ID is required',
    }),

  AWS_S3_SECRET_ACCESS_KEY: Joi.string()
    .min(1)
    .required()
    .messages({
      'any.required': 'AWS_S3_SECRET_ACCESS_KEY is required',
    }),

  // ============================================================
  // PLAGIARISM DETECTION
  // ============================================================

  TURNITIN_API_KEY: Joi.string()
    .min(1)
    .required()
    .messages({
      'any.required': 'TURNITIN_API_KEY is required',
    }),

  TURNITIN_API_URL: Joi.string()
    .uri()
    .required()
    .messages({
      'string.uri': 'TURNITIN_API_URL must be a valid URL',
      'any.required': 'TURNITIN_API_URL is required',
    }),

  // ============================================================
  // EMAIL & NOTIFICATIONS
  // ============================================================

  NOTIFICATION_EMAIL_FROM: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': 'NOTIFICATION_EMAIL_FROM must be a valid email',
      'any.required': 'NOTIFICATION_EMAIL_FROM is required',
    }),

  NOTIFICATION_EMAIL_PROVIDER: Joi.string()
    .valid('sendgrid', 'mailgun')
    .required()
    .messages({
      'string.valid':
        'NOTIFICATION_EMAIL_PROVIDER must be one of: sendgrid, mailgun',
      'any.required': 'NOTIFICATION_EMAIL_PROVIDER is required',
    }),

  NOTIFICATION_EMAIL_API_KEY: Joi.string()
    .min(1)
    .required()
    .messages({
      'any.required': 'NOTIFICATION_EMAIL_API_KEY is required',
    }),

  // ============================================================
  // EXTERNAL SERVICES
  // ============================================================

  REDIS_URL: Joi.string()
    .uri()
    .optional()
    .messages({
      'string.uri': 'REDIS_URL must be a valid URL',
    }),
})
  .unknown(true) // Allow other env vars not defined here
  .required();
