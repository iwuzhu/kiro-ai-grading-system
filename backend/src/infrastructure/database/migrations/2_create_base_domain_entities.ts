import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Create Base Domain Entity Tables
 *
 * This migration creates the foundational tables for the multi-tenant grading system:
 * - institutions: Tenant management and configuration
 * - users: User accounts with role-based access
 * - courses: Course definitions
 * - course_enrollments: Enrollment tracking
 *
 * All tables are in the grading schema with:
 * ✓ Tenant isolation via tenant_id and unique constraints
 * ✓ Foreign key relationships with cascade delete
 * ✓ Indices for tenant_id, unique constraints, and common queries
 * ✓ Soft delete support (deleted_at column)
 * ✓ Audit trail timestamps (created_at, updated_at)
 * ✓ Proper constraints enforcing data integrity
 *
 * Acceptance Criteria:
 * ✓ All tables created in grading schema
 * ✓ tenant_id indexed and part of unique constraints
 * ✓ Foreign keys properly configured with cascade policies
 * ✓ Constraints prevent orphaned records
 * ✓ Enum columns properly defined
 * ✓ JSONB settings column for flexible configuration
 *
 * Table Dependencies:
 * 1. institutions (no dependencies)
 * 2. users (FK: institution_id -> institutions.id)
 * 3. courses (FK: institution_id -> institutions.id, created_by_user_id -> users.id)
 * 4. course_enrollments (FK: course_id -> courses.id, user_id -> users.id)
 */
