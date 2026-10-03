-- Drop the incorrectly constrained audit_logs table and recreate it
-- This must be run BEFORE starting the backend with the new code

-- Drop the table if it exists (this will cascade to any foreign keys referencing it)
DROP TABLE IF EXISTS grading.audit_logs CASCADE;

-- The new backend code will recreate the table automatically on startup
-- with the correct structure (tenant_id as value, not foreign key)

-- Verify the table is dropped
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'grading' AND table_name = 'audit_logs'
) as table_exists;
-- Should return: false
