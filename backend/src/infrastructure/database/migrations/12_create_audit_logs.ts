import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Create Audit Logs Table
 *
 * This migration creates the immutable audit_logs table for compliance tracking.
 * - All significant events are logged (grade changes, plagiarism flags, user actions)
 * - Logs are append-only and cannot be modified or deleted
 * - Supports FERPA, GDPR, and SOC 2 audit requirements
 *
 * Acceptance Criteria:
 * ✓ audit_logs table created in grading schema
 * ✓ Immutability enforced via trigger (no updates/deletes)
 * ✓ Tenant isolation via RLS policy
 * ✓ Index on (tenant_id, event_type, created_at) for compliance queries
 * ✓ JSONB action_details for flexible event payloads
 * ✓ Foreign key references to users and institutions
 */
export class CreateAuditLogs1704067200012 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ========================================
    // CREATE IMMUTABILITY ERROR FUNCTION
    // ========================================
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION grading.raise_immutable_error()
      RETURNS TRIGGER AS $$
      BEGIN
        RAISE EXCEPTION 'Audit logs are immutable. No updates or deletions allowed.';
      END;
      $$ LANGUAGE plpgsql;
    `);

    // ========================================
    // CREATE audit_logs TABLE
    // ========================================
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS grading.audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES grading.institutions(id) ON DELETE CASCADE,
        event_type VARCHAR(100) NOT NULL,
        actor_user_id UUID REFERENCES grading.users(id) ON DELETE SET NULL,
        resource_type VARCHAR(100),
        resource_id UUID,
        action_details JSONB,
        ip_address INET,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        
        -- Immutability constraint
        CONSTRAINT audit_logs_immutable CHECK (true),
        
        -- Tenant isolation constraint
        CONSTRAINT audit_logs_tenant_not_null CHECK (tenant_id IS NOT NULL)
      )
    `);

    // ========================================
    // CREATE INDICES FOR COMPLIANCE QUERIES
    // ========================================
    // Primary index: tenant + event_type + created_at (most common compliance queries)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_grading_audit_logs_tenant_event 
      ON grading.audit_logs(tenant_id, event_type, created_at DESC)
    `);

    // Actor-based queries: "Find all actions by user X"
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_grading_audit_logs_actor 
      ON grading.audit_logs(tenant_id, actor_user_id, created_at DESC)
    `);

    // Resource-based queries: "Find all events affecting grade Y"
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_grading_audit_logs_resource 
      ON grading.audit_logs(tenant_id, resource_type, resource_id, created_at DESC)
    `);

    // Time-range queries for compliance reports
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_grading_audit_logs_created_at 
      ON grading.audit_logs(created_at DESC)
    `);

    // ========================================
    // ENABLE ROW-LEVEL SECURITY (RLS)
    // ========================================
    await queryRunner.query(`
      ALTER TABLE grading.audit_logs ENABLE ROW LEVEL SECURITY
    `);

    // RLS Policy for tenant isolation
    await queryRunner.query(`
      CREATE POLICY IF NOT EXISTS grading_audit_logs_tenant_isolation 
      ON grading.audit_logs
      USING (tenant_id = current_setting('app.current_tenant_id')::uuid)
      WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid)
    `);

    // ========================================
    // IMMUTABILITY TRIGGERS
    // ========================================
    // Prevent UPDATE operations
    await queryRunner.query(`
      CREATE TRIGGER IF NOT EXISTS audit_logs_no_update
      BEFORE UPDATE ON grading.audit_logs
      FOR EACH ROW
      EXECUTE FUNCTION grading.raise_immutable_error()
    `);

    // Prevent DELETE operations
    await queryRunner.query(`
      CREATE TRIGGER IF NOT EXISTS audit_logs_no_delete
      BEFORE DELETE ON grading.audit_logs
      FOR EACH ROW
      EXECUTE FUNCTION grading.raise_immutable_error()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop triggers
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS audit_logs_no_delete ON grading.audit_logs
    `);

    await queryRunner.query(`
      DROP TRIGGER IF EXISTS audit_logs_no_update ON grading.audit_logs
    `);

    // Disable RLS and drop policy
    await queryRunner.query(`
      ALTER TABLE grading.audit_logs DISABLE ROW LEVEL SECURITY
    `);

    await queryRunner.query(`
      DROP POLICY IF EXISTS grading_audit_logs_tenant_isolation ON grading.audit_logs
    `);

    // Drop indices
    await queryRunner.query(`
      DROP INDEX IF EXISTS grading.idx_grading_audit_logs_created_at
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS grading.idx_grading_audit_logs_resource
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS grading.idx_grading_audit_logs_actor
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS grading.idx_grading_audit_logs_tenant_event
    `);

    // Drop table
    await queryRunner.query(`
      DROP TABLE IF EXISTS grading.audit_logs CASCADE
    `);

    // Drop function
    await queryRunner.query(`
      DROP FUNCTION IF EXISTS grading.raise_immutable_error()
    `);
  }
}
