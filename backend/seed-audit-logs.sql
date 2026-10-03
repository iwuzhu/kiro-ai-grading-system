-- Seed audit logs for test institution
-- This script inserts 10 realistic audit log entries

-- First, get the institution and user IDs
-- Update these UUIDs based on your actual data
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
  td.tenant_id,
  logs.event_type,
  CASE 
    WHEN logs.actor_type = 'admin' THEN td.admin_id
    WHEN logs.actor_type = 'teacher' THEN td.teacher_id
    WHEN logs.actor_type = 'student' THEN td.student_id
    ELSE NULL
  END as actor_user_id,
  logs.resource_type,
  logs.resource_id,
  logs.action_details,
  logs.ip_address,
  logs.created_at
FROM test_data td
CROSS JOIN (VALUES
  -- User login (5 minutes ago)
  ('user_login', 'admin', 'user', 'user-id-admin', '{"email":"admin@deepgrader.com","ip":"192.168.1.100"}', '192.168.1.100', NOW() - INTERVAL '5 minutes'),
  
  -- Submission received (3.5 hours ago)
  ('submission_received', 'student', 'submission', '22222222-2222-2222-2222-222222222222', '{"assignmentId":"44444444-4444-4444-4444-444444444444","fileName":"essay_final_draft.pdf","fileSize":245632,"submissionCount":1}', '172.16.0.10', NOW() - INTERVAL '3.5 hours'),
  
  -- Plagiarism scanned (2.5 hours ago) - system event
  ('plagiarism_scanned', NULL, 'submission', '22222222-2222-2222-2222-222222222222', '{"plagiarismScore":12,"aiGenerationScore":5,"sourceMatches":2,"scanTime":8500}', NULL, NOW() - INTERVAL '2.5 hours'),
  
  -- Grade created (2 hours ago) - AI system event
  ('grade_created', NULL, 'grade', '11111111-1111-1111-1111-111111111111', '{"submissionId":"22222222-2222-2222-2222-222222222222","score":87,"confidence":0.92,"aiProvider":"openai","aiModel":"gpt-4o","feedback":"Excellent work on this assignment. Your analysis was thorough and well-articulated.","tokenCount":1245,"latency":2340}', NULL, NOW() - INTERVAL '2 hours'),
  
  -- Grade override (1.75 hours ago)
  ('grade_override', 'teacher', 'grade', '11111111-1111-1111-1111-111111111111', '{"originalScore":87,"overriddenScore":92,"originalConfidence":0.92,"rationale":"Student demonstrated exceptional understanding in class discussion.","requiresApproval":false}', '10.0.0.50', NOW() - INTERVAL '1.75 hours'),
  
  -- Grade released (1.5 hours ago)
  ('grade_released', 'teacher', 'grade', '11111111-1111-1111-1111-111111111111', '{"submissionId":"22222222-2222-2222-2222-222222222222","visibleToStudent":true,"includesFeedback":true}', '10.0.0.50', NOW() - INTERVAL '1.5 hours'),
  
  -- Institution settings changed (4 hours ago)
  ('institution_settings_changed', 'admin', 'institution', NULL, '{"settingKey":"plagiarism_threshold","previousValue":75,"newValue":80,"description":"Increased plagiarism threshold from 75% to 80% for stricter detection"}', '192.168.1.100', NOW() - INTERVAL '4 hours'),
  
  -- User role changed (5 hours ago)
  ('user_role_changed', 'admin', 'user', NULL, '{"previousRole":"STUDENT","newRole":"INSTRUCTOR","reason":"Promoted to instructor based on department request"}', '192.168.1.100', NOW() - INTERVAL '5 hours'),
  
  -- Another grade created (6 hours ago) - AI system event
  ('grade_created', NULL, 'grade', '55555555-5555-5555-5555-555555555555', '{"submissionId":"66666666-6666-6666-6666-666666666666","score":78,"confidence":0.85,"aiProvider":"openai","aiModel":"gpt-4o","feedback":"Good effort overall. Consider providing more detailed analysis.","tokenCount":1100,"latency":2100}', NULL, NOW() - INTERVAL '6 hours'),
  
  -- User logout (7 hours ago)
  ('user_logout', 'admin', 'user', NULL, '{"email":"admin@deepgrader.com","sessionDuration":3600}', '192.168.1.100', NOW() - INTERVAL '7 hours')
) logs(event_type, actor_type, resource_type, resource_id, action_details, ip_address, created_at)
ON CONFLICT DO NOTHING;

-- Verify the audit logs were inserted
SELECT COUNT(*) as total_audit_logs FROM grading.audit_logs;
SELECT event_type, COUNT(*) as count FROM grading.audit_logs GROUP BY event_type ORDER BY count DESC;
