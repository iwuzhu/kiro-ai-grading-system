import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

/**
 * Data Source for TypeORM CLI
 * Used for running migrations via `typeorm migration:run -d src/infrastructure/database/data-source.ts`
 */
export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  schema: 'grading',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  entities: [
    'dist/domain/**/*.entity.js',
  ],
  migrations: [
    'dist/infrastructure/database/migrations/**/*.js',
  ],
  logging: process.env.NODE_ENV === 'development',
  synchronize: false,
  migrationsRun: false,
});
