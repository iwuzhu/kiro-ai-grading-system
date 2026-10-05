/**
 * Question Type System
 *
 * Defines all supported question types, their structures, and validation rules.
 * Each question type has a specific TypeScript interface that defines its required fields.
 */

// ========== ENUMS ==========

export enum QuestionTypeEnum {
  MULTIPLE_CHOICE = 'MULTIPLE_CHOICE',
  SHORT_ANSWER = 'SHORT_ANSWER',
  FILL_BLANK = 'FILL_BLANK',
  ESSAY = 'ESSAY',
  CODE = 'CODE',
  FILE_UPLOAD = 'FILE_UPLOAD',
}

export enum AnswerStatusEnum {
  IN_PROGRESS = 'in_progress',
  SUBMITTED = 'submitted',
  GRADED = 'graded',
}

export enum PublishedStatusEnum {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
}

// ========== BASE QUESTION INTERFACE ==========

/**
 * Base question structure - all questions have these fields
 */
export interface BaseQuestion {
  id: string; // Unique question identifier within assignment
  type: QuestionTypeEnum;
  prompt: string; // The question text
  pointValue: number; // Points this question is worth
  createdAt: Date;
  updatedAt?: Date;
}

// ========== QUESTION TYPE-SPECIFIC INTERFACES ==========

/**
 * Multiple Choice Question
 * Student selects one correct answer from options
 */
export interface MultipleChoiceQuestion extends BaseQuestion {
  type: QuestionTypeEnum.MULTIPLE_CHOICE;
  options: {
    label: string; // "A", "B", "C", "D"
    text: string; // Option text
  }[];
  correctAnswer: string; // Label of correct answer
  explanation?: string; // Optional explanation of correct answer
}

/**
 * Short Answer Question
 * Student writes a brief response (1-2 sentences)
 * Graded by AI or instructor with keyword matching
 */
export interface ShortAnswerQuestion extends BaseQuestion {
  type: QuestionTypeEnum.SHORT_ANSWER;
  expectedAnswer: string; // Model/expected answer
  keywords?: string[]; // Keywords to look for in answer
  minWords?: number; // Minimum word count
  maxWords?: number; // Maximum word count
}

/**
 * Fill in the Blank Question
 * Student completes sentence(s) with missing word(s)
 */
export interface FillBlankQuestion extends BaseQuestion {
  type: QuestionTypeEnum.FILL_BLANK;
  prompt: string; // Sentence with ____ blanks
  blanks: {
    position: number; // Position/order in prompt
    answers: string[]; // Acceptable answers (case-insensitive variants)
  }[];
}

/**
 * Essay Question
 * Student writes long-form response
 * Graded by AI or instructor using rubric
 */
export interface EssayQuestion extends BaseQuestion {
  type: QuestionTypeEnum.ESSAY;
  rubricCriteria?: string[]; // Grading rubric criteria
  minWords?: number;
  maxWords?: number;
  allowedFormatting?: string[]; // "bold", "italic", "lists", "code"
}

/**
 * Code Question
 * Student submits source code
 * Can be auto-graded with test cases
 */
export interface CodeQuestion extends BaseQuestion {
  type: QuestionTypeEnum.CODE;
  language: string; // "python", "javascript", "java", "cpp", etc.
  starterCode?: string; // Optional template code
  testCases?: {
    input: string;
    expectedOutput: string;
    description?: string;
  }[];
  hiddenTestCases?: number; // Number of hidden test cases for auto-grading
}

/**
 * File Upload Question
 * Student uploads a file (PDF, document, image, code, etc.)
 */
export interface FileUploadQuestion extends BaseQuestion {
  type: QuestionTypeEnum.FILE_UPLOAD;
  allowedTypes?: string[]; // "pdf", "docx", "txt", "jpg", "png"
  maxSizeBytes?: number; // Maximum file size in bytes
  description?: string; // Additional instructions
}

// Union type of all question types
export type Question =
  | MultipleChoiceQuestion
  | ShortAnswerQuestion
  | FillBlankQuestion
  | EssayQuestion
  | CodeQuestion
  | FileUploadQuestion;

// ========== ASSIGNMENT CONTENT ==========

/**
 * Assignment Content Structure
 * JSONB stored in assignments.content column
 */
export interface AssignmentContent {
  questions: Question[];
  version?: number; // Content version for tracking changes
  createdAt?: Date;
  updatedAt?: Date;
}

// ========== ANSWER TYPE-SPECIFIC INTERFACES ==========

/**
 * Base answer structure - all answers have these fields
 */
export interface BaseAnswer {
  questionId: string; // References question in assignment
  type: QuestionTypeEnum;
  submittedAt: Date;
}

