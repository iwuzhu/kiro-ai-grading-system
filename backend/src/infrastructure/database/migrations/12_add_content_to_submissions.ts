import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddContentToSubmissions1725312000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE grading.submissions
      ADD COLUMN content TEXT NULL
    `)

    await queryRunner.query(`
      COMMENT ON COLUMN grading.submissions.content IS 'Text submission content (for essays, short answers, etc.)'
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE grading.submissions
      DROP COLUMN content
    `)
  }
}
