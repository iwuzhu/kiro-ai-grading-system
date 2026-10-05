/**
 * Frontend Question Type System
 *
 * Mirror of backend question types for TypeScript type safety
 * Used in React components and API calls
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

export const QUESTION_TYPE_LABELS: Record<QuestionTypeEnum, string> = {
  [QuestionTypeEnum.MULTIPLE_CHOICE]: 'Multiple Choice',
  [QuestionTypeEnum.SHORT_ANSWER]: 'Short Answer',
  [QuestionTypeEnum.FILL_BLANK]: 'Fill in the Blank',
  [QuestionTypeEnum.ESSAY]: 'Essay',
  [QuestionTypeEnum.CODE]: 'Code',
  [QuestionTypeEnum.FILE_UPLOAD]: 'File Upload',
};

export const QUESTION_TYPE_DESCRIPTIONS: Record<QuestionTypeEnum, string> = {
  [QuestionTypeEnum.MULTIPLE_CHOICE]: 'Select one correct answer from options',
  [QuestionTypeEnum.SHORT_ANSWER]: 'Brief written response (1-2 sentences)',
  [QuestionTypeEnum.FILL_BLANK]: 'Complete sentence with missing word(s)',
  [QuestionTypeEnum.ESSAY]: 'Long-form written response',
  [QuestionTypeEnum.CODE]: 'Source code submission',
  [QuestionTypeEnum.FILE_UPLOAD]: 'Upload a file (PDF, document, image, etc.)',
};

// ========== BASE QUESTION INTERFACE ==========

export interface BaseQuestion {
  id: string;
  type: QuestionTypeEnum;
  prompt: string;
  pointValue: number;
  createdAt?: Date;
  updatedAt?: Date;
}

// ========== QUESTION TYPE-SPECIFIC INTERFACES ==========

export interface MultipleChoiceQuestion extends BaseQuestion {
  type: QuestionTypeEnum.MULTIPLE_CHOICE;
  options: {
    label: string;
    text: string;
  }[];
  correctAnswer: string;
  explanation?: string;
}

export interface ShortAnswerQuestion extends BaseQuestion {
  type: QuestionTypeEnum.SHORT_ANSWER;
  expectedAnswer: string;
  keywords?: string[];
  minWords?: number;
  maxWords?: number;
}

export interface FillBlankQuestion extends BaseQuestion {
  type: QuestionTypeEnum.FILL_BLANK;
  blanks: {
    position: number;
    answers: string[];
  }[];
}

export interface EssayQuestion extends BaseQuestion {
  type: QuestionTypeEnum.ESSAY;
  rubricCriteria?: string[];
  minWords?: number;
  maxWords?: number;
  allowedFormatting?: string[];
}

export interface CodeQuestion extends BaseQuestion {
  type: QuestionTypeEnum.CODE;
  language: string;
  starterCode?: string;
  testCases?: {
    input: string;
    expectedOutput: string;
    description?: string;
  }[];
  hiddenTestCases?: number;
}

export interface FileUploadQuestion extends BaseQuestion {
  type: QuestionTypeEnum.FILE_UPLOAD;
  allowedTypes?: string[];
  maxSizeBytes?: number;
  description?: string;
}

export type Question =
  | MultipleChoiceQuestion
  | ShortAnswerQuestion
  | FillBlankQuestion
  | EssayQuestion
  | CodeQuestion
  | FileUploadQuestion;

// ========== ASSIGNMENT CONTENT ==========

export interface AssignmentContent {
  questions: Question[];
  version?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Assignment {
  id: string;
  tenant_id: string;
  course_id: string;
  rubric_id?: string;
  title: string;
  description?: string;
  point_value?: number;
  content: AssignmentContent;
  published_status: PublishedStatusEnum;
  allow_incremental: boolean;
  soft_deadline?: Date;
  hard_deadline?: Date;
  published_at?: Date;
  published_by_user_id?: string;
  late_penalty_percent: number;
  created_by_user_id: string;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
}

// ========== ANSWER TYPE-SPECIFIC INTERFACES ==========

export interface BaseAnswer {
  questionId: string;
  type: QuestionTypeEnum;
  submittedAt?: Date;
}

export interface MultipleChoiceAnswer extends BaseAnswer {
  type: QuestionTypeEnum.MULTIPLE_CHOICE;
  selectedOption: string;
}

export interface ShortAnswerAnswer extends BaseAnswer {
  type: QuestionTypeEnum.SHORT_ANSWER;
  answer: string;
  wordCount?: number;
}

export interface FillBlankAnswer extends BaseAnswer {
  type: QuestionTypeEnum.FILL_BLANK;
  answers: {
    blankPosition: number;
    answer: string;
  }[];
}

export interface EssayAnswer extends BaseAnswer {
  type: QuestionTypeEnum.ESSAY;
  essay: string;
  wordCount: number;
}

export interface CodeAnswer extends BaseAnswer {
  type: QuestionTypeEnum.CODE;
  code: string;
  language: string;
  testResults?: {
    passed: number;
    total: number;
    details: string;
  };
}

export interface FileUploadAnswer extends BaseAnswer {
  type: QuestionTypeEnum.FILE_UPLOAD;
  files: {
    originalName: string;
    mimeType: string;
    s3Uri: string;
    uploadedAt: Date;
    sizeBytes: number;
  }[];
}

export type Answer =
  | MultipleChoiceAnswer
  | ShortAnswerAnswer
  | FillBlankAnswer
  | EssayAnswer
  | CodeAnswer
  | FileUploadAnswer;

// ========== SUBMISSION CONTENT ==========

export interface SubmissionContent {
  answers: Answer[];
  startedAt: Date;
  completedAt: Date;
  version?: number;
}

export interface Submission {
  id: string;
  tenant_id: string;
  assignment_id: string;
  student_id: string;
  version: number;
  is_incremental: boolean;
  content: SubmissionContent;
  answer_status: AnswerStatusEnum;
  question_count: number;
  file_path?: string;
  file_type?: string;
  is_late: boolean;
  submitted_at: Date;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
}

// ========== FORM STATE INTERFACES ==========

/**
 * Form state for creating/editing questions
 */
