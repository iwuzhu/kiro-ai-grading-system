# Database Schema Isolation

## Overview

The AI Grading System shares a PostgreSQL database with other projects. To maintain clear separation of concerns and enable independent schema management, all grading-related tables are isolated within a dedicated grading schema.

## Schema Design

### Schema Naming Convention

`
Database: shared_database (or environment-specific name)
+-- Schema: grading
    +-- Tables (all grading entities)
    +-- Views (analytics queries)
    +-- Functions (stored procedures)
    +-- Policies (row-level security)
    +-- Indices (performance optimization)
`

### Schema Creation

`sql
-- Create grading schema with ownership
CREATE SCHEMA IF NOT EXISTS grading AUTHORIZATION grading_owner;

-- Grant usage to application role
GRANT USAGE ON SCHEMA grading TO application_role;
GRANT CREATE ON SCHEMA grading TO application_role;

-- Set search path
SET search_path TO grading, public;
`

---

## Table Organization

### All Grading Tables in 'grading' Schema

Every table created by this project must be in the grading schema:

`
grading.institutions
grading.users
grading.courses
grading.course_enrollments
grading.assignments
grading.submissions
grading.grades
grading.grade_overrides
grading.rubrics
grading.plagiarism_results
grading.plagiarism_flags
grading.grading_traces
grading.audit_logs
grading.notifications
grading.institution_configs
`

### Example Table Definition

`sql
CREATE TABLE grading.institutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  domain VARCHAR(255) UNIQUE,
  timezone VARCHAR(50),
  plagiarism_threshold DECIMAL(5, 2) DEFAULT 20.0,
  ai_provider VARCHAR(50) DEFAULT 'openai',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP NULL,
  CONSTRAINT valid_plagiarism_threshold CHECK (plagiarism_threshold >= 0 AND plagiarism_threshold <= 100),
  CONSTRAINT valid_ai_provider CHECK (ai_provider IN ('openai', 'claude', 'bedrock'))
);

CREATE INDEX idx_institutions_tenant_id ON grading.institutions(tenant_id);
CREATE INDEX idx_institutions_domain ON grading.institutions(domain);
`

---

## Row-Level Security (RLS)

### RLS Policies in Grading Schema

All RLS policies are scoped to the grading schema:

`sql
-- Enable RLS on all grading tables
ALTER TABLE grading.institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE grading.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE grading.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE grading.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE grading.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE grading.grades ENABLE ROW LEVEL SECURITY;

-- Example RLS policy for tenant isolation
CREATE POLICY grading_tenant_isolation ON grading.assignments
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Apply to all tables that have tenant_id
CREATE POLICY grading_users_tenant ON grading.users
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);
`

---

## TypeORM Schema Configuration

### Entity Schema Declaration

In NestJS TypeORM entities, specify the schema:

`	ypescript
@Entity({ name: 'institutions', schema: 'grading' })
export class Institution {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  tenantId: string;

  @Column({ length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  domain: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn({ nullable: true })
  deletedAt: Date;
}
`

### DataSource Configuration

`	ypescript
// src/infrastructure/database/postgres.module.ts
export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT) || 5432,
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,

  // Schema configuration
  schema: 'grading', // Default schema for all entities
  
  // Connection pooling
  extra: {
    max: 20,
    min: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  },

  // Entity discovery
  entities: [__dirname + '/../../domain/**/*.entity.ts'],
  migrations: [__dirname + '/migrations/**/*{.ts,.js}'],
  
  // Logging
  logging: process.env.NODE_ENV === 'development',
  logger: 'advanced-console',
};

@Module({
  imports: [
    TypeOrmModule.forRoot(dataSourceOptions),
  ],
})
export class PostgresModule {}
`

---

## Migration Strategy

### Migration Location & Naming

Migrations belong in the grading schema directory:

`
src/infrastructure/database/migrations/
+-- 1_create_schema.ts
+-- 2_create_institutions.ts
+-- 3_create_users.ts
+-- 4_create_courses.ts
+-- 5_create_assignments.ts
+-- 6_create_submissions.ts
+-- 7_create_grades.ts
+-- 8_create_plagiarism_tables.ts
+-- 9_create_audit_logs.ts
+-- 10_create_indices.ts
+-- 11_create_rls_policies.ts
`

### Initial Schema Migration

`	ypescript
// src/infrastructure/database/migrations/1_create_schema.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateGradingSchema1704067200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create schema if it doesn't exist
    await queryRunner.query('CREATE SCHEMA IF NOT EXISTS grading');

    // Grant permissions
    await queryRunner.query('GRANT USAGE ON SCHEMA grading TO public');
    await queryRunner.query('GRANT CREATE ON SCHEMA grading TO public');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop schema and all contained objects
    await queryRunner.query('DROP SCHEMA IF EXISTS grading CASCADE');
  }
}
`

### Running Migrations

`ash
# Generate new migration
npm run typeorm migration:generate -- src/infrastructure/database/migrations/CreateGradingSchema

# Run all migrations
npm run typeorm migration:run

# Revert last migration
npm run typeorm migration:revert

# Show migration status
npm run typeorm migration:show
`