/**
 * Multiple Choice Answer
 */
export interface MultipleChoiceAnswer extends BaseAnswer {
  type: QuestionTypeEnum.MULTIPLE_CHOICE;
  selectedOption: string; // Selected answer label
}

/**
 * Short Answer
 */
export interface ShortAnswerAnswer extends BaseAnswer {
  type: QuestionTypeEnum.SHORT_ANSWER;
  answer: string; // Student's written response
  wordCount?: number; // Calculated word count
}

/**
 * Fill in the Blank Answer
 */
export interface FillBlankAnswer extends BaseAnswer {
  type: QuestionTypeEnum.FILL_BLANK;
  answers: {
    blankPosition: number;
    answer: string; // Student's answer for this blank
  }[];
}

/**
 * Essay Answer
 */
export interface EssayAnswer extends BaseAnswer {
  type: QuestionTypeEnum.ESSAY;
  essay: string; // Full essay text
  wordCount: number; // Calculated word count
}

/**
 * Code Answer
 */
export interface CodeAnswer extends BaseAnswer {
  type: QuestionTypeEnum.CODE;
  code: string; // Submitted code
  language: string; // Language used
  testResults?: {
    passed: number;
    total: number;
    details: string; // Error messages, output, etc.
  };
}

/**
 * File Upload Answer
 */
export interface FileUploadAnswer extends BaseAnswer {
  type: QuestionTypeEnum.FILE_UPLOAD;
  files: {
    originalName: string;
    mimeType: string;
    s3Uri: string; // S3 URI of uploaded file
    uploadedAt: Date;
    sizeBytes: number;
  }[];
}

// Union type of all answer types
export type Answer =
  | MultipleChoiceAnswer
  | ShortAnswerAnswer
  | FillBlankAnswer
  | EssayAnswer
  | CodeAnswer
  | FileUploadAnswer;

// ========== SUBMISSION CONTENT ==========

/**
 * Submission Content Structure
 * JSONB stored in submissions.content column
 */
export interface SubmissionContent {
  answers: Answer[];
  startedAt: Date;
  completedAt: Date;
  version?: number; // Content version for tracking changes
}

// ========== GRADING STRUCTURES ==========

/**
 * Grade Details for per-question grading
 */
export interface GradeDetails {
  rubricScores?: {
    criterion: string;
    score: number;
    maxScore: number;
    feedback?: string;
  }[];
  autoGradingOutput?: {
    testsPassed?: number;
    testsFailed?: number;
    output?: string;
    stderr?: string;
  };
  keywordMatches?: {
    found: string[];
    missing: string[];
  };
  wordCount?: number;
  codeQualityMetrics?: {
    complexity?: number;
    styleIssues?: number;
  };
}

// ========== VALIDATION HELPERS ==========

/**
 * Type guard functions to narrow union types
 */
export function isMultipleChoiceQuestion(q: Question): q is MultipleChoiceQuestion {
  return q.type === QuestionTypeEnum.MULTIPLE_CHOICE;
}

export function isShortAnswerQuestion(q: Question): q is ShortAnswerQuestion {
  return q.type === QuestionTypeEnum.SHORT_ANSWER;
}

export function isFillBlankQuestion(q: Question): q is FillBlankQuestion {
  return q.type === QuestionTypeEnum.FILL_BLANK;
}

export function isEssayQuestion(q: Question): q is EssayQuestion {
  return q.type === QuestionTypeEnum.ESSAY;
}

export function isCodeQuestion(q: Question): q is CodeQuestion {
  return q.type === QuestionTypeEnum.CODE;
}

export function isFileUploadQuestion(q: Question): q is FileUploadQuestion {
  return q.type === QuestionTypeEnum.FILE_UPLOAD;
}

// Answer type guards
export function isMultipleChoiceAnswer(a: Answer): a is MultipleChoiceAnswer {
  return a.type === QuestionTypeEnum.MULTIPLE_CHOICE;
}

export function isShortAnswerAnswer(a: Answer): a is ShortAnswerAnswer {
  return a.type === QuestionTypeEnum.SHORT_ANSWER;
}

export function isFillBlankAnswer(a: Answer): a is FillBlankAnswer {
  return a.type === QuestionTypeEnum.FILL_BLANK;
}

export function isEssayAnswer(a: Answer): a is EssayAnswer {
  return a.type === QuestionTypeEnum.ESSAY;
}

export function isCodeAnswer(a: Answer): a is CodeAnswer {
  return a.type === QuestionTypeEnum.CODE;
}

export function isFileUploadAnswer(a: Answer): a is FileUploadAnswer {
  return a.type === QuestionTypeEnum.FILE_UPLOAD;
}
