# Grading Schema Setup & Management

## Overview

The AI Grading System uses a dedicated `grading` schema within PostgreSQL to isolate all grading-related tables, views, and functions from other projects sharing the same database. This document explains the schema architecture, permissions model, and how to manage it.

---

## Schema Architecture

### Logical Structure

```
Database: shared_database (configured via DB_NAME env var)
└── Schema: grading
    ├── Tables
    │   ├── institutions (institutions.entity.ts)
    │   ├── users (user.entity.ts)
    │   ├── courses (course.entity.ts)
    │   ├── course_enrollments
    │   ├── assignments (assignment.entity.ts)
    │   ├── submissions (submission.entity.ts)
    │   ├── grades (grade.entity.ts)
    │   ├── grade_overrides
    │   ├── rubrics
    │   ├── plagiarism_results
    │   ├── plagiarism_flags
    │   ├── grading_traces
    │   ├── audit_logs
    │   ├── notifications
    │   └── institution_configs
    │
    ├── Functions (RLS Infrastructure)
    │   ├── get_current_tenant_id()      [Returns current tenant UUID]
    │   ├── check_tenant_access(uuid)    [Validates tenant membership]
    │   ├── get_current_user_id()        [Returns current user UUID]
    │   └── get_current_user_role()      [Returns user role: admin/instructor/student]
    │
    ├── Views (Analytics & Aggregations)
    │   └── [Created by task 5.x]
    │
    └── Policies (Row-Level Security)
        └── [Created by task 1.5 and subsequent tasks]
```

---

## Roles & Permissions Model

### Role Hierarchy

| Role | Type | Purpose | Permissions |
|------|------|---------|-------------|
| `application_role` | Service Account | NestJS application connection | USAGE, CREATE on grading schema; SELECT/INSERT/UPDATE/DELETE on tables |
| `admin_role` | Administrator | Schema administration & maintenance | ALL PRIVILEGES on grading schema |
| `postgres` | Superuser | Database administration | All permissions (use only for initial setup) |

### Permission Breakdown

#### application_role (Service Account)
```sql
GRANT USAGE ON SCHEMA grading TO application_role;
GRANT CREATE ON SCHEMA grading TO application_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA grading TO application_role;
```

- **USAGE**: Allows accessing objects in the grading schema
- **CREATE**: Allows creating new tables during migrations
- **SELECT/INSERT/UPDATE/DELETE**: Basic CRUD operations on tables
- **Default Privileges**: Automatically grants CRUD on future tables

#### admin_role (Administrator)
```sql
GRANT ALL PRIVILEGES ON SCHEMA grading TO admin_role;
```

- **ALL PRIVILEGES**: Full control including ALTER, DROP, GRANT operations
- Used for: Schema maintenance, emergency fixes, administrative tasks

---

## Database Connection

### Environment Configuration

```bash
# .env or .env.local
DB_HOST=localhost              # PostgreSQL server hostname
DB_PORT=5432                   # PostgreSQL port
DB_USERNAME=grading_user       # Database user (application_role)
DB_PASSWORD=your_secure_pw     # Database password
DB_NAME=shared_database        # Database name (shared by multiple projects)

# Schema configuration is handled by TypeORM DataSource
# Not in connection string (configured in code)
```

### TypeORM DataSource Configuration

See `src/infrastructure/database/database.module.ts`:
- `schema: 'grading'` sets default schema for all entities
- `search_path` environment variable configured per role
- Entity definitions use `@Entity({ schema: 'grading' })` decorator

---

## Running Migrations

### Prerequisites

```bash
# Ensure PostgreSQL is running and accessible
# Create the database if it doesn't exist:
createdb shared_database

# Verify connection
psql -h localhost -U grading_user -d shared_database -c "SELECT 1"
```

### Commands