export class CreateBaseDomainEntities1704067200001
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ========================================
    // 1. CREATE institutions TABLE
    // ========================================
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS grading.institutions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        domain VARCHAR(255) NOT NULL UNIQUE,
        timezone VARCHAR(50) NOT NULL DEFAULT 'UTC',
        plagiarism_threshold NUMERIC(5, 2) NOT NULL DEFAULT 75,
        ai_provider VARCHAR(50) NOT NULL DEFAULT 'openai',
        settings JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        deleted_at TIMESTAMP,
        CONSTRAINT valid_plagiarism_threshold CHECK (
          plagiarism_threshold >= 0 AND plagiarism_threshold <= 100
        ),
        CONSTRAINT valid_ai_provider CHECK (
          ai_provider IN ('openai', 'claude', 'bedrock')
        ),
        CONSTRAINT valid_timezone CHECK (timezone ~ '^[A-Za-z/_]+$')
      )
    `);

    // Create indices on institutions
    await queryRunner.query(`
      CREATE INDEX idx_institutions_tenant_id 
      ON grading.institutions(tenant_id)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_institutions_domain 
      ON grading.institutions(domain)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_institutions_deleted_at 
      ON grading.institutions(deleted_at) 
      WHERE deleted_at IS NULL
    `);

    // ========================================
    // 2. CREATE users TABLE
    // ========================================
    // First, create the role enum
    await queryRunner.query(`
      CREATE TYPE grading.user_role AS ENUM('ADMIN', 'INSTRUCTOR', 'STUDENT')
    `);

    // Create the status enum
    await queryRunner.query(`
      CREATE TYPE grading.user_status AS ENUM('ACTIVE', 'INACTIVE', 'INVITED')
    `);

    // Create the SSO provider enum
    await queryRunner.query(`
      CREATE TYPE grading.sso_provider AS ENUM('okta', 'azure', 'google')
    `);

    // Create users table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS grading.users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        institution_id UUID NOT NULL,
        email VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        role grading.user_role NOT NULL,
        password_hash VARCHAR(255),
        sso_provider grading.sso_provider,
        sso_id VARCHAR(255),
        status grading.user_status NOT NULL DEFAULT 'INVITED',
        permissions TEXT[] DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        deleted_at TIMESTAMP,
        UNIQUE(tenant_id, email),
        CONSTRAINT unique_user_sso UNIQUE (tenant_id, sso_provider, sso_id)
          WHERE sso_provider IS NOT NULL AND sso_id IS NOT NULL,
        CONSTRAINT fk_users_institution 
          FOREIGN KEY (institution_id) REFERENCES grading.institutions(id)
          ON DELETE CASCADE,
        CONSTRAINT valid_email CHECK (email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}$'),
        CONSTRAINT password_or_sso CHECK (
          (password_hash IS NOT NULL AND sso_provider IS NULL) OR
          (password_hash IS NULL AND sso_provider IS NOT NULL) OR
          (password_hash IS NOT NULL AND sso_provider IS NOT NULL)
        )
      )
    `);

    // Create indices on users
    await queryRunner.query(`
      CREATE INDEX idx_users_tenant_id 
      ON grading.users(tenant_id)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_users_institution_id 
      ON grading.users(institution_id)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_users_role 
      ON grading.users(role)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_users_tenant_email 
      ON grading.users(tenant_id, email)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_users_status 
      ON grading.users(status)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_users_sso 
      ON grading.users(tenant_id, sso_provider, sso_id) 
      WHERE sso_provider IS NOT NULL AND sso_id IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE INDEX idx_users_deleted_at 
      ON grading.users(deleted_at) 
      WHERE deleted_at IS NULL
    `);

    // ========================================
    // 3. CREATE courses TABLE
    // ========================================
    // Create course status enum
    await queryRunner.query(`
      CREATE TYPE grading.course_status AS ENUM('DRAFT', 'ACTIVE', 'ARCHIVED')
    `);

    // Create courses table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS grading.courses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        institution_id UUID NOT NULL,
        code VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        created_by_user_id UUID,
        status grading.course_status NOT NULL DEFAULT 'DRAFT',
        semester_start DATE,
        semester_end DATE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        deleted_at TIMESTAMP,
        UNIQUE(tenant_id, code),
        CONSTRAINT fk_courses_institution 
          FOREIGN KEY (institution_id) REFERENCES grading.institutions(id)
          ON DELETE CASCADE,
        CONSTRAINT fk_courses_created_by_user 
          FOREIGN KEY (created_by_user_id) REFERENCES grading.users(id)
          ON DELETE SET NULL,
        CONSTRAINT valid_semester_dates CHECK (
          semester_start IS NULL OR semester_end IS NULL OR semester_start <= semester_end
        )
      )
    `);

    // Create indices on courses
    await queryRunner.query(`
      CREATE INDEX idx_courses_tenant_id 
      ON grading.courses(tenant_id)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_courses_institution_id 
      ON grading.courses(institution_id)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_courses_created_by_user_id 
      ON grading.courses(created_by_user_id)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_courses_status 
      ON grading.courses(status)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_courses_tenant_code 
      ON grading.courses(tenant_id, code)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_courses_deleted_at 
      ON grading.courses(deleted_at) 
      WHERE deleted_at IS NULL
    `);

    // ========================================
    // 4. CREATE course_enrollments TABLE
    // ========================================
    // Create enrollment role enum
    await queryRunner.query(`
      CREATE TYPE grading.enrollment_role AS ENUM('INSTRUCTOR', 'STUDENT')
    `);

    // Create course_enrollments table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS grading.course_enrollments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        course_id UUID NOT NULL,
        user_id UUID NOT NULL,
        role grading.enrollment_role NOT NULL DEFAULT 'STUDENT',
        enrolled_at TIMESTAMP DEFAULT NOW(),
        unenrolled_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(course_id, user_id),
        CONSTRAINT fk_enrollments_course 
          FOREIGN KEY (course_id) REFERENCES grading.courses(id)
          ON DELETE CASCADE,
        CONSTRAINT fk_enrollments_user 
          FOREIGN KEY (user_id) REFERENCES grading.users(id)
          ON DELETE CASCADE,
        CONSTRAINT valid_unenrollment_date CHECK (
          unenrolled_at IS NULL OR unenrolled_at >= enrolled_at
        )
      )
    `);

    // Create indices on course_enrollments
    await queryRunner.query(`
      CREATE INDEX idx_enrollments_tenant_id 
      ON grading.course_enrollments(tenant_id)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_enrollments_course_id 
      ON grading.course_enrollments(course_id)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_enrollments_user_id 
      ON grading.course_enrollments(user_id)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_enrollments_role 
      ON grading.course_enrollments(role)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_enrollments_active 
      ON grading.course_enrollments(course_id, user_id) 
      WHERE unenrolled_at IS NULL
    `);

    // ========================================
    // 5. CREATE RLS (Row-Level Security) POLICIES
    // ========================================
    // Enable RLS on all tables
    await queryRunner.query(
      'ALTER TABLE grading.institutions ENABLE ROW LEVEL SECURITY',
    );
    await queryRunner.query(
      'ALTER TABLE grading.users ENABLE ROW LEVEL SECURITY',
    );
    await queryRunner.query(
      'ALTER TABLE grading.courses ENABLE ROW LEVEL SECURITY',
    );
    await queryRunner.query(
      'ALTER TABLE grading.course_enrollments ENABLE ROW LEVEL SECURITY',
    );

    // RLS Policy: institutions - tenant isolation
    await queryRunner.query(`
      CREATE POLICY grading_tenant_isolation_institutions 
      ON grading.institutions
      USING (tenant_id = grading.get_current_tenant_id())
      WITH CHECK (tenant_id = grading.get_current_tenant_id())
    `);

    // RLS Policy: users - tenant isolation
    await queryRunner.query(`
      CREATE POLICY grading_tenant_isolation_users 
      ON grading.users
      USING (tenant_id = grading.get_current_tenant_id())
      WITH CHECK (tenant_id = grading.get_current_tenant_id())
    `);

    // RLS Policy: courses - tenant isolation
    await queryRunner.query(`
      CREATE POLICY grading_tenant_isolation_courses 
      ON grading.courses
      USING (tenant_id = grading.get_current_tenant_id())
      WITH CHECK (tenant_id = grading.get_current_tenant_id())
    `);

    // RLS Policy: course_enrollments - tenant isolation
    await queryRunner.query(`
      CREATE POLICY grading_tenant_isolation_enrollments 
      ON grading.course_enrollments
      USING (tenant_id = grading.get_current_tenant_id())
      WITH CHECK (tenant_id = grading.get_current_tenant_id())
    `);

    // ========================================
    // 6. CREATE TABLE COMMENTS (documentation)
    // ========================================
    await queryRunner.query(`
      COMMENT ON TABLE grading.institutions IS 
      'Multi-tenant institution/organization entities. Each institution is a separate tenant with isolated data.'
    `);

    await queryRunner.query(`
      COMMENT ON TABLE grading.users IS 
      'User accounts with role-based access control (ADMIN, INSTRUCTOR, STUDENT).'
    `);

    await queryRunner.query(`
      COMMENT ON TABLE grading.courses IS 
      'Courses within institutions. Students and instructors enroll in courses to interact with assignments.'
    `);

    await queryRunner.query(`
      COMMENT ON TABLE grading.course_enrollments IS 
      'Tracks user enrollment in courses, including enrollment dates and role (INSTRUCTOR vs STUDENT).'
    `);

    // ========================================
    // 7. CREATE FUNCTIONS FOR AUDIT TRAIL
    // ========================================
    // Function to update updated_at timestamp
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION grading.update_timestamp()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);

    // Trigger for institutions.updated_at
    await queryRunner.query(`
      CREATE TRIGGER trg_institutions_updated_at
      BEFORE UPDATE ON grading.institutions
      FOR EACH ROW
      EXECUTE FUNCTION grading.update_timestamp()
    `);

    // Trigger for users.updated_at
    await queryRunner.query(`
      CREATE TRIGGER trg_users_updated_at
      BEFORE UPDATE ON grading.users
      FOR EACH ROW
      EXECUTE FUNCTION grading.update_timestamp()
    `);

    // Trigger for courses.updated_at
    await queryRunner.query(`
      CREATE TRIGGER trg_courses_updated_at
      BEFORE UPDATE ON grading.courses
      FOR EACH ROW
      EXECUTE FUNCTION grading.update_timestamp()
    `);

    // Trigger for course_enrollments.updated_at
    await queryRunner.query(`
      CREATE TRIGGER trg_enrollments_updated_at
      BEFORE UPDATE ON grading.course_enrollments
      FOR EACH ROW
      EXECUTE FUNCTION grading.update_timestamp()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ========================================
    // ROLLBACK: Drop tables in reverse order
    // ========================================

    // Drop triggers
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS trg_enrollments_updated_at ON grading.course_enrollments',
    );
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS trg_courses_updated_at ON grading.courses',
    );
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS trg_users_updated_at ON grading.users',
    );
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS trg_institutions_updated_at ON grading.institutions',
    );

    // Drop function
    await queryRunner.query(
      'DROP FUNCTION IF EXISTS grading.update_timestamp()',
    );

    // Drop tables (CASCADE drops RLS policies automatically)
    await queryRunner.query(
      'DROP TABLE IF EXISTS grading.course_enrollments CASCADE',
    );
    await queryRunner.query('DROP TABLE IF EXISTS grading.courses CASCADE');
    await queryRunner.query('DROP TABLE IF EXISTS grading.users CASCADE');
    await queryRunner.query('DROP TABLE IF EXISTS grading.institutions CASCADE');

    // Drop enums
    await queryRunner.query('DROP TYPE IF EXISTS grading.enrollment_role');
    await queryRunner.query('DROP TYPE IF EXISTS grading.course_status');
    await queryRunner.query('DROP TYPE IF EXISTS grading.sso_provider');
    await queryRunner.query('DROP TYPE IF EXISTS grading.user_status');
    await queryRunner.query('DROP TYPE IF EXISTS grading.user_role');
  }
}
