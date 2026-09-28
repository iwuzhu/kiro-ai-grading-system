# Task 1.1 Verification Checklist

Use this checklist to verify that Task 1.1 (Create PostgreSQL Database Schema) has been completed successfully.

## Pre-Requisites

- [ ] PostgreSQL is installed and running
- [ ] Node.js 18+ is installed
- [ ] npm or yarn is installed
- [ ] Database `shared_database` has been created
- [ ] Application user `grading_user` has been created
- [ ] `.env.local` is configured with correct DB credentials

## File Creation

- [ ] ✅ `backend/src/infrastructure/database/migrations/1_create_grading_schema.ts` exists
- [ ] ✅ `backend/src/infrastructure/database/database.module.ts` exists
- [ ] ✅ `backend/src/infrastructure/middleware/tenant-context.middleware.ts` exists
- [ ] ✅ `backend/src/infrastructure/database/SCHEMA_SETUP.md` exists
- [ ] ✅ `backend/SETUP_DATABASE.md` exists
- [ ] ✅ `backend/src/infrastructure/database/migrations/1_create_grading_schema.test.ts` exists
- [ ] ✅ `backend/TASK_1_1_DELIVERABLES.md` exists

## Migration Execution

### Step 1: Install Dependencies
```bash
cd backend
npm install
```
- [ ] TypeORM installed: `npm list typeorm`
- [ ] @nestjs/typeorm installed: `npm list @nestjs/typeorm`
- [ ] pg (PostgreSQL driver) installed: `npm list pg`

### Step 2: Run Migrations
```bash
npm run typeorm migration:run
```
- [ ] Migration runs without errors
- [ ] Output shows: ✔ CreateGradingSchema1704067200000
- [ ] No SQL errors in output
- [ ] All migration steps complete (schema, roles, functions)

### Step 3: Verify Schema Creation
```bash
psql -U grading_user -h localhost -d shared_database -c "\dn"
```
- [ ] Output includes `grading` schema
- [ ] Owner is correct (postgres or grading_user)

## Acceptance Criteria Verification

### ✅ AC 1: grading schema created with proper authorization

```bash
psql -U grading_user -h localhost -d shared_database -c \
  "SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'grading';"
```
- [ ] Returns exactly 1 row
- [ ] schema_name value is "grading"

### ✅ AC 2: Application role can create tables in grading schema

```bash
psql -U grading_user -h localhost -d shared_database -c \
  "CREATE TABLE grading.test_verify (id UUID PRIMARY KEY); DROP TABLE grading.test_verify;"
```
- [ ] Table created without errors
- [ ] Table dropped without errors
- [ ] Permission verified: PASS

### ✅ AC 3: RLS can be enabled on tables

```bash
psql -U grading_user -h localhost -d shared_database << 'EOF'
CREATE TABLE grading.test_rls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL
);
ALTER TABLE grading.test_rls ENABLE ROW LEVEL SECURITY;
SELECT relname FROM pg_class WHERE relname = 'test_rls' AND relrowsecurity = true;
DROP TABLE grading.test_rls;
EOF
```
- [ ] Table created successfully
- [ ] RLS enabled without errors
- [ ] Query returns "test_rls" row
- [ ] Table dropped successfully

### ✅ AC 4: Schema is isolated from other project schemas

```bash
psql -U postgres -h localhost -d shared_database -c \
  "SELECT schema_name FROM information_schema.schemata 
   WHERE schema_name = 'grading';"
```
- [ ] Returns exactly 1 row with "grading"
- [ ] No other grading-related schemas exist

## Role Verification

### Verify application_role exists and has permissions

```bash
psql -U postgres -h localhost -d shared_database -c \
  "SELECT rolname FROM pg_roles WHERE rolname = 'application_role';"
```
- [ ] Returns 1 row: "application_role"

### Verify application_role has USAGE on grading schema

```bash
psql -U postgres -h localhost -d shared_database -c \
  "SELECT privilege_type FROM information_schema.role_schema_grants 
   WHERE grantee = 'application_role' AND table_schema = 'grading' 
   AND privilege_type = 'USAGE';"
```
- [ ] Returns 1 row with privilege_type = "USAGE"

### Verify application_role has CREATE on grading schema

