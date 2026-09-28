import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Create Grading Schema
 * 
 * This migration establishes the foundational grading schema within a shared PostgreSQL database.
 * All grading-related tables, policies, and functions are isolated in this schema to enable:
 * - Clear separation from other projects sharing the database
 * - Independent scaling and backup/restore operations
 * - Simplified permission management via schema-level grants
 * - Tenant isolation through Row-Level Security (RLS) policies
 * 
 * Schema Structure:
 * - grading schema: Contains all grading system tables, views, and functions
 * - application_role: Application service account with CREATE/USAGE permissions
 * - admin_role: Administrative account with full schema control
 * 
 * Acceptance Criteria:
 * ✓ Schema created with proper authorization
 * ✓ Application role can create tables in grading schema
 * ✓ RLS can be enabled on tables
 * ✓ Schema isolated from other project schemas
 */
export class CreateGradingSchema1704067200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ========================================
    // 1. Create grading schema
    // ========================================
    await queryRunner.query('CREATE SCHEMA IF NOT EXISTS grading');

    // ========================================
    // 2. Create roles if they don't exist
    // ========================================
    // Check and create application_role
    try {
      await queryRunner.query(
        `CREATE ROLE application_role WITH LOGIN PASSWORD 'change_me_in_env'`,
      );
    } catch (error) {
      // Role may already exist, which is fine
      if (!error.message.includes('already exists')) {
        throw error;
      }
    }

    // Check and create admin_role
    try {
      await queryRunner.query(`CREATE ROLE admin_role WITH LOGIN SUPERUSER`);
    } catch (error) {
      // Role may already exist, which is fine
      if (!error.message.includes('already exists')) {
        throw error;
      }
    }

    // ========================================
    // 3. Grant schema-level permissions to application_role
    // ========================================
    // USAGE: Allows the role to access objects in the schema
    await queryRunner.query('GRANT USAGE ON SCHEMA grading TO application_role');

    // CREATE: Allows the role to create tables and other objects in the schema
    await queryRunner.query(
      'GRANT CREATE ON SCHEMA grading TO application_role',
    );

    // ALL PRIVILEGES on schema for admin_role
    await queryRunner.query(
      'GRANT ALL PRIVILEGES ON SCHEMA grading TO admin_role',
    );

    // ========================================
    // 4. Set default privileges for future tables
    // ========================================
    // When application_role creates new tables, grant SELECT/INSERT/UPDATE/DELETE
    await queryRunner.query(
      `ALTER DEFAULT PRIVILEGES FOR ROLE application_role IN SCHEMA grading
       GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO application_role`,
    );

    // ========================================
    // 5. Configure search_path for application_role
    // ========================================
    // Set search_path so tables are created in grading schema by default
    await queryRunner.query(
      `ALTER ROLE application_role SET search_path = 'grading', 'public'`,
    );

    // ========================================
    // 6. Create RLS policy infrastructure functions
    // ========================================
    // These foundational functions will be used by task 1.5 and other RLS policy tasks

    // Function: get_current_tenant_id
    // Purpose: Extract the current tenant_id from application context
    // This is called by RLS policies to enforce tenant isolation
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION grading.get_current_tenant_id()
      RETURNS UUID AS $$
      BEGIN
        RETURN current_setting('app.current_tenant_id', true)::UUID;
      EXCEPTION WHEN OTHERS THEN
        RETURN NULL;
      END;
      $$ LANGUAGE plpgsql STABLE;
    `);

    // Function: check_tenant_access
    // Purpose: Verify if a given record belongs to the current tenant
    // Returns true if the record's tenant_id matches the current tenant
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION grading.check_tenant_access(record_tenant_id UUID)
      RETURNS BOOLEAN AS $$
      BEGIN
        RETURN record_tenant_id = grading.get_current_tenant_id();
      END;
      $$ LANGUAGE plpgsql STABLE;
    `);

    // Function: get_current_user_id
    // Purpose: Extract the current user_id from application context
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION grading.get_current_user_id()
      RETURNS UUID AS $$
      BEGIN
        RETURN current_setting('app.current_user_id', true)::UUID;
      EXCEPTION WHEN OTHERS THEN
        RETURN NULL;
      END;
      $$ LANGUAGE plpgsql STABLE;
    `);

    // Function: get_current_user_role
    // Purpose: Extract the current user's role from application context
    // Valid values: 'admin', 'instructor', 'student'
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION grading.get_current_user_role()
      RETURNS TEXT AS $$
      BEGIN
        RETURN current_setting('app.current_user_role', true)::TEXT;
      EXCEPTION WHEN OTHERS THEN
        RETURN NULL;
      END;
      $$ LANGUAGE plpgsql STABLE;
    `);

    // ========================================
    // 7. Create comment documentation
    // ========================================
    await queryRunner.query(`
      COMMENT ON SCHEMA grading IS 'Dedicated schema for AI Grading System. Contains all tables, views, policies, and functions for the grading platform. Isolated from other projects in shared database.';
    `);

    await queryRunner.query(`
      COMMENT ON FUNCTION grading.get_current_tenant_id() IS 'Returns the UUID of the current tenant from application context. Used by RLS policies for tenant isolation.';
    `);

    await queryRunner.query(`
      COMMENT ON FUNCTION grading.check_tenant_access(UUID) IS 'Verifies if a record belongs to the current tenant. Returns true if record tenant_id matches current tenant.';
    `);

    await queryRunner.query(`
      COMMENT ON FUNCTION grading.get_current_user_id() IS 'Returns the UUID of the current authenticated user from application context.';
    `);

    await queryRunner.query(`
      COMMENT ON FUNCTION grading.get_current_user_role() IS 'Returns the role of the current user: admin, instructor, or student.';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ========================================
    // Rollback: Drop grading schema and all contained objects
    // ========================================
    // CASCADE drops all tables, views, functions, and policies in the schema
    await queryRunner.query('DROP SCHEMA IF EXISTS grading CASCADE');

    // ========================================
    // Optional: Drop roles if they were created specifically for this project
    // Note: Be cautious dropping roles if other applications use them
    // Uncomment only if you're certain these roles are grading-system-only
    // ========================================
    // await queryRunner.query('DROP ROLE IF EXISTS application_role');
    // await queryRunner.query('DROP ROLE IF EXISTS admin_role');
  }
}
