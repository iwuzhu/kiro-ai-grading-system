import {
  Question,
  Answer,
  QuestionTypeEnum,
  MultipleChoiceQuestion,
  ShortAnswerQuestion,
  FillBlankQuestion,
  EssayQuestion,
  CodeQuestion,
  FileUploadQuestion,
  isMultipleChoiceQuestion,
  isShortAnswerQuestion,
  isFillBlankQuestion,
  isEssayQuestion,
  isCodeQuestion,
  isFileUploadQuestion,
} from './question.types';

/**
 * Question Validation Errors
 */
export class QuestionValidationError extends Error {
  constructor(
    public questionId: string,
    public field: string,
    public message: string,
  ) {
    super(`Question ${questionId} - ${field}: ${message}`);
    this.name = 'QuestionValidationError';
  }
}

/**
 * Answer Validation Errors
 */
export class AnswerValidationError extends Error {
  constructor(
    public questionId: string,
    public message: string,
  ) {
    super(`Answer for question ${questionId}: ${message}`);
    this.name = 'AnswerValidationError';
  }
}

/**
 * Question Validator
 *
 * Validates question structures before storage
 */
export class QuestionValidator {
  /**
   * Validate a single question
   * @throws QuestionValidationError if validation fails
   */
  static validate(question: Question): void {
    // Common validations
    if (!question.id || question.id.trim().length === 0) {
      throw new QuestionValidationError(question.id || 'unknown', 'id', 'Question ID is required');
    }

    if (!question.prompt || question.prompt.trim().length === 0) {
      throw new QuestionValidationError(question.id, 'prompt', 'Prompt is required');
    }

    if (!question.pointValue || question.pointValue <= 0) {
      throw new QuestionValidationError(
        question.id,
        'pointValue',
        'Point value must be greater than 0',
      );
    }

    // Type-specific validations
    switch (question.type) {
      case QuestionTypeEnum.MULTIPLE_CHOICE:
        this.validateMultipleChoice(question as MultipleChoiceQuestion);
        break;
      case QuestionTypeEnum.SHORT_ANSWER:
        this.validateShortAnswer(question as ShortAnswerQuestion);
        break;
      case QuestionTypeEnum.FILL_BLANK:
        this.validateFillBlank(question as FillBlankQuestion);
        break;
      case QuestionTypeEnum.ESSAY:
        this.validateEssay(question as EssayQuestion);
        break;
      case QuestionTypeEnum.CODE:
        this.validateCode(question as CodeQuestion);
        break;
      case QuestionTypeEnum.FILE_UPLOAD:
        this.validateFileUpload(question as FileUploadQuestion);
        break;
      default:
        throw new QuestionValidationError(
          (question as any).id,
          'type',
          `Unknown question type: ${(question as any).type}`,
        );
    }
  }

  private static validateMultipleChoice(q: MultipleChoiceQuestion): void {
    if (!Array.isArray(q.options) || q.options.length < 2) {
      throw new QuestionValidationError(q.id, 'options', 'At least 2 options required');
    }

    q.options.forEach((opt, idx) => {
      if (!opt.label || !opt.text) {
        throw new QuestionValidationError(
          q.id,
          `options[${idx}]`,
          'Each option must have label and text',
        );
      }
    });

    const validLabels = q.options.map((o) => o.label);
    if (!validLabels.includes(q.correctAnswer)) {
      throw new QuestionValidationError(
        q.id,
        'correctAnswer',
        `Correct answer must be one of: ${validLabels.join(', ')}`,
      );
    }
  }

  private static validateShortAnswer(q: ShortAnswerQuestion): void {
    if (!q.expectedAnswer || q.expectedAnswer.trim().length === 0) {
      throw new QuestionValidationError(
        q.id,
        'expectedAnswer',
        'Expected answer is required',
      );
    }

    if (q.minWords !== undefined && q.maxWords !== undefined && q.minWords > q.maxWords) {
      throw new QuestionValidationError(
        q.id,
        'minWords/maxWords',
        'Minimum words cannot exceed maximum words',
      );
    }
  }