```bash
psql -U postgres -h localhost -d shared_database -c \
  "SELECT privilege_type FROM information_schema.role_schema_grants 
   WHERE grantee = 'application_role' AND table_schema = 'grading' 
   AND privilege_type = 'CREATE';"
```
- [ ] Returns 1 row with privilege_type = "CREATE"

### Verify admin_role exists

```bash
psql -U postgres -h localhost -d shared_database -c \
  "SELECT rolname FROM pg_roles WHERE rolname = 'admin_role';"
```
- [ ] Returns 1 row: "admin_role"

## RLS Functions Verification

### Verify all 4 RLS functions exist

```bash
psql -U grading_user -h localhost -d shared_database -c \
  "SELECT routine_name FROM information_schema.routines 
   WHERE routine_schema = 'grading' 
   ORDER BY routine_name;"
```
- [ ] Returns 4 rows:
  - [ ] check_tenant_access
  - [ ] get_current_tenant_id
  - [ ] get_current_user_id
  - [ ] get_current_user_role

### Verify get_current_tenant_id() function works

```bash
psql -U grading_user -h localhost -d shared_database -c \
  "SELECT grading.get_current_tenant_id();"
```
- [ ] Returns NULL (no context set)
- [ ] No SQL errors

### Verify get_current_tenant_id() with context set

```bash
psql -U grading_user -h localhost -d shared_database << 'EOF'
SET app.current_tenant_id = '550e8400-e29b-41d4-a716-446655440000';
SELECT grading.get_current_tenant_id();
RESET app.current_tenant_id;
EOF
```
- [ ] Returns: "550e8400-e29b-41d4-a716-446655440000"
- [ ] No SQL errors

### Verify check_tenant_access() function works

```bash
psql -U grading_user -h localhost -d shared_database << 'EOF'
SET app.current_tenant_id = '550e8400-e29b-41d4-a716-446655440000';
SELECT grading.check_tenant_access('550e8400-e29b-41d4-a716-446655440000'::uuid);
RESET app.current_tenant_id;
EOF
```
- [ ] Returns: "t" (true)
- [ ] No SQL errors

### Verify check_tenant_access() with non-matching tenant

```bash
psql -U grading_user -h localhost -d shared_database << 'EOF'
SET app.current_tenant_id = '550e8400-e29b-41d4-a716-446655440000';
SELECT grading.check_tenant_access('660e8400-e29b-41d4-a716-446655440001'::uuid);
RESET app.current_tenant_id;
EOF
```
- [ ] Returns: "f" (false)
- [ ] No SQL errors

### Verify get_current_user_id() function works

```bash
psql -U grading_user -h localhost -d shared_database << 'EOF'
SELECT grading.get_current_user_id();
SET app.current_user_id = '550e8400-e29b-41d4-a716-446655440000';
SELECT grading.get_current_user_id();
RESET app.current_user_id;
EOF
```
- [ ] First query returns: NULL
- [ ] Second query returns: "550e8400-e29b-41d4-a716-446655440000"
- [ ] No SQL errors

### Verify get_current_user_role() function works

```bash
psql -U grading_user -h localhost -d shared_database << 'EOF'
SELECT grading.get_current_user_role();
SET app.current_user_role = 'admin';
SELECT grading.get_current_user_role();
SET app.current_user_role = 'instructor';
SELECT grading.get_current_user_role();
SET app.current_user_role = 'student';
SELECT grading.get_current_user_role();
RESET app.current_user_role;
EOF
```
- [ ] First query returns: NULL
- [ ] Second query returns: "admin"
- [ ] Third query returns: "instructor"
- [ ] Fourth query returns: "student"
- [ ] No SQL errors

## Migration Tests

### Run migration tests

```bash
npm test -- migrations
```
- [ ] All tests pass
- [ ] No test failures
- [ ] Output shows: "PASS" or "Tests: X passed"

### Test results should include

- [ ] ✓ Schema Creation (1+ tests)
- [ ] ✓ Role Setup (2+ tests)
- [ ] ✓ Permissions (3+ tests)
- [ ] ✓ RLS Functions (4+ tests)
- [ ] ✓ Context Functions (3+ tests)
- [ ] ✓ Table Creation Permission (1+ test)
- [ ] ✓ Migration Rollback (1+ test)
- [ ] ✓ Acceptance Criteria (4+ tests)

**Total**: 16+ tests should pass

