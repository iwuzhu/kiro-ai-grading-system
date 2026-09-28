/**
 * Configuration Factory Function
 *
 * Transforms raw environment variables into a typed, validated application configuration.
 * This factory is used by NestJS ConfigModule to build the application configuration.
 *
 * Requirement: 19 - Data Security & Privacy
 */

import { IAppConfig, EnvironmentVariables } from './config.interface';

/**
 * Parse boolean string values from environment variables
 * Handles: 'true', '1', 'yes' as true, everything else as false
 */
function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;
  return ['true', '1', 'yes'].includes(value.toLowerCase());
}

/**
 * Parse integer values from environment variables
 */
function parseInt(value: string | undefined, defaultValue: number): number {
  if (value === undefined) return defaultValue;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Configuration factory function
 *
 * @param env - Environment variables (already validated by Joi schema)
 * @returns Typed application configuration object
 *
 * @throws Error if critical configuration is missing
 */
export function configuration(env: EnvironmentVariables): IAppConfig {
  // Validate critical secrets are present
  if (!env.JWT_SECRET) {
    throw new Error('JWT_SECRET is required but not found in environment variables');
  }
  if (!env.REFRESH_TOKEN_SECRET) {
    throw new Error('REFRESH_TOKEN_SECRET is required but not found in environment variables');
  }
  if (!env.SESSION_SECRET) {
    throw new Error('SESSION_SECRET is required but not found in environment variables');
  }
  if (!env.ENCRYPTION_KEY) {
    throw new Error('ENCRYPTION_KEY is required but not found in environment variables');
  }
  if (!env.DATABASE_PASSWORD) {
    throw new Error('DATABASE_PASSWORD is required but not found in environment variables');
  }

  // Validate AI provider configuration
  const aiProvider = env.AI_PROVIDER || 'openai';
  switch (aiProvider) {
    case 'openai':
      if (!env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY is required when AI_PROVIDER=openai');
      }
      break;
    case 'claude':
      if (!env.ANTHROPIC_API_KEY) {
        throw new Error('ANTHROPIC_API_KEY is required when AI_PROVIDER=claude');
      }
      break;
    case 'bedrock':
      if (!env.AWS_ACCESS_KEY_ID || !env.AWS_SECRET_ACCESS_KEY) {
        throw new Error(
          'AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are required when AI_PROVIDER=bedrock',
        );
      }
      break;
  }

  // Build configuration object
  const config: IAppConfig = {
    application: {
      nodeEnv: (env.NODE_ENV || 'dev') as 'dev' | 'test' | 'prod',
      port: parseInt(env.PORT, 3000),
      apiBaseUrl: env.API_BASE_URL || 'http://localhost:3000',
      corsOrigin: env.CORS_ORIGIN || 'http://localhost:3001',
      logLevel: (env.LOG_LEVEL || 'info') as 'debug' | 'info' | 'warn' | 'error',
    },

    database: {
      host: env.DATABASE_HOST || 'localhost',
      port: parseInt(env.DATABASE_PORT, 5432),
      name: env.DATABASE_NAME || 'shared_database',
      user: env.DATABASE_USER || 'grading_user',
      password: env.DATABASE_PASSWORD || '',
      ssl: parseBoolean(env.DATABASE_SSL, false),
      poolMin: parseInt(env.DATABASE_POOL_MIN, 5),
      poolMax: parseInt(env.DATABASE_POOL_MAX, 20),
      logging: parseBoolean(env.DATABASE_LOGGING, false),
      schema: 'grading', // Always 'grading' schema
    },

    authentication: {
      jwtSecret: env.JWT_SECRET || '',
      jwtExpiration: parseInt(env.JWT_EXPIRATION, 3600),
      refreshTokenSecret: env.REFRESH_TOKEN_SECRET || '',
      refreshTokenExpiration: parseInt(env.REFRESH_TOKEN_EXPIRATION, 2592000),
      sessionSecret: env.SESSION_SECRET || '',
    },

    aiProvider: {
      provider: (aiProvider as 'openai' | 'claude' | 'bedrock'),

      // OpenAI configuration
      ...(aiProvider === 'openai' && {
        openai: {
          apiKey: env.OPENAI_API_KEY || '',
          model: env.OPENAI_MODEL || 'gpt-4-turbo',
        },
      }),

      // Anthropic Claude configuration
      ...(aiProvider === 'claude' && {
        anthropic: {
          apiKey: env.ANTHROPIC_API_KEY || '',
          model: env.ANTHROPIC_MODEL || 'claude-3-opus-20240229',
        },
      }),

      // AWS Bedrock configuration
      ...(aiProvider === 'bedrock' && {
        bedrock: {
          accessKeyId: env.AWS_ACCESS_KEY_ID || '',
          secretAccessKey: env.AWS_SECRET_ACCESS_KEY || '',
          region: env.AWS_REGION || 'us-east-1',
        },
      }),
    },

    encryption: {
      key: env.ENCRYPTION_KEY || '',
      algorithm: env.ENCRYPTION_ALGORITHM || 'aes-256-cbc',
    },

    s3: {
      bucketName: env.AWS_S3_BUCKET_NAME || '',
      region: env.AWS_S3_REGION || 'us-east-1',
      accessKeyId: env.AWS_S3_ACCESS_KEY_ID || '',
      secretAccessKey: env.AWS_S3_SECRET_ACCESS_KEY || '',
    },

    plagiarism: {
      turnitinApiKey: env.TURNITIN_API_KEY || '',
      turnitinApiUrl: env.TURNITIN_API_URL || 'https://api.turnitin.com',
    },

    notification: {
      emailFrom: env.NOTIFICATION_EMAIL_FROM || 'noreply@grading-system.edu',
      emailProvider: (env.NOTIFICATION_EMAIL_PROVIDER || 'sendgrid') as 'sendgrid' | 'mailgun',
      emailApiKey: env.NOTIFICATION_EMAIL_API_KEY || '',
    },

    externalServices: {
      redisUrl: env.REDIS_URL,
    },
  };

  return config;
}

/**
 * Configuration factory for NestJS ConfigModule
 *
 * Usage in app.module.ts:
 * ```typescript
 * import { ConfigModule } from '@nestjs/config';
 * import { configuration } from './infrastructure/config/configuration';
 * import { configValidationSchema } from './infrastructure/config/config.validation';
 *
 * @Module({
 *   imports: [
 *     ConfigModule.forRoot({
 *       load: [configuration],
 *       validationSchema: configValidationSchema,
 *       isGlobal: true,
 *     }),
 *   ],
 * })
 * export class AppModule {}
 * ```
 *
 * Access configuration in services:
 * ```typescript
 * import { ConfigService } from '@nestjs/config';
 * import { IAppConfig } from './infrastructure/config/config.interface';
 *
 * @Injectable()
 * export class MyService {
 *   constructor(private configService: ConfigService<IAppConfig>) {}
 *
 *   getSomething() {
 *     const dbHost = this.configService.get('database.host');
 *     const jwtSecret = this.configService.get('authentication.jwtSecret');
 *   }
 * }
 * ```
 */
export default configuration;