```bash
# Run all pending migrations
npm run typeorm migration:run

# Show migration status
npm run typeorm migration:show

# Generate new migration (if schema changes)
npm run typeorm migration:generate -- -n <migration_name>

# Revert last migration (USE WITH CAUTION!)
npm run typeorm migration:revert

# Revert to specific migration
npm run typeorm migration:revert -- --transaction false
```

### First-Time Setup

```bash
# 1. Ensure PostgreSQL is running
docker run -d \
  --name postgres \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  postgres:15

# 2. Create the database
psql -U postgres -h localhost -c "CREATE DATABASE shared_database;"

# 3. Create application user
psql -U postgres -h localhost -d shared_database -c \
  "CREATE USER grading_user WITH PASSWORD 'change_me';"

# 4. Run migrations
npm install
npm run typeorm migration:run

# 5. Verify schema was created
psql -U grading_user -h localhost -d shared_database -c \
  "\dn"  # List all schemas

# Output should show: grading | postgres
```

---

## RLS (Row-Level Security) Foundation

### Infrastructure Functions

Four foundational functions enable RLS policies without modifying business logic:

#### 1. `get_current_tenant_id()`
Extracts tenant UUID from application session context.

```sql
SELECT grading.get_current_tenant_id();
-- Returns: '550e8400-e29b-41d4-a716-446655440000' or NULL if not set
```

**Usage in RLS Policies:**
```sql
CREATE POLICY tenant_isolation ON grading.assignments
  USING (tenant_id = grading.get_current_tenant_id())
  WITH CHECK (tenant_id = grading.get_current_tenant_id());
```

#### 2. `check_tenant_access(record_tenant_id UUID)`
Validates if a specific record belongs to the current tenant.

```sql
SELECT grading.check_tenant_access('550e8400-e29b-41d4-a716-446655440000');
-- Returns: TRUE if record's tenant matches current tenant, FALSE otherwise
```

#### 3. `get_current_user_id()`
Extracts the current authenticated user's UUID.

```sql
SELECT grading.get_current_user_id();
-- Returns: '660e8400-e29b-41d4-a716-446655440000' or NULL if not set
```

#### 4. `get_current_user_role()`
Returns the current user's role for RBAC-based policies.

```sql
SELECT grading.get_current_user_role();
-- Returns: 'admin' | 'instructor' | 'student' | NULL
```

**Usage in role-based policy:**
```sql
CREATE POLICY admin_full_access ON grading.institutions
  USING (grading.get_current_user_role() = 'admin')
  WITH CHECK (grading.get_current_user_role() = 'admin');
```

### Setting Application Context

In NestJS middleware/interceptor, set these values per request:

```typescript
// src/middleware/tenant-context.middleware.ts
export async function setTenantContext(
  tenantId: string,
  userId: string,
  userRole: 'admin' | 'instructor' | 'student',
) {
  const dataSource = getDataSource();
  
  await dataSource.query(
    `SET app.current_tenant_id = '${tenantId}'`,
  );
  await dataSource.query(
    `SET app.current_user_id = '${userId}'`,
  );
  await dataSource.query(
    `SET app.current_user_role = '${userRole}'`,
  );
}
```

---

## Table Naming & Schema Specification

### Entity Definition Pattern

All entities must specify `schema: 'grading'`:

```typescript
import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity({ name: 'institutions', schema: 'grading' })
export class Institution {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', unique: true })
  tenantId: string;

  @Column({ length: 255 })
  name: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn({ nullable: true })
  deletedAt: Date;
}
```

### Queries Reference Grading Schema

TypeORM automatically uses the schema, but for raw queries, be explicit:

```typescript
// Raw query - explicitly reference schema
await dataSource.query(
  'SELECT * FROM grading.assignments WHERE course_id = $1',
  [courseId]
);

// TypeORM query - uses schema from DataSource config
const assignments = await assignmentRepository.find({
  where: { courseId },
});
```

---

## Backup & Restore

### Backup Only Grading Schema

