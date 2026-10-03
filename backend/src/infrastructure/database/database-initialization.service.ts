import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Institution } from '../../domain/entities/institution.entity';
import { User } from '../../domain/entities/user.entity';
import { Course } from '../../domain/entities/course.entity';
import { CourseEnrollment } from '../../domain/entities/course-enrollment.entity';

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
   * Seed test data for development
   * Creates institutions, users, and sample data
   * Idempotent - safe to run multiple times
   */
  private async seedTestData(): Promise<void> {
    const institutionRepo = this.dataSource.getRepository(Institution);
    const userRepo = this.dataSource.getRepository(User);
    const courseRepo = this.dataSource.getRepository(Course);
    const enrollmentRepo = this.dataSource.getRepository(CourseEnrollment);

    // Use the same hardcoded UUID as the auth controller for test data
    const testUniversityId = '550e8400-e29b-41d4-a716-446655440000';
    
    // Check if test institution already exists (using domain as primary check)
    let institution = await institutionRepo.findOne({
      where: { domain: 'test-university.edu' },
    });

    if (!institution) {
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
      } catch (error) {
        this.logger.warn(`Could not create institution: ${error.message}`);
        // Try to find it again in case another process created it
        institution = await institutionRepo.findOne({
          where: { domain: 'test-university.edu' },
        });
        if (!institution) {
          throw error;
        }
        this.logger.log(`✓ Institution "Test University" already exists (found after creation attempt)`);
      }
    } else {
      this.logger.log(`✓ Institution "Test University" already exists`);
    }

    // Ensure institution was found/created
    if (!institution) {
      throw new Error('Test institution could not be created or found');
    }

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

    const createdUsers: Record<string, User> = {};

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
          const updatedUser = await userRepo.save(existingUser);
          createdUsers[testUser.email] = updatedUser;
        } else {
          createdUsers[testUser.email] = existingUser;
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

      const savedUser = await userRepo.save(user);
      createdUsers[testUser.email] = savedUser;
      this.logger.log(`✓ Created user: ${testUser.email}`);
    }

    // Create test courses and enrollments
    await this.createTestCoursesAndEnrollments(
      courseRepo,
      enrollmentRepo,
      institution,
      createdUsers
    );

    this.logger.log('✓ Test data seeding complete');
  }

  /**
   * Create test courses and enroll users
   */
  private async createTestCoursesAndEnrollments(
    courseRepo: Repository<Course>,
    enrollmentRepo: Repository<CourseEnrollment>,
    institution: Institution,
    users: Record<string, User>,
  ): Promise<void> {
    const teacher = users['teacher1@deepgrader.com'];
    const student = users['student1@deepgrader.com'];

    if (!teacher || !student) {
      this.logger.warn('Skipping course creation - teacher or student not found');
      return;
    }

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

      if (existingCourse) {
        this.logger.log(`✓ Course ${courseData.code} already exists`);
        continue;
      }

      // Create course
      this.logger.log(`Creating test course: ${courseData.code} - ${courseData.title}...`);
      const course = courseRepo.create({
        tenant_id: institution.tenant_id,
        institution_id: institution.id,
        created_by_user_id: teacher.id,
        code: courseData.code,
        title: courseData.title,
        description: courseData.description,
        status: 'ACTIVE',
      });

      const savedCourse = await courseRepo.save(course);

      // Enroll teacher as instructor
      const teacherEnrollment = await enrollmentRepo.findOne({
        where: {
          course_id: savedCourse.id,
          user_id: teacher.id,
          role: 'INSTRUCTOR',
        },
      });

      if (!teacherEnrollment) {
        this.logger.log(`  Enrolling teacher as INSTRUCTOR...`);
        const enrollment = enrollmentRepo.create({
          tenant_id: institution.tenant_id,
          course_id: savedCourse.id,
          user_id: teacher.id,
          role: 'INSTRUCTOR',
        });
        await enrollmentRepo.save(enrollment);
        this.logger.log(`  ✓ Teacher enrolled`);
      }

      // Enroll student
      const studentEnrollment = await enrollmentRepo.findOne({
        where: {
          course_id: savedCourse.id,
          user_id: student.id,
          role: 'STUDENT',
        },
      });

      if (!studentEnrollment) {
        this.logger.log(`  Enrolling student as STUDENT...`);
        const enrollment = enrollmentRepo.create({
          tenant_id: institution.tenant_id,
          course_id: savedCourse.id,
          user_id: student.id,
          role: 'STUDENT',
        });
        await enrollmentRepo.save(enrollment);
        this.logger.log(`  ✓ Student enrolled`);
      }

      this.logger.log(`✓ Created course: ${courseData.code}`);
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
