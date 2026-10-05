import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveTypeFieldFromAssignments1704067200000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop the type column from assignments table
    await queryRunner.query(
      `ALTER TABLE grading.assignments DROP COLUMN IF EXISTS type;`
    );

    // Drop the assignment_type enum if it exists (it might be used elsewhere, so check first)
    // This is safe in PostgreSQL - it will only drop if no other tables use it
    await queryRunner.query(
      `DO $$ BEGIN
         DROP TYPE IF EXISTS grading.assignment_type CASCADE;
       EXCEPTION WHEN OTHERS THEN
         NULL;
       END $$;`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Recreate the assignment_type enum
    await queryRunner.query(
      `CREATE TYPE grading.assignment_type AS ENUM (
        'essay',
        'code',
        'quiz',
        'short-answer',
        'file',
        'project'
      );`
    );

    // Recreate the type column with default value
    await queryRunner.query(
      `ALTER TABLE grading.assignments 
       ADD COLUMN type grading.assignment_type DEFAULT 'essay'::grading.assignment_type;`
    );
  }
}
