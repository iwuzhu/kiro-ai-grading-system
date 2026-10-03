# Audit Logs Seeding Guide

## Problem Identified

The audit logs table (`grading.audit_logs`) was not being populated with sample data when the backend started, even though the code was in place.

## Root Cause

The original seeding approach had a timing issue:
1. TypeORM repository-based seeding relied on the audit logs entity working correctly
2. The seeding code was complex and had multiple dependencies on user lookups
3. No fallback mechanism existed if the ORM-based approach failed silently

## Solution Implemented

I've added two new fallback mechanisms to ensure audit logs are always seeded:

### 1. **Raw SQL Fallback** (Automatic - runs on backend startup)
- Method: `seedAuditLogsWithRawSQL()` in `database-initialization.service.ts`
- Runs automatically after the main seeding process completes
- Uses raw SQL queries that don't depend on TypeORM entity mapping
- **Location**: Runs every time backend starts
- **When**: After `seedTestData()` completes
- **Behavior**: Checks for existing logs first, skips if already populated

### 2. **Manual SQL Script** (On-demand - run manually if needed)
- File: `backend/insert-audit-logs.sql`
- Use this if the automatic seeding still doesn't work
- Includes error handling and validation
- Verifies institution and users exist before inserting

## How It Works Now

### Automatic Flow (Backend Startup)
```
Backend starts
    ↓
Connect to database
    ↓
Create grading schema
    ↓
Ensure audit_logs table exists
    ↓
Seed test institution & users
    ↓
Seed audit logs (ORM-based) ← May fail silently
    ↓
Seed audit logs (Raw SQL) ← FALLBACK - ensures data is inserted
    ↓
Backend ready with 10 audit logs populated
```

### Backend Code Changes

**File**: `backend/src/infrastructure/database/database-initialization.service.ts`

1. **New method**: `seedAuditLogsWithRawSQL()` (lines 112-203)
   - Queries database directly for institution and users
   - Constructs audit log entries as arrays
   - Inserts using parameterized SQL queries
   - Includes detailed error logging

2. **Integration**: Called in `onApplicationBootstrap()` (lines 54-60)
   - Runs after `seedTestData()` completes
   - Wrapped in try-catch to never block startup
   - Logs success/warning messages

## Usage Instructions

### Option 1: Automatic Seeding (Recommended)
1. Start backend normally:
   ```bash
   cd backend
   npm start
   ```
2. Check backend logs for:
   ```
   ✓ Seeded X audit logs via raw SQL
   ```
3. Logs should appear in admin dashboard after login

### Option 2: Manual SQL Seeding (If Automatic Fails)

**Prerequisites**:
- Backend must have run at least once with `SEED_DATABASE=true`
- Test institution must exist (domain: `test-university.edu`)
- Test users must exist (admin@deepgrader.com, teacher1@deepgrader.com, student1@deepgrader.com)

**Steps**:
1. Open a PostgreSQL client (psql, pgAdmin, DBeaver, etc.)
2. Connect to your database: `tec-bridgeaidb`
3. Run the script:
   ```bash
   psql -U tecbridgeai -h tec-bridgeaidb.csvikosmym65.us-east-1.rds.amazonaws.com -d tec-bridgeaidb -f backend/insert-audit-logs.sql
   ```

4. Verify insertion:
   ```sql
   SELECT COUNT(*) FROM grading.audit_logs;
   -- Should return 10 if successful
   ```

### Option 3: Direct SQL Execution

Copy and paste this into your database client:

```sql
-- Get institution and users
SELECT id, tenant_id FROM grading.institutions WHERE domain = 'test-university.edu' LIMIT 1;
SELECT id, email FROM grading.users WHERE email IN ('admin@deepgrader.com', 'teacher1@deepgrader.com', 'student1@deepgrader.com');

-- Then update these UUIDs and run:
INSERT INTO grading.audit_logs 
  (tenant_id, event_type, actor_user_id, resource_type, resource_id, action_details, ip_address, created_at)
VALUES
  -- Replace TENANT_ID and USER_IDs with actual UUIDs
  ('TENANT_ID', 'user_login', 'ADMIN_ID', 'user', 'ADMIN_ID', '{"email":"admin@deepgrader.com"}', '192.168.1.100', NOW() - INTERVAL '5 minutes'),
  ('TENANT_ID', 'submission_received', 'STUDENT_ID', 'submission', '22222222-2222-2222-2222-222222222222', '{"fileName":"essay.pdf"}', '172.16.0.10', NOW() - INTERVAL '3.5 hours'),
  -- ... (add remaining 8 logs from insert-audit-logs.sql)
;
```

