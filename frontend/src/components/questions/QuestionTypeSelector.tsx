'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  QuestionTypeEnum,
  QUESTION_TYPE_LABELS,
  QUESTION_TYPE_DESCRIPTIONS,
} from '@/lib/types/questions.types';

interface QuestionTypeSelectorProps {
  open: boolean;
  onClose: () => void;
  onSelect: (type: QuestionTypeEnum) => void;
}

/**
 * QuestionTypeSelector Dialog Component
 *
 * Displays available question types for instructor to choose when adding a question
 * Modal dialog with grid of type options
 *
 * Flow:
 * 1. Instructor clicks "+ Add Question"
 * 2. Dialog opens showing 6 question types
 * 3. Instructor selects a type
 * 4. Dialog closes and QuestionEditor opens with empty form for that type
 */
export const QuestionTypeSelector: React.FC<QuestionTypeSelectorProps> = ({
  open,
  onClose,
  onSelect,
}) => {
  const questionTypes = Object.values(QuestionTypeEnum);

  const handleTypeSelect = (type: QuestionTypeEnum) => {
    onSelect(type);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add Question to Assignment</DialogTitle>
          <DialogDescription>
            Select the type of question you want to add
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
          {questionTypes.map((type) => (
            <button
              key={type}
              onClick={() => handleTypeSelect(type)}
              className="p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all text-left"
            >
              <h3 className="font-semibold text-gray-900">
                {QUESTION_TYPE_LABELS[type]}
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                {QUESTION_TYPE_DESCRIPTIONS[type]}
              </p>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};
