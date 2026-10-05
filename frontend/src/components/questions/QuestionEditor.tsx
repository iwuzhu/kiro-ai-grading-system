'use client';

import React, { useState } from 'react';
import {
  Question,
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
} from '@/lib/types/questions.types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';

interface QuestionEditorProps {
  question?: Question;
  onSave: (question: Question) => void;
  onCancel: () => void;
}

/**
 * Dynamic Question Editor Component
 *
 * Renders form fields based on question type
 * Supports all 6 question types with type-specific fields
 *
 * Flow:
 * 1. QuestionEditor mounts with type from QuestionTypeSelector
 * 2. Renders type-specific form fields
 * 3. Instructor fills in fields
 * 4. Clicks "Save Question"
 * 5. Validates and calls onSave callback
 * 6. Question added to assignment
 */
export const QuestionEditor: React.FC<QuestionEditorProps> = ({
  question,
  onSave,
  onCancel,
}) => {
  const [formData, setFormData] = useState<any>(
    question || { type: QuestionTypeEnum.MULTIPLE_CHOICE, id: '', prompt: '', pointValue: 5 }
  );
  const [errors, setErrors] = useState<string[]>([]);

  const handleFieldChange = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };

  const validateForm = (): boolean => {
    const newErrors: string[] = [];

    if (!formData.prompt?.trim()) {
      newErrors.push('Question prompt is required');
    }

    if (formData.pointValue <= 0) {
      newErrors.push('Point value must be greater than 0');
    }

    // Type-specific validation
    if (isMultipleChoiceQuestion(formData)) {
      if (!formData.options || formData.options.length < 2) {
        newErrors.push('At least 2 options required for multiple choice');
      }
      if (!formData.correctAnswer) {
        newErrors.push('Correct answer must be selected');
      }
    }

    if (isShortAnswerQuestion(formData)) {
      if (!formData.expectedAnswer?.trim()) {
        newErrors.push('Expected answer is required for short answer');
      }
    }

    if (isFillBlankQuestion(formData)) {
      if (!formData.blanks || formData.blanks.length === 0) {
        newErrors.push('At least 1 blank required for fill-in-the-blank');
      }
    }

    if (isCodeQuestion(formData)) {
      if (!formData.language?.trim()) {
        newErrors.push('Programming language is required for code questions');
      }
    }

    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const handleSave = () => {
    if (validateForm()) {
      onSave(formData);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Common Fields */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Question</label>
          <Textarea
            value={formData.prompt}
            onChange={(e) => handleFieldChange('prompt', e.target.value)}
            placeholder="Enter the question text"
            rows={4}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Points</label>
            <Input
              type="number"
              min="1"
              value={formData.pointValue}
              onChange={(e) => handleFieldChange('pointValue', parseFloat(e.target.value))}
            />
          </div>
        </div>
      </div>

      {/* Type-Specific Fields */}
      {isMultipleChoiceQuestion(formData) && (
        <MultipleChoiceEditor formData={formData} onChange={handleFieldChange} />
      )}
      {isShortAnswerQuestion(formData) && (
        <ShortAnswerEditor formData={formData} onChange={handleFieldChange} />
      )}
      {isFillBlankQuestion(formData) && (
        <FillBlankEditor formData={formData} onChange={handleFieldChange} />
      )}
      {isEssayQuestion(formData) && (
        <EssayEditor formData={formData} onChange={handleFieldChange} />
      )}
      {isCodeQuestion(formData) && (
        <CodeEditor formData={formData} onChange={handleFieldChange} />
      )}
      {isFileUploadQuestion(formData) && (
        <FileUploadEditor formData={formData} onChange={handleFieldChange} />
      )}

      {/* Errors */}
      {errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded p-3">
          <p className="text-sm font-medium text-red-900 mb-1">Errors:</p>
          <ul className="text-sm text-red-700 space-y-1">
            {errors.map((error, idx) => (
              <li key={idx}>• {error}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleSave}>Save Question</Button>
      </div>
    </div>
  );
};

// ========== TYPE-SPECIFIC EDITORS ==========

const MultipleChoiceEditor: React.FC<{
  formData: MultipleChoiceQuestion;
  onChange: (field: string, value: any) => void;
}> = ({ formData, onChange }) => {
  const handleOptionChange = (index: number, field: string, value: string) => {
    const newOptions = [...formData.options];
    newOptions[index] = { ...newOptions[index], [field]: value };
    onChange('options', newOptions);
  };

  const addOption = () => {
    const newLabel = String.fromCharCode(65 + formData.options.length); // A, B, C, etc.
    onChange('options', [
      ...formData.options,
      { label: newLabel, text: '' },
    ]);
  };

  const removeOption = (index: number) => {
    onChange('options', formData.options.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      <h3 className="font-semibold">Options</h3>
      {formData.options?.map((option, idx) => (
        <div key={idx} className="flex gap-2">
          <Input
            value={option.label}
            disabled
            className="w-12"
          />
          <Input
            value={option.text}
            onChange={(e) => handleOptionChange(idx, 'text', e.target.value)}
            placeholder="Option text"
          />
          <Select
            value={formData.correctAnswer === option.label ? 'correct' : ''}
            onChange={(e) => {
              if (e.target.value === 'correct') {
                onChange('correctAnswer', option.label);
              }
            }}
          >
            {formData.correctAnswer === option.label ? (
              <option value="correct">✓ Correct Answer</option>
            ) : (
              <option value="">Mark Correct</option>
            )}
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => removeOption(idx)}
            disabled={formData.options.length <= 2}
          >
            Remove
          </Button>
        </div>
      ))}
      <Button variant="outline" onClick={addOption}>
        + Add Option
      </Button>
    </div>
  );
};

const ShortAnswerEditor: React.FC<{
  formData: ShortAnswerQuestion;
  onChange: (field: string, value: any) => void;
}> = ({ formData, onChange }) => (
  <div className="space-y-4">
    <div>
      <label className="block text-sm font-medium mb-1">Expected Answer</label>
      <Input
        value={formData.expectedAnswer}
        onChange={(e) => onChange('expectedAnswer', e.target.value)}
        placeholder="Model answer"
      />
    </div>
    <div className="grid grid-cols-2 gap-4">
      <div>
        <label className="block text-sm font-medium mb-1">Min Words</label>
        <Input
          type="number"
          min="0"
          value={formData.minWords || ''}
          onChange={(e) => onChange('minWords', e.target.value ? parseInt(e.target.value) : undefined)}
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Max Words</label>
        <Input
          type="number"
          min="0"
          value={formData.maxWords || ''}
          onChange={(e) => onChange('maxWords', e.target.value ? parseInt(e.target.value) : undefined)}
        />
      </div>
    </div>
  </div>
);

const FillBlankEditor: React.FC<{
  formData: FillBlankQuestion;
  onChange: (field: string, value: any) => void;
}> = ({ formData, onChange }) => (
  <div className="space-y-4">
    <div>
      <label className="block text-sm font-medium mb-1">
        Question (use ____ for blanks)
      </label>
      <Textarea
        value={formData.prompt}
        onChange={(e) => onChange('prompt', e.target.value)}
        rows={4}
      />
    </div>
    <p className="text-sm text-gray-600">
      {formData.blanks?.length || 0} blank(s) detected in question
    </p>
  </div>
);

const EssayEditor: React.FC<{
  formData: EssayQuestion;
  onChange: (field: string, value: any) => void;
}> = ({ formData, onChange }) => (
  <div className="space-y-4">
    <div className="grid grid-cols-2 gap-4">
      <div>
        <label className="block text-sm font-medium mb-1">Min Words</label>
        <Input
          type="number"
          value={formData.minWords || ''}
          onChange={(e) => onChange('minWords', e.target.value ? parseInt(e.target.value) : undefined)}
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Max Words</label>
        <Input
          type="number"
          value={formData.maxWords || ''}
          onChange={(e) => onChange('maxWords', e.target.value ? parseInt(e.target.value) : undefined)}
        />
      </div>
    </div>
  </div>
);

const CodeEditor: React.FC<{
  formData: CodeQuestion;
  onChange: (field: string, value: any) => void;
}> = ({ formData, onChange }) => (
  <div className="space-y-4">
    <div>
      <label className="block text-sm font-medium mb-1">Programming Language</label>
      <Select value={formData.language} onChange={(e) => onChange('language', e.target.value)}>
        <option value="">Select Language</option>
        <option value="python">Python</option>
        <option value="javascript">JavaScript</option>
        <option value="java">Java</option>
        <option value="cpp">C++</option>
        <option value="c">C</option>
      </Select>
    </div>
    <div>
      <label className="block text-sm font-medium mb-1">Starter Code (Optional)</label>
      <Textarea
        value={formData.starterCode || ''}
        onChange={(e) => onChange('starterCode', e.target.value)}
        placeholder="def solution():\n    pass"
        rows={6}
      />
    </div>
  </div>
);

const FileUploadEditor: React.FC<{
  formData: FileUploadQuestion;
  onChange: (field: string, value: any) => void;
}> = ({ formData, onChange }) => (
  <div className="space-y-4">
    <div>
      <label className="block text-sm font-medium mb-1">Allowed File Types</label>
      <Input
        value={formData.allowedTypes?.join(', ') || ''}
        onChange={(e) =>
          onChange(
            'allowedTypes',
            e.target.value
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean)
          )
        }
        placeholder="pdf, docx, txt"
      />
    </div>
    <div>
      <label className="block text-sm font-medium mb-1">Max File Size (bytes)</label>
      <Input
        type="number"
        value={formData.maxSizeBytes || ''}
        onChange={(e) => onChange('maxSizeBytes', e.target.value ? parseInt(e.target.value) : undefined)}
      />
    </div>
  </div>
);
