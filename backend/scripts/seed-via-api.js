#!/usr/bin/env node

/**
 * Seed test data via REST API
 * This approach doesn't require direct database access
 * Usage: node scripts/seed-via-api.js
 */

require('dotenv').config({ path: '.env.local' });

const API_URL = process.env.API_URL || 'http://localhost:3001/api/v1';
const INSTRUCTOR_EMAIL = 'teacher1@deepgrader.com';
const INSTRUCTOR_PASSWORD = 'Password123!';
const STUDENT_EMAIL = 'student1@deepgrader.com';
const STUDENT_PASSWORD = 'Password123!';

let instructorToken = null;
let studentToken = null;
let instructorId = null;
let studentId = null;

async function login(email, password) {
  try {
    console.log(`🔐 Logging in as ${email}...`);
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      throw new Error(`Login failed: ${response.status}`);
    }

    const data = await response.json();
    console.log(`✓ Logged in successfully`);
    return {
      token: data.data?.accessToken,
      userId: data.data?.user?.id,
    };
  } catch (error) {
    console.error(`❌ Login failed for ${email}:`, error.message);
    return null;
  }
}

async function createCourse(token, courseData) {
  try {
    console.log(`📚 Creating course: ${courseData.title}...`);
    const response = await fetch(`${API_URL}/courses`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(courseData),
    });

    if (!response.ok) {
      throw new Error(`Failed to create course: ${response.status}`);
    }

    const data = await response.json();
    console.log(`✓ Course created: ${data.data?.id}`);
    return data.data;
  } catch (error) {
    console.error(`❌ Error creating course:`, error.message);
    return null;
  }
}

async function enrollStudent(token, courseId, studentId) {
  try {
    console.log(`👥 Enrolling student in course...`);
    const response = await fetch(`${API_URL}/courses/${courseId}/enrollments`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ user_id: studentId, enrollment_status: 'ACTIVE' }),
    });

    if (!response.ok) {
      throw new Error(`Failed to enroll student: ${response.status}`);
    }

    console.log(`✓ Student enrolled`);
    return true;
  } catch (error) {
    console.error(`❌ Error enrolling student:`, error.message);
    return false;
  }
}

async function createAssignment(token, courseId, assignmentData) {
  try {
    console.log(`📝 Creating assignment: ${assignmentData.title}...`);
    const response = await fetch(`${API_URL}/courses/${courseId}/assignments`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(assignmentData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Failed to create assignment: ${response.status} - ${errorData.error?.message || ''}`);
    }

    const data = await response.json();
    console.log(`✓ Assignment created: ${data.data?.id}`);
    return data.data;
  } catch (error) {
    console.error(`❌ Error creating assignment:`, error.message);
    return null;
  }
}

async function publishAssignment(token, assignmentId) {
  try {
    console.log(`📤 Publishing assignment...`);
    const response = await fetch(`${API_URL}/courses/assignments/${assignmentId}/publish`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to publish: ${response.status}`);
    }

    console.log(`✓ Assignment published`);
    return true;
  } catch (error) {
    console.error(`❌ Error publishing assignment:`, error.message);
    return false;
  }
}

async function createSubmission(token, assignmentId, submissionData) {
  try {
    console.log(`📤 Creating submission...`);
    const response = await fetch(
      `${API_URL}/submissions/assignments/${assignmentId}/submit`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submissionData),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Failed to create submission: ${response.status} - ${errorData.error?.message || ''}`);
    }

    const data = await response.json();
    console.log(`✓ Submission created: ${data.data?.id}`);
    return data.data;
  } catch (error) {
    console.error(`❌ Error creating submission:`, error.message);
    return null;
  }
}

async function seedTestData() {
  console.log('🌱 Starting test data seeding via API...\n');

  // Step 1: Login
  const instructorAuth = await login(INSTRUCTOR_EMAIL, INSTRUCTOR_PASSWORD);
  if (!instructorAuth) {
    console.error('❌ Failed to authenticate instructor');
    process.exit(1);
  }
  instructorToken = instructorAuth.token;
  instructorId = instructorAuth.userId;

  const studentAuth = await login(STUDENT_EMAIL, STUDENT_PASSWORD);
  if (!studentAuth) {
    console.error('❌ Failed to authenticate student');
    process.exit(1);
  }
  studentToken = studentAuth.token;
  studentId = studentAuth.userId;

  console.log('\n📚 Creating courses and assignments...\n');

  // Step 2: Create courses
  const course1 = await createCourse(instructorToken, {
    code: 'CS101',
    title: 'Introduction to Computer Science',
    description: 'Learn the fundamentals of computer science and programming',
  });

  if (!course1) {
    console.error('❌ Failed to create first course');
    process.exit(1);
  }

  // Step 3: Enroll student in course
  await enrollStudent(instructorToken, course1.id, studentId);

  // Step 4: Create and publish assignments
  const assignment1 = await createAssignment(instructorToken, course1.id, {
    title: 'Assignment 1: Hello World Program',
    description: 'Write a simple Hello World program in Python',
    type: 'CODE',
    point_value: 50,
    soft_deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    hard_deadline: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
    allow_incremental: true,
    late_penalty_percent: 10,
  });

  if (assignment1) {
    await publishAssignment(instructorToken, assignment1.id);

    // Step 5: Create student submissions
    console.log('\n📤 Creating student submissions...\n');
    
    await createSubmission(studentToken, assignment1.id, {
      file_path: 's3://submissions/CS101/hello_world_v1.py',
      file_type: 'text/plain',
    });

    // Second submission (version 2)
    await createSubmission(studentToken, assignment1.id, {
      file_path: 's3://submissions/CS101/hello_world_v2.py',
      file_type: 'text/plain',
    });
  }

  // Create second course
  const course2 = await createCourse(instructorToken, {
    code: 'MATH201',
    title: 'Calculus II',
    description: 'Advanced calculus concepts including integration and series',
  });

  if (course2) {
    await enrollStudent(instructorToken, course2.id, studentId);

    const assignment2 = await createAssignment(instructorToken, course2.id, {
      title: 'Problem Set 1: Derivatives and Integrals',
      description: 'Solve 15 calculus problems',
      type: 'SHORT_ANSWER',
      point_value: 75,
      soft_deadline: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      hard_deadline: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      allow_incremental: false,
      late_penalty_percent: 15,
    });

    if (assignment2) {
      await publishAssignment(instructorToken, assignment2.id);

      // Create on-time submission for past assignment
      await createSubmission(studentToken, assignment2.id, {
        file_path: 's3://submissions/MATH201/problem_set_1.pdf',
        file_type: 'application/pdf',
      });
    }
  }

  console.log('\n✅ Test data seeding completed!\n');
  console.log('💡 You can now:');
  console.log('  1. Login as instructor: teacher1@deepgrader.com / Password123!');
  console.log('  2. Navigate to CS101 course');
  console.log('  3. Click "View Assignments"');
  console.log('  4. Click "View Details" on "Assignment 1: Hello World Program"');
  console.log('  5. Click "View Submissions" to see student submissions\n');
}

seedTestData().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
