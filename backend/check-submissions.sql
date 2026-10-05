-- Check submission table status
-- Run this against the grading schema

-- 1. Count total submissions
SELECT COUNT(*) as total_submissions FROM grading.submissions;

-- 2. List all submissions with key details
SELECT 
  id,
  tenant_id,
  assignment_id,
  student_id,
  version,
  file_path,
  content::text,
  answer_status,
  is_late,
  submitted_at,
  created_at
FROM grading.submissions
ORDER BY created_at DESC
LIMIT 20;

-- 3. Check if table exists and has proper schema
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'grading' AND table_name = 'submissions'
ORDER BY ordinal_position;

-- 4. Check for foreign key constraints
SELECT 
  constraint_name,
  table_name,
  column_name,
  referenced_table_name,
  referenced_column_name
FROM information_schema.key_column_usage
WHERE table_schema = 'grading' AND table_name = 'submissions';

-- 5. Check indices
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'grading' AND tablename = 'submissions';
