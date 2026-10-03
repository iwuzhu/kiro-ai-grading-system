-- Manual Audit Logs Seeding Script
-- Run this manually if automatic seeding didn't work

-- First, check if the audit_logs table exists
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'grading' AND table_name = 'audit_logs';

-- Get institution and user IDs (using test data)
WITH test_data AS (
  SELECT 
    i.id as institution_id,
    i.tenant_id,
    (SELECT id FROM grading.users WHERE tenant_id = i.tenant_id AND email = 'admin@deepgrader.com' LIMIT 1) as admin_id,
    (SELECT id FROM grading.users WHERE tenant_id = i.tenant_id AND email = 'teacher1@deepgrader.com' LIMIT 1) as teacher_id,
    (SELECT id FROM grading.users WHERE tenant_id = i.tenant_id AND email = 'student1@deepgrader.com' LIMIT 1) as student_id
  FROM grading.institutions i
  WHERE i.domain = 'test-university.edu'
  LIMIT 1
)
INSERT INTO grading.audit_logs 
  (tenant_id, event_type, actor_user_id, resource_type, resource_id, action_details, ip_address, created_at)
SELECT 
  t.tenant_id,
  'user_login'::text,
  t.admin_id,
  'user'::text,
  t.admin_id,
  '{"email": "admin@deepgrader.com", "ip": "192.168.1.100"}'::jsonb,
  '192.168.1.100'::inet,
  NOW() - INTERVAL '5 minutes'
FROM test_data t
WHERE t.admin_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Verify the insert
SELECT COUNT(*) as total_audit_logs FROM grading.audit_logs;

-- Show recent audit logs
SELECT id, event_type, actor_user_id, created_at, action_details 
FROM grading.audit_logs 
ORDER BY created_at DESC 
LIMIT 10;
