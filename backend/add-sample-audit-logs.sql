-- Add Sample Audit Logs to grading.audit_logs table
-- This script inserts 10 realistic activity log entries

SET search_path TO grading, public;

-- Get institution and user IDs
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
  event_type,
  actor_user_id,
  resource_type,
  resource_id,
  action_details,
  ip_address,
  created_at
FROM test_data t,
LATERAL (
  VALUES
    -- 1. User Login (just now)
    (t.tenant_id, 'user_login'::text, t.admin_id, 'user'::text, t.admin_id, 
     '{"email": "admin@deepgrader.com", "ip": "192.168.1.100"}'::jsonb, '192.168.1.100'::inet, NOW()),

    -- 2. User Login - Teacher (5 minutes ago)
    (t.tenant_id, 'user_login'::text, t.teacher_id, 'user'::text, t.teacher_id,
     '{"email": "teacher1@deepgrader.com", "ip": "10.0.0.50"}'::jsonb, '10.0.0.50'::inet, NOW() - INTERVAL '5 minutes'),

    -- 3. Submission Received (15 minutes ago)
    (t.tenant_id, 'submission_received'::text, t.student_id, 'submission'::text, 
     '22222222-2222-2222-2222-222222222222'::uuid,
     '{"assignmentId": "44444444-4444-4444-4444-444444444444", "fileName": "essay_final.pdf", "fileSize": 245632, "submissionCount": 1}'::jsonb,
     '172.16.0.10'::inet, NOW() - INTERVAL '15 minutes'),

    -- 4. Plagiarism Scanned (10 minutes ago)
    (t.tenant_id, 'plagiarism_scanned'::text, NULL::uuid, 'submission'::text, 
     '22222222-2222-2222-2222-222222222222'::uuid,
     '{"plagiarismScore": 12, "aiGenerationScore": 5, "sourceMatches": 2, "scanTime": 8500}'::jsonb,
     NULL::inet, NOW() - INTERVAL '10 minutes'),

    -- 5. Grade Created - AI (8 minutes ago)
    (t.tenant_id, 'grade_created'::text, NULL::uuid, 'grade'::text,
     '11111111-1111-1111-1111-111111111111'::uuid,
     '{"submissionId": "22222222-2222-2222-2222-222222222222", "score": 87, "confidence": 0.92, "aiProvider": "openai", "aiModel": "gpt-4o", "feedback": "Excellent work on this assignment. Your analysis was thorough and well-articulated.", "tokenCount": 1245, "latency": 2340}'::jsonb,
     NULL::inet, NOW() - INTERVAL '8 minutes'),

    -- 6. Grade Override by Teacher (5 minutes ago)
    (t.tenant_id, 'grade_override'::text, t.teacher_id, 'grade'::text,
     '11111111-1111-1111-1111-111111111111'::uuid,
     '{"originalScore": 87, "overriddenScore": 92, "originalConfidence": 0.92, "rationale": "Student demonstrated exceptional understanding in class discussion. AI underestimated participation value.", "requiresApproval": false}'::jsonb,
     '10.0.0.50'::inet, NOW() - INTERVAL '5 minutes'),

    -- 7. Grade Released (3 minutes ago)
    (t.tenant_id, 'grade_released'::text, t.teacher_id, 'grade'::text,
     '11111111-1111-1111-1111-111111111111'::uuid,
     '{"submissionId": "22222222-2222-2222-2222-222222222222", "visibleToStudent": true, "includesFeedback": true}'::jsonb,
     '10.0.0.50'::inet, NOW() - INTERVAL '3 minutes'),

    -- 8. Student View Grade (1 minute ago)
    (t.tenant_id, 'grade_viewed'::text, t.student_id, 'grade'::text,
     '11111111-1111-1111-1111-111111111111'::uuid,
     '{"submissionId": "22222222-2222-2222-2222-222222222222", "score": 92}'::jsonb,
     '172.16.0.10'::inet, NOW() - INTERVAL '1 minute'),

    -- 9. Institution Settings Changed (30 minutes ago)
    (t.tenant_id, 'institution_settings_changed'::text, t.admin_id, 'institution'::text, t.institution_id,
     '{"settingKey": "plagiarism_threshold", "previousValue": 75, "newValue": 80, "description": "Increased plagiarism threshold from 75% to 80% for stricter detection"}'::jsonb,
     '192.168.1.100'::inet, NOW() - INTERVAL '30 minutes'),

    -- 10. User Role Changed (1 hour ago)
    (t.tenant_id, 'user_role_changed'::text, t.admin_id, 'user'::text, t.teacher_id,
     '{"previousRole": "STUDENT", "newRole": "INSTRUCTOR", "reason": "Promoted to instructor based on department request"}'::jsonb,
     '192.168.1.100'::inet, NOW() - INTERVAL '1 hour')
) AS data(
  tenant_id, event_type, actor_user_id, resource_type, resource_id, action_details, ip_address, created_at
);

-- Verify insertion
SELECT 'Audit logs inserted successfully!' as message;
SELECT COUNT(*) as total_logs FROM grading.audit_logs;
SELECT event_type, actor_user_id, created_at FROM grading.audit_logs ORDER BY created_at DESC LIMIT 10;
