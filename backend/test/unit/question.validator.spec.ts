import { QuestionValidator, QuestionValidationError } from '../../src/domain/value-objects/question.validator';
import {
  QuestionTypeEnum,
  MultipleChoiceQuestion,
  ShortAnswerQuestion,
  EssayQuestion,
  CodeQuestion,
  FillBlankQuestion,
  FileUploadQuestion,
} from '../../src/domain/value-objects/question.types';

describe('QuestionValidator', () => {
  describe('Multiple Choice Questions', () => {
    it('should validate correct multiple choice question', () => {
      const question: MultipleChoiceQuestion = {
        id: 'q1',
        type: QuestionTypeEnum.MULTIPLE_CHOICE,
        prompt: 'What is 2+2?',
        pointValue: 5,
        createdAt: new Date(),
        options: [
          { label: 'A', text: '3' },
          { label: 'B', text: '4' },
          { label: 'C', text: '5' },
        ],
        correctAnswer: 'B',
      };

      expect(() => QuestionValidator.validate(question)).not.toThrow();
    });

    it('should reject multiple choice with fewer than 2 options', () => {
      const question: MultipleChoiceQuestion = {
        id: 'q1',
        type: QuestionTypeEnum.MULTIPLE_CHOICE,
        prompt: 'What is 2+2?',
        pointValue: 5,
        createdAt: new Date(),
        options: [{ label: 'A', text: '3' }],
        correctAnswer: 'A',
      };

      expect(() => QuestionValidator.validate(question)).toThrow(QuestionValidationError);
    });

    it('should reject multiple choice with invalid correct answer', () => {
      const question: MultipleChoiceQuestion = {
        id: 'q1',
        type: QuestionTypeEnum.MULTIPLE_CHOICE,
        prompt: 'What is 2+2?',
        pointValue: 5,
        createdAt: new Date(),
        options: [
          { label: 'A', text: '3' },
          { label: 'B', text: '4' },
        ],
        correctAnswer: 'Z', // Invalid label
      };

      expect(() => QuestionValidator.validate(question)).toThrow(QuestionValidationError);
    });

    it('should reject multiple choice with missing option labels or text', () => {
      const question: MultipleChoiceQuestion = {
        id: 'q1',
        type: QuestionTypeEnum.MULTIPLE_CHOICE,
        prompt: 'What is 2+2?',
        pointValue: 5,
        createdAt: new Date(),
        options: [
          { label: '', text: '3' }, // Missing label
          { label: 'B', text: '4' },
        ],
        correctAnswer: 'B',
      };

      expect(() => QuestionValidator.validate(question)).toThrow(QuestionValidationError);
    });
  });

  describe('Short Answer Questions', () => {
    it('should validate correct short answer question', () => {
      const question: ShortAnswerQuestion = {
        id: 'q2',
        type: QuestionTypeEnum.SHORT_ANSWER,
        prompt: 'What is the capital of France?',
        pointValue: 5,
        createdAt: new Date(),
        expectedAnswer: 'Paris',
        keywords: ['Paris', 'capital'],
        minWords: 1,
        maxWords: 50,
      };

      expect(() => QuestionValidator.validate(question)).not.toThrow();
    });

    it('should reject short answer without expected answer', () => {
      const question: ShortAnswerQuestion = {
        id: 'q2',
        type: QuestionTypeEnum.SHORT_ANSWER,
        prompt: 'What is the capital of France?',
        pointValue: 5,
        createdAt: new Date(),
        expectedAnswer: '',
        keywords: [],
      };

      expect(() => QuestionValidator.validate(question)).toThrow(QuestionValidationError);
    });

    it('should reject short answer with invalid word limits', () => {
      const question: ShortAnswerQuestion = {
        id: 'q2',
        type: QuestionTypeEnum.SHORT_ANSWER,
        prompt: 'What is the capital of France?',
        pointValue: 5,
        createdAt: new Date(),
        expectedAnswer: 'Paris',
        minWords: 50,
        maxWords: 10, // Max < Min
      };

      expect(() => QuestionValidator.validate(question)).toThrow(QuestionValidationError);
    });
  });

  describe('Essay Questions', () => {
    it('should validate correct essay question', () => {
      const question: EssayQuestion = {
        id: 'q3',
        type: QuestionTypeEnum.ESSAY,
        prompt: 'Discuss the impact of climate change on global economies.',
        pointValue: 20,
        createdAt: new Date(),
        rubricCriteria: ['clarity', 'evidence', 'analysis'],
        minWords: 500,
        maxWords: 2000,
        allowedFormatting: ['bold', 'italic', 'lists'],
      };

      expect(() => QuestionValidator.validate(question)).not.toThrow();
    });

    it('should validate essay with minimal fields', () => {
      const question: EssayQuestion = {
        id: 'q3',
        type: QuestionTypeEnum.ESSAY,
        prompt: 'Discuss climate change.',
        pointValue: 10,
        createdAt: new Date(),
      };

      expect(() => QuestionValidator.validate(question)).not.toThrow();
    });

    it('should reject essay with invalid word limits', () => {
      const question: EssayQuestion = {
        id: 'q3',
        type: QuestionTypeEnum.ESSAY,
        prompt: 'Discuss climate change.',
        pointValue: 10,
        createdAt: new Date(),
        minWords: 2000,
        maxWords: 500, // Max < Min
      };

      expect(() => QuestionValidator.validate(question)).toThrow(QuestionValidationError);
    });
  });

  describe('Code Questions', () => {
    it('should validate correct code question', () => {
      const question: CodeQuestion = {
        id: 'q4',
        type: QuestionTypeEnum.CODE,
        prompt: 'Implement a function to calculate factorial.',
        pointValue: 25,
        createdAt: new Date(),
        language: 'python',
        starterCode: 'def factorial(n):\n    pass',
        testCases: [
          { input: '5', expectedOutput: '120', description: 'factorial(5) = 120' },
          { input: '0', expectedOutput: '1', description: 'factorial(0) = 1' },
        ],
        hiddenTestCases: 3,
      };

      expect(() => QuestionValidator.validate(question)).not.toThrow();
    });

    it('should reject code question without language specified', () => {
      const question: any = {
        id: 'q4',
        type: QuestionTypeEnum.CODE,
        prompt: 'Implement a function.',
        pointValue: 10,
        createdAt: new Date(),
        // Missing language
      };

      expect(() => QuestionValidator.validate(question)).toThrow(QuestionValidationError);
    });

    it('should validate code question with invalid language', () => {
      const question: any = {
        id: 'q4',
        type: QuestionTypeEnum.CODE,
        prompt: 'Implement a function.',
        pointValue: 10,
        createdAt: new Date(),
        language: 'cobol', // Unlikely but valid
      };

      expect(() => QuestionValidator.validate(question)).not.toThrow();
    });
  });

  describe('Fill Blank Questions', () => {
    it('should validate correct fill blank question', () => {
      const question: FillBlankQuestion = {
        id: 'q5',
        type: QuestionTypeEnum.FILL_BLANK,
        prompt: 'The capital of France is ____.',
        pointValue: 5,
        createdAt: new Date(),
        blanks: [
          {
            position: 0,
            answers: ['Paris', 'paris', 'PARIS'],
          },
        ],
      };

      expect(() => QuestionValidator.validate(question)).not.toThrow();
    });

    it('should reject fill blank without blanks', () => {
      const question: FillBlankQuestion = {
        id: 'q5',
        type: QuestionTypeEnum.FILL_BLANK,
        prompt: 'The capital of France is ____.',
        pointValue: 5,
        createdAt: new Date(),
        blanks: [],
      };

      expect(() => QuestionValidator.validate(question)).toThrow(QuestionValidationError);
    });

    it('should reject fill blank with blank missing answers', () => {
      const question: FillBlankQuestion = {
        id: 'q5',
        type: QuestionTypeEnum.FILL_BLANK,
        prompt: 'The capital of France is ____.',
        pointValue: 5,
        createdAt: new Date(),
        blanks: [
          {
            position: 0,
            answers: [], // No acceptable answers
          },
        ],
      };

      expect(() => QuestionValidator.validate(question)).toThrow(QuestionValidationError);
    });
  });

  describe('File Upload Questions', () => {
    it('should validate correct file upload question', () => {
      const question: FileUploadQuestion = {
        id: 'q6',
        type: QuestionTypeEnum.FILE_UPLOAD,
        prompt: 'Upload your code as a ZIP file.',
        pointValue: 30,
        createdAt: new Date(),
        allowedTypes: ['zip', 'tar', 'rar'],
        maxSizeBytes: 100 * 1024 * 1024, // 100 MB
        description: 'Include all source files and documentation.',
      };

      expect(() => QuestionValidator.validate(question)).not.toThrow();
    });

    it('should validate file upload with minimal fields', () => {
      const question: FileUploadQuestion = {
        id: 'q6',
        type: QuestionTypeEnum.FILE_UPLOAD,
        prompt: 'Upload your work.',
        pointValue: 10,
        createdAt: new Date(),
      };

      expect(() => QuestionValidator.validate(question)).not.toThrow();
    });
  });

  describe('Point Value Validation', () => {
    it('should reject question with zero points', () => {
      const question: MultipleChoiceQuestion = {
        id: 'q1',
        type: QuestionTypeEnum.MULTIPLE_CHOICE,
        prompt: 'What is 2+2?',
        pointValue: 0, // Invalid
        createdAt: new Date(),
        options: [
          { label: 'A', text: '3' },
          { label: 'B', text: '4' },
        ],
        correctAnswer: 'B',
      };

      expect(() => QuestionValidator.validate(question)).toThrow(QuestionValidationError);
    });

    it('should reject question with negative points', () => {
      const question: MultipleChoiceQuestion = {
        id: 'q1',
        type: QuestionTypeEnum.MULTIPLE_CHOICE,
        prompt: 'What is 2+2?',
        pointValue: -5, // Invalid
        createdAt: new Date(),
        options: [
          { label: 'A', text: '3' },
          { label: 'B', text: '4' },
        ],
        correctAnswer: 'B',
      };

      expect(() => QuestionValidator.validate(question)).toThrow(QuestionValidationError);
    });

    it('should accept very high point values', () => {
      const question: MultipleChoiceQuestion = {
        id: 'q1',
        type: QuestionTypeEnum.MULTIPLE_CHOICE,
        prompt: 'What is 2+2?',
        pointValue: 1000,
        createdAt: new Date(),
        options: [
          { label: 'A', text: '3' },
          { label: 'B', text: '4' },
        ],
        correctAnswer: 'B',
      };

      expect(() => QuestionValidator.validate(question)).not.toThrow();
    });
  });

  describe('Prompt Validation', () => {
    it('should reject question with empty prompt', () => {
      const question: MultipleChoiceQuestion = {
        id: 'q1',
        type: QuestionTypeEnum.MULTIPLE_CHOICE,
        prompt: '', // Invalid
        pointValue: 5,
        createdAt: new Date(),
        options: [
          { label: 'A', text: '3' },
          { label: 'B', text: '4' },
        ],
        correctAnswer: 'B',
      };

      expect(() => QuestionValidator.validate(question)).toThrow(QuestionValidationError);
    });

    it('should reject question with whitespace-only prompt', () => {
      const question: MultipleChoiceQuestion = {
        id: 'q1',
        type: QuestionTypeEnum.MULTIPLE_CHOICE,
        prompt: '   ', // Invalid
        pointValue: 5,
        createdAt: new Date(),
        options: [
          { label: 'A', text: '3' },
          { label: 'B', text: '4' },
        ],
        correctAnswer: 'B',
      };

      expect(() => QuestionValidator.validate(question)).toThrow(QuestionValidationError);
    });
  });
});
