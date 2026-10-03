#!/usr/bin/env node

/**
 * Seed script for creating test courses, assignments, and submissions
 * Usage: node scripts/seed-test-submissions.js
 */

const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

const TENANT_ID = '550e8400-e29b-41d4-a716-446655440000';
const INSTRUCTOR_ID = '223e4567-e89b-12d3-a456-426614174001';
const STUDENT_ID = '323e4567-e89b-12d3-a456-426614174002';

async function seedTestData() {
  const client = await pool.connect();
  
  try {
    console.log('🌱 Starting test data seeding...\n');
    
    // Set tenant context
    await client.query(`SET app.current_tenant_id = '${TENANT_ID}'`);

    // 1. Create test courses
    console.log('📚 Creating test courses...');
    const courseResults = await client.query(`
      INSERT INTO grading.courses (
        id, tenant_id, code, title, description, created_by_user_id, status, created_at, updated_at
      ) VALUES
      (
        '423e4567-e89b-12d3-a456-426614174100',
        $1,
        'CS101',
        'Introduction to Computer Science',
        'Learn the fundamentals of computer science and programming',
        $2,
        'ACTIVE',
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      ),
      (
        '423e4567-e89b-12d3-a456-426614174101',
        $1,
        'MATH201',
        'Calculus II',
        'Advanced calculus concepts including integration and series',
        $2,
        'ACTIVE',
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
      ON CONFLICT DO NOTHING
      RETURNING id, code, title;
    `, [TENANT_ID, INSTRUCTOR_ID]);
    
    console.log(`✓ Created ${courseResults.rows.length} courses`);
    courseResults.rows.forEach(course => {
      console.log(`  - ${course.code}: ${course.title}`);
    });

    // 2. Create course enrollments
    console.log('\n👥 Creating course enrollments...');
    const enrollmentResults = await client.query(`
      INSERT INTO grading.course_enrollments (
        id, tenant_id, course_id, user_id, enrollment_status, enrolled_at, created_at, updated_at
      ) VALUES
      (
        '523e4567-e89b-12d3-a456-426614174100',
        $1,
        '423e4567-e89b-12d3-a456-426614174100',
        $2,
        'ACTIVE',
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      ),
      (
        '523e4567-e89b-12d3-a456-426614174101',
        $1,
        '423e4567-e89b-12d3-a456-426614174101',
        $2,
        'ACTIVE',
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
      ON CONFLICT DO NOTHING
      RETURNING id;
    `, [TENANT_ID, STUDENT_ID]);
    
    console.log(`✓ Created ${enrollmentResults.rows.length} enrollments`);

    // 3. Create test assignments
    console.log('\n📝 Creating test assignments...');
    const assignmentResults = await client.query(`
      INSERT INTO grading.assignments (
        id, tenant_id, course_id, title, description, type, point_value, 
        soft_deadline, hard_deadline, allow_incremental, late_penalty_percent,
        published_at, created_by_user_id, created_at, updated_at
      ) VALUES
      (
        '623e4567-e89b-12d3-a456-426614174100',
        $1,
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
        $2,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      ),
      (
        '623e4567-e89b-12d3-a456-426614174101',
        $1,
        '423e4567-e89b-12d3-a456-426614174100',
        'Essay: History of Computer Science',
        'Write a 2-3 page essay on the history of computer science.',
        'ESSAY',
        100,
        (CURRENT_TIMESTAMP + INTERVAL '14 days'),
        (CURRENT_TIMESTAMP + INTERVAL '21 days'),
        false,
        5,
        CURRENT_TIMESTAMP,
        $2,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      ),
      (
        '623e4567-e89b-12d3-a456-426614174102',
        $1,
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
        $2,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
      ON CONFLICT DO NOTHING
      RETURNING id, title, type;
    `, [TENANT_ID, INSTRUCTOR_ID]);
    
    console.log(`✓ Created ${assignmentResults.rows.length} assignments`);
    assignmentResults.rows.forEach(assignment => {
      console.log(`  - ${assignment.title} (${assignment.type})`);
    });

    // 4. Create test submissions
    console.log('\n📤 Creating test submissions...');
    const submissionResults = await client.query(`
      INSERT INTO grading.submissions (
        id, tenant_id, assignment_id, student_id, version, file_path, file_type,
        is_late, is_incremental, submitted_at, created_at, updated_at
      ) VALUES
      (
        '723e4567-e89b-12d3-a456-426614174100',
        $1,
        '623e4567-e89b-12d3-a456-426614174100',
        $2,
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
        $1,
        '623e4567-e89b-12d3-a456-426614174100',
        $2,
        2,
        's3://submissions/CS101/hello_world_v2.py',
        'text/plain',
        false,
        true,
        (CURRENT_TIMESTAMP + INTERVAL '5 days'),
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      ),
      (
        '723e4567-e89b-12d3-a456-426614174102',
        $1,
        '623e4567-e89b-12d3-a456-426614174101',
        $2,
        1,
        's3://submissions/CS101/essay_history.docx',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        true,
        false,
        (CURRENT_TIMESTAMP + INTERVAL '25 days'),
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      ),
      (
        '723e4567-e89b-12d3-a456-426614174103',
        $1,
        '623e4567-e89b-12d3-a456-426614174102',
        $2,
        1,
        's3://submissions/MATH201/problem_set_1.pdf',
        'application/pdf',
        false,
        false,
        (CURRENT_TIMESTAMP - INTERVAL '2 days'),
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
      ON CONFLICT DO NOTHING
      RETURNING id, assignment_id, version, is_late;
    `, [TENANT_ID, STUDENT_ID]);
    
    console.log(`✓ Created ${submissionResults.rows.length} submissions`);
    submissionResults.rows.forEach((sub, i) => {
      const status = sub.is_late ? '⏰ LATE' : '✓ ON TIME';
      console.log(`  - Submission ${i + 1}: Version ${sub.version} ${status}`);
    });

    // 5. Verify data
    console.log('\n📊 Verification Summary:');
    
    const coursesCount = await client.query(
      'SELECT COUNT(*) as count FROM grading.courses WHERE tenant_id = $1',
      [TENANT_ID]
    );
    
    const assignmentsCount = await client.query(
      'SELECT COUNT(*) as count FROM grading.assignments WHERE tenant_id = $1',
      [TENANT_ID]
    );
    
    const submissionsCount = await client.query(
      'SELECT COUNT(*) as count FROM grading.submissions WHERE tenant_id = $1',
      [TENANT_ID]
    );
    
    const enrollmentsCount = await client.query(
      'SELECT COUNT(*) as count FROM grading.course_enrollments WHERE tenant_id = $1',
      [TENANT_ID]
    );

    console.log(`  📚 Courses: ${coursesCount.rows[0].count}`);
    console.log(`  📝 Assignments: ${assignmentsCount.rows[0].count}`);
    console.log(`  📤 Submissions: ${submissionsCount.rows[0].count}`);
    console.log(`  👥 Enrollments: ${enrollmentsCount.rows[0].count}`);

    console.log('\n✅ Test data seeding completed successfully!');
    console.log('\n💡 You can now:');
    console.log('  1. Login as instructor: teacher1@deepgrader.com');
    console.log('  2. Navigate to CS101 course');
    console.log('  3. Click "View Assignments" to see the assignments');
    console.log('  4. Click "View Details" on any assignment');
    console.log('  5. Click "View Submissions" to see student submissions');

  } catch (error) {
    console.error('❌ Error seeding test data:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seedTestData().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
