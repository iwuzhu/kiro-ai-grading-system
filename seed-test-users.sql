-- Seed test users directly (in case seeding service skips them)
-- Password: Password123!
-- Bcrypt hash: $2b$10$Q0Qv5k9mj8F3g0e4v3m9K.d5mfJqKpGjL9sY5z6x0w5v2u9t8r4o9

SET app.current_tenant_id = '550e8400-e29b-41d4-a716-446655440000';

INSERT INTO grading.users (
  id,
  tenant_id,
  institution_id,
  email,
  name,
  role,
  password_hash,
  status,
  permissions,
  created_at,
  updated_at
) VALUES 
-- Admin user
(
  '123e4567-e89b-12d3-a456-426614174000',
  '550e8400-e29b-41d4-a716-446655440000',
  '550e8400-e29b-41d4-a716-446655440000',
  'admin@deepgrader.com',
  'Administrator',
  'ADMIN',
  '$2b$10$Q0Qv5k9mj8F3g0e4v3m9K.d5mfJqKpGjL9sY5z6x0w5v2u9t8r4o9',
  'ACTIVE',
  ARRAY['institution:admin', 'users:manage', 'settings:write', 'audit_logs:read', 'courses:create', 'assignments:manage', 'submissions:view', 'grades:write', 'plagiarism:view', 'analytics:read'],
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
),
-- Instructor user
(
  '223e4567-e89b-12d3-a456-426614174001',
  '550e8400-e29b-41d4-a716-446655440000',
  '550e8400-e29b-41d4-a716-446655440000',
  'teacher1@deepgrader.com',
  'Teacher One',
  'INSTRUCTOR',
  '$2b$10$Q0Qv5k9mj8F3g0e4v3m9K.d5mfJqKpGjL9sY5z6x0w5v2u9t8r4o9',
  'ACTIVE',
  ARRAY['courses:create', 'assignments:manage', 'submissions:view', 'grades:write', 'plagiarism:view', 'analytics:read'],
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
),
-- Student user
(
  '323e4567-e89b-12d3-a456-426614174002',
  '550e8400-e29b-41d4-a716-446655440000',
  '550e8400-e29b-41d4-a716-446655440000',
  'student1@deepgrader.com',
  'Student One',
  'STUDENT',
  '$2b$10$Q0Qv5k9mj8F3g0e4v3m9K.d5mfJqKpGjL9sY5z6x0w5v2u9t8r4o9',
  'ACTIVE',
  ARRAY['courses:view', 'assignments:view', 'submissions:create', 'grades:view'],
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT (tenant_id, email) DO NOTHING;
