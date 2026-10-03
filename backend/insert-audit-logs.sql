-- Direct insertion of audit logs
-- Run this after the backend has created the test institution and users
-- This script assumes:
-- - Institution exists with domain 'test-university.edu'
-- - Test users exist: admin@deepgrader.com, teacher1@deepgrader.com, student1@deepgrader.com

DO $$
DECLARE
  v_tenant_id UUID;
  v_institution_id UUID;
  v_admin_id UUID;
  v_teacher_id UUID;
  v_student_id UUID;
  v_log_count INT;
BEGIN
  -- Get the test institution and users
  SELECT i.id, i.tenant_id 
  INTO v_institution_id, v_tenant_id
  FROM grading.institutions i
  WHERE i.domain = 'test-university.edu'
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Test institution not found. Did you run the backend with SEED_DATABASE=true?';
  END IF;

  -- Get test users
  SELECT id INTO v_admin_id 
  FROM grading.users 
  WHERE tenant_id = v_tenant_id AND email = 'admin@deepgrader.com' LIMIT 1;

  SELECT id INTO v_teacher_id 
  FROM grading.users 
  WHERE tenant_id = v_tenant_id AND email = 'teacher1@deepgrader.com' LIMIT 1;

  SELECT id INTO v_student_id 
  FROM grading.users 
  WHERE tenant_id = v_tenant_id AND email = 'student1@deepgrader.com' LIMIT 1;

  IF v_admin_id IS NULL OR v_teacher_id IS NULL OR v_student_id IS NULL THEN
    RAISE EXCEPTION 'Test users not found. Admin: %, Teacher: %, Student: %', v_admin_id, v_teacher_id, v_student_id;
  END IF;

  -- Check existing logs
  SELECT COUNT(*) INTO v_log_count 
  FROM grading.audit_logs 
  WHERE tenant_id = v_tenant_id;

  IF v_log_count > 0 THEN
    RAISE NOTICE 'Audit logs already exist (%). Skipping insertion.', v_log_count;
    RETURN;
  END IF;

  -- Insert audit logs
  INSERT INTO grading.audit_logs (tenant_id, event_type, actor_user_id, resource_type, resource_id, action_details, ip_address, created_at)
  VALUES
    (v_tenant_id, 'user_login', v_admin_id, 'user', v_admin_id, '{"email":"admin@deepgrader.com","ip":"192.168.1.100"}', '192.168.1.100', NOW() - INTERVAL '5 minutes'),
    (v_tenant_id, 'submission_received', v_student_id, 'submission', '22222222-2222-2222-2222-222222222222', '{"assignmentId":"44444444-4444-4444-4444-444444444444","fileName":"essay_final_draft.pdf","fileSize":245632}', '172.16.0.10', NOW() - INTERVAL '3.5 hours'),
    (v_tenant_id, 'plagiarism_scanned', NULL, 'submission', '22222222-2222-2222-2222-222222222222', '{"plagiarismScore":12,"aiGenerationScore":5,"sourceMatches":2}', NULL, NOW() - INTERVAL '2.5 hours'),
    (v_tenant_id, 'grade_created', NULL, 'grade', '11111111-1111-1111-1111-111111111111', '{"submissionId":"22222222-2222-2222-2222-222222222222","score":87,"confidence":0.92}', NULL, NOW() - INTERVAL '2 hours'),
    (v_tenant_id, 'grade_override', v_teacher_id, 'grade', '11111111-1111-1111-1111-111111111111', '{"originalScore":87,"overriddenScore":92}', '10.0.0.50', NOW() - INTERVAL '1.75 hours'),
    (v_tenant_id, 'grade_released', v_teacher_id, 'grade', '11111111-1111-1111-1111-111111111111', '{"visibleToStudent":true}', '10.0.0.50', NOW() - INTERVAL '1.5 hours'),
    (v_tenant_id, 'institution_settings_changed', v_admin_id, 'institution', v_institution_id, '{"settingKey":"plagiarism_threshold","previousValue":75,"newValue":80}', '192.168.1.100', NOW() - INTERVAL '4 hours'),
    (v_tenant_id, 'user_role_changed', v_admin_id, 'user', v_teacher_id, '{"previousRole":"STUDENT","newRole":"INSTRUCTOR"}', '192.168.1.100', NOW() - INTERVAL '5 hours'),
    (v_tenant_id, 'grade_created', NULL, 'grade', '55555555-5555-5555-5555-555555555555', '{"submissionId":"66666666-6666-6666-6666-666666666666","score":78,"confidence":0.85}', NULL, NOW() - INTERVAL '6 hours'),
    (v_tenant_id, 'user_logout', v_admin_id, 'user', v_admin_id, '{"sessionDuration":3600}', '192.168.1.100', NOW() - INTERVAL '7 hours');

  RAISE NOTICE 'Successfully inserted 10 audit logs for tenant %', v_tenant_id;
  
  -- Display summary
  SELECT COUNT(*) INTO v_log_count FROM grading.audit_logs WHERE tenant_id = v_tenant_id;
  RAISE NOTICE 'Total audit logs in system: %', v_log_count;
END $$;

-- Verify the audit logs were inserted
SELECT COUNT(*) as total_audit_logs FROM grading.audit_logs;
