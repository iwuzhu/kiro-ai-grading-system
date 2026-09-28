/**
 * Configuration Interfaces
 *
 * TypeScript interfaces for all configuration properties.
 * These provide type safety and IDE autocomplete for configuration access.
 *
 * Requirement: 19 - Data Security & Privacy
 */

/**
 * Application Configuration
 */
export interface ApplicationConfig {
  /** Node environment: dev, test, prod */
  nodeEnv: 'dev' | 'test' | 'prod';

  /** Server port (default 3000) */
  port: number;

  /** API base URL (used for redirects, email links) */
  apiBaseUrl: string;

  /** CORS origin(s) - frontend URL */
  corsOrigin: string | string[];

  /** Logging level: debug, info, warn, error */
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * Database Configuration
 */
export interface DatabaseConfig {
  /** PostgreSQL host */
  host: string;

  /** PostgreSQL port */
  port: number;

  /** Database name */
  name: string;

  /** Database user */
  user: string;

  /** Database password */
  password: string;

  /** Enable SSL for production */
  ssl: boolean;

  /** Minimum pool connections */
  poolMin: number;

  /** Maximum pool connections */
  poolMax: number;

  /** Enable SQL query logging */
  logging: boolean;

  /** Database schema (always 'grading') */
  schema: string;
}

/**
 * Authentication Configuration
 */
export interface AuthenticationConfig {
  /** JWT secret key (min 32 characters) */
  jwtSecret: string;

  /** JWT access token expiration (seconds) */
  jwtExpiration: number;

  /** Refresh token secret (min 32 characters) */
  refreshTokenSecret: string;

  /** Refresh token expiration (seconds) */
  refreshTokenExpiration: number;

  /** Session secret for secure cookies (min 32 characters) */
  sessionSecret: string;
}

/**
 * AI Provider Configuration
 */
export interface AIProviderConfig {
  /** Selected provider: openai, claude, or bedrock */
  provider: 'openai' | 'claude' | 'bedrock';

  /** OpenAI specific configuration */
  openai?: {
    /** OpenAI API key */
    apiKey: string;

    /** Model name (e.g., gpt-4-turbo) */
    model: string;
  };

  /** Anthropic Claude specific configuration */
  anthropic?: {
    /** Anthropic API key */
    apiKey: string;

    /** Model name (e.g., claude-3-opus-20240229) */
    model: string;
  };

  /** AWS Bedrock specific configuration */
  bedrock?: {
    /** AWS access key ID */
    accessKeyId: string;

    /** AWS secret access key */
    secretAccessKey: string;

    /** AWS region */
    region: string;
  };
}

/**
 * Encryption Configuration
 */
export interface EncryptionConfig {
  /** Encryption key (32 bytes base64-encoded for AES-256) */
  key: string;

  /** Encryption algorithm (default: aes-256-cbc) */
  algorithm: string;
}

/**
 * AWS S3 Configuration
 */
export interface S3Config {
  /** S3 bucket name for file storage */
  bucketName: string;

  /** AWS region */
  region: string;

  /** AWS access key ID */
  accessKeyId: string;

  /** AWS secret access key */
  secretAccessKey: string;
}

/**
 * Plagiarism Detection Configuration
 */
export interface PlagiarismConfig {
  /** Turnitin API key */
  turnitinApiKey: string;

  /** Turnitin API URL */
  turnitinApiUrl: string;
}

/**
 * Email & Notifications Configuration
 */
export interface NotificationConfig {
  /** Sender email address */
  emailFrom: string;

  /** Email provider: sendgrid or mailgun */
  emailProvider: 'sendgrid' | 'mailgun';

  /** Email provider API key */
  emailApiKey: string;
}

/**
 * External Services Configuration
 */
export interface ExternalServicesConfig {
  /** Redis URL for caching (optional) */
  redisUrl?: string;
}

/**
 * Complete Application Configuration
 */
export interface IAppConfig {
  /** Application settings */
  application: ApplicationConfig;

  /** Database settings */
  database: DatabaseConfig;

  /** Authentication settings */
  authentication: AuthenticationConfig;

  /** AI provider settings */
  aiProvider: AIProviderConfig;

  /** Encryption settings */
  encryption: EncryptionConfig;

  /** AWS S3 settings */
  s3: S3Config;

  /** Plagiarism detection settings */
  plagiarism: PlagiarismConfig;

  /** Email & notifications settings */
  notification: NotificationConfig;

  /** External services settings */
  externalServices: ExternalServicesConfig;
}

/**
 * Environment Variables (Raw)
 *
 * Represents all possible environment variables before validation
 */
export interface EnvironmentVariables {
  // Application
  NODE_ENV?: string;
  PORT?: string;
  API_BASE_URL?: string;
  CORS_ORIGIN?: string;
  LOG_LEVEL?: string;

  // Database
  DATABASE_HOST?: string;
  DATABASE_PORT?: string;
  DATABASE_NAME?: string;
  DATABASE_USER?: string;
  DATABASE_PASSWORD?: string;
  DATABASE_SSL?: string;
  DATABASE_POOL_MIN?: string;
  DATABASE_POOL_MAX?: string;
  DATABASE_LOGGING?: string;

  // Authentication
  JWT_SECRET?: string;
  JWT_EXPIRATION?: string;
  REFRESH_TOKEN_SECRET?: string;
  REFRESH_TOKEN_EXPIRATION?: string;
  SESSION_SECRET?: string;

  // AI Providers
  AI_PROVIDER?: string;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  ANTHROPIC_API_KEY?: string;
  ANTHROPIC_MODEL?: string;
  AWS_ACCESS_KEY_ID?: string;
  AWS_SECRET_ACCESS_KEY?: string;
  AWS_REGION?: string;

  // Encryption
  ENCRYPTION_KEY?: string;
  ENCRYPTION_ALGORITHM?: string;

  // AWS S3
  AWS_S3_BUCKET_NAME?: string;
  AWS_S3_REGION?: string;
  AWS_S3_ACCESS_KEY_ID?: string;
  AWS_S3_SECRET_ACCESS_KEY?: string;

  // Plagiarism
  TURNITIN_API_KEY?: string;
  TURNITIN_API_URL?: string;

  // Notifications
  NOTIFICATION_EMAIL_FROM?: string;
  NOTIFICATION_EMAIL_PROVIDER?: string;
  NOTIFICATION_EMAIL_API_KEY?: string;

  // External Services
  REDIS_URL?: string;
}
