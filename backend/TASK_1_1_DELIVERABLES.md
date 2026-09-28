# Task 1.1: Create PostgreSQL Database Schema - Deliverables

**Task**: Create PostgreSQL Database Schema (grading schema)
**Effort**: XL (13 story points)  
**Priority**: Critical  
**Status**: ✅ Completed

---

## Overview

This task establishes the foundational database infrastructure for the AI Grading System by creating a dedicated `grading` schema in PostgreSQL with proper ownership, permissions, and Row-Level Security (RLS) infrastructure. The schema provides:

- **Tenant Isolation**: All grading data isolated in a single schema within a shared database
- **RBAC Support**: Application and admin roles with granular permissions
- **RLS Foundation**: Foundational functions for enforcing tenant isolation via database policies
- **Scalability**: Clear path for independent scaling, backup, and migration operations

---

## Deliverables

### 1. Database Migration File
**File**: `backend/src/infrastructure/database/migrations/1_create_grading_schema.ts`

**Contents**:
- ✅ Create `grading` schema with `CREATE SCHEMA IF NOT EXISTS grading`
- ✅ Create `application_role` with LOGIN and appropriate permissions
- ✅ Create `admin_role` with SUPERUSER permissions
- ✅ Grant USAGE and CREATE on `grading` schema to `application_role`
- ✅ Set search_path for `application_role` to prioritize `grading` schema
- ✅ Configure default privileges for future tables
- ✅ Create 4 foundational RLS functions:
  - `get_current_tenant_id()` - Returns current tenant UUID from session
  - `check_tenant_access(UUID)` - Validates tenant membership for a record
  - `get_current_user_id()` - Returns current user UUID from session
  - `get_current_user_role()` - Returns current user role (admin/instructor/student)

**Key Features**:
- Idempotent: Can be run multiple times without errors
- Reversible: Includes down() method for rollback
- Well-documented: Inline comments explain each step
- Error-safe: Handles existing roles gracefully

---

### 2. TypeORM Database Configuration
**File**: `backend/src/infrastructure/database/database.module.ts`

**Contents**:
- ✅ DataSourceOptions configuration with:
  - PostgreSQL connection parameters
  - `schema: 'grading'` as default schema for all entities
  - Connection pooling configuration (max: 20, min: 5 connections)
  - Entity and migration discovery paths
  - Logging configuration (enabled in development)
  - SSL support for cloud-hosted databases
- ✅ DatabaseModule class for NestJS integration
- ✅ Helper functions:
  - `getDataSource()` - Access DataSource instance
  - `AppDataSource` - Singleton DataSource instance

**Configuration Coverage**:
- Connection pooling for multi-tenant multi-request scenarios
- Automatic entity and migration discovery
- Environment-based configuration
- SSL support for production deployments

---

### 3. Tenant Context Middleware
**File**: `backend/src/infrastructure/middleware/tenant-context.middleware.ts`

**Contents**:
- ✅ `TenantContextMiddleware` NestJS middleware that:
  - Extracts tenant_id, user_id, user_role from request context
  - Sets PostgreSQL session variables for RLS enforcement
  - Attaches context to request object for use in handlers
  - Includes development strategies for context extraction (headers, body, JWT claims)
- ✅ `TenantContextService` for service-layer access:
  - `getCurrentTenantId()` - Get current tenant from session
  - `getCurrentUserId()` - Get current user from session
  - `getCurrentUserRole()` - Get current user role from session
  - `checkTenantAccess(tenantId)` - Verify tenant membership

**Usage Pattern**:
```typescript
// In middleware setup (app.module.ts)
app.use(TenantContextMiddleware);

// In service/controller (injected)
const tenantId = await tenantContextService.getCurrentTenantId();
```

---

### 4. Schema Setup Documentation
**File**: `backend/src/infrastructure/database/SCHEMA_SETUP.md`

**Contents** (2,500+ words):
- ✅ Schema architecture and logical structure
- ✅ Roles & permissions model with permission breakdown
- ✅ Database connection configuration examples
- ✅ RLS foundation functions explanation
- ✅ Table naming and schema specification patterns
- ✅ Backup & restore procedures
- ✅ Verification commands for schema and functions
- ✅ Troubleshooting guide with common errors and solutions
- ✅ Best practices for production usage
- ✅ Related tasks and next steps

---

### 5. Developer Setup Instructions
**File**: `backend/SETUP_DATABASE.md`