---

## Backup & Restore

### Schema-Specific Backup

When backing up, isolate the grading schema:

`ash
# Backup only grading schema
pg_dump -U \ -h \ -n grading \ > grading_backup.sql

# Restore grading schema
psql -U \ -h \ \ < grading_backup.sql

# Full database backup (all schemas)
pg_dump -U \ -h \ \ > full_backup.sql
`

### Backup Retention Policy

- **Hourly**: Last 24 hours (local)
- **Daily**: Last 30 days (S3)
- **Weekly**: Last 12 weeks (S3 Glacier)
- **Monthly**: Last 12 months (S3 Glacier Deep Archive)

---

## Performance Considerations

### Indices in Grading Schema

Create indices on frequently queried columns:

`sql
-- Tenant isolation indices
CREATE INDEX idx_grading_institutions_tenant_id ON grading.institutions(tenant_id);
CREATE INDEX idx_grading_users_tenant_id ON grading.users(tenant_id);
CREATE INDEX idx_grading_courses_tenant_id ON grading.courses(tenant_id);

-- Lookup indices
CREATE INDEX idx_grading_users_email_tenant ON grading.users(tenant_id, email);
CREATE INDEX idx_grading_courses_code_tenant ON grading.courses(tenant_id, code);
CREATE INDEX idx_grading_assignments_course ON grading.assignments(course_id);

-- Foreign key indices (automatic for constraints, but explicit for clarity)
CREATE INDEX idx_grading_submissions_assignment ON grading.submissions(assignment_id);
CREATE INDEX idx_grading_submissions_student ON grading.submissions(student_id);
CREATE INDEX idx_grading_grades_submission ON grading.grades(submission_id);

-- Query optimization indices
CREATE INDEX idx_grading_audit_logs_tenant_event ON grading.audit_logs(tenant_id, event_type, created_at);
CREATE INDEX idx_grading_plagiarism_results_status ON grading.plagiarism_results(status, scanned_at);
`

### Query Optimization

`	ypescript
// Use schema in raw queries when needed
async findInstitution(tenantId: string): Promise<Institution> {
  return this.dataSource.query(
    'SELECT * FROM grading.institutions WHERE tenant_id = \',
    [tenantId]
  );
}

// TypeORM automatically uses configured schema
async findUser(userId: string): Promise<User> {
  // Queries grading.users by default
  return this.userRepository.findById(userId);
}
`

---

## Schema Segregation Benefits

1. **Clear Ownership**: Grading project owns everything in grading schema
2. **Independent Scaling**: Can optimize grading tables separately
3. **Simplified Migrations**: Only manage grading-specific schema changes
4. **Cross-Project Safety**: Other projects can't accidentally modify grading tables
5. **Easier Backup/Restore**: Can backup grading schema independently
6. **Future Extraction**: Can easily move grading schema to dedicated database if needed

---

## Database Connection String

### Environment Variables

`ash
# .env.local
DB_HOST=postgres.example.com
DB_PORT=5432
DB_USERNAME=grading_user
DB_PASSWORD=***
DB_NAME=shared_database

# Schema is configured in TypeORM DataSource
# Not in connection string (handled by TypeORM schema option)
`

### Connection Example

`
postgresql://grading_user:***@postgres.example.com:5432/shared_database
  Schema: grading (configured in TypeORM DataSource)
`

---

## Monitoring & Maintenance

### Monitor Schema Size

`sql
-- Check schema size
SELECT 
  schema_name,
  pg_size_pretty(SUM(table_size)) AS schema_size
FROM (
  SELECT 
    table_schema as schema_name,
    pg_total_relation_size(schemaname||'.'||tablename) as table_size
  FROM pg_tables
  WHERE table_schema = 'grading'
) AS tables
GROUP BY schema_name;

-- Check largest tables
SELECT
  tablename,
  pg_size_pretty(pg_total_relation_size('grading.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'grading'
ORDER BY pg_total_relation_size('grading.'||tablename) DESC;
`

### Monitor RLS Performance

`sql
-- Check RLS policy impact on query performance
EXPLAIN ANALYZE SELECT * FROM grading.assignments WHERE tenant_id = 'uuid-here';
`

---

## Integration with Other Schemas

### Cross-Schema Queries (if needed)

If other projects need to reference grading data (not recommended):

`sql
-- Example: Other schema reads from grading (view-only)
CREATE VIEW other_schema.grading_assignment_summary AS
SELECT 
  a.id,
  a.title,
  COUNT(s.id) as submission_count
FROM grading.assignments a
LEFT JOIN grading.submissions s ON a.id = s.assignment_id
GROUP BY a.id, a.title;

-- Grant read-only access
GRANT SELECT ON other_schema.grading_assignment_summary TO other_project_role;
`

### Recommended Approach: API-Based Integration

Instead of cross-schema queries, expose grading data through REST APIs that other projects call:

`	ypescript
// other-project calls this endpoint
GET /api/v1/{institution_id}/assignments/{assignment_id}/summary
// Returns: { id, title, submission_count, ... }
`

