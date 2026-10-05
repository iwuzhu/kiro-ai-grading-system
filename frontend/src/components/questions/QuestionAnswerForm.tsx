'use client';

import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Question,
  Answer,
  QuestionTypeEnum,
  MultipleChoiceQuestion,
  ShortAnswerQuestion,
  EssayQuestion,
  CodeQuestion,
  FileUploadQuestion,
  // FileUploadAnswer,
} from '@/lib/types/questions.types';

interface QuestionAnswerFormProps {
  question: Question;
  initialAnswer?: Answer;
  onChange: (answer: Answer) => void;
}

/**
 * QuestionAnswerForm Component
 *
 * Dynamic form for answering questions based on their type.
 * Supports all question types with type-specific input fields.
 */
export const QuestionAnswerForm: React.FC<QuestionAnswerFormProps> = ({
  question,
  initialAnswer,
  onChange,
}) => {
  const [answer, setAnswer] = useState<any>(initialAnswer || {});

  useEffect(() => {
    if (initialAnswer) {
      setAnswer(initialAnswer);
    }
  }, [initialAnswer?.questionId]);

  const handleChange = (newAnswer: any) => {
    setAnswer(newAnswer);
    onChange(newAnswer);
  };

  const now = new Date();

  switch (question.type) {
    case QuestionTypeEnum.MULTIPLE_CHOICE: {
      const q = question as MultipleChoiceQuestion;
      return (
        <div className="space-y-3">
          {q.options.map((option) => (
            <label key={option.label} className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name={`question-${question.id}`}
                value={option.label}
                checked={answer.selectedOption === option.label}
                onChange={(e) =>
                  handleChange({
                    questionId: question.id,
                    type: QuestionTypeEnum.MULTIPLE_CHOICE,
                    selectedOption: e.target.value,
                    submittedAt: now,
                  })
                }
                className="rounded-full border-gray-300"
              />
              <span className="text-sm">
                <strong>{option.label}.</strong> {option.text}
              </span>
            </label>
          ))}
        </div>
      );
    }

    case QuestionTypeEnum.SHORT_ANSWER: {
      const q = question as ShortAnswerQuestion;
      const wordCount = (answer.answer || '').split(/\s+/).filter((w: string) => w.length > 0)
        .length;
      const isValid =
        !q.minWords || !q.maxWords || (wordCount >= q.minWords && wordCount <= q.maxWords);

      return (
        <div className="space-y-2">
          <Textarea
            value={answer.answer || ''}
            onChange={(e) => {
              const text = e.target.value;
              const count = text.split(/\s+/).filter((w) => w.length > 0).length;
              handleChange({
                questionId: question.id,
                type: QuestionTypeEnum.SHORT_ANSWER,
                answer: text,
                wordCount: count,
                submittedAt: now,
              });
            }}
            placeholder="Enter your answer here..."
            rows={6}
          />
          <div className={`text-sm ${isValid ? 'text-gray-600' : 'text-red-600'}`}>
            Word count: {wordCount}
            {q.minWords && q.maxWords && ` / ${q.minWords}-${q.maxWords}`}
          </div>
        </div>
      );
    }

    case QuestionTypeEnum.ESSAY: {
      const q = question as EssayQuestion;
      const wordCount = (answer.essay || '').split(/\s+/).filter((w: string) => w.length > 0)
        .length;
      const isValid = !q.minWords || !q.maxWords || (wordCount >= q.minWords && wordCount <= q.maxWords);

      return (
        <div className="space-y-2">
          <Textarea
            value={answer.essay || ''}
            onChange={(e) => {
              const text = e.target.value;
              const count = text.split(/\s+/).filter((w) => w.length > 0).length;
              handleChange({
                questionId: question.id,
                type: QuestionTypeEnum.ESSAY,
                essay: text,
                wordCount: count,
                submittedAt: now,
              });
            }}
            placeholder="Write your essay here..."
            rows={12}
          />
          <div className={`text-sm ${isValid ? 'text-gray-600' : 'text-red-600'}`}>
            Word count: {wordCount}
            {q.minWords && q.maxWords && ` / ${q.minWords}-${q.maxWords}`}
          </div>
        </div>
      );
    }

    case QuestionTypeEnum.CODE: {
      const q = question as CodeQuestion;
      return (
        <div className="space-y-2">
          <div className="text-sm text-gray-600 mb-2">Language: {q.language}</div>
          {q.starterCode && (
            <div className="bg-gray-100 p-3 rounded-lg text-sm font-mono">
              <p className="text-gray-600 mb-2">Starter code:</p>
              <pre className="text-xs overflow-auto">{q.starterCode}</pre>
            </div>
          )}
          <Textarea
            value={answer.code || ''}
            onChange={(e) =>
              handleChange({
                questionId: question.id,
                type: QuestionTypeEnum.CODE,
                code: e.target.value,
                language: q.language,
                submittedAt: now,
              })
            }
            placeholder="Write your code here..."
            rows={12}
            className="font-mono text-sm"
          />
        </div>
      );
    }

    case QuestionTypeEnum.FILL_BLANK: {
      return (
        <div className="space-y-3">
          {/* For each blank, show an input */}
          {question.prompt.split('____').map((part, idx) => (
            <React.Fragment key={idx}>
              <span className="text-gray-700">{part}</span>
              {idx < (question as any).blanks?.length && (
                <Input
                  type="text"
                  value={
                    answer.answers?.find((a: any) => a.blankPosition === idx)?.answer || ''
                  }
                  onChange={(e) => {
                    const updatedAnswers = [...(answer.answers || [])];
                    const idx_answer = updatedAnswers.findIndex((a: any) => a.blankPosition === idx);
                    if (idx_answer >= 0) {
                      updatedAnswers[idx_answer].answer = e.target.value;
                    } else {
                      updatedAnswers.push({
                        blankPosition: idx,
                        answer: e.target.value,
                      });
                    }
                    handleChange({
                      questionId: question.id,
                      type: QuestionTypeEnum.FILL_BLANK,
                      answers: updatedAnswers,
                      submittedAt: now,
                    });
                  }}
                  placeholder={`Blank ${idx + 1}`}
                />
              )}
            </React.Fragment>
          ))}
        </div>
      );
    }

    case QuestionTypeEnum.FILE_UPLOAD: {
      const q = question as FileUploadQuestion;
      return (
        <div className="space-y-3">
          {q.description && <p className="text-sm text-gray-600">{q.description}</p>}
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
            <input
              type="file"
              id={`file-${question.id}`}
              multiple={q.allowedTypes?.length !== 1}
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                handleChange({
                  questionId: question.id,
                  type: QuestionTypeEnum.FILE_UPLOAD,
                  files: files.map((f) => ({
                    originalName: f.name,
                    mimeType: f.type,
                    s3Uri: '', // Will be set by upload handler
                    uploadedAt: now,
                    sizeBytes: f.size,
                  })),
                  submittedAt: now,
                });
              }}
              className="hidden"
            />
            <label
              htmlFor={`file-${question.id}`}
              className="cursor-pointer text-blue-600 hover:text-blue-800"
            >
              <p className="text-sm font-medium">Click to upload or drag and drop</p>
              {q.allowedTypes && (
                <p className="text-xs text-gray-500 mt-1">
                  Accepted: {q.allowedTypes.join(', ')}
                </p>
              )}
              {q.maxSizeBytes && (
                <p className="text-xs text-gray-500">
                  Max size: {(q.maxSizeBytes / 1024 / 1024).toFixed(1)} MB
                </p>
              )}
            </label>
          </div>
          {answer.files && answer.files.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium mb-2">Selected files:</p>
              <ul className="space-y-1">
                {answer.files.map((f: any, idx: number) => (
                  <li key={idx} className="text-sm text-gray-600">
                    📄 {f.originalName} ({(f.sizeBytes / 1024).toFixed(1)} KB)
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      );
    }

    default:
      return <div className="text-gray-500">Unsupported question type</div>;
  }
};
