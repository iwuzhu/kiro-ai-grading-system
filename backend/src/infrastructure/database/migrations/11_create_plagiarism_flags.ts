import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

/**
 * Migration 11: Create Plagiarism Flags Table
 *
 * Creates the plagiarism_flags table to manage plagiarism investigation workflow.
 * Tracks investigation status, actions, notes, and audit trail for plagiarism cases.
 *
 * Table: plagiarism_flags
 * Schema: grading
 *
 * Columns:
 * - id (UUID PK): Unique flag identifier
 * - tenant_id (UUID): Tenant isolation
 * - institution_id (UUID): Institution reference
 * - submission_id (UUID FK): Link to submission
 * - plagiarism_result_id (UUID FK): Link to plagiarism result
 * - flagged_by_user_id (UUID FK): Instructor who created flag
 * - status (ENUM): FLAGGED, INVESTIGATING, RESOLVED, FALSE_POSITIVE
 * - action (TEXT): Action taken (e.g., "Student warned", "Grade reduced")
 * - investigation_notes (TEXT): Detailed investigation notes
 * - flagged_at (TIMESTAMP): When flag was created
 * - resolved_at (TIMESTAMP): When investigation completed
 * - created_at (TIMESTAMP): When record created
 * - updated_at (TIMESTAMP): Last modification
 *
 * Indices:
 * - idx_plagiarism_flags_tenant_id: Tenant filtering
 * - idx_plagiarism_flags_submission_id: Submission lookup
 * - idx_plagiarism_flags_plagiarism_result_id: Result linking
 * - idx_plagiarism_flags_flagged_by_user_id: Investigator filtering
 * - idx_plagiarism_flags_status: Status filtering (unresolved investigations)
 * - idx_plagiarism_flags_flagged_at: Timeline queries
 *
 * Foreign Keys:
 * - submission_id → submissions.id (CASCADE)
 * - plagiarism_result_id → plagiarism_results.id (CASCADE)
 * - flagged_by_user_id → users.id (SET NULL - keep history if user deleted)
 * - institution_id → institutions.id (CASCADE)
 *
 * Row-Level Security: Tenant isolation via tenant_id
 *
 * Workflow:
 * - Flag created in FLAGGED status when plagiarism_score >= threshold
 * - Investigator transitions to INVESTIGATING
 * - Action and notes recorded
 * - Status changed to RESOLVED or FALSE_POSITIVE when complete
 * - Investigation history preserved for audit trail
 *
 * Requirement 4.2: Plagiarism Flag Entity & Repository
 */
export class CreatePlagiarismFlags1704067200011 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create plagiarism_flags table
    await queryRunner.createTable(
      new Table({
        name: 'plagiarism_flags',
        schema: 'grading',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'tenant_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'institution_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'submission_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'plagiarism_result_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'flagged_by_user_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['FLAGGED', 'INVESTIGATING', 'RESOLVED', 'FALSE_POSITIVE'],
            isNullable: false,
            default: "'FLAGGED'",
          },
          {
            name: 'action',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'investigation_notes',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'flagged_at',
            type: 'timestamp with time zone',
            isNullable: false,
            default: 'now()',
          },
          {
            name: 'resolved_at',
            type: 'timestamp with time zone',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp with time zone',
            isNullable: false,
            default: 'now()',
          },
          {
            name: 'updated_at',
            type: 'timestamp with time zone',
            isNullable: false,
            default: 'now()',
          },
        ],
        foreignKeys: [
          {
            columnNames: ['submission_id'],
            referencedSchema: 'grading',
            referencedTableName: 'submissions',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
          {
            columnNames: ['plagiarism_result_id'],
            referencedSchema: 'grading',
            referencedTableName: 'plagiarism_results',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
          {
            columnNames: ['flagged_by_user_id'],
            referencedSchema: 'grading',
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
          },
          {
            columnNames: ['institution_id'],
            referencedSchema: 'grading',
            referencedTableName: 'institutions',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
    );

    // Create indices for efficient querying
    await queryRunner.createIndex(
      'plagiarism_flags',
      new TableIndex({
        name: 'idx_plagiarism_flags_tenant_id',
        columnNames: ['tenant_id'],
      }),
    );

    await queryRunner.createIndex(
      'plagiarism_flags',
      new TableIndex({
        name: 'idx_plagiarism_flags_submission_id',
        columnNames: ['submission_id'],
      }),
    );

    await queryRunner.createIndex(
      'plagiarism_flags',
      new TableIndex({
        name: 'idx_plagiarism_flags_plagiarism_result_id',
        columnNames: ['plagiarism_result_id'],
      }),
    );

    await queryRunner.createIndex(
      'plagiarism_flags',
      new TableIndex({
        name: 'idx_plagiarism_flags_flagged_by_user_id',
        columnNames: ['flagged_by_user_id'],
      }),
    );

    await queryRunner.createIndex(
      'plagiarism_flags',
      new TableIndex({
        name: 'idx_plagiarism_flags_status',
        columnNames: ['status'],
      }),
    );

    await queryRunner.createIndex(
      'plagiarism_flags',
      new TableIndex({
        name: 'idx_plagiarism_flags_flagged_at',
        columnNames: ['flagged_at'],
      }),
    );

    // Create composite index for tenant + status (for unresolved investigations)
    await queryRunner.createIndex(
      'plagiarism_flags',
      new TableIndex({
        name: 'idx_plagiarism_flags_tenant_status',
        columnNames: ['tenant_id', 'status'],
      }),
    );

    // Enable Row-Level Security
    await queryRunner.query(
      `ALTER TABLE grading.plagiarism_flags ENABLE ROW LEVEL SECURITY`,
    );

    // Create RLS policy for tenant isolation
    await queryRunner.query(`
      CREATE POLICY plagiarism_flags_tenant_isolation ON grading.plagiarism_flags
      USING (tenant_id = grading.get_current_tenant_id())
      WITH CHECK (tenant_id = grading.get_current_tenant_id())
    `);

    // Add table comment
    await queryRunner.query(`
      COMMENT ON TABLE grading.plagiarism_flags IS 'Tracks plagiarism investigation workflow. Stores investigation status, actions, notes, and audit trail. Tenant-isolated via RLS. Workflow: FLAGGED → INVESTIGATING → RESOLVED.';
    `);

    console.log('✓ Created plagiarism_flags table');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop table (CASCADE will remove indices and constraints)
    await queryRunner.dropTable('plagiarism_flags', true, true, true);
    console.log('✓ Dropped plagiarism_flags table');
  }
}