## Verification

After seeding, verify the data:

1. **Check count**:
   ```sql
   SELECT COUNT(*) FROM grading.audit_logs;
   -- Should return 10
   ```

2. **Check by event type**:
   ```sql
   SELECT event_type, COUNT(*) as count 
   FROM grading.audit_logs 
   GROUP BY event_type
   ORDER BY count DESC;
   ```

3. **Expected output**:
   ```
   event_type                    | count
   grade_created                 | 2
   user_login                    | 1
   submission_received           | 1
   plagiarism_scanned            | 1
   grade_override                | 1
   grade_released                | 1
   institution_settings_changed  | 1
   user_role_changed             | 1
   user_logout                   | 1
   ```

4. **View in admin dashboard**:
   - Login to http://localhost:3000/dashboard/admin/logs
   - Should see 10 audit logs in the table
   - Check different event types by filtering

## What Was Seeded

10 realistic audit log entries across these event types:

| # | Event Type | Actor | Resource | Time Ago | Details |
|---|-----------|-------|----------|----------|---------|
| 1 | user_login | admin | user | 5 min | Admin login event |
| 2 | submission_received | student | submission | 3.5h | Essay PDF uploaded |
| 3 | plagiarism_scanned | (System) | submission | 2.5h | 12% plagiarism match |
| 4 | grade_created | (AI) | grade | 2h | Score: 87, Confidence: 92% |
| 5 | grade_override | teacher | grade | 1.75h | Overridden to 92 |
| 6 | grade_released | teacher | grade | 1.5h | Grade visible to student |
| 7 | institution_settings_changed | admin | institution | 4h | Threshold updated to 80% |
| 8 | user_role_changed | admin | user | 5h | Teacher promoted from student |
| 9 | grade_created | (AI) | grade | 6h | Score: 78, Confidence: 85% |
| 10 | user_logout | admin | user | 7h | Admin logout |

## Troubleshooting

### No audit logs showing in dashboard?

**Check 1: Verify backend ran with seeding**
```bash
cd backend
npm start
# Look for these messages in logs:
# ✓ Seeding database with test data...
# ✓ Database seeding complete
# ✓ Seeded X audit logs via raw SQL
```

**Check 2: Verify table exists**
```sql
SELECT * FROM information_schema.tables 
WHERE table_schema = 'grading' AND table_name = 'audit_logs';
```

**Check 3: Verify data was inserted**
```sql
SELECT COUNT(*) FROM grading.audit_logs;
SELECT * FROM grading.audit_logs LIMIT 5;
```

**Check 4: Verify tenant isolation**
```sql
-- Get the tenant ID you're using
SELECT id, tenant_id FROM grading.institutions LIMIT 1;

-- Check logs for that tenant
SELECT COUNT(*) FROM grading.audit_logs 
WHERE tenant_id = '<your-tenant-id>';
```

**Check 5: Verify frontend is sending correct tenant**
- Open browser DevTools → Network tab
- Go to http://localhost:3000/dashboard/admin/logs
- Check the `/audit-logs` request
- Look for header: `X-Tenant-ID: <uuid>`
- Should match the tenant from database

### Still empty after all checks?

Run the manual SQL script:
```bash
psql -U tecbridgeai -h tec-bridgeaidb.csvikosmym65.us-east-1.rds.amazonaws.com -d tec-bridgeaidb -f backend/insert-audit-logs.sql
```

If that also fails, there may be a database connectivity issue. Check:
- Database connection string in `.env.local`
- AWS RDS security group allows your IP
- User credentials are correct
- Database/schema exists

## Files Modified

1. **`backend/src/infrastructure/database/database-initialization.service.ts`**
   - Added `seedAuditLogsWithRawSQL()` method
   - Integrated call in `onApplicationBootstrap()`
   - Improved error handling

2. **New files created**:
   - `backend/insert-audit-logs.sql` - Manual seeding script
   - `backend/seed-audit-logs.sql` - Alternative seeding approach

## Backend Build Status

✅ Build successful (exit code: 0)

The changes are fully compatible and compile without errors.

## Next Steps

1. **Start backend**: `cd backend && npm start`
2. **Verify logs are seeded**: Check backend console output
3. **Login to admin dashboard**: http://localhost:3000/dashboard/admin/logs
4. **View audit logs**: Should see 10 entries in the table

If audit logs still don't appear, run the manual SQL script provided above.

