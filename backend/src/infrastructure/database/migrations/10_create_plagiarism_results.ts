import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

/**
 * Migration 10: Create Plagiarism Results Table
 *
 * Creates the plagiarism_results table to store plagiarism scan results.
 * Stores plagiarism scores, AI-generation scores, source matches, and scan metadata.
 *
 * Table: plagiarism_results
 * Schema: grading
 *
 * Columns:
 * - id (UUID PK): Unique result identifier
 * - tenant_id (UUID): Tenant isolation
 * - institution_id (UUID): Institution reference
 * - submission_id (UUID FK): Link to submission
 * - assignment_id (UUID FK): Link to assignment (denormalized for optimization)
 * - overall_score (NUMERIC 5,2): Plagiarism percentage (0-100%)
 * - ai_generation_score (NUMERIC 5,2): AI content percentage (0-100%)
 * - turnitin_scan_id (VARCHAR): External Turnitin reference
 * - source_matches (JSONB): Array of matched sources
 * - status (ENUM): PENDING, COMPLETED, FAILED
 * - scanned_at (TIMESTAMP): When scan completed
 * - created_at (TIMESTAMP): When record created
 * - updated_at (TIMESTAMP): Last modification
 *
 * Indices:
 * - idx_plagiarism_results_tenant_id: Tenant filtering
 * - idx_plagiarism_results_submission_id: Submission lookup
 * - idx_plagiarism_results_assignment_id: Assignment-wide analysis
 * - idx_plagiarism_results_status: Status filtering for pending/failed retries
 * - idx_plagiarism_results_scanned_at: Temporal queries
 *
 * Foreign Keys:
 * - submission_id → submissions.id (CASCADE)
 * - assignment_id → assignments.id (CASCADE)
 * - institution_id → institutions.id (CASCADE)
 *
 * Unique Constraints:
 * - unique_plagiarism_result_submission_status: Prevents duplicate active results
 *
 * Row-Level Security: Tenant isolation via tenant_id
 *
 * Requirement 4.1: Plagiarism Result Entity & Repository
 */
export class CreatePlagiarismResults1704067200010 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create plagiarism_results table
    await queryRunner.createTable(
      new Table({
        name: 'plagiarism_results',
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
            name: 'assignment_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'overall_score',
            type: 'numeric',
            precision: 5,
            scale: 2,
            isNullable: false,
            default: 0,
          },
          {
            name: 'ai_generation_score',
            type: 'numeric',
            precision: 5,
            scale: 2,
            isNullable: false,
            default: 0,
          },
          {
            name: 'turnitin_scan_id',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'source_matches',
            type: 'jsonb',
            isNullable: false,
            default: "'[]'::jsonb",
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['PENDING', 'COMPLETED', 'FAILED'],
            isNullable: false,
            default: "'PENDING'",
          },
          {
            name: 'scanned_at',
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
            columnNames: ['assignment_id'],
            referencedSchema: 'grading',
            referencedTableName: 'assignments',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
          {
            columnNames: ['institution_id'],
            referencedSchema: 'grading',
            referencedTableName: 'institutions',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
        uniques: [
          {
            columnNames: ['submission_id', 'status'],
            name: 'unique_plagiarism_result_submission_status',
          },
        ],
      }),
    );

    // Create indices for efficient querying
    await queryRunner.createIndex(
      'plagiarism_results',
      new TableIndex({
        name: 'idx_plagiarism_results_tenant_id',
        columnNames: ['tenant_id'],
      }),
    );

    await queryRunner.createIndex(
      'plagiarism_results',
      new TableIndex({
        name: 'idx_plagiarism_results_submission_id',
        columnNames: ['submission_id'],
      }),
    );

    await queryRunner.createIndex(
      'plagiarism_results',
      new TableIndex({
        name: 'idx_plagiarism_results_assignment_id',
        columnNames: ['assignment_id'],
      }),
    );

    await queryRunner.createIndex(
      'plagiarism_results',
      new TableIndex({
        name: 'idx_plagiarism_results_status',
        columnNames: ['status'],
      }),
    );

    await queryRunner.createIndex(
      'plagiarism_results',
      new TableIndex({
        name: 'idx_plagiarism_results_scanned_at',
        columnNames: ['scanned_at'],
      }),
    );

    // Create composite index for tenant + assignment analysis
    await queryRunner.createIndex(
      'plagiarism_results',
      new TableIndex({
        name: 'idx_plagiarism_results_tenant_assignment',
        columnNames: ['tenant_id', 'assignment_id'],
      }),
    );

    // Create composite index for score-based filtering
    await queryRunner.createIndex(
      'plagiarism_results',
      new TableIndex({
        name: 'idx_plagiarism_results_overall_score',
        columnNames: ['overall_score'],
      }),
    );

    // Enable Row-Level Security
    await queryRunner.query(
      `ALTER TABLE grading.plagiarism_results ENABLE ROW LEVEL SECURITY`,
    );

    // Create RLS policy for tenant isolation
    await queryRunner.query(`
      CREATE POLICY plagiarism_results_tenant_isolation ON grading.plagiarism_results
      USING (tenant_id = grading.get_current_tenant_id())
      WITH CHECK (tenant_id = grading.get_current_tenant_id())
    `);

    // Add table comment
    await queryRunner.query(`
      COMMENT ON TABLE grading.plagiarism_results IS 'Stores plagiarism scan results for submissions. Tracks plagiarism score, AI-generation score, source matches, and scan status. Tenant-isolated via RLS.';
    `);

    console.log('✓ Created plagiarism_results table');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop table (CASCADE will remove indices and constraints)
    await queryRunner.dropTable('plagiarism_results', true, true, true);
    console.log('✓ Dropped plagiarism_results table');
  }
}