export interface QuestionFormState {
  id: string;
  type: QuestionTypeEnum;
  prompt: string;
  pointValue: number;
  
  // Type-specific fields
  options?: { label: string; text: string }[];
  correctAnswer?: string;
  expectedAnswer?: string;
  keywords?: string[];
  minWords?: number;
  maxWords?: number;
  blanks?: { position: number; answers: string[] }[];
  language?: string;
  starterCode?: string;
  testCases?: { input: string; expectedOutput: string; description?: string }[];
  allowedTypes?: string[];
  maxSizeBytes?: number;
  rubricCriteria?: string[];
}

/**
 * Form state for submitting answers
 */
export interface AnswerFormState {
  [key: string]: any; // Flexible for different question types
  
  // Common fields
  questionId: string;
  type: QuestionTypeEnum;
  
  // Type-specific fields
  selectedOption?: string; // MULTIPLE_CHOICE
  answer?: string; // SHORT_ANSWER
  essay?: string; // ESSAY
  code?: string; // CODE
  answers?: { blankPosition: number; answer: string }[]; // FILL_BLANK
  files?: { originalName: string; s3Uri: string }[]; // FILE_UPLOAD
}

/**
 * Form state for creating assignments
 */
export interface AssignmentFormState {
  id?: string;
  title: string;
  description?: string;
  pointValue?: number;
  allowIncremental: boolean;
  softDeadline?: Date;
  hardDeadline?: Date;
  latePenaltyPercent: number;
  questions: Question[];
  publishedStatus: PublishedStatusEnum;
}

// ========== API REQUEST/RESPONSE TYPES ==========

export interface CreateAssignmentRequest {
  title: string;
  description?: string;
  pointValue?: number;
  allowIncremental?: boolean;
  softDeadline?: string; // ISO date string
  hardDeadline?: string;
  latePenaltyPercent?: number;
}

export interface AddQuestionRequest {
  question: Question;
}

export interface EditQuestionRequest {
  updates: Partial<Question>;
}

export interface SubmitAnswerRequest {
  answer: Answer;
}

export interface SubmitAnswersRequest {
  answers: Answer[];
}

// ========== VALIDATION HELPERS ==========

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