**Contents** (2,000+ words):
- ✅ Prerequisites: PostgreSQL, Node.js, npm/yarn
- ✅ Step-by-step database setup:
  1. Start PostgreSQL (local or Docker)
  2. Create shared_database
  3. Create application user (grading_user)
  4. Configure environment variables (.env.local)
  5. Install dependencies
  6. Run migrations
  7. Verify schema created
  8. Verify RLS functions
  9. Verify permissions
  10. Start application
- ✅ Troubleshooting section with:
  - PostgreSQL connection errors
  - Authentication errors
  - Permission errors
  - Migration errors
  - Module not found errors
- ✅ Common database tasks:
  - Create test data
  - Backup/restore schema
  - Reset database (dev only)
- ✅ Environment-specific configurations (dev, staging, production)

---

### 6. Migration Tests
**File**: `backend/src/infrastructure/database/migrations/1_create_grading_schema.test.ts`

**Test Coverage**:
- ✅ Schema creation verification
- ✅ Role creation (application_role, admin_role)
- ✅ Permission grants verification:
  - USAGE on schema
  - CREATE on schema
  - ALL PRIVILEGES for admin
- ✅ RLS function existence checks (4 functions):
  - get_current_tenant_id
  - check_tenant_access
  - get_current_user_id
  - get_current_user_role
- ✅ Context function behavior:
  - Returns NULL when context not set
  - Returns correct values when context set
  - Correctly validates tenant access
- ✅ Table creation permissions
- ✅ Migration rollback verification
- ✅ All acceptance criteria validation

**Test Framework**: Jest (standard for NestJS)
**Run Command**: `npm test -- migrations`

---

## Acceptance Criteria Validation

### ✅ AC 1: grading schema created with proper authorization

**Verification**:
```bash
psql -U grading_user -h localhost -d shared_database -c "\dn grading"
# Output shows grading schema with correct owner
```

**Test**: `test('✓ grading schema created with proper authorization')`

### ✅ AC 2: Application role can create tables in grading schema

**Verification**:
```bash
psql -U grading_user -h localhost -d shared_database -c \
  "CREATE TABLE grading.test_table (id INT); DROP TABLE grading.test_table;"
```

**Test**: `test('application_role should have CREATE on grading schema')`
**Test**: `test('✓ Application role can create tables in grading schema')`

### ✅ AC 3: RLS can be enabled on tables

**Verification**:
```bash
psql -U grading_user -h localhost -d shared_database -c \
  "CREATE TABLE grading.test (id INT); ALTER TABLE grading.test ENABLE ROW LEVEL SECURITY;"
```

**Test**: `test('✓ RLS can be enabled on tables')`

### ✅ AC 4: Schema is isolated from other project schemas

**Verification**:
```bash
psql -U postgres -h localhost -d shared_database -c \
  "SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'grading';"
```

**Test**: `test('✓ Schema is isolated from other project schemas')`

### ✅ AC 5: Maps to Requirement 19 (Data Security & Privacy)

**Mapping**:
- **Requirement 19**: Encryption, RLS policies, audit trails, FERPA/GDPR compliance
- **Implementation**: 
  - RLS function infrastructure (enforced via middleware)
  - Audit trail foundation (tables will be created in task 1.4)
  - RBAC controls via roles and permissions
  - Data isolation at schema level (prevents cross-tenant access)

---

## Database Connection Flow

### Request Processing

```
1. HTTP Request arrives
   ↓
2. TenantContextMiddleware intercepts
   ├─ Extract tenant_id, user_id, user_role
   ├─ SET PostgreSQL session variables
   │  ├─ SET app.current_tenant_id = 'xxx'
   │  ├─ SET app.current_user_id = 'yyy'
   │  └─ SET app.current_user_role = 'instructor'
   └─ Continue to route handler
   ↓
3. Route handler queries database
   ├─ TypeORM uses grading schema by default
   └─ RLS policies check session context
   ↓
4. RLS policies enforce tenant isolation
   ├─ get_current_tenant_id() returns session context
   ├─ WHERE tenant_id = get_current_tenant_id()
   └─ Only returns rows for current tenant
   ↓
5. Response returned to client
```

---

## Environment Configuration

### Development (.env.local)
```bash
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=grading_user
DB_PASSWORD=change_me
DB_NAME=shared_database
DB_LOGGING=true
NODE_ENV=development
DB_SSL=false
```