## Documentation Verification

- [ ] `backend/SETUP_DATABASE.md` is readable
- [ ] `backend/SETUP_DATABASE.md` contains:
  - [ ] Prerequisites section
  - [ ] Step-by-step setup instructions
  - [ ] Troubleshooting guide
  - [ ] Common database tasks
  - [ ] Environment-specific configurations
  
- [ ] `backend/src/infrastructure/database/SCHEMA_SETUP.md` is readable
- [ ] `backend/src/infrastructure/database/SCHEMA_SETUP.md` contains:
  - [ ] Schema architecture overview
  - [ ] Roles & permissions model
  - [ ] Database connection configuration
  - [ ] RLS foundation functions explanation
  - [ ] Backup & restore procedures
  - [ ] Troubleshooting guide
  
- [ ] `backend/TASK_1_1_DELIVERABLES.md` contains:
  - [ ] Task overview
  - [ ] Deliverables list
  - [ ] Acceptance criteria validation
  - [ ] File structure
  - [ ] Next steps

## Code Quality Verification

### Migration file (`1_create_grading_schema.ts`)

- [ ] Has JSDoc comment block at top
- [ ] up() method is well-documented with section comments
- [ ] down() method exists for rollback
- [ ] No hardcoded passwords (uses env vars)
- [ ] Error handling for existing roles
- [ ] Proper SQL syntax (no typos)

### Database module (`database.module.ts`)

- [ ] Exports dataSourceOptions with all required fields
- [ ] schema: 'grading' is set
- [ ] Connection pooling configured
- [ ] Environment variables used for configuration
- [ ] Logging appropriately configured
- [ ] NestJS Module decorator present
- [ ] Helper functions exported

### Middleware (`tenant-context.middleware.ts`)

- [ ] Implements NestMiddleware interface
- [ ] TenantContextMiddleware class exists
- [ ] TenantContextService class exists
- [ ] Extracts tenant_id, user_id, user_role correctly
- [ ] Sets database session variables
- [ ] Proper error handling
- [ ] Method documentation

## Integration Verification

### TypeORM is properly configured

- [ ] DataSourceOptions can be imported
- [ ] Database module can be imported in app.module.ts
- [ ] No circular dependencies

### Middleware can be used in app.module.ts

```typescript
// Example in app.module.ts
app.use(TenantContextMiddleware);
```
- [ ] Middleware can be instantiated
- [ ] No TypeScript errors

### Services can use TenantContextService

```typescript
// Example in any service
constructor(private tenantContext: TenantContextService) {}

async someMethod() {
  const tenantId = await this.tenantContext.getCurrentTenantId();
}
```
- [ ] Service can be injected
- [ ] No TypeScript errors

## Final Checklist

- [ ] **All acceptance criteria met**: AC1, AC2, AC3, AC4
- [ ] **All files created**: 7 files
- [ ] **All tests passing**: 16+ test cases
- [ ] **Documentation complete**: 3 comprehensive docs
- [ ] **Database functional**: Schema created, roles configured, functions working
- [ ] **Ready for Task 1.2**: Domain entities can be created in grading schema

---

## Troubleshooting

If any verification fails, check:

1. **PostgreSQL not running**
   - `psql -U postgres -c "SELECT 1"`
   - If fails, start PostgreSQL

2. **Database doesn't exist**
   - `psql -U postgres -c "CREATE DATABASE shared_database;"`

3. **User doesn't have permissions**
   - `psql -U postgres -d shared_database -c "GRANT USAGE ON SCHEMA grading TO grading_user;"`

4. **Migration not running**
   - Check `.env.local` has correct credentials
   - Run: `npm run typeorm migration:show`

5. **Tests failing**
   - Ensure database is accessible
   - Run: `npm test -- migrations --verbose`

---

## Completion Confirmation

**Verified by**: __________________ (Name)  
**Date**: __________________  
**Time spent**: __________ hours  
**Notes**: ___________________________________________________________

**All criteria met**: ☐ Yes ☐ No

If "No", what criteria are not met?
_________________________________________________________________
_________________________________________________________________

---

## Sign-off

Task 1.1 is complete when:
- ✅ All acceptance criteria verified
- ✅ All tests passing
- ✅ All files created
- ✅ Documentation complete
- ✅ Ready to proceed to Task 1.2

