-- Create test accounts for development
-- These accounts will be used to test the login functionality

-- First, get or create a test institution
INSERT INTO grading.institutions (id, tenant_id, name, domain, timezone, created_at, updated_at)
VALUES (
  '550e8400-e29b-41d4-a716-446655440000'::uuid,
  '550e8400-e29b-41d4-a716-446655440000'::uuid,
  'Test University',
  'test.example.com',
  'America/New_York',
  NOW(),
  NOW()
)
ON CONFLICT (tenant_id) DO NOTHING;

-- Admin account
-- Email: testadmin@test.com
-- Password: TestPassword123!
-- Password hash: $2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcg7b3XeKeUxWdeS86E36DRcT36
INSERT INTO grading.users (
  id,
  tenant_id,
  email,
  name,
  role,
  status,
  password_hash,
  created_at,
  updated_at
)
VALUES (
  gen_random_uuid(),
  '550e8400-e29b-41d4-a716-446655440000'::uuid,
  'testadmin@test.com',
  'Test Admin',
  'admin',
  'ACTIVE',
  '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcg7b3XeKeUxWdeS86E36DRcT36',
  NOW(),
  NOW()
)
ON CONFLICT (tenant_id, email) DO NOTHING;

-- Instructor account
-- Email: testinstructor@test.com
-- Password: TestPassword123!
-- Password hash: $2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcg7b3XeKeUxWdeS86E36DRcT36
INSERT INTO grading.users (
  id,
  tenant_id,
  email,
  name,
  role,
  status,
  password_hash,
  created_at,
  updated_at
)
VALUES (
  gen_random_uuid(),
  '550e8400-e29b-41d4-a716-446655440000'::uuid,
  'testinstructor@test.com',
  'Test Instructor',
  'instructor',
  'ACTIVE',
  '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcg7b3XeKeUxWdeS86E36DRcT36',
  NOW(),
  NOW()
)
ON CONFLICT (tenant_id, email) DO NOTHING;

-- Student account
-- Email: teststudent@test.com
-- Password: TestPassword123!
-- Password hash: $2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcg7b3XeKeUxWdeS86E36DRcT36
INSERT INTO grading.users (
  id,
  tenant_id,
  email,
  name,
  role,
  status,
  password_hash,
  created_at,
  updated_at
)
VALUES (
  gen_random_uuid(),
  '550e8400-e29b-41d4-a716-446655440000'::uuid,
  'teststudent@test.com',
  'Test Student',
  'student',
  'ACTIVE',
  '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcg7b3XeKeUxWdeS86E36DRcT36',
  NOW(),
  NOW()
)
ON CONFLICT (tenant_id, email) DO NOTHING;

-- Verify the accounts were created
SELECT email, role, status FROM grading.users WHERE tenant_id = '550e8400-e29b-41d4-a716-446655440000'::uuid;
