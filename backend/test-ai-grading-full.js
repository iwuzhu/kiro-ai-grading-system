#!/usr/bin/env node
/**
 * Full AI Grading Test with Data Seeding
 * 
 * This script:
 * 1. Creates test submissions and assignments directly via API
 * 2. Calls AI grading endpoint
 * 3. Verifies the results
 */

const http = require('http');
const crypto = require('crypto');
require('dotenv').config({ path: '.env.local' });

// Configuration
const API_URL = 'http://localhost:3001';
const TENANT_ID = '550e8400-e29b-41d4-a716-446655440000';
const INSTRUCTOR_ID = '223e4567-e89b-12d3-a456-426614174001';
const STUDENT_ID = '323e4567-e89b-12d3-a456-426614174002';
const JWT_SECRET = process.env.JWT_SECRET || 'e4bd51ddf172769c442b126626bea54c74be0aa7f3d4dc4de3e83a01b226ab69af42e3ff2571d3ef9838f5a04ab957efdee1c27074a7cea33eb1b50247235bfc';

/**
 * Generate JWT token
 */
function generateToken(userId, role = 'INSTRUCTOR') {
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: userId,
    email: role === 'INSTRUCTOR' ? 'instructor@test.edu' : 'student@test.edu',
    tenant_id: TENANT_ID,
    role,
    permissions: role === 'INSTRUCTOR' ? ['grades:write'] : [],
    type: 'access',
    iat: now,
    exp: now + 3600
  };

  const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  const message = headerB64 + '.' + payloadB64;
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(message)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  return message + '.' + signature;
}

/**
 * Make HTTP request
 */
