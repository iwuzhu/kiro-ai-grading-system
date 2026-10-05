import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration 14: Create question_types Reference Table
 *
 * This migration creates a reference table for question types,
 * allowing the system to support multiple question types per assignment.
 *
 * Question types:
 * - MULTIPLE_CHOICE: Select one correct answer from options
 * - SHORT_ANSWER: Brief written response (1-2 sentences)
 * - FILL_BLANK: Complete sentence with missing word(s)
 * - ESSAY: Long-form written response
 * - CODE: Source code submission
 * - FILE_UPLOAD: Upload a file (PDF, document, image, etc.)
 *
 * The schema_template provides guidance for frontend form rendering.
 */
export class CreateQuestionTypesTable1728144000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create the question_types reference table
    await queryRunner.query(`
      CREATE TABLE grading.question_types (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        schema_template JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        CONSTRAINT valid_question_type_id CHECK (id ~ '^[A-Z_]+$')
      );

      COMMENT ON TABLE grading.question_types IS 'Reference table for supported question types';
      COMMENT ON COLUMN grading.question_types.id IS 'Question type identifier (MULTIPLE_CHOICE, SHORT_ANSWER, etc.)';
      COMMENT ON COLUMN grading.question_types.schema_template IS 'Sample JSON structure for this question type';
    `);

    // Seed with question types
    await queryRunner.query(`
      INSERT INTO grading.question_types (id, name, description, schema_template) VALUES
        (
          'MULTIPLE_CHOICE',
          'Multiple Choice',
          'Select one correct answer from options',
          '{
            "prompt": "What is 2 + 2?",
            "options": [
              { "label": "A", "text": "3" },
              { "label": "B", "text": "4" },
              { "label": "C", "text": "5" }
            ],
            "correctAnswer": "B",
            "pointValue": 5
          }'::jsonb
        ),
        (
          'SHORT_ANSWER',
          'Short Answer',
          'Brief written response (1-2 sentences)',
          '{
            "prompt": "What is the capital of France?",
            "expectedAnswer": "Paris",
            "keywords": ["Paris", "France capital"],
            "pointValue": 5
          }'::jsonb
        ),
        (
          'FILL_BLANK',
          'Fill in the Blank',
          'Complete sentence with missing word(s)',
          '{
            "prompt": "The capital of France is ____.",
            "blanks": [
              {
                "position": 0,
                "answers": ["Paris", "paris"]
              }
            ],
            "pointValue": 5
          }'::jsonb
        ),
        (
          'ESSAY',
          'Essay',
          'Long-form written response',
          '{
            "prompt": "Discuss the causes of World War II.",
            "rubricCriteria": ["Thesis clarity", "Evidence quality", "Organization"],
            "minWords": 100,
            "maxWords": 1000,
            "pointValue": 25
          }'::jsonb
        ),
        (
          'CODE',
          'Code',
          'Source code submission',
          '{
            "prompt": "Write a function to calculate factorial.",
            "language": "python",
            "starterCode": "def factorial(n):\\n    pass",
            "testCases": [
              { "input": "5", "expectedOutput": "120" }
            ],
            "pointValue": 25
          }'::jsonb
        ),
        (
          'FILE_UPLOAD',
          'File Upload',
          'Upload a file (PDF, document, image, etc.)',
          '{
            "prompt": "Upload your project documentation.",
            "allowedTypes": ["pdf", "docx", "txt"],
            "maxSizeBytes": 10485760,
            "pointValue": 10
          }'::jsonb
        );
    `);

    // Create index for fast lookups
    await queryRunner.query(`
      CREATE INDEX idx_question_types_id ON grading.question_types(id);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop the table
    await queryRunner.query(`
      DROP TABLE IF EXISTS grading.question_types CASCADE;
    `);
  }
}