```bash
# Backup grading schema (structure + data)
pg_dump -U grading_user -h localhost \
  -n grading \
  shared_database > grading_backup.sql

# Backup grading schema (structure only)
pg_dump -U grading_user -h localhost \
  -n grading \
  -s \
  shared_database > grading_schema.sql
```

### Restore Grading Schema

```bash
# Restore grading schema
psql -U postgres -h localhost \
  shared_database < grading_backup.sql
```

### Full Database Backup (All Schemas)

```bash
pg_dump -U postgres -h localhost shared_database > full_backup.sql
```

---

## Verifying Schema Setup

### Check Schema Exists

```bash
psql -U grading_user -h localhost -d shared_database -c "SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'grading';"

# Expected output:
#  schema_name 
# ----------
#  grading
```

### Check Permissions

```bash
# List all roles and permissions on grading schema
psql -U postgres -h localhost -d shared_database -c "\dn+ grading"

# Expected output shows grading schema owned by application_role or admin_role
```

### Check Functions

```bash
# List all functions in grading schema
psql -U grading_user -h localhost -d shared_database -c "\df grading.*"

# Expected output:
#                    List of functions
# Schema | Name              | Result data type | Type | Owner
# --------+-------------------+------------------+------+---
# grading | check_tenant_access | boolean          | func | 
# grading | get_current_tenant_id | uuid             | func | 
# grading | get_current_user_id   | uuid             | func | 
# grading | get_current_user_role | text             | func |
```

### Test RLS Policy Application

After task 1.5 completes, verify RLS policies work:

```bash
psql -U grading_user -h localhost -d shared_database

-- Set current tenant
SET app.current_tenant_id = '550e8400-e29b-41d4-a716-446655440000';

-- Query should only return rows for this tenant (once policies are created)
SELECT * FROM grading.assignments;
```

---

## Troubleshooting

### Permission Denied Errors

**Error**: `permission denied for schema grading`

**Solution**:
```bash
# Verify application_role has USAGE and CREATE
psql -U postgres -h localhost -d shared_database -c \
  "GRANT USAGE, CREATE ON SCHEMA grading TO application_role;"
```

### Migration Fails with Role Exists

**Error**: `role "application_role" already exists`

**Solution**: The migration checks for existing roles and skips creation. This is normal and safe. The migration will proceed to grant permissions.

### Cannot Create Tables

**Error**: `permission denied to create "grading.my_table"`

**Solution**:
1. Verify connected as `application_role`, not another user
2. Verify migration ran successfully: `npm run typeorm migration:show`
3. Re-run migration: `npm run typeorm migration:run`

### Schema Not Found in TypeORM

**Error**: `relation "assignments" does not exist`

**Solution**:
1. Check `@Entity({ schema: 'grading' })` decorator is present
2. Verify entity is registered in `TypeOrmModule.forFeature([...])`
3. Run migrations: `npm run typeorm migration:run`

---

## Best Practices

1. **Always Run Migrations**: Never manually execute SQL on production. Use migrations only.
2. **Test Migrations Locally**: Run migrations in dev/test before production.
3. **Backup Before Migrations**: Always backup database before running migrations on production.
4. **Set Tenant Context**: Every request must set `app.current_tenant_id` for RLS to work.
5. **Use Typed Entities**: Avoid raw SQL; use TypeORM entities for type safety.
6. **Don't Modify Roles**: Don't modify application_role or admin_role permissions manually.
7. **Document Changes**: Add comments to migrations explaining schema changes.

---

## Related Tasks

- **Task 1.2-1.5**: Create tables and RLS policies in grading schema
- **Task 2.x**: Populate tables with domain entities
- **Task 5.x**: Create views for analytics queries
- **Task 6.x**: Deploy and monitor schema in production

---

## Questions or Issues?

Refer to:
- `.kiro/steering/database-schema-isolation.md` for architectural overview
- `src/infrastructure/database/database.module.ts` for TypeORM configuration
- `src/middleware/tenant-context.middleware.ts` for tenant context setup
