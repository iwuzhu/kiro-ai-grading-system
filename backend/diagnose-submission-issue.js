/**
 * Diagnostic Script: Check why teacher can't see student submissions
 * Compares:
 * - Teacher's tenant_id
 * - Student's tenant_id
 * - Assignment's tenant_id
 * - Submission's tenant_id
 */

require('dotenv').config({ path: '.env.local' });
const { DataSource } = require('typeorm');

async function diagnose() {
  console.log('=== SUBMISSION VISIBILITY DIAGNOSIS ===\n');

  const config = {
    type: 'postgres',
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    schema: 'grading',
    logging: false,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  };

  const dataSource = new DataSource(config);

  try {
    await dataSource.initialize();
    console.log('✓ Connected to database\n');

    // Get test users
    console.log('--- USERS ---');
    const users = await dataSource.query(`
      SELECT id, email, role, tenant_id FROM grading.users 
      WHERE email IN ('teacher1@deepgrader.com', 'student1@deepgrader.com')
      ORDER BY role DESC
    `);

    if (users.length === 0) {
      console.log('❌ No test users found!\n');
      return;
    }

    const teacher = users.find(u => u.role === 'INSTRUCTOR');
    const student = users.find(u => u.role === 'STUDENT');

    if (!teacher) console.log('❌ No teacher found');
    if (!student) console.log('❌ No student found');

    if (teacher) {
      console.log(`Teacher: ${teacher.email}`);
      console.log(`  ID: ${teacher.id}`);
      console.log(`  Tenant: ${teacher.tenant_id}`);
    }
    console.log();

    if (student) {
      console.log(`Student: ${student.email}`);
      console.log(`  ID: ${student.id}`);
      console.log(`  Tenant: ${student.tenant_id}`);
    }
    console.log();

    // Check tenant match
    if (teacher && student) {
      if (teacher.tenant_id === student.tenant_id) {
        console.log('✓ Teacher and student have SAME tenant_id\n');
      } else {
        console.log('❌ PROBLEM: Teacher and student have DIFFERENT tenant_ids!\n');
      }
    }

    // Get assignments created by teacher
    if (teacher) {
      console.log('--- ASSIGNMENTS ---');
      const assignments = await dataSource.query(`
        SELECT id, title, tenant_id, created_by_user_id 
        FROM grading.assignments
        WHERE tenant_id = $1 AND created_by_user_id = $2
        LIMIT 5
      `, [teacher.tenant_id, teacher.id]);

      if (assignments.length === 0) {
        console.log(`❌ No assignments found for teacher (${teacher.id}) in tenant (${teacher.tenant_id})\n`);
      } else {
        console.log(`Found ${assignments.length} assignments:\n`);
        
        for (const assignment of assignments) {
          console.log(`Assignment: ${assignment.title}`);
          console.log(`  ID: ${assignment.id}`);
          console.log(`  Tenant: ${assignment.tenant_id}`);
          console.log(`  Created by: ${assignment.created_by_user_id}`);

          // Check submissions for this assignment
          const submissions = await dataSource.query(`
            SELECT id, student_id, version, tenant_id, submitted_at, file_path
            FROM grading.submissions
            WHERE assignment_id = $1
            ORDER BY submitted_at DESC
          `, [assignment.id]);

          if (submissions.length === 0) {
            console.log(`  Submissions: NONE`);
          } else {
            console.log(`  Submissions: ${submissions.length}`);
            for (const sub of submissions) {
              console.log(`    - ID: ${sub.id}`);
              console.log(`      Student: ${sub.student_id}`);
              console.log(`      Version: ${sub.version}`);
              console.log(`      Tenant: ${sub.tenant_id}`);
              console.log(`      Submitted: ${sub.submitted_at}`);
              console.log(`      File: ${sub.file_path ? '✓' : '✗'}`);
              
              // Check if this submission's tenant matches teacher's tenant
              if (sub.tenant_id !== teacher.tenant_id) {
                console.log(`      ⚠️  WARNING: Submission tenant (${sub.tenant_id}) != Teacher tenant (${teacher.tenant_id})`);
              }
              
              // Check if student owns this submission
              if (student && sub.student_id === student.id) {
                console.log(`      ✓ Submitted by test student`);
              }
            }
          }
          console.log();
        }
      }
    }

    // Raw query showing what the API endpoint would see
    if (teacher && assignments.length > 0) {
      const firstAssignment = assignments[0];
      console.log('--- API ENDPOINT SIMULATION ---');
      console.log(`Query: getAssignmentSubmissions(tenantId="${teacher.tenant_id}", assignmentId="${firstAssignment.id}")\n`);
      
      const query = `
        SELECT s.id, s.student_id, s.version, s.is_late, s.submitted_at, s.file_path, s.file_type
        FROM grading.submissions s
        WHERE s.tenant_id = $1 AND s.assignment_id = $2
        ORDER BY s.student_id ASC, s.version DESC
      `;

      const result = await dataSource.query(query, [teacher.tenant_id, firstAssignment.id]);
      
      if (result.length === 0) {
        console.log('❌ API would return: 0 submissions (EMPTY)\n');
        
        // Debug: check if submissions exist but with different tenant
        const allSubmissions = await dataSource.query(`
          SELECT id, tenant_id, student_id FROM grading.submissions
          WHERE assignment_id = $1
        `, [firstAssignment.id]);
        
        if (allSubmissions.length > 0) {
          console.log('⚠️  DEBUG: Submissions exist for this assignment, but with different tenant_id!');
          for (const sub of allSubmissions) {
            console.log(`  - Tenant: ${sub.tenant_id}, Student: ${sub.student_id}`);
          }
        }
      } else {
        console.log(`✓ API would return: ${result.length} submissions\n`);
        for (const sub of result) {
          console.log(`  - ID: ${sub.id}, Student: ${sub.student_id}, Version: ${sub.version}`);
        }
      }
    }

  } catch (error) {
    console.error('❌ ERROR:', error.message);
  } finally {
    await dataSource.destroy();
  }
}

diagnose();