  private static validateFillBlank(q: FillBlankQuestion): void {
    if (!Array.isArray(q.blanks) || q.blanks.length === 0) {
      throw new QuestionValidationError(q.id, 'blanks', 'At least 1 blank required');
    }

    q.blanks.forEach((blank, idx) => {
      if (blank.position === undefined || blank.position < 0) {
        throw new QuestionValidationError(
          q.id,
          `blanks[${idx}].position`,
          'Position must be non-negative',
        );
      }

      if (!Array.isArray(blank.answers) || blank.answers.length === 0) {
        throw new QuestionValidationError(
          q.id,
          `blanks[${idx}].answers`,
          'At least 1 acceptable answer required',
        );
      }
    });
  }

  private static validateEssay(q: EssayQuestion): void {
    // Essay questions are relatively flexible
    if (q.minWords !== undefined && q.maxWords !== undefined && q.minWords > q.maxWords) {
      throw new QuestionValidationError(
        q.id,
        'minWords/maxWords',
        'Minimum words cannot exceed maximum words',
      );
    }
  }

  private static validateCode(q: CodeQuestion): void {
    if (!q.language || q.language.trim().length === 0) {
      throw new QuestionValidationError(q.id, 'language', 'Programming language is required');
    }

    const validLanguages = ['python', 'javascript', 'java', 'cpp', 'c', 'go', 'rust', 'typescript'];
    if (!validLanguages.includes(q.language.toLowerCase())) {
      throw new QuestionValidationError(
        q.id,
        'language',
        `Language must be one of: ${validLanguages.join(', ')}`,
      );
    }

    if (q.testCases) {
      q.testCases.forEach((tc, idx) => {
        if (!tc.input || !tc.expectedOutput) {
          throw new QuestionValidationError(
            q.id,
            `testCases[${idx}]`,
            'Each test case must have input and expectedOutput',
          );
        }
      });
    }
  }

  private static validateFileUpload(q: FileUploadQuestion): void {
    if (q.maxSizeBytes !== undefined && q.maxSizeBytes <= 0) {
      throw new QuestionValidationError(
        q.id,
        'maxSizeBytes',
        'Max file size must be greater than 0',
      );
    }

    // No specific file type validation - allow any types specified
  }

  /**
   * Validate all questions in an assignment content
   * @throws QuestionValidationError if any question is invalid
   */
  static validateAssignment(questions: Question[]): void {
    if (!Array.isArray(questions)) {
      throw new Error('Questions must be an array');
    }

    if (questions.length === 0) {
      throw new Error('Assignment must contain at least one question');
    }

    // Check for duplicate question IDs
    const ids = new Set<string>();
    questions.forEach((q) => {
      if (ids.has(q.id)) {
        throw new Error(`Duplicate question ID: ${q.id}`);
      }
      ids.add(q.id);
    });

    // Validate each question
    questions.forEach((q) => this.validate(q));
  }
}

/**
 * Answer Validator
 *
 * Validates student answers against question requirements
 */
export class AnswerValidator {
  /**
   * Validate an answer against its corresponding question
   * @throws AnswerValidationError if answer is invalid
   */
  static validate(answer: Answer, question: Question): void {
    if (answer.questionId !== question.id) {
      throw new AnswerValidationError(
        answer.questionId,
        'Question ID mismatch',
      );
    }

    if (answer.type !== question.type) {
      throw new AnswerValidationError(
        answer.questionId,
        `Answer type ${answer.type} does not match question type ${question.type}`,
      );
    }

    // Type-specific validations
    switch (answer.type) {
      case QuestionTypeEnum.MULTIPLE_CHOICE:
        if (isMultipleChoiceQuestion(question)) {
          this.validateMultipleChoiceAnswer(answer as any, question);
        }
        break;
      case QuestionTypeEnum.SHORT_ANSWER:
        if (isShortAnswerQuestion(question)) {
          this.validateShortAnswerAnswer(answer as any, question);
        }
        break;
      case QuestionTypeEnum.FILL_BLANK:
        if (isFillBlankQuestion(question)) {
          this.validateFillBlankAnswer(answer as any, question);
        }
        break;
      case QuestionTypeEnum.ESSAY:
        if (isEssayQuestion(question)) {
          this.validateEssayAnswer(answer as any, question);
        }
        break;
      case QuestionTypeEnum.CODE:
        if (isCodeQuestion(question)) {
          this.validateCodeAnswer(answer as any, question);
        }
        break;
      case QuestionTypeEnum.FILE_UPLOAD:
        if (isFileUploadQuestion(question)) {
          this.validateFileUploadAnswer(answer as any, question);
        }
        break;
    }
  }

