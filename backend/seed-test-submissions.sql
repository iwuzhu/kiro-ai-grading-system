-- Seed test data: Courses, Assignments, and Submissions
-- This script creates complete test data for development and testing

SET app.current_tenant_id = '550e8400-e29b-41d4-a716-446655440000';

-- ============================================================================
-- 1. CREATE TEST COURSES
-- ============================================================================

INSERT INTO grading.courses (
  id,
  tenant_id,
  code,
  title,
  description,
  created_by_user_id,
  status,
  created_at,
  updated_at
) VALUES
(
  '423e4567-e89b-12d3-a456-426614174100',
  '550e8400-e29b-41d4-a716-446655440000',
  'CS101',
  'Introduction to Computer Science',
  'Learn the fundamentals of computer science and programming',
  '223e4567-e89b-12d3-a456-426614174001',
  'ACTIVE',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
),
(
  '423e4567-e89b-12d3-a456-426614174101',
  '550e8400-e29b-41d4-a716-446655440000',
  'MATH201',
  'Calculus II',
  'Advanced calculus concepts including integration and series',
  '223e4567-e89b-12d3-a456-426614174001',
  'ACTIVE',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 2. CREATE COURSE ENROLLMENTS (Students enrolled in courses)
-- ============================================================================

INSERT INTO grading.course_enrollments (
  id,
  tenant_id,
  course_id,
  user_id,
  enrollment_status,
  enrolled_at,
  created_at,
  updated_at
) VALUES
(
  '523e4567-e89b-12d3-a456-426614174100',
  '550e8400-e29b-41d4-a716-446655440000',
  '423e4567-e89b-12d3-a456-426614174100',
  '323e4567-e89b-12d3-a456-426614174002',
  'ACTIVE',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
),
(
  '523e4567-e89b-12d3-a456-426614174101',
  '550e8400-e29b-41d4-a716-446655440000',
  '423e4567-e89b-12d3-a456-426614174101',
  '323e4567-e89b-12d3-a456-426614174002',
  'ACTIVE',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 3. CREATE TEST ASSIGNMENTS
-- ============================================================================

INSERT INTO grading.assignments (
  id,
  tenant_id,
  course_id,
  title,
  description,
  type,
  point_value,
  soft_deadline,
  hard_deadline,
  allow_incremental,
  late_penalty_percent,
  published_at,
  created_by_user_id,
  created_at,
  updated_at
) VALUES
(
  '623e4567-e89b-12d3-a456-426614174100',
  '550e8400-e29b-41d4-a716-446655440000',
  '423e4567-e89b-12d3-a456-426614174100',
  'Assignment 1: Hello World Program',
  'Write a simple Hello World program in Python. Students should submit a .py file.',
  'CODE',
  50,
  (CURRENT_TIMESTAMP + INTERVAL '7 days'),
  (CURRENT_TIMESTAMP + INTERVAL '10 days'),
  true,
  10,
  CURRENT_TIMESTAMP,
  '223e4567-e89b-12d3-a456-426614174001',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
),
(
  '623e4567-e89b-12d3-a456-426614174101',
  '550e8400-e29b-41d4-a716-446655440000',
  '423e4567-e89b-12d3-a456-426614174100',
  'Essay: History of Computer Science',
  'Write a 2-3 page essay on the history of computer science. Should include major contributions and figures.',
  'ESSAY',
  100,
  (CURRENT_TIMESTAMP + INTERVAL '14 days'),
  (CURRENT_TIMESTAMP + INTERVAL '21 days'),
  false,
  5,
  CURRENT_TIMESTAMP,
  '223e4567-e89b-12d3-a456-426614174001',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
),
(
  '623e4567-e89b-12d3-a456-426614174102',
  '550e8400-e29b-41d4-a716-446655440000',
  '423e4567-e89b-12d3-a456-426614174101',
  'Problem Set 1: Derivatives and Integrals',
  'Solve 15 calculus problems covering derivatives and basic integration techniques.',
  'SHORT_ANSWER',
  75,
  (CURRENT_TIMESTAMP - INTERVAL '2 days'),
  (CURRENT_TIMESTAMP - INTERVAL '1 day'),
  false,
  15,
  CURRENT_TIMESTAMP,
  '223e4567-e89b-12d3-a456-426614174001',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 4. CREATE TEST SUBMISSIONS (Various states: on-time, late, multiple versions)
-- ============================================================================

-- Assignment 1 (Code): 2 submissions from student 1 (on-time and late)
INSERT INTO grading.submissions (
  id,
  tenant_id,
  assignment_id,
  student_id,
  version,
  file_path,
  file_type,
  is_late,
  is_incremental,
  submitted_at,
  created_at,
  updated_at
) VALUES
(
  '723e4567-e89b-12d3-a456-426614174100',
  '550e8400-e29b-41d4-a716-446655440000',
  '623e4567-e89b-12d3-a456-426614174100',
  '323e4567-e89b-12d3-a456-426614174002',
  1,
  's3://submissions/CS101/hello_world_v1.py',
  'text/plain',
  false,
  true,
  (CURRENT_TIMESTAMP + INTERVAL '2 days'),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
),
(
  '723e4567-e89b-12d3-a456-426614174101',
  '550e8400-e29b-41d4-a716-446655440000',
  '623e4567-e89b-12d3-a456-426614174100',
  '323e4567-e89b-12d3-a456-426614174002',
  2,
  's3://submissions/CS101/hello_world_v2.py',
  'text/plain',
  false,
  true,
  (CURRENT_TIMESTAMP + INTERVAL '5 days'),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
),
-- Assignment 2 (Essay): Late submission from student 1
(
  '723e4567-e89b-12d3-a456-426614174102',
  '550e8400-e29b-41d4-a716-446655440000',
  '623e4567-e89b-12d3-a456-426614174101',
  '323e4567-e89b-12d3-a456-426614174002',
  1,
  's3://submissions/CS101/essay_history.docx',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  true,
  false,
  (CURRENT_TIMESTAMP + INTERVAL '25 days'),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
),
-- Assignment 3 (Problem Set): Past deadline, on-time submission from student 1
(
  '723e4567-e89b-12d3-a456-426614174103',
  '550e8400-e29b-41d4-a716-446655440000',
  '623e4567-e89b-12d3-a456-426614174102',
  '323e4567-e89b-12d3-a456-426614174002',
  1,
  's3://submissions/MATH201/problem_set_1.pdf',
  'application/pdf',
  false,
  false,
  (CURRENT_TIMESTAMP - INTERVAL '2 days'),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 5. VERIFY DATA WAS INSERTED
-- ============================================================================

SELECT 'COURSES' as "Table", COUNT(*) as "Count" FROM grading.courses WHERE tenant_id = '550e8400-e29b-41d4-a716-446655440000'
UNION ALL
SELECT 'ASSIGNMENTS', COUNT(*) FROM grading.assignments WHERE tenant_id = '550e8400-e29b-41d4-a716-446655440000'
UNION ALL
SELECT 'SUBMISSIONS', COUNT(*) FROM grading.submissions WHERE tenant_id = '550e8400-e29b-41d4-a716-446655440000'
UNION ALL
SELECT 'ENROLLMENTS', COUNT(*) FROM grading.course_enrollments WHERE tenant_id = '550e8400-e29b-41d4-a716-446655440000';

-- Show details of created data
ECHO 'Test Courses:'
SELECT id, code, title FROM grading.courses WHERE tenant_id = '550e8400-e29b-41d4-a716-446655440000';

ECHO 'Test Assignments:'
SELECT id, title, type, published_at FROM grading.assignments WHERE tenant_id = '550e8400-e29b-41d4-a716-446655440000';

ECHO 'Test Submissions:'
SELECT id, student_id, version, is_late, submitted_at FROM grading.submissions WHERE tenant_id = '550e8400-e29b-41d4-a716-446655440000';
