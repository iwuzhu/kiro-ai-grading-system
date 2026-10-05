'use client';

import React from 'react';
import {
  Question,
  isMultipleChoiceQuestion,
  isShortAnswerQuestion,
  isFillBlankQuestion,
  isEssayQuestion,
  isCodeQuestion,
  isFileUploadQuestion,
} from '@/lib/types/questions.types';

interface QuestionRendererProps {
  question: Question;
  showAnswerArea?: boolean;
  onAnswerChange?: (answer: any) => void;
}

/**
 * Question Renderer Component
 *
 * Displays a question in read-only format (for viewing assignments)
 * Can optionally show answer area for students to respond
 *
 * Handles all 6 question types with appropriate display
 */
export const QuestionRenderer: React.FC<QuestionRendererProps> = ({
  question,
  showAnswerArea = false,
  onAnswerChange,
}) => {
  return (
    <div className="border rounded-lg p-6 bg-white space-y-4">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            {question.prompt}
          </h3>
        </div>
        <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded text-sm font-medium">
          {question.pointValue} pts
        </span>
      </div>

      {/* Content based on type */}
      {isMultipleChoiceQuestion(question) && (
        <MultipleChoiceRenderer question={question} showAnswerArea={showAnswerArea} onAnswerChange={onAnswerChange} />
      )}
      {isShortAnswerQuestion(question) && (
        <ShortAnswerRenderer question={question} showAnswerArea={showAnswerArea} onAnswerChange={onAnswerChange} />
      )}
      {isFillBlankQuestion(question) && (
        <FillBlankRenderer question={question} showAnswerArea={showAnswerArea} onAnswerChange={onAnswerChange} />
      )}
      {isEssayQuestion(question) && (
        <EssayRenderer question={question} showAnswerArea={showAnswerArea} onAnswerChange={onAnswerChange} />
      )}
      {isCodeQuestion(question) && (
        <CodeRenderer question={question} showAnswerArea={showAnswerArea} onAnswerChange={onAnswerChange} />
      )}
      {isFileUploadQuestion(question) && (
        <FileUploadRenderer question={question} showAnswerArea={showAnswerArea} onAnswerChange={onAnswerChange} />
      )}
    </div>
  );
};

// ========== TYPE-SPECIFIC RENDERERS ==========

const MultipleChoiceRenderer: React.FC<QuestionRendererProps> = ({
  question,
  showAnswerArea,
  onAnswerChange,
}) => {
  const q = question as any;
  const [selected, setSelected] = React.useState('');

  const handleChange = (label: string) => {
    setSelected(label);
    onAnswerChange?.({ selectedOption: label });
  };

  return (
    <div className="space-y-3">
      {q.options?.map((option: any) => (
        <label key={option.label} className="flex items-center p-3 border rounded cursor-pointer hover:bg-gray-50">
          <input
            type="radio"
            name={`question-${q.id}`}
            value={option.label}
            checked={selected === option.label}
            onChange={() => handleChange(option.label)}
            disabled={!showAnswerArea}
            className="mr-3"
          />
          <span className="font-semibold text-gray-700 w-8">{option.label}:</span>
          <span className="text-gray-600 flex-1">{option.text}</span>
        </label>
      ))}
    </div>
  );
};

const ShortAnswerRenderer: React.FC<QuestionRendererProps> = ({
  question,
  showAnswerArea,
  onAnswerChange,
}) => {
  const q = question as any;
  const [answer, setAnswer] = React.useState('');

  const handleChange = (value: string) => {
    setAnswer(value);
    onAnswerChange?.({ answer: value });
  };

  return (
    <div className="space-y-2">
      {showAnswerArea ? (
        <textarea
          value={answer}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="Enter your answer here"
          className="w-full p-2 border rounded min-h-20 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      ) : (
        <p className="text-gray-600">Expected answer: {q.expectedAnswer}</p>
      )}
      {q.minWords && (
        <p className="text-sm text-gray-500">Minimum {q.minWords} words</p>
      )}
    </div>
  );
};

const FillBlankRenderer: React.FC<QuestionRendererProps> = ({
  question,
  showAnswerArea,
  // onAnswerChange,  // Callback for answer changes
}) => {
  const q = question as any;
  // const [answers, setAnswers] = React.useState<string[]>(['']);

  return (
    <div className="space-y-3">
      <p className="text-gray-700 whitespace-pre-wrap">{q.prompt}</p>
      {showAnswerArea && (
        <div className="space-y-2">
          {q.blanks?.map((_blank: any, idx: number) => (
            <input
              key={idx}
              type="text"
              placeholder={`Blank ${idx + 1}`}
              className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          ))}
        </div>
      )}
    </div>
  );
};

const EssayRenderer: React.FC<QuestionRendererProps> = ({
  question,
  showAnswerArea,
  onAnswerChange,
}) => {
  const q = question as any;
  const [essay, setEssay] = React.useState('');

  const handleChange = (value: string) => {
    setEssay(value);
    onAnswerChange?.({ essay: value });
  };

  return (
    <div className="space-y-2">
      {showAnswerArea ? (
        <textarea
          value={essay}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="Write your essay here"
          className="w-full p-2 border rounded min-h-48 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      ) : (
        <p className="text-gray-600">This is an essay question requiring a written response.</p>
      )}
      {q.minWords && (
        <p className="text-sm text-gray-500">
          Minimum {q.minWords} words {q.maxWords && `- Maximum ${q.maxWords} words`}
        </p>
      )}
    </div>
  );
};

const CodeRenderer: React.FC<QuestionRendererProps> = ({
  question,
  showAnswerArea,
  onAnswerChange,
}) => {
  const q = question as any;
  const [code, setCode] = React.useState(q.starterCode || '');

  const handleChange = (value: string) => {
    setCode(value);
    onAnswerChange?.({ code: value });
  };

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-gray-700">Language: {q.language}</p>
      {showAnswerArea ? (
        <textarea
          value={code}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={`Write your ${q.language} code here`}
          className="w-full p-2 border rounded font-mono min-h-40 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      ) : (
        <pre className="bg-gray-100 p-3 rounded text-sm overflow-x-auto">
          {q.starterCode || '// No starter code provided'}
        </pre>
      )}
    </div>
  );
};

const FileUploadRenderer: React.FC<QuestionRendererProps> = ({
  question,
  showAnswerArea,
  onAnswerChange,
}) => {
  const q = question as any;

  return (
    <div className="space-y-3">
      {q.allowedTypes && (
        <p className="text-sm text-gray-600">
          Allowed types: {q.allowedTypes.join(', ').toUpperCase()}
        </p>
      )}
      {showAnswerArea && (
        <div className="border-2 border-dashed rounded p-6 text-center hover:border-blue-500">
          <input
            type="file"
            multiple
            className="w-full"
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
              onAnswerChange?.({ files });
            }}
          />
          <p className="text-sm text-gray-500 mt-2">Drag and drop files here or click to select</p>
        </div>
      )}
    </div>
  );
};