  private static validateMultipleChoiceAnswer(
    answer: any,
    question: MultipleChoiceQuestion,
  ): void {
    if (!answer.selectedOption) {
      throw new AnswerValidationError(answer.questionId, 'Selected option is required');
    }

    const validOptions = question.options.map((o) => o.label);
    if (!validOptions.includes(answer.selectedOption)) {
      throw new AnswerValidationError(
        answer.questionId,
        `Selected option must be one of: ${validOptions.join(', ')}`,
      );
    }
  }

  private static validateShortAnswerAnswer(answer: any, question: ShortAnswerQuestion): void {
    if (!answer.answer || answer.answer.trim().length === 0) {
      throw new AnswerValidationError(answer.questionId, 'Answer text is required');
    }

    const wordCount = answer.answer.trim().split(/\s+/).length;
    if (question.minWords && wordCount < question.minWords) {
      throw new AnswerValidationError(
        answer.questionId,
        `Minimum ${question.minWords} words required, got ${wordCount}`,
      );
    }

    if (question.maxWords && wordCount > question.maxWords) {
      throw new AnswerValidationError(
        answer.questionId,
        `Maximum ${question.maxWords} words allowed, got ${wordCount}`,
      );
    }
  }

  private static validateFillBlankAnswer(answer: any, question: FillBlankQuestion): void {
    if (!Array.isArray(answer.answers)) {
      throw new AnswerValidationError(answer.questionId, 'Answers array is required');
    }

    if (answer.answers.length !== question.blanks.length) {
      throw new AnswerValidationError(
        answer.questionId,
        `Expected ${question.blanks.length} answers, got ${answer.answers.length}`,
      );
    }

    answer.answers.forEach((a: any, idx: number) => {
      if (!a.answer || a.answer.trim().length === 0) {
        throw new AnswerValidationError(answer.questionId, `Blank ${idx + 1} requires an answer`);
      }
    });
  }

  private static validateEssayAnswer(answer: any, question: EssayQuestion): void {
    if (!answer.essay || answer.essay.trim().length === 0) {
      throw new AnswerValidationError(answer.questionId, 'Essay text is required');
    }

    const wordCount = answer.essay.trim().split(/\s+/).length;
    if (question.minWords && wordCount < question.minWords) {
      throw new AnswerValidationError(
        answer.questionId,
        `Minimum ${question.minWords} words required, got ${wordCount}`,
      );
    }

    if (question.maxWords && wordCount > question.maxWords) {
      throw new AnswerValidationError(
        answer.questionId,
        `Maximum ${question.maxWords} words allowed, got ${wordCount}`,
      );
    }
  }

  private static validateCodeAnswer(answer: any, question: CodeQuestion): void {
    if (!answer.code || answer.code.trim().length === 0) {
      throw new AnswerValidationError(answer.questionId, 'Code is required');
    }

    if (!answer.language) {
      throw new AnswerValidationError(answer.questionId, 'Programming language is required');
    }
  }

  private static validateFileUploadAnswer(answer: any, question: FileUploadQuestion): void {
    if (!Array.isArray(answer.files) || answer.files.length === 0) {
      throw new AnswerValidationError(answer.questionId, 'At least one file is required');
    }

    answer.files.forEach((file: any, idx: number) => {
      if (!file.s3Uri || !file.originalName) {
        throw new AnswerValidationError(
          answer.questionId,
          `File ${idx + 1} missing required fields (s3Uri, originalName)`,
        );
      }

      if (question.maxSizeBytes && file.sizeBytes > question.maxSizeBytes) {
        throw new AnswerValidationError(
          answer.questionId,
          `File ${idx + 1} exceeds maximum size of ${question.maxSizeBytes} bytes`,
        );
      }

      if (question.allowedTypes && question.allowedTypes.length > 0) {
        const ext = file.originalName.split('.').pop()?.toLowerCase();
        if (!question.allowedTypes.includes(ext || '')) {
          throw new AnswerValidationError(
            answer.questionId,
            `File ${idx + 1} type not allowed. Allowed types: ${question.allowedTypes.join(', ')}`,
          );
        }
      }
    });
  }
}
