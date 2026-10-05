-- Debug submission persistence
-- Run this to check the grading.submissions table status

-- 1. Check table exists
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'grading' 
AND table_name = 'submissions';

-- 2. Check table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'grading'
AND table_name = 'submissions'
ORDER BY ordinal_position;

-- 3. List all submissions (recent first)
SELECT 
  id,
  tenant_id,
  assignment_id,
  student_id,
  version,
  file_path,
  content,
  answer_status,
  created_at,
  submitted_at
FROM grading.submissions
ORDER BY created_at DESC
LIMIT 10;

-- 4. Count submissions by tenant
SELECT 
  tenant_id,
  COUNT(*) as submission_count
FROM grading.submissions
GROUP BY tenant_id
ORDER BY submission_count DESC;

-- 5. Check for any recent inserts in audit logs
SELECT 
  event_type,
  COUNT(*) as count,
  MAX(created_at) as latest
FROM grading.audit_logs
WHERE event_type LIKE '%submission%'
GROUP BY event_type
ORDER BY MAX(created_at) DESC;
