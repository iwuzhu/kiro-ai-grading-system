import { MigrationInterface, QueryRunner } from 'typeorm'

export class UpdateAssignmentTypeEnum1728057600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create new enum type with updated values
    await queryRunner.query(`
      CREATE TYPE grading.assignments_type_enum_new AS ENUM (
        'ESSAY',
        'CODE',
        'MULTIPLE_CHOICE',
        'FILL_BLANK',
        'SHORT_ANSWER',
        'FILE'
      )
    `)

    // Convert existing values (QUIZ -> MULTIPLE_CHOICE)
    await queryRunner.query(`
      ALTER TABLE grading.assignments
      ALTER COLUMN type TYPE grading.assignments_type_enum_new
      USING CASE
        WHEN type::text = 'QUIZ' THEN 'MULTIPLE_CHOICE'::grading.assignments_type_enum_new
        ELSE type::text::grading.assignments_type_enum_new
      END
    `)

    // Drop old enum
    await queryRunner.query(`
      DROP TYPE grading.assignments_type_enum
    `)

    // Rename new enum to old name
    await queryRunner.query(`
      ALTER TYPE grading.assignments_type_enum_new RENAME TO assignments_type_enum
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Create old enum type with original values
    await queryRunner.query(`
      CREATE TYPE grading.assignments_type_enum_old AS ENUM (
        'ESSAY',
        'CODE',
        'QUIZ',
        'SHORT_ANSWER',
        'FILE'
      )
    `)

    // Convert values back (MULTIPLE_CHOICE -> QUIZ, FILL_BLANK -> QUIZ)
    await queryRunner.query(`
      ALTER TABLE grading.assignments
      ALTER COLUMN type TYPE grading.assignments_type_enum_old
      USING CASE
        WHEN type::text IN ('MULTIPLE_CHOICE', 'FILL_BLANK') THEN 'QUIZ'::grading.assignments_type_enum_old
        ELSE type::text::grading.assignments_type_enum_old
      END
    `)

    // Drop new enum
    await queryRunner.query(`
      DROP TYPE grading.assignments_type_enum
    `)

    // Rename old enum back
    await queryRunner.query(`
      ALTER TYPE grading.assignments_type_enum_old RENAME TO assignments_type_enum
    `)
  }
}
