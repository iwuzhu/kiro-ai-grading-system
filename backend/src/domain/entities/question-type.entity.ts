import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * QuestionType Entity
 *
 * Reference table defining supported question types in the system.
 * Each question type has a schema template to guide UI rendering and validation.
 *
 * Question Types:
 * - MULTIPLE_CHOICE: Select one correct answer from options
 * - SHORT_ANSWER: Brief written response (1-2 sentences)
 * - FILL_BLANK: Complete sentence with missing word(s)
 * - ESSAY: Long-form written response
 * - CODE: Source code submission
 * - FILE_UPLOAD: Upload a file (PDF, document, image, etc.)
 *
 * The schema_template provides guidance for frontend form rendering and
 * backend validation of questions of this type.
 */
@Entity('question_types', { schema: 'grading' })
@Index('idx_question_types_id', ['id'])
export class QuestionType {
  /**
   * Question Type ID
   * Primary key: MULTIPLE_CHOICE, SHORT_ANSWER, FILL_BLANK, ESSAY, CODE, FILE_UPLOAD
   * Format: UPPERCASE_WITH_UNDERSCORES
   */
  @PrimaryColumn({ type: 'varchar', length: 50 })
  id: string;

  /**
   * Display Name
   * Human-readable name of the question type
   * Example: "Multiple Choice"
   */
  @Column({ type: 'varchar', length: 100, nullable: false })
  name: string;

  /**
   * Description
   * Detailed description of what this question type is for
   * Example: "Select one correct answer from options"
   */
  @Column({ type: 'text', nullable: true })
  description: string | null;

  /**
   * Schema Template
   * JSONB object containing the structure/schema for this question type
   * Used by frontend to render question editor forms
   * Example for MULTIPLE_CHOICE:
   * {
   *   "prompt": "What is 2 + 2?",
   *   "options": [
   *     { "label": "A", "text": "3" },
   *     { "label": "B", "text": "4" }
   *   ],
   *   "correctAnswer": "B",
   *   "pointValue": 5
   * }
   */
  @Column({ type: 'jsonb', nullable: false })
  schema_template: Record<string, any>;

  /**
   * Created At
   * When this question type was added to the system
   */
  @CreateDateColumn()
  created_at: Date;
}