### Production (.env.production)
```bash
DB_HOST=postgres.example.com
DB_PORT=5432
DB_USERNAME=grading_user
DB_PASSWORD=***(from secrets)
DB_NAME=shared_database
DB_LOGGING=false
NODE_ENV=production
DB_SSL=true
DB_POOL_MAX=50
DB_POOL_MIN=10
```

---

## Running Migrations

```bash
# From backend directory

# Check migration status
npm run typeorm migration:show

# Run all pending migrations
npm run typeorm migration:run

# Expected output:
# ✔ CreateGradingSchema1704067200000

# Verify schema was created
psql -U grading_user -h localhost -d shared_database -c "\dn grading"
```

---

## Task Completion Checklist

- ✅ Grading schema created with proper authorization
- ✅ Application role has USAGE and CREATE permissions
- ✅ Admin role has ALL PRIVILEGES
- ✅ Default privileges configured for future tables
- ✅ RLS foundation functions created (4 functions)
- ✅ TypeORM database module configured
- ✅ Tenant context middleware implemented
- ✅ Database configuration file created
- ✅ Schema setup documentation (2,500+ words)
- ✅ Developer setup guide (2,000+ words)
- ✅ Migration tests (16+ test cases)
- ✅ All acceptance criteria implemented and verified

---

## File Structure

```
backend/
├── src/
│   ├── infrastructure/
│   │   ├── database/
│   │   │   ├── migrations/
│   │   │   │   ├── 1_create_grading_schema.ts       ✅ Migration
│   │   │   │   └── 1_create_grading_schema.test.ts  ✅ Tests
│   │   │   ├── database.module.ts                   ✅ TypeORM config
│   │   │   └── SCHEMA_SETUP.md                       ✅ Documentation
│   │   └── middleware/
│   │       └── tenant-context.middleware.ts         ✅ Middleware & Service
│   └── domain/
│       └── [entities created in task 1.2+]
├── SETUP_DATABASE.md                                ✅ Developer guide
└── TASK_1_1_DELIVERABLES.md                         ✅ This file
```

---

## Next Steps

### Task 1.2: Create Domain Entities
- Create TypeORM entities for core domains:
  - Institution
  - User
  - Course
  - CourseEnrollment
  - Assignment
  - Submission
  - Grade
  - Rubric

### Task 1.3: Create Indices
- Performance optimization indices on frequently queried columns
- Tenant isolation indices
- Foreign key indices

### Task 1.4: Create Audit Logs Tables
- Audit trails for all data changes
- Compliance logging (FERPA, GDPR)

### Task 1.5: Create RLS Policies
- Tenant isolation policies
- Role-based policies (admin full access, instructor course access, student own submission access)
- Enforce policies using the foundation functions from this task

---

## Key Technical Decisions

### Single Schema in Shared Database
- **Decision**: All grading tables in dedicated `grading` schema
- **Rationale**: Clear separation from other projects, easier backup/restore, simpler permission management
- **Alternative Rejected**: Separate database (adds operational complexity, requires additional PostgreSQL licensing)

### RLS Function-Based Isolation
- **Decision**: Context passed via PostgreSQL session variables, enforced via RLS policies
- **Rationale**: Database-level enforcement is secure, can't be bypassed by application bugs, works across all databases
- **Alternative Rejected**: Application-level filtering (easier to bypass, less secure)

### Idempotent Migration
- **Decision**: Use `CREATE SCHEMA IF NOT EXISTS`, catch role creation errors
- **Rationale**: Migrations can be run multiple times safely, better for distributed deployments
- **Trade-off**: Slightly more complex migration code

---

## References

- **PostgreSQL Schemas**: https://www.postgresql.org/docs/current/ddl-schemas.html
- **TypeORM Migrations**: https://typeorm.io/migrations
- **PostgreSQL Row-Level Security**: https://www.postgresql.org/docs/current/ddl-rowsecurity.html
- **NestJS Database**: https://docs.nestjs.com/techniques/database
- **Steering Document**: `.kiro/steering/database-schema-isolation.md`

---

## Support

For setup issues, see `backend/SETUP_DATABASE.md`
For schema details, see `backend/src/infrastructure/database/SCHEMA_SETUP.md`
For migration details, see `backend/src/infrastructure/database/migrations/1_create_grading_schema.ts`

