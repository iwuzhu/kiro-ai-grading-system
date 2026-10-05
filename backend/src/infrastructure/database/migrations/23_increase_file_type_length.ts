import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Increase file_type column length
 * 
 * Issue: MIME types can be long (e.g., application/vnd.openxmlformats-officedocument.wordprocessingml.document = 73 chars)
 * Current limit: 50 chars causes string truncation errors
 * New limit: 255 chars to accommodate all standard MIME types
 */
export class IncreaseFileTypeLength1725316800000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Increase file_type from VARCHAR(50) to VARCHAR(255)
    await queryRunner.query(`
      ALTER TABLE grading.submissions
      ALTER COLUMN file_type TYPE VARCHAR(255)
    `);

    console.log('[Migration] ✅ Increased file_type column length to 255');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert file_type back to VARCHAR(50)
    await queryRunner.query(`
      ALTER TABLE grading.submissions
      ALTER COLUMN file_type TYPE VARCHAR(50)
    `);

    console.log('[Migration] ✅ Reverted file_type column length to 50');
  }
}
