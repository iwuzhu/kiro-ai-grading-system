# Audit Logs Fix - Foreign Key Constraint Issue

## Problem

When the backend tried to seed audit logs, it failed with:
```
error: insert or update on table "audit_logs" violates foreign key constraint "audit_logs_tenant_id_fkey"
```

## Root Cause

The audit logs table had an **incorrect foreign key constraint**:
- It was created with: `tenant_id UUID NOT NULL REFERENCES grading.institutions(id) ON DELETE CASCADE`
- But `institutions` table has:
  - `id` (primary key, auto-generated UUID)
  - `tenant_id` (a separate column, also UUID)
- The seeding code was using `tenant_id` from the institution (which is a different value than `id`)
- PostgreSQL rejected the insert because the `tenant_id` value didn't match any `id` in institutions

## Solution

### Step 1: Drop the Old Table
You must drop the incorrectly constrained table so the backend can recreate it properly.

**Option A: Run SQL Script (Recommended)**
```bash
psql -U tecbridgeai -h tec-bridgeaidb.csvikosmym65.us-east-1.rds.amazonaws.com \
  -d tec-bridgeaidb -f backend/fix-audit-logs-table.sql
```

**Option B: Manual SQL**
Connect to your database and run:
```sql
DROP TABLE IF EXISTS grading.audit_logs CASCADE;
```

Then verify:
```sql
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'grading' AND table_name = 'audit_logs'
);
-- Should return: false (table is dropped)
```

### Step 2: Update Backend Code
The backend code has been fixed with:
- Removed foreign key constraint on `tenant_id` in table creation
- Removed `@ManyToOne(() => Institution)` from AuditLog entity
- `tenant_id` is now stored as a simple UUID value (not a foreign key)
- Row-Level Security policies still enforce tenant isolation

### Step 3: Start Backend
```bash
cd backend
npm start
```

The backend will automatically:
1. Detect that the `audit_logs` table doesn't exist
2. Create it with the correct schema (no foreign key on tenant_id)
3. Seed 10 sample audit logs

**Expected Output:**
```
✓ Grading schema ready
✓ Database connection verified
✓ Creating audit_logs table...
✓ audit_logs table created successfully
✓ Seeding database with test data...
✓ Database seeding complete
✓ Seeded 10 audit logs via raw SQL
✓ API listening on port 3001
```

## Files Changed

### Backend Code Changes
1. **`backend/src/infrastructure/database/database-initialization.service.ts`**
   - Updated table creation SQL to remove foreign key on tenant_id
   - Now creates: `tenant_id UUID NOT NULL` (no constraint)
   - RLS policies still enforce isolation via `current_setting('app.current_tenant_id')`

2. **`backend/src/domain/entities/audit-log.entity.ts`**
   - Removed `@ManyToOne(() => Institution)` relationship
   - Removed import of Institution entity
   - Kept `@ManyToOne(() => User)` for actor relationship

## Schema Design Rationale

### Why No Foreign Key on tenant_id?
1. **Flexibility**: Audit logs may reference institutions that have been deleted (soft-deleted)
2. **RLS Enforcement**: PostgreSQL Row-Level Security policies enforce tenant isolation
3. **Data Integrity**: Using RLS is more reliable than foreign keys for multi-tenant systems
4. **Performance**: No foreign key constraint eliminates join overhead

### How is Isolation Enforced?
```sql
-- RLS Policy on audit_logs
CREATE POLICY tenant_isolation ON audit_logs
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Set tenant context before queries
SET app.current_tenant_id = '<tenant-uuid>';
SELECT * FROM audit_logs;  -- Only sees logs for this tenant
```

## Verification Steps

After starting the backend, verify:

### 1. Table Created Correctly
```sql
\d grading.audit_logs
-- Should show tenant_id as regular UUID column (not foreign key)
```

### 2. Audit Logs Inserted
```sql
SELECT COUNT(*) FROM grading.audit_logs;
-- Should return 10
```

### 3. Event Types Populated
```sql
SELECT event_type, COUNT(*) as count 
FROM grading.audit_logs 
GROUP BY event_type
ORDER BY count DESC;

-- Expected output:
-- grade_created           | 2
-- user_login              | 1
-- submission_received     | 1
-- plagiarism_scanned      | 1
-- grade_override          | 1
-- grade_released          | 1
-- institution_settings_changed | 1
-- user_role_changed       | 1
-- user_logout             | 1
```

### 4. View in Dashboard
1. Login to http://localhost:3000/dashboard/admin/logs
2. Admin email: `admin@deepgrader.com`
3. Password: `Password123!`
4. Should see 10 audit logs in the table

## Build Status
✅ **Backend compiles successfully**
```
> nest build
Exit Code: 0
```

## Troubleshooting

### Table Still Has Foreign Key?
Check if the old table still exists:
```sql
SELECT constraint_name, constraint_type 
FROM information_schema.table_constraints 
WHERE table_name = 'audit_logs' AND table_schema = 'grading';
```

If you see `audit_logs_tenant_id_fkey`, the old table wasn't dropped. Run the fix script again:
```bash
psql -U tecbridgeai -h tec-bridgeaidb.csvikosmym65.us-east-1.rds.amazonaws.com \
  -d tec-bridgeaidb -f backend/fix-audit-logs-table.sql
```

### Still Getting Foreign Key Error?
Make sure you:
1. ✅ Dropped the old table: `DROP TABLE grading.audit_logs CASCADE;`
2. ✅ Rebuilt the backend: `npm run build`
3. ✅ Started the backend: `npm start`
4. ✅ Waited for seeding to complete (watch for "✓ Seeded" messages)

### Audit Logs Not Appearing in Dashboard?
Check that:
1. Backend logs show "✓ Seeded X audit logs via raw SQL"
2. Database has 10 records: `SELECT COUNT(*) FROM grading.audit_logs;`
3. Correct tenant_id: `SELECT DISTINCT tenant_id FROM grading.audit_logs;`
4. Frontend is sending correct header: Check Network tab in browser DevTools

## Next Steps

1. **Drop the old table**:
   ```bash
   psql -U tecbridgeai -h tec-bridgeaidb.csvikosmym65.us-east-1.rds.amazonaws.com \
     -d tec-bridgeaidb -f backend/fix-audit-logs-table.sql
   ```

2. **Start backend**:
   ```bash
   cd backend && npm start
   ```

3. **Wait for seeding** (watch the logs for the success message)

4. **Login to admin dashboard**: http://localhost:3000/dashboard/admin/logs

5. **Verify 10 audit logs appear**

If you need manual data insertion after this fix, use:
```bash
psql -U tecbridgeai -h tec-bridgeaidb.csvikosmym65.us-east-1.rds.amazonaws.com \
  -d tec-bridgeaidb -f backend/insert-audit-logs.sql
```
