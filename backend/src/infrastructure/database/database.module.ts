import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSourceOptions, DataSource } from 'typeorm';
import * as path from 'path';

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
 */

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME || 'tecbridgeai',
  password: process.env.DB_PASSWORD || 'change_me',
  database: process.env.DB_NAME || 'tec-bridgeaidb',

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
};

/**
 * Database Module
 * Initializes TypeORM connection and provides database services
 */
@Module({
  imports: [
    TypeOrmModule.forRoot(dataSourceOptions),
  ],
})
export class DatabaseModule {}

/**
 * Data Source Instance
 * Used for raw queries and direct database access
 * Instantiated after module initialization
 */
export const AppDataSource = new DataSource(dataSourceOptions);

/**
 * Get Data Source
 * Utility function to access the DataSource instance
 * Used in services and middleware for direct database access
 */
export function getDataSource(): DataSource {
  if (!AppDataSource.isInitialized) {
    throw new Error(
      'DataSource not initialized. Ensure DatabaseModule is imported in AppModule.',
    );
  }
  return AppDataSource;
}
