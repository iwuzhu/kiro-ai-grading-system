import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { Assignment } from '../../src/domain/entities/assignment.entity';
import { Submission } from '../../src/domain/entities/submission.entity';
import { Grade } from '../../src/domain/entities/grade.entity';
import { User } from '../../src/domain/entities/user.entity';
import { Course } from '../../src/domain/entities/course.entity';
import { Institution } from '../../src/domain/entities/institution.entity';

/**
 * Integration Tests for Assignment & Submission Workflows
 *
 * Tests end-to-end workflows:
 * 1. Create assignment with questions
 * 2. Student submits assignment
 * 3. Grade assignment
 * 4. Multiple submissions (if incremental enabled)
 */
describe('Assignment & Submission Workflows (Integration)', () => {
  let app: INestApplication;
  let instructorToken: string;
  let studentToken: string;
  let tenantId: string;
  let courseId: string;
  let assignmentId: string;
  let submissionId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Setup: Create test data', () => {
    it('should create institution and get tenant ID', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/institutions')
        .send({
          name: 'Test University',
          domain: 'test.edu',
          timezone: 'America/New_York',
        });

      expect(response.status).toBe(201);
      expect(response.body.data).toHaveProperty('tenant_id');
      tenantId = response.body.data.tenant_id;
    });

    it('should register instructor', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/users/register')
        .send({
          email: 'instructor@test.edu',
          password: 'Password123!',
          name: 'Dr. Teacher',
          role: 'INSTRUCTOR',
          tenantId,
        });

      expect(response.status).toBe(201);
      instructorToken = response.body.data.accessToken;
    });

    it('should register student', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/users/register')
        .send({
          email: 'student@test.edu',
          password: 'Password123!',
          name: 'John Student',
          role: 'STUDENT',
          tenantId,
        });

      expect(response.status).toBe(201);
      studentToken = response.body.data.accessToken;
    });

    it('should create course', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/institutions/${tenantId}/courses`)
        .set('Authorization', `Bearer ${instructorToken}`)
        .send({
          code: 'CS101',
          title: 'Introduction to Computer Science',
          semester: 'Fall 2024',
        });

      expect(response.status).toBe(201);
      courseId = response.body.data.id;
    });

    it('should enroll student in course', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/institutions/${tenantId}/courses/${courseId}/enroll`)
        .set('Authorization', `Bearer ${instructorToken}`)
        .send({
          email: 'student@test.edu',
          role: 'STUDENT',
        });

      expect(response.status).toBe(200);
    });
  });

  describe('Create Assignment with Questions', () => {
    it('should create assignment with multiple questions', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/assignments')
        .set('Authorization', `Bearer ${instructorToken}`)
        .send({
          courseId,
          title: 'Midterm Exam',
          description: 'Comprehensive midterm examination',
          pointValue: 100,
          allowIncremental: false,
          content: {
            questions: [
              {
                id: 'q1',
                type: 'MULTIPLE_CHOICE',
                prompt: 'What is the largest prime number less than 10?',
                pointValue: 20,
                options: [
                  { label: 'A', text: '5' },
                  { label: 'B', text: '7' },
                  { label: 'C', text: '9' },
                ],
                correctAnswer: 'B',
                createdAt: new Date(),
              },
              {
                id: 'q2',
                type: 'SHORT_ANSWER',
                prompt: 'Explain the concept of recursion.',
                pointValue: 30,
                expectedAnswer: 'A function calling itself',
                minWords: 10,
                maxWords: 100,
                createdAt: new Date(),
              },
              {
                id: 'q3',
                type: 'ESSAY',
                prompt: 'Discuss the impact of artificial intelligence on society.',
                pointValue: 50,
                minWords: 200,
                maxWords: 500,
                createdAt: new Date(),
              },
            ],
          },
        });

      expect(response.status).toBe(201);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.content.questions).toHaveLength(3);
      assignmentId = response.body.data.id;
    });

    it('should not allow creating assignment with mismatched point values', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/assignments')
        .set('Authorization', `Bearer ${instructorToken}`)
        .send({
          courseId,
          title: 'Quiz',
          description: 'Quick quiz',
          pointValue: 100, // Doesn't match sum of questions (40)
          content: {
            questions: [
              {
                id: 'q1',
                type: 'MULTIPLE_CHOICE',
                prompt: 'Question 1?',
                pointValue: 20,
                options: [
                  { label: 'A', text: 'Yes' },
                  { label: 'B', text: 'No' },
                ],
                correctAnswer: 'A',
                createdAt: new Date(),
              },
              {
                id: 'q2',
                type: 'SHORT_ANSWER',
                prompt: 'Question 2?',
                pointValue: 20,
                expectedAnswer: 'Answer',
                createdAt: new Date(),
              },
            ],
          },
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Student Submission Workflow', () => {
    it('should allow student to view published assignment', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/assignments/${assignmentId}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe(assignmentId);
      expect(response.body.data.content.questions).toHaveLength(3);
    });

    it('should create submission with answers', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/submissions')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          assignmentId,
          content: {
            answers: [
              {
                questionId: 'q1',
                type: 'MULTIPLE_CHOICE',
                selectedOption: 'B',
                submittedAt: new Date(),
              },
              {
                questionId: 'q2',
                type: 'SHORT_ANSWER',
                answer: 'Recursion is when a function calls itself with modified parameters',
                wordCount: 11,
                submittedAt: new Date(),
              },
              {
                questionId: 'q3',
                type: 'ESSAY',
                essay:
                  'AI has revolutionized multiple sectors including healthcare, finance, and transportation. ' +
                  'While it brings efficiency and innovation, it also raises concerns about job displacement and ethical considerations. ' +
                  'Society must balance technological progress with responsible AI governance.',
                wordCount: 45,
                submittedAt: new Date(),
              },
            ],
            startedAt: new Date(),
            completedAt: new Date(),
          },
        });

      expect(response.status).toBe(201);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.version).toBe(1);
      submissionId = response.body.data.id;
    });

    it('should not allow resubmission if incremental disabled', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/submissions')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          assignmentId,
          content: {
            answers: [
              {
                questionId: 'q1',
                type: 'MULTIPLE_CHOICE',
                selectedOption: 'A',
                submittedAt: new Date(),
              },
            ],
            startedAt: new Date(),
            completedAt: new Date(),
          },
        });

      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain('multiple submissions');
    });

    it('should retrieve student submission', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/submissions/${submissionId}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe(submissionId);
      expect(response.body.data.content.answers).toHaveLength(3);
    });
  });

  describe('Grading Workflow', () => {
    it('should grade submission with AI', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/submissions/${submissionId}/grade`)
        .set('Authorization', `Bearer ${instructorToken}`)
        .send({
          gradeAll: true,
          useAI: true,
        });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('grades');
      expect(Array.isArray(response.body.data.grades)).toBe(true);
    });

    it('should retrieve grades for submission', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/submissions/${submissionId}/grades`)
        .set('Authorization', `Bearer ${instructorToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);

      // Verify grade structure
      const grade = response.body.data[0];
      expect(grade).toHaveProperty('score');
      expect(grade).toHaveProperty('feedback');
      expect(grade).toHaveProperty('status');
    });

    it('should allow instructor to override grade', async () => {
      // Get the first grade
      const gradesResponse = await request(app.getHttpServer())
        .get(`/api/v1/submissions/${submissionId}/grades`)
        .set('Authorization', `Bearer ${instructorToken}`);

      const gradeId = gradesResponse.body.data[0].id;

      const response = await request(app.getHttpServer())
        .patch(`/api/v1/grades/${gradeId}/override`)
        .set('Authorization', `Bearer ${instructorToken}`)
        .send({
          newScore: 95,
          rationale: 'Exceptional work, demonstrated mastery of concepts',
        });

      expect(response.status).toBe(200);
      expect(response.body.data.score).toBe(95);
      expect(response.body.data.status).toBe('OVERRIDDEN');
    });
  });

  describe('Incremental Submission Workflow', () => {
    let incrementalAssignmentId: string;
    let firstSubmissionId: string;
    let secondSubmissionId: string;

    it('should create assignment allowing incremental submissions', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/assignments')
        .set('Authorization', `Bearer ${instructorToken}`)
        .send({
          courseId,
          title: 'Project - Incremental',
          description: 'Project with incremental submissions',
          pointValue: 50,
          allowIncremental: true,
          content: {
            questions: [
              {
                id: 'proj-q1',
                type: 'CODE',
                prompt: 'Write a sorting algorithm',
                pointValue: 50,
                language: 'python',
                createdAt: new Date(),
              },
            ],
          },
        });

      expect(response.status).toBe(201);
      incrementalAssignmentId = response.body.data.id;
    });

    it('should allow first submission', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/submissions')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          assignmentId: incrementalAssignmentId,
          content: {
            answers: [
              {
                questionId: 'proj-q1',
                type: 'CODE',
                code: 'def bubble_sort(arr):\n    pass',
                language: 'python',
                submittedAt: new Date(),
              },
            ],
            startedAt: new Date(),
            completedAt: new Date(),
          },
        });

      expect(response.status).toBe(201);
      expect(response.body.data.version).toBe(1);
      firstSubmissionId = response.body.data.id;
    });

    it('should allow second submission (incremental)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/submissions')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          assignmentId: incrementalAssignmentId,
          content: {
            answers: [
              {
                questionId: 'proj-q1',
                type: 'CODE',
                code: 'def bubble_sort(arr):\n    for i in range(len(arr)):\n        for j in range(len(arr)-1-i):\n            if arr[j] > arr[j+1]:\n                arr[j], arr[j+1] = arr[j+1], arr[j]\n    return arr',
                language: 'python',
                submittedAt: new Date(),
              },
            ],
            startedAt: new Date(),
            completedAt: new Date(),
          },
        });

      expect(response.status).toBe(201);
      expect(response.body.data.version).toBe(2);
      secondSubmissionId = response.body.data.id;
    });

    it('should retrieve all submission versions for student', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/submissions?assignmentId=${incrementalAssignmentId}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].version).toBe(1);
      expect(response.body.data[1].version).toBe(2);
    });
  });

  describe('Validation & Error Handling', () => {
    it('should reject submission with invalid answer format', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/submissions')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          assignmentId,
          content: {
            answers: [
              {
                questionId: 'q1',
                type: 'MULTIPLE_CHOICE',
                selectedOption: 'INVALID', // Invalid option
                submittedAt: new Date(),
              },
            ],
            startedAt: new Date(),
            completedAt: new Date(),
          },
        });

      expect(response.status).toBe(400);
    });

    it('should reject submission after hard deadline', async () => {
      // Create assignment with past hard deadline
      const pastDeadline = new Date(Date.now() - 1000 * 60 * 60); // 1 hour ago

      const assignmentResponse = await request(app.getHttpServer())
        .post('/api/v1/assignments')
        .set('Authorization', `Bearer ${instructorToken}`)
        .send({
          courseId,
          title: 'Expired Assignment',
          description: 'Assignment with past deadline',
          pointValue: 50,
          hardDeadline: pastDeadline,
          content: {
            questions: [
              {
                id: 'exp-q1',
                type: 'MULTIPLE_CHOICE',
                prompt: 'Question?',
                pointValue: 50,
                options: [
                  { label: 'A', text: 'Yes' },
                  { label: 'B', text: 'No' },
                ],
                correctAnswer: 'A',
                createdAt: new Date(),
              },
            ],
          },
        });

      const expiredAssignmentId = assignmentResponse.body.data.id;

      const response = await request(app.getHttpServer())
        .post('/api/v1/submissions')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          assignmentId: expiredAssignmentId,
          content: {
            answers: [
              {
                questionId: 'exp-q1',
                type: 'MULTIPLE_CHOICE',
                selectedOption: 'A',
                submittedAt: new Date(),
              },
            ],
            startedAt: new Date(),
            completedAt: new Date(),
          },
        });

      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain('deadline');
    });
  });
});
