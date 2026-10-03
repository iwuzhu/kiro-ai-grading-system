import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Institution } from '../../domain/entities/institution.entity';
import { User } from '../../domain/entities/user.entity';
import { Course } from '../../domain/entities/course.entity';
import { CourseEnrollment } from '../../domain/entities/course-enrollment.entity';
import { Assignment } from '../../domain/entities/assignment.entity';
import { AuditLog } from '../../domain/entities/audit-log.entity';

/**
 * Database Initialization Service
 * 
 * Runs on application startup to:
 * 1. Verify database connection with retries (5 attempts, 3-second delays)
 * 2. Create the 'grading' schema if it doesn't exist
 * 3. Synchronize database schema (creates tables from entities)
 * 4. Seed test data if SEED_DATABASE=true
 */
@Injectable()
export class DatabaseInitializationService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DatabaseInitializationService.name);

  constructor(
    private dataSource: DataSource,
    private configService: ConfigService,
  ) {}

  async onApplicationBootstrap() {
    try {
      // Verify database connection with retries
      await this.verifyDatabaseConnection();

      // Create schema
      this.logger.log('Creating grading schema...');
      await this.dataSource.query(`CREATE SCHEMA IF NOT EXISTS grading`);
      this.logger.log('✓ Grading schema ready');

      // Synchronize database schema (creates tables from entities)
      // NOTE: Disabled in development mode to prevent schema sync errors with existing data
      // Schema changes should be managed via migrations
      if (process.env.NODE_ENV === 'development') {
        this.logger.log('Schema synchronization disabled (use migrations instead)');
        // await this.dataSource.synchronize();
        // this.logger.log('✓ Database schema synchronized');
      }

      // Seed test data if enabled
      const shouldSeed = this.configService.get<string>('SEED_DATABASE', 'false') === 'true';
      if (shouldSeed) {
        try {
          this.logger.log('Seeding database with test data...');
          await this.seedTestData();
          this.logger.log('✓ Database seeding complete');
        } catch (seedError) {
          this.logger.warn(
            `Database seeding failed (continuing anyway): ${seedError.message}`,
          );
        }
      }

      // Always try to seed audit logs with raw SQL as fallback
      try {
        await this.seedAuditLogsWithRawSQL();
      } catch (seedError) {
        this.logger.warn(
          `Audit logs raw SQL seeding failed (continuing anyway): ${seedError.message}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to initialize database: ${error.message}`,
        error.stack,
      );
      // Don't exit - allow app to start even if DB init fails
      // Health endpoint will still work
    }
  }

  /**
   * Verify database connection with retries
   * Attempts connection 5 times with 3-second delays
   */
  private async verifyDatabaseConnection(): Promise<void> {
    const maxAttempts = 5;
    const delayMs = 3000;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        this.logger.log(`Verifying database connection (attempt ${attempt}/${maxAttempts})...`);
        
        // Test query to verify connection
        await this.dataSource.query('SELECT 1');
        
        this.logger.log('✓ Database connection verified');
        return;
      } catch (error) {
        if (attempt === maxAttempts) {
          throw new Error(`Failed to connect to database after ${maxAttempts} attempts: ${error.message}`);
        }
        
        this.logger.warn(`Connection attempt ${attempt} failed. Retrying in ${delayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  /**
   * Seed audit logs directly with raw SQL as fallback
   * This is a safety net when ORM-based seeding fails
   */
  private async seedAuditLogsWithRawSQL(): Promise<void> {
    try {
      // Check if institution exists
      const institutions = await this.dataSource.query(
        `SELECT id, tenant_id FROM grading.institutions LIMIT 1`
      );

      if (!institutions || institutions.length === 0) {
        this.logger.log('No institutions found for audit log seeding');
        return;
      }

      const institution = institutions[0];
      const tenantId = institution.tenant_id;

      // Check if audit logs already exist
      const logCount = await this.dataSource.query(
        `SELECT COUNT(*) as count FROM grading.audit_logs WHERE tenant_id = $1`,
        [tenantId]
      );

      if (logCount[0].count > 0) {
        this.logger.log(`✓ Audit logs already exist (${logCount[0].count} entries)`);
        return;
      }

      this.logger.log('Seeding audit logs via raw SQL...');

      // Get user IDs
      const users = await this.dataSource.query(
        `SELECT id, email FROM grading.users WHERE tenant_id = $1 AND email IN ($2, $3, $4)`,
        [tenantId, 'admin@deepgrader.com', 'teacher1@deepgrader.com', 'student1@deepgrader.com']
      );

      const userMap: Record<string, string> = {};
      users.forEach((u: any) => {
        userMap[u.email] = u.id;
      });

      if (!userMap['admin@deepgrader.com'] || !userMap['teacher1@deepgrader.com'] || !userMap['student1@deepgrader.com']) {
        this.logger.warn('Not all test users found for audit log seeding');
        return;
      }

      const adminId = userMap['admin@deepgrader.com'];
      const teacherId = userMap['teacher1@deepgrader.com'];
      const studentId = userMap['student1@deepgrader.com'];

      const sampleGradeId = '11111111-1111-1111-1111-111111111111';
      const sampleSubmissionId = '22222222-2222-2222-2222-222222222222';

      const now = new Date();

      const auditLogs = [
        [tenantId, 'user_login', adminId, 'user', adminId, JSON.stringify({ email: 'admin@deepgrader.com', ip: '192.168.1.100' }), '192.168.1.100', new Date(now.getTime() - 5 * 60 * 1000)],
        [tenantId, 'submission_received', studentId, 'submission', sampleSubmissionId, JSON.stringify({ assignmentId: '44444444-4444-4444-4444-444444444444', studentId, fileName: 'essay_final_draft.pdf', fileSize: 245632, submissionCount: 1 }), '172.16.0.10', new Date(now.getTime() - 3.5 * 60 * 60 * 1000)],
        [tenantId, 'plagiarism_scanned', null, 'submission', sampleSubmissionId, JSON.stringify({ plagiarismScore: 12, aiGenerationScore: 5, sourceMatches: 2, scanTime: 8500 }), null, new Date(now.getTime() - 2.5 * 60 * 60 * 1000)],
        [tenantId, 'grade_created', null, 'grade', sampleGradeId, JSON.stringify({ submissionId: sampleSubmissionId, score: 87, confidence: 0.92, aiProvider: 'openai', aiModel: 'gpt-4o', feedback: 'Excellent work on this assignment. Your analysis was thorough and well-articulated.', tokenCount: 1245, latency: 2340 }), null, new Date(now.getTime() - 2 * 60 * 60 * 1000)],
        [tenantId, 'grade_override', teacherId, 'grade', sampleGradeId, JSON.stringify({ originalScore: 87, overriddenScore: 92, originalConfidence: 0.92, rationale: 'Student demonstrated exceptional understanding in class discussion.', requiresApproval: false, submissionId: sampleSubmissionId }), '10.0.0.50', new Date(now.getTime() - 1.75 * 60 * 60 * 1000)],
        [tenantId, 'grade_released', teacherId, 'grade', sampleGradeId, JSON.stringify({ submissionId: sampleSubmissionId, visibleToStudent: true, includesFeedback: true }), '10.0.0.50', new Date(now.getTime() - 1.5 * 60 * 60 * 1000)],
        [tenantId, 'institution_settings_changed', adminId, 'institution', institution.id, JSON.stringify({ settingKey: 'plagiarism_threshold', previousValue: 75, newValue: 80, description: 'Increased plagiarism threshold from 75% to 80% for stricter detection' }), '192.168.1.100', new Date(now.getTime() - 4 * 60 * 60 * 1000)],
        [tenantId, 'user_role_changed', adminId, 'user', teacherId, JSON.stringify({ userId: teacherId, previousRole: 'STUDENT', newRole: 'INSTRUCTOR', reason: 'Promoted to instructor based on department request' }), '192.168.1.100', new Date(now.getTime() - 5 * 60 * 60 * 1000)],
        [tenantId, 'grade_created', null, 'grade', '55555555-5555-5555-5555-555555555555', JSON.stringify({ submissionId: '66666666-6666-6666-6666-666666666666', score: 78, confidence: 0.85, aiProvider: 'openai', aiModel: 'gpt-4o', feedback: 'Good effort overall. Consider providing more detailed analysis.', tokenCount: 1100, latency: 2100 }), null, new Date(now.getTime() - 6 * 60 * 60 * 1000)],
        [tenantId, 'user_logout', adminId, 'user', adminId, JSON.stringify({ email: 'admin@deepgrader.com', sessionDuration: 3600 }), '192.168.1.100', new Date(now.getTime() - 7 * 60 * 60 * 1000)],
      ];

      let insertedCount = 0;
      for (const log of auditLogs) {
        try {
          await this.dataSource.query(
            `INSERT INTO grading.audit_logs (tenant_id, event_type, actor_user_id, resource_type, resource_id, action_details, ip_address, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            log
          );
          insertedCount++;
        } catch (err) {
          this.logger.warn(`Failed to insert audit log: ${err.message}`);
        }
      }

      this.logger.log(`✓ Seeded ${insertedCount} audit logs via raw SQL`);
    } catch (error) {
      this.logger.warn(`Error in seedAuditLogsWithRawSQL: ${error.message}`);
    }
  }

  /**
   * Seed test data for development
   * Creates institutions, users, and sample data
   * Idempotent - safe to run multiple times
   */
  private async seedTestData(): Promise<void> {
    const institutionRepo = this.dataSource.getRepository(Institution);
    const userRepo = this.dataSource.getRepository(User);
    const courseRepo = this.dataSource.getRepository(Course);
    const enrollmentRepo = this.dataSource.getRepository(CourseEnrollment);
    const auditLogRepo = this.dataSource.getRepository(AuditLog);

    // Use the same hardcoded UUID as the auth controller for test data
    const testUniversityId = '550e8400-e29b-41d4-a716-446655440000';
    
    // Step 0: Ensure audit_logs table exists (if migration hasn't run)
    await this.ensureAuditLogsTableExists();

    // Step 1: Ensure test institution exists
    let institution = await this.ensureTestInstitution(institutionRepo, testUniversityId);

    // Ensure institution was found/created
    if (!institution) {
      throw new Error('Test institution could not be created or found');
    }

    // Step 2: Create test users
    await this.createTestUsers(userRepo, institution);

    // Step 3: Create test courses and enrollments
    const courseCreations = await this.findCreatedUsers(userRepo, institution);
    const courses = await this.createTestCoursesAndEnrollments(
      courseRepo,
      enrollmentRepo,
      institution,
      courseCreations
    );

    // Step 3.5: Create test assignments for courses
    const assignmentRepo = this.dataSource.getRepository(Assignment);
    if (courses.length > 0) {
      await this.createTestAssignments(
        assignmentRepo,
        institution,
        courseCreations.teacher,
        courses
      );
    }

    // Step 4: Seed audit logs
    await this.seedAuditLogs(auditLogRepo, userRepo, institution);

    this.logger.log('✓ Test data seeding complete');
  }

  /**
   * Ensure audit_logs table exists (fallback if migration hasn't run)
   */
  private async ensureAuditLogsTableExists(): Promise<void> {
    try {
      // Check if table exists
      const tableExists = await this.dataSource.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'grading' 
          AND table_name = 'audit_logs'
        )
      `);

      if (tableExists[0].exists) {
        this.logger.log('✓ audit_logs table already exists');
        return;
      }

      this.logger.log('Creating audit_logs table...');

      // Create the table
      // Note: tenant_id is stored as a value, not a foreign key, for flexibility
      // Row-Level Security policies enforce tenant isolation
      await this.dataSource.query(`
        CREATE TABLE grading.audit_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id UUID NOT NULL,
          event_type VARCHAR(100) NOT NULL,
          actor_user_id UUID REFERENCES grading.users(id) ON DELETE SET NULL,
          resource_type VARCHAR(100),
          resource_id UUID,
          action_details JSONB,
          ip_address INET,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          CONSTRAINT audit_logs_tenant_not_null CHECK (tenant_id IS NOT NULL)
        )
      `);

      // Create indices
      await this.dataSource.query(`
        CREATE INDEX IF NOT EXISTS idx_grading_audit_logs_tenant_event 
        ON grading.audit_logs(tenant_id, event_type, created_at DESC)
      `);

      await this.dataSource.query(`
        CREATE INDEX IF NOT EXISTS idx_grading_audit_logs_actor 
        ON grading.audit_logs(tenant_id, actor_user_id, created_at DESC)
      `);

      await this.dataSource.query(`
        CREATE INDEX IF NOT EXISTS idx_grading_audit_logs_created_at 
        ON grading.audit_logs(created_at DESC)
      `);

      this.logger.log('✓ audit_logs table created successfully');
    } catch (error) {
      this.logger.warn(`Error ensuring audit_logs table: ${error.message}`);
      // Don't throw - continue with seeding
    }
  }

  /**
   * Ensure test institution exists or create it
   * Handles the case where it already exists gracefully
   */
  private async ensureTestInstitution(
    institutionRepo: Repository<Institution>,
    testUniversityId: string,
  ): Promise<Institution> {
    // First, check if it already exists
    let institution = await institutionRepo.findOne({
      where: { domain: 'test-university.edu' },
    });

    if (institution) {
      this.logger.log(`✓ Institution "Test University" already exists`);
      return institution;
    }

    // Institution doesn't exist, try to create it
    try {
      this.logger.log('Creating test institution "Test University"...');
      institution = institutionRepo.create({
        id: testUniversityId,
        tenant_id: testUniversityId,
        name: 'Test University',
        domain: 'test-university.edu',
        timezone: 'UTC',
        plagiarism_threshold: 75,
        ai_provider: 'openai',
        settings: {
          allow_anonymous_submissions: false,
          require_plagiarism_check: true,
          email_notifications_enabled: false,
          max_file_upload_size_mb: 50,
        },
      });
      await institutionRepo.save(institution);
      this.logger.log(`✓ Created institution: ${institution.name} (${institution.id})`);
      return institution;
    } catch (error) {
      // Likely duplicate key error - try to find it one more time
      this.logger.warn(`Could not create institution: ${error.message}`);
      
      // Try by tenant_id as fallback
      institution = await institutionRepo.findOne({
        where: { tenant_id: testUniversityId },
      });

      if (institution) {
        this.logger.log(`✓ Institution "Test University" already exists (found by tenant_id)`);
        return institution;
      }

      // Try by domain again with a fresh query
      institution = await institutionRepo.findOne({
        where: { domain: 'test-university.edu' },
      });

      if (institution) {
        this.logger.log(`✓ Institution "Test University" already exists (found by domain)`);
        return institution;
      }

      // Truly cannot find or create institution
      throw new Error(`Failed to create or find test institution: ${error.message}`);
    }
  }

  /**
   * Create or update test users in the institution
   */
  private async createTestUsers(
    userRepo: Repository<User>,
    institution: Institution,
  ): Promise<void> {
    // Test users configuration
    const testUsers = [
      {
        email: 'admin@deepgrader.com',
        name: 'Administrator',
        role: 'ADMIN' as const,
        password: 'Password123!',
      },
      {
        email: 'teacher1@deepgrader.com',
        name: 'Teacher One',
        role: 'INSTRUCTOR' as const,
        password: 'Password123!',
      },
      {
        email: 'student1@deepgrader.com',
        name: 'Student One',
        role: 'STUDENT' as const,
        password: 'Password123!',
      },
    ];

    for (const testUser of testUsers) {
      // Check if user already exists in institution
      const existingUser = await userRepo.findOne({
        where: {
          tenant_id: institution.tenant_id,
          email: testUser.email,
        },
      });

      if (existingUser) {
        this.logger.log(`✓ User ${testUser.email} already exists`);
        // Ensure the role is correct (in case it was changed or migrated)
        if (existingUser.role !== testUser.role) {
          this.logger.log(`  Updating role from ${existingUser.role} to ${testUser.role}...`);
          existingUser.role = testUser.role;
          existingUser.permissions = this.getDefaultPermissions(testUser.role);
          await userRepo.save(existingUser);
        }
        continue;
      }

      // Hash password
      const passwordHash = await bcrypt.hash(testUser.password, 10);

      // Create user
      this.logger.log(`Creating test user: ${testUser.email} (${testUser.role})...`);
      const user = userRepo.create({
        tenant_id: institution.tenant_id,
        institution_id: institution.id,
        email: testUser.email,
        name: testUser.name,
        role: testUser.role,
        password_hash: passwordHash,
        status: 'ACTIVE',
        permissions: this.getDefaultPermissions(testUser.role),
      });

      await userRepo.save(user);
      this.logger.log(`✓ Created user: ${testUser.email}`);
    }
  }

  /**
   * Find the created test users for course enrollment
   */
  private async findCreatedUsers(
    userRepo: Repository<User>,
    institution: Institution,
  ): Promise<Record<string, User>> {
    const createdUsers: Record<string, User> = {};

    const teacher = await userRepo.findOne({
      where: {
        tenant_id: institution.tenant_id,
        email: 'teacher1@deepgrader.com',
      },
    });

    const student = await userRepo.findOne({
      where: {
        tenant_id: institution.tenant_id,
        email: 'student1@deepgrader.com',
      },
    });

    if (teacher) createdUsers['teacher1@deepgrader.com'] = teacher;
    if (student) createdUsers['student1@deepgrader.com'] = student;

    return createdUsers;
  }

  /**
   * Create test courses and enroll users
   */
  private async createTestCoursesAndEnrollments(
    courseRepo: Repository<Course>,
    enrollmentRepo: Repository<CourseEnrollment>,
    institution: Institution,
    users: Record<string, User>,
  ): Promise<Course[]> {
    const teacher = users['teacher1@deepgrader.com'];
    const student = users['student1@deepgrader.com'];

    if (!teacher || !student) {
      this.logger.warn('Skipping course creation - teacher or student not found');
      return [];
    }

    const createdCourses: Course[] = [];

    // Define test courses
    const testCourses = [
      {
        code: 'CS101',
        title: 'Introduction to Computer Science',
        description: 'Learn the basics of programming and computer science',
      },
      {
        code: 'CS201',
        title: 'Data Structures and Algorithms',
        description: 'Master fundamental data structures and algorithm design',
      },
      {
        code: 'CS301',
        title: 'Web Development',
        description: 'Build modern web applications with cutting-edge technologies',
      },
    ];

    for (const courseData of testCourses) {
      // Check if course already exists
      const existingCourse = await courseRepo.findOne({
        where: {
          tenant_id: institution.tenant_id,
          code: courseData.code,
        },
      });

      let course: Course;
      if (existingCourse) {
        this.logger.log(`✓ Course ${courseData.code} already exists`);
        course = existingCourse;
      } else {
        // Create course
        this.logger.log(`Creating test course: ${courseData.code} - ${courseData.title}...`);
        course = courseRepo.create({
          tenant_id: institution.tenant_id,
          institution_id: institution.id,
          created_by_user_id: teacher.id,
          code: courseData.code,
          title: courseData.title,
          description: courseData.description,
          status: 'ACTIVE',
        });
        course = await courseRepo.save(course);
        this.logger.log(`✓ Created course: ${courseData.code}`);
      }

      createdCourses.push(course);

      // Always check and create enrollments (even if course already existed)
      // Enroll teacher as instructor
      const teacherEnrollment = await enrollmentRepo.findOne({
        where: {
          course_id: course.id,
          user_id: teacher.id,
          role: 'INSTRUCTOR',
        },
      });

      if (!teacherEnrollment) {
        this.logger.log(`  Enrolling teacher as INSTRUCTOR...`);
        const enrollment = enrollmentRepo.create({
          tenant_id: institution.tenant_id,
          course_id: course.id,
          user_id: teacher.id,
          role: 'INSTRUCTOR',
        });
        await enrollmentRepo.save(enrollment);
        this.logger.log(`  ✓ Teacher enrolled`);
      }

      // Enroll student
      const studentEnrollment = await enrollmentRepo.findOne({
        where: {
          course_id: course.id,
          user_id: student.id,
          role: 'STUDENT',
        },
      });

      if (!studentEnrollment) {
        this.logger.log(`  Enrolling student as STUDENT...`);
        const enrollment = enrollmentRepo.create({
          tenant_id: institution.tenant_id,
          course_id: course.id,
          user_id: student.id,
          role: 'STUDENT',
        });
        await enrollmentRepo.save(enrollment);
        this.logger.log(`  ✓ Student enrolled`);
      }
    }

    return createdCourses;
  }

  /**
   * Create test assignments for courses
   * Creates sample assignments for CS101, CS201, and CS301
   */
  private async createTestAssignments(
    assignmentRepo: Repository<Assignment>,
    institution: Institution,
    teacher: User,
    courses: Course[],
  ): Promise<void> {
    // Find CS101 course
    const cs101 = courses.find(c => c.code === 'CS101');
    const cs201 = courses.find(c => c.code === 'CS201');
    const cs301 = courses.find(c => c.code === 'CS301');

    if (!cs101 && !cs201 && !cs301) {
      this.logger.warn('No courses found for assignment creation');
      return;
    }

    // Set deadlines - soft deadline 1 week from now, hard deadline 1.5 weeks
    const now = new Date();
    const softDeadlineCs101 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const hardDeadlineCs101 = new Date(now.getTime() + 10.5 * 24 * 60 * 60 * 1000);

    const softDeadlineCs201 = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const hardDeadlineCs201 = new Date(now.getTime() + 17.5 * 24 * 60 * 60 * 1000);

    const softDeadlineCs301 = new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000);
    const hardDeadlineCs301 = new Date(now.getTime() + 24.5 * 24 * 60 * 60 * 1000);

    if (cs101) {
      // Check if assignments already exist for this course
      const existingCount = await assignmentRepo.count({
        where: { course_id: cs101.id },
      });

      if (existingCount === 0) {
        this.logger.log(`Creating test assignments for CS101...`);

        const assignments = [
          {
            title: 'Midterm Essay',
            description: 'Write a 2000-word essay on the fundamentals of programming languages. Include discussion of variables, functions, and control flow.',
            type: 'ESSAY' as const,
            point_value: 100,
            soft_deadline: softDeadlineCs101,
            hard_deadline: hardDeadlineCs101,
            late_penalty_percent: 10,
            allow_incremental: true,
          },
          {
            title: 'Programming Project: Hello World',
            description: 'Create a simple program that prints "Hello, World!" in at least 3 different programming languages. Document your code with comments.',
            type: 'CODE' as const,
            point_value: 50,
            soft_deadline: new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000),
            hard_deadline: new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000),
            late_penalty_percent: 5,
            allow_incremental: true,
          },
          {
            title: 'Quiz: Computer Science Basics',
            description: 'Take this 20-question quiz covering course materials from weeks 1-3. You will have 60 minutes to complete it.',
            type: 'QUIZ' as const,
            point_value: 25,
            soft_deadline: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000),
            hard_deadline: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
            late_penalty_percent: 15,
            allow_incremental: false,
          },
        ];

        for (const assignmentData of assignments) {
          const assignment = assignmentRepo.create({
            tenant_id: institution.tenant_id,
            course_id: cs101.id,
            created_by_user_id: teacher.id,
            title: assignmentData.title,
            description: assignmentData.description,
            type: assignmentData.type,
            point_value: assignmentData.point_value,
            soft_deadline: assignmentData.soft_deadline,
            hard_deadline: assignmentData.hard_deadline,
            late_penalty_percent: assignmentData.late_penalty_percent,
            allow_incremental: assignmentData.allow_incremental,
            published_at: now,
            published_by_user_id: teacher.id,
          });
          await assignmentRepo.save(assignment);
          this.logger.log(`  ✓ Created assignment: ${assignmentData.title}`);
        }
      } else {
        this.logger.log(`✓ CS101 already has ${existingCount} assignments`);
      }
    }

    if (cs201) {
      const existingCount = await assignmentRepo.count({
        where: { course_id: cs201.id },
      });

      if (existingCount === 0) {
        this.logger.log(`Creating test assignments for CS201...`);

        const assignments = [
          {
            title: 'Implement Binary Search Tree',
            description: 'Implement a binary search tree data structure with insert, delete, and search operations. Provide unit tests for each operation.',
            type: 'CODE' as const,
            point_value: 150,
            soft_deadline: softDeadlineCs201,
            hard_deadline: hardDeadlineCs201,
            late_penalty_percent: 5,
            allow_incremental: true,
          },
          {
            title: 'Algorithm Analysis Essay',
            description: 'Analyze the time complexity of quicksort, mergesort, and bubble sort. Write a 1500-word essay comparing their performance characteristics.',
            type: 'ESSAY' as const,
            point_value: 75,
            soft_deadline: new Date(now.getTime() + 11 * 24 * 60 * 60 * 1000),
            hard_deadline: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
            late_penalty_percent: 10,
            allow_incremental: false,
          },
        ];

        for (const assignmentData of assignments) {
          const assignment = assignmentRepo.create({
            tenant_id: institution.tenant_id,
            course_id: cs201.id,
            created_by_user_id: teacher.id,
            title: assignmentData.title,
            description: assignmentData.description,
            type: assignmentData.type,
            point_value: assignmentData.point_value,
            soft_deadline: assignmentData.soft_deadline,
            hard_deadline: assignmentData.hard_deadline,
            late_penalty_percent: assignmentData.late_penalty_percent,
            allow_incremental: assignmentData.allow_incremental,
            published_at: now,
            published_by_user_id: teacher.id,
          });
          await assignmentRepo.save(assignment);
          this.logger.log(`  ✓ Created assignment: ${assignmentData.title}`);
        }
      } else {
        this.logger.log(`✓ CS201 already has ${existingCount} assignments`);
      }
    }

    if (cs301) {
      const existingCount = await assignmentRepo.count({
        where: { course_id: cs301.id },
      });

      if (existingCount === 0) {
        this.logger.log(`Creating test assignments for CS301...`);

        const assignments = [
          {
            title: 'Build a Personal Portfolio Website',
            description: 'Create a responsive personal portfolio website showcasing your projects. Use HTML, CSS, and JavaScript. Deploy to GitHub Pages or similar service.',
            type: 'CODE' as const,
            point_value: 200,
            soft_deadline: softDeadlineCs301,
            hard_deadline: hardDeadlineCs301,
            late_penalty_percent: 5,
            allow_incremental: true,
          },
          {
            title: 'Web Development Trends Report',
            description: 'Research and write a 2000-word report on the latest trends in web development. Include discussion of frameworks, tools, and best practices.',
            type: 'ESSAY' as const,
            point_value: 100,
            soft_deadline: new Date(now.getTime() + 18 * 24 * 60 * 60 * 1000),
            hard_deadline: new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000),
            late_penalty_percent: 8,
            allow_incremental: false,
          },
        ];

        for (const assignmentData of assignments) {
          const assignment = assignmentRepo.create({
            tenant_id: institution.tenant_id,
            course_id: cs301.id,
            created_by_user_id: teacher.id,
            title: assignmentData.title,
            description: assignmentData.description,
            type: assignmentData.type,
            point_value: assignmentData.point_value,
            soft_deadline: assignmentData.soft_deadline,
            hard_deadline: assignmentData.hard_deadline,
            late_penalty_percent: assignmentData.late_penalty_percent,
            allow_incremental: assignmentData.allow_incremental,
            published_at: now,
            published_by_user_id: teacher.id,
          });
          await assignmentRepo.save(assignment);
          this.logger.log(`  ✓ Created assignment: ${assignmentData.title}`);
        }
      } else {
        this.logger.log(`✓ CS301 already has ${existingCount} assignments`);
      }
    }

    this.logger.log('✓ Test assignments creation complete');
  }

  /**
   * Seed sample audit logs for testing
   */
  private async seedAuditLogs(
    auditLogRepo: Repository<AuditLog>,
    userRepo: Repository<User>,
    institution: Institution,
  ): Promise<void> {
    // Check if audit logs already exist for this institution
    let existingLogCount = 0;
    try {
      existingLogCount = await auditLogRepo.count({
        where: { tenant_id: institution.tenant_id },
      });
    } catch (err) {
      this.logger.warn(`Could not count audit logs: ${err.message}`);
    }

    if (existingLogCount > 0) {
      this.logger.log(`✓ Audit logs already exist (${existingLogCount} entries)`);
      return;
    }

    try {
      this.logger.log('Seeding sample audit logs...');

      // Get test users
      const adminUser = await userRepo.findOne({
        where: { tenant_id: institution.tenant_id, email: 'admin@deepgrader.com' },
      });

      const teacherUser = await userRepo.findOne({
        where: { tenant_id: institution.tenant_id, email: 'teacher1@deepgrader.com' },
      });

      const studentUser = await userRepo.findOne({
        where: { tenant_id: institution.tenant_id, email: 'student1@deepgrader.com' },
      });

      if (!adminUser || !teacherUser || !studentUser) {
        this.logger.warn('Could not seed audit logs - test users not found');
        this.logger.warn(`  Admin: ${adminUser?.id}, Teacher: ${teacherUser?.id}, Student: ${studentUser?.id}`);
        return;
      }

      // Sample IDs for demonstration
      const sampleGradeId = '11111111-1111-1111-1111-111111111111';
      const sampleSubmissionId = '22222222-2222-2222-2222-222222222222';

      const now = new Date();
      const auditLogs = [
        // User login (5 minutes ago)
        {
          tenant_id: institution.tenant_id,
          event_type: 'user_login',
          actor_user_id: adminUser.id,
          resource_type: 'user',
          resource_id: adminUser.id,
          action_details: { email: 'admin@deepgrader.com', ip: '192.168.1.100' },
          ip_address: '192.168.1.100',
          created_at: new Date(now.getTime() - 5 * 60 * 1000),
        },
        // Submission received (3.5 hours ago)
        {
          tenant_id: institution.tenant_id,
          event_type: 'submission_received',
          actor_user_id: studentUser.id,
          resource_type: 'submission',
          resource_id: sampleSubmissionId,
          action_details: {
            assignmentId: '44444444-4444-4444-4444-444444444444',
            studentId: studentUser.id,
            fileName: 'essay_final_draft.pdf',
            fileSize: 245632,
            submissionCount: 1,
          },
          ip_address: '172.16.0.10',
          created_at: new Date(now.getTime() - 3.5 * 60 * 60 * 1000),
        },
        // Plagiarism scanned (2.5 hours ago)
        {
          tenant_id: institution.tenant_id,
          event_type: 'plagiarism_scanned',
          actor_user_id: null,
          resource_type: 'submission',
          resource_id: sampleSubmissionId,
          action_details: {
            plagiarismScore: 12,
            aiGenerationScore: 5,
            sourceMatches: 2,
            scanTime: 8500,
          },
          ip_address: null,
          created_at: new Date(now.getTime() - 2.5 * 60 * 60 * 1000),
        },
        // Grade created (2 hours ago)
        {
          tenant_id: institution.tenant_id,
          event_type: 'grade_created',
          actor_user_id: null,
          resource_type: 'grade',
          resource_id: sampleGradeId,
          action_details: {
            submissionId: sampleSubmissionId,
            score: 87,
            confidence: 0.92,
            aiProvider: 'openai',
            aiModel: 'gpt-4o',
            feedback: 'Excellent work on this assignment. Your analysis was thorough and well-articulated.',
            tokenCount: 1245,
            latency: 2340,
          },
          ip_address: null,
          created_at: new Date(now.getTime() - 2 * 60 * 60 * 1000),
        },
        // Grade override (1.75 hours ago)
        {
          tenant_id: institution.tenant_id,
          event_type: 'grade_override',
          actor_user_id: teacherUser.id,
          resource_type: 'grade',
          resource_id: sampleGradeId,
          action_details: {
            originalScore: 87,
            overriddenScore: 92,
            originalConfidence: 0.92,
            rationale: 'Student demonstrated exceptional understanding in class discussion.',
            requiresApproval: false,
            submissionId: sampleSubmissionId,
          },
          ip_address: '10.0.0.50',
          created_at: new Date(now.getTime() - 1.75 * 60 * 60 * 1000),
        },
        // Grade released (1.5 hours ago)
        {
          tenant_id: institution.tenant_id,
          event_type: 'grade_released',
          actor_user_id: teacherUser.id,
          resource_type: 'grade',
          resource_id: sampleGradeId,
          action_details: {
            submissionId: sampleSubmissionId,
            visibleToStudent: true,
            includesFeedback: true,
          },
          ip_address: '10.0.0.50',
          created_at: new Date(now.getTime() - 1.5 * 60 * 60 * 1000),
        },
        // Institution settings changed (4 hours ago)
        {
          tenant_id: institution.tenant_id,
          event_type: 'institution_settings_changed',
          actor_user_id: adminUser.id,
          resource_type: 'institution',
          resource_id: institution.id,
          action_details: {
            settingKey: 'plagiarism_threshold',
            previousValue: 75,
            newValue: 80,
            description: 'Increased plagiarism threshold from 75% to 80% for stricter detection',
          },
          ip_address: '192.168.1.100',
          created_at: new Date(now.getTime() - 4 * 60 * 60 * 1000),
        },
        // User role changed (5 hours ago)
        {
          tenant_id: institution.tenant_id,
          event_type: 'user_role_changed',
          actor_user_id: adminUser.id,
          resource_type: 'user',
          resource_id: teacherUser.id,
          action_details: {
            userId: teacherUser.id,
            previousRole: 'STUDENT',
            newRole: 'INSTRUCTOR',
            reason: 'Promoted to instructor based on department request',
          },
          ip_address: '192.168.1.100',
          created_at: new Date(now.getTime() - 5 * 60 * 60 * 1000),
        },
        // Another grade created (6 hours ago)
        {
          tenant_id: institution.tenant_id,
          event_type: 'grade_created',
          actor_user_id: null,
          resource_type: 'grade',
          resource_id: '55555555-5555-5555-5555-555555555555',
          action_details: {
            submissionId: '66666666-6666-6666-6666-666666666666',
            score: 78,
            confidence: 0.85,
            aiProvider: 'openai',
            aiModel: 'gpt-4o',
            feedback: 'Good effort overall. Consider providing more detailed analysis.',
            tokenCount: 1100,
            latency: 2100,
          },
          ip_address: null,
          created_at: new Date(now.getTime() - 6 * 60 * 60 * 1000),
        },
        // User logout (7 hours ago)
        {
          tenant_id: institution.tenant_id,
          event_type: 'user_logout',
          actor_user_id: adminUser.id,
          resource_type: 'user',
          resource_id: adminUser.id,
          action_details: {
            email: 'admin@deepgrader.com',
            sessionDuration: 3600,
          },
          ip_address: '192.168.1.100',
          created_at: new Date(now.getTime() - 7 * 60 * 60 * 1000),
        },
      ];

      // Insert all audit logs - use raw SQL to avoid TypeORM mapping issues
      for (const log of auditLogs) {
        try {
          await this.dataSource.query(
            `INSERT INTO grading.audit_logs 
            (tenant_id, event_type, actor_user_id, resource_type, resource_id, action_details, ip_address, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              log.tenant_id,
              log.event_type,
              log.actor_user_id,
              log.resource_type,
              log.resource_id,
              JSON.stringify(log.action_details),
              log.ip_address,
              log.created_at,
            ]
          );
        } catch (insertErr) {
          this.logger.warn(`Failed to insert audit log (${log.event_type}): ${insertErr.message}`);
        }
      }

      this.logger.log(`✓ Seeded ${auditLogs.length} audit logs`);
    } catch (error) {
      this.logger.warn(`Error seeding audit logs: ${error.message}`);
    }
  }

  /**
   * Get default permissions for a user role
   */
  private getDefaultPermissions(role: 'ADMIN' | 'INSTRUCTOR' | 'STUDENT'): string[] {
    const rolePermissions: Record<string, string[]> = {
      ADMIN: [
        'manage:users',
        'manage:institutions',
        'manage:courses',
        'manage:assignments',
        'view:submissions',
        'override:grades',
        'manage:plagiarism',
        'view:analytics',
        'manage:settings',
      ],
      INSTRUCTOR: [
        'create:courses',
        'update:own_courses',
        'delete:own_courses',
        'manage:assignments',
        'view:submissions',
        'submit:grades',
        'view:analytics',
      ],
      STUDENT: [
        'view:own_submissions',
        'create:submissions',
        'view:own_grades',
      ],
    };

    return rolePermissions[role] || [];
  }
}
