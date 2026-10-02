import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSourceOptions, DataSource } from 'typeorm';
import * as path from 'path';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { DatabaseInitializationService } from './database-initialization.service';

/**
 * Database Module Configuration
 *
 * This module configures TypeORM to connect to the PostgreSQL database
 * with the grading schema as the default schema for all entities.
 *
 * Key Features:
 * - Grading schema isolation: All entities live in 'grading' schema
 * - Connection pooling: Configured for optimal performance
 * - Automatic migrations: TypeORM migrations run on module initialization
 * - Logging: Development logging enabled, production logging disabled
 * - AWS Secrets Manager: Fetches credentials from RDSDatabaseSecrets
 */

/**
 * Fetch database credentials from AWS Secrets Manager
 * Falls back to environment variables if Secrets Manager is unavailable
 */
async function getDatabaseCredentials() {
  try {
    if (process.env.USE_SECRETS_MANAGER !== 'false') {
      const client = new SecretsManagerClient({ 
        region: process.env.AWS_REGION || 'us-east-1' 
      });

      const secretName = process.env.SECRETS_MANAGER_SECRET_NAME || 'RDSDatabaseSecrets';
      const command = new GetSecretValueCommand({ SecretId: secretName });
      const response = await client.send(command);

      let secret;
      if (response.SecretString) {
        secret = JSON.parse(response.SecretString);
      } else if (response.SecretBinary) {
        const buff = Buffer.from(response.SecretBinary as unknown as string, 'base64');
        secret = JSON.parse(buff.toString('ascii'));
      }

      console.log(`[DatabaseModule] Loaded credentials from AWS Secrets Manager: ${secretName}`);

      return {
        host: secret.host || process.env.DB_HOST || 'localhost',
        port: parseInt(secret.port || process.env.DB_PORT || '5432'),
        username: secret.username || process.env.DB_USERNAME || 'tecbridgeai',
        password: secret.password || process.env.DB_PASSWORD,
        database: secret.dbname || process.env.DB_NAME || 'tec-bridgeaidb',
      };
    }
  } catch (error) {
    console.warn(`[DatabaseModule] Failed to fetch from AWS Secrets Manager: ${error.message}`);
    console.log('[DatabaseModule] Falling back to environment variables');
  }

  // Fallback to environment variables
  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'tecbridgeai',
    password: process.env.DB_PASSWORD || 'change_me',
    database: process.env.DB_NAME || 'tec-bridgeaidb',
  };
}

// Initialize credentials as a promise that resolves when credentials are loaded
let credentialsPromise: Promise<any> | null = null;

export function getCredentialsPromise() {
  if (!credentialsPromise) {
    credentialsPromise = getDatabaseCredentials();
  }
  return credentialsPromise;
}

/**
 * Database Module
 * Initializes TypeORM connection and provides database services
 */
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: async () => {
        const credentials = await getCredentialsPromise();
        return {
          type: 'postgres',
          host: credentials.host,
          port: credentials.port,
          username: credentials.username,
          password: credentials.password,
          database: credentials.database,

          /**
           * Schema Configuration
           * - schema: 'grading' sets the default schema for all entities
           * - Migrations will reference this schema explicitly
           * - Raw queries should reference 'grading.table_name' explicitly
           */
          schema: 'grading',

          /**
           * Entity Discovery
           * Automatically loads all entity files in the src/domain directory
           * Entities must be decorated with @Entity({ schema: 'grading' })
           */
          entities: [
            path.join(__dirname, '/../../domain/**/*.entity.ts'),
            path.join(__dirname, '/../../domain/**/*.entity.js'),
          ],

          /**
           * Migration Discovery
           * TypeORM loads and runs migrations in order
           * Migration files must export a class implementing MigrationInterface
           */
          migrations: [
            path.join(__dirname, '/migrations/**/*{.ts,.js}'),
          ],

          /**
           * Connection Pooling Configuration
           * Optimizes database connections for multi-tenant multi-request scenarios
           */
          extra: {
            // Maximum number of connections in pool
            max: parseInt(process.env.DB_POOL_MAX || '20'),
            // Minimum number of connections in pool (keeps idle connections)
            min: parseInt(process.env.DB_POOL_MIN || '5'),
            // Kill idle connections after this time (ms)
            idleTimeoutMillis: parseInt(
              process.env.DB_IDLE_TIMEOUT || '30000',
            ),
            // Connection timeout (ms)
            connectionTimeoutMillis: parseInt(
              process.env.DB_CONNECTION_TIMEOUT || '5000',
            ),
          },

          /**
           * Logging Configuration
           * Enable in development for debugging, disable in production for performance
           */
          logging:
            process.env.NODE_ENV === 'development' ||
            process.env.DB_LOGGING === 'true',
          logger: 'advanced-console',

          /**
           * Synchronization
           * NEVER use synchronize in production
           * Always use migrations for schema changes
           */
          synchronize: false,

          /**
           * Subscribers: Database event listeners
           * Used for audit trails, entity lifecycle hooks, etc.
           */
          subscribers: [
            path.join(__dirname, '/../../domain/**/*.subscriber.ts'),
            path.join(__dirname, '/../../domain/**/*.subscriber.js'),
          ],

          /**
           * SSL Configuration
           * Required for cloud-hosted PostgreSQL (AWS RDS, etc.)
           */
          ...(process.env.DB_SSL === 'true' && {
            ssl: {
              rejectUnauthorized: false,
            },
          }),
        } as DataSourceOptions;
      },
    }),
  ],
  providers: [DatabaseInitializationService],
})
export class DatabaseModule {}

/**
 * Data Source Instance
 * Used for raw queries and direct database access
 * Initialized asynchronously after credentials are loaded
 */
export let AppDataSource: DataSource;

/**
 * Initialize Data Source
 * Call this function before using AppDataSource for raw queries
 */
export async function initializeDataSource(): Promise<DataSource> {
  if (AppDataSource && AppDataSource.isInitialized) {
    return AppDataSource;
  }

  const credentials = await getCredentialsPromise();
  
  AppDataSource = new DataSource({
    type: 'postgres',
    host: credentials.host,
    port: credentials.port,
    username: credentials.username,
    password: credentials.password,
    database: credentials.database,
    schema: 'grading',
    entities: [
      path.join(__dirname, '/../../domain/**/*.entity.ts'),
      path.join(__dirname, '/../../domain/**/*.entity.js'),
    ],
    migrations: [
      path.join(__dirname, '/migrations/**/*{.ts,.js}'),
    ],
    logging: process.env.NODE_ENV === 'development' || process.env.DB_LOGGING === 'true',
    logger: 'advanced-console',
    synchronize: false,
    ...(process.env.DB_SSL === 'true' && {
      ssl: {
        rejectUnauthorized: false,
      },
    }),
  });

  await AppDataSource.initialize();
  return AppDataSource;
}

/**
 * Get Data Source
 * Utility function to access the DataSource instance
 * Used in services and middleware for direct database access
 */
export function getDataSource(): DataSource {
  if (!AppDataSource || !AppDataSource.isInitialized) {
    throw new Error(
      'DataSource not initialized. Ensure initializeDataSource() is called and DatabaseModule is imported in AppModule.',
    );
  }
  return AppDataSource;
}