function makeRequest(method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(body);
    const url = new URL(path, API_URL);

    const options = {
      hostname: url.hostname,
      port: url.port || 3001,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-ID': TENANT_ID,
        ...headers,
      }
    };

    if (bodyStr) {
      options.headers['Content-Length'] = Buffer.byteLength(bodyStr);
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function runFullTest() {
  console.log('═'.repeat(70));
  console.log(' AI GRADING FULL TEST - Create Data & Test Grading');
  console.log('═'.repeat(70) + '\n');

  const instructorToken = generateToken(INSTRUCTOR_ID, 'INSTRUCTOR');

  try {
    // Step 1: Create a course
    console.log('Step 1: Creating test course...');
    const courseRes = await makeRequest('POST', '/api/v1/courses', {
      code: 'TEST101',
      title: 'Test Course for AI Grading',
      description: 'Testing AI grading functionality'
    }, {
      'Authorization': `Bearer ${instructorToken}`
    });

    if (!courseRes.data.success) {
      throw new Error(`Failed to create course: ${courseRes.data.error?.message}`);
    }
    const courseId = courseRes.data.data.id;
    console.log(`✓ Course created: ${courseId}\n`);

    // Step 2: Create an assignment
    console.log('Step 2: Creating test assignment...');
    const assignmentRes = await makeRequest('POST', `/api/v1/courses/${courseId}/assignments`, {
      title: 'Essay: Artificial Intelligence in Education',
      description: 'Write a 500-word essay on how AI can improve educational outcomes. Include specific examples.',
      type: 'ESSAY',
      point_value: 100,
      allow_incremental: false
    }, {
      'Authorization': `Bearer ${instructorToken}`
    });

    if (!assignmentRes.data.success) {
      throw new Error(`Failed to create assignment: ${assignmentRes.data.error?.message}`);
    }
    const assignmentId = assignmentRes.data.data.id;
    console.log(`✓ Assignment created: ${assignmentId}\n`);

    // Step 3: Create a submission with content
    console.log('Step 3: Creating test submission...');
    const studentToken = generateToken(STUDENT_ID, 'STUDENT');
    const submissionContent = `Artificial Intelligence in Education

Artificial Intelligence (AI) has the potential to revolutionize education by personalizing learning experiences and providing timely feedback to students. In this essay, I explore how AI can improve educational outcomes.

First, AI enables personalized learning paths. Traditional classrooms use a one-size-fits-all approach, but AI systems can adapt to individual student needs. For example, adaptive learning platforms like DreamBox and Khan Academy use AI to identify knowledge gaps and suggest targeted practice problems. This personalization leads to better engagement and improved learning outcomes.

Second, AI provides instant feedback. Students benefit greatly from immediate responses to their work. AI tutoring systems can grade assignments, provide explanations, and suggest improvements in real-time. This is particularly valuable for mathematics and programming assignments where multiple solution approaches exist.

Third, AI can assist teachers with administrative tasks. By automating grading and administrative work, AI frees teachers to focus on mentoring and providing individual attention. This increases teaching effectiveness and student satisfaction.

However, AI in education also presents challenges. Issues around data privacy, algorithmic bias, and the importance of human connection in learning must be carefully addressed.

In conclusion, while AI has the potential to significantly improve educational outcomes through personalization and feedback, successful implementation requires careful consideration of ethical issues and a human-centered approach that values the teacher-student relationship.`;

    const submissionRes = await makeRequest('POST', `/api/v1/assignments/${assignmentId}/submissions`, {
      content: submissionContent
    }, {
      'Authorization': `Bearer ${studentToken}`
    });

    if (!submissionRes.data.success) {
      throw new Error(`Failed to create submission: ${submissionRes.data.error?.message}`);
    }
    const submissionId = submissionRes.data.data.id;
    console.log(`✓ Submission created: ${submissionId}\n`);

    // Step 4: Test AI grading
    console.log('Step 4: Testing AI grading endpoint...');
    console.log('Calling: POST /api/v1/grading/ai-grade\n');

    const gradeRes = await makeRequest('POST', '/api/v1/grading/ai-grade', {
      submission_id: submissionId,
      assignment_id: assignmentId
    }, {
      'Authorization': `Bearer ${instructorToken}`
    });

    console.log(`HTTP Status: ${gradeRes.status}\n`);

    if (!gradeRes.data.success) {
      console.error('❌ AI GRADING FAILED');
      console.error('Error:', gradeRes.data.error);
      throw new Error(gradeRes.data.error?.message);
    }

    const grade = gradeRes.data.data;
    console.log('✅ AI GRADING SUCCESSFUL\n');
    console.log('Grade Data:');
    console.log(JSON.stringify(grade, null, 2) + '\n');

    // Step 5: Verify results
    console.log('═'.repeat(70));
    console.log('VERIFICATION');
    console.log('═'.repeat(70) + '\n');

    const checks = [
      {
        name: 'AI Score (0-100)',
        check: grade.ai_score >= 0 && grade.ai_score <= 100,
        value: `${grade.ai_score}`
      },
      {
        name: 'Confidence (0-100)',
        check: grade.confidence >= 0 && grade.confidence <= 100,
        value: `${grade.confidence}%`
      },
      {
        name: 'Feedback Length',
        check: grade.feedback && grade.feedback.length >= 20,
        value: `${grade.feedback?.length || 0} chars`
      },
      {
        name: 'Strengths',
        check: grade.strengths && grade.strengths.length >= 1,
        value: `${grade.strengths?.length || 0} identified`
      },
      {
        name: 'Improvements',
        check: grade.improvements && grade.improvements.length >= 1,
        value: `${grade.improvements?.length || 0} suggested`
      },
      {
        name: 'Status',
        check: grade.status === 'AI_GRADED',
        value: grade.status
      },
      {
        name: 'AI Provider',
        check: grade.aiProvider === 'openai',
        value: grade.aiProvider
      }
    ];

    checks.forEach(check => {
      const icon = check.check ? '✓' : '✗';
      console.log(`${icon} ${check.name}: ${check.value}`);
    });

    const allPassed = checks.every(c => c.check);
    console.log('\n' + '═'.repeat(70));
    console.log(allPassed ? '✅ ALL CHECKS PASSED' : '❌ SOME CHECKS FAILED');
    console.log('═'.repeat(70) + '\n');

    if (allPassed) {
      console.log('🎉 AI Grading is working correctly!\n');
      console.log('Key Features Verified:');
      console.log('  ✓ AI generates score (0-100)');
      console.log('  ✓ Confidence score tracked');
      console.log('  ✓ Detailed feedback provided');
      console.log('  ✓ Strengths identified');
      console.log('  ✓ Improvement areas suggested');
      console.log('  ✓ Grade stored with correct status');
      console.log('  ✓ OpenAI provider working\n');
    }

    return allPassed;

  } catch (error) {
    console.error('\n❌ TEST FAILED');
    console.error('Error:', error.message);
    console.error('\nTroubleshooting:');
    console.error('  1. Is backend running? npm run start');
    console.error('  2. Is API key set? echo $env:TECOpenAIAPIKey');
    console.error('  3. Check backend logs for detailed errors');
    return false;
  }
}

runFullTest()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
