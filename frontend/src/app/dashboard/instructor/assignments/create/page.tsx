'use client';

export const revalidate = 0; // Disable static generation

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

import {
  QuestionTypeSelector,
  QuestionEditor,
  QuestionRenderer,
} from '@/components/questions';
import { Question, QuestionTypeEnum, AssignmentContent } from '@/lib/types/questions.types';

interface CreateAssignmentFormData {
  title: string;
  description: string;
  pointValue: number;
  courseId: string;
  softDeadline?: Date;
  hardDeadline?: Date;
  allowIncremental: boolean;
}

/**
 * CreateAssignment Page
 *
 * Allows instructors to create new assignments with multiple questions.
 * Features:
 * - Dynamic question builder with type selector
 * - Add/edit/remove questions
 * - Preview questions as student would see them
 * - Drag-to-reorder questions
 * - Publish assignment to make visible to students
 */
export default function CreateAssignmentPage({
  params,
}: {
  params: { courseId: string };
}): JSX.Element {
  const router = useRouter();
  // User context will be used when authentication is fully integrated

  // Form state
  const [formData, setFormData] = useState<CreateAssignmentFormData>({
    title: '',
    description: '',
    pointValue: 0,
    courseId: params.courseId,
    allowIncremental: false,
  });

  const [questions, setQuestions] = useState<Question[]>([]);
  const [showQuestionSelector, setShowQuestionSelector] = useState(false);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Fetch course data to validate
  const { data: course, isLoading: courseLoading } = useQuery({
    queryKey: ['course', params.courseId],
    queryFn: async () => {
      const response = await axios.get(
        `/api/v1/courses/${params.courseId}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
          },
        }
      );
      return response.data.data;
    },
  });

  // Handle form field changes
  const handleFormChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ): void => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        type === 'checkbox'
          ? (e.target as HTMLInputElement).checked
          : type === 'number'
          ? parseFloat(value)
          : value,
    }));
  };

  // Add new question
  const handleAddQuestion = (type: QuestionTypeEnum): void => {
    const newQuestion: any = {
      id: `q-${Date.now()}`,
      type,
      prompt: '',
      pointValue: 10,
      createdAt: new Date(),
      ...(type === QuestionTypeEnum.MULTIPLE_CHOICE && {
        options: [
          { label: 'A', text: '' },
          { label: 'B', text: '' },
        ],
        correctAnswer: 'A',
      }),
      ...(type === QuestionTypeEnum.SHORT_ANSWER && {
        expectedAnswer: '',
        minWords: 5,
        maxWords: 100,
      }),
      ...(type === QuestionTypeEnum.ESSAY && {
        rubricCriteria: [],
        minWords: 100,
        maxWords: 2000,
      }),
      ...(type === QuestionTypeEnum.CODE && {
        language: 'python',
      }),
    };

    setQuestions([...questions, newQuestion]);
    setShowQuestionSelector(false);
  };

  // Update existing question
  const handleUpdateQuestion = (updatedQuestion: Question): void => {
    setQuestions(
      questions.map((q) =>
        q.id === editingQuestionId ? updatedQuestion : q
      )
    );
    setEditingQuestionId(null);
  };

  // Delete question
  const handleDeleteQuestion = (questionId: string): void => {
    setQuestions(questions.filter((q) => q.id !== questionId));
  };

  // Reorder questions (drag & drop)
  // const handleReorderQuestions = (newOrder: Question[]): void => {
  //   setQuestions(newOrder);
  // };

  // Submit assignment
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Validate
    if (!formData.title.trim()) {
      setError('Assignment title is required');
      return;
    }

    if (questions.length === 0) {
      setError('At least one question is required');
      return;
    }

    const totalPoints = questions.reduce((sum, q) => sum + q.pointValue, 0);
    if (totalPoints !== formData.pointValue) {
      setError(
        `Total points (${totalPoints}) must equal assignment point value (${formData.pointValue})`
      );
      return;
    }

    setIsSubmitting(true);

    try {
      // Create the assignment with questions
      const content: AssignmentContent = {
        questions,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const response = await axios.post(
        `/api/v1/assignments`,
        {
          courseId: formData.courseId,
          title: formData.title,
          description: formData.description,
          pointValue: formData.pointValue,
          allowIncremental: formData.allowIncremental,
          softDeadline: formData.softDeadline,
          hardDeadline: formData.hardDeadline,
          content,
        },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
          },
        }
      );

      setSuccess('Assignment created successfully!');
      
      // Redirect to assignment details after short delay
      setTimeout(() => {
        router.push(`/dashboard/instructor/assignments/${response.data.data.id}`);
      }, 1500);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to create assignment');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (courseLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg text-gray-600">Loading...</p>
      </div>
    );
  }

  const totalPoints = questions.reduce((sum, q) => sum + q.pointValue, 0);
  const pointsMatch = totalPoints === formData.pointValue;

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Create Assignment</h1>
        <p className="text-gray-600 mt-2">
          {course?.title && `Course: ${course.title}`}
        </p>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="mb-6 bg-green-50 border-green-200">
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Assignment Details */}
        <Card>
          <CardHeader>
            <CardTitle>Assignment Details</CardTitle>
            <CardDescription>
              Basic information about this assignment
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Title *
                </label>
                <Input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleFormChange}
                  placeholder="e.g., Essay on Climate Change"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Point Value *
                </label>
                <Input
                  type="number"
                  name="pointValue"
                  value={formData.pointValue}
                  onChange={handleFormChange}
                  placeholder="100"
                  min="0"
                  required
                />
                {!pointsMatch && (
                  <p className="text-sm text-orange-600 mt-1">
                    Total question points: {totalPoints} (mismatch!)
                  </p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <Textarea
                name="description"
                value={formData.description}
                onChange={handleFormChange}
                placeholder="Describe the assignment..."
                rows={4}
              />
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="allowIncremental"
                  checked={formData.allowIncremental}
                  onChange={handleFormChange}
                  className="rounded border-gray-300"
                />
                <span className="text-sm font-medium text-gray-700">
                  Allow incremental submissions (students can resubmit)
                </span>
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Soft Deadline
                </label>
                <Input
                  type="datetime-local"
                  name="softDeadline"
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      softDeadline: e.target.value
                        ? new Date(e.target.value)
                        : undefined,
                    })
                  }
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Hard Deadline
                </label>
                <Input
                  type="datetime-local"
                  name="hardDeadline"
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      hardDeadline: e.target.value
                        ? new Date(e.target.value)
                        : undefined,
                    })
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Questions Builder */}
        <Card>
          <CardHeader>
            <CardTitle>Questions</CardTitle>
            <CardDescription>
              Add questions to your assignment. Students will answer each question.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Questions List */}
            {questions.length > 0 && (
              <div className="space-y-4">
                {questions.map((question, index) => (
                  <div key={question.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <p className="text-sm font-medium text-gray-500">
                          Question {index + 1} •{' '}
                          <span className="inline-block px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-semibold">
                            {question.type}
                          </span>
                        </p>
                        <p className="text-sm text-gray-600 mt-1">{question.prompt}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-gray-900">
                          {question.pointValue} pts
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingQuestionId(question.id)}
                      >
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteQuestion(question.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Edit Question Modal */}
            {editingQuestionId && (
              <QuestionEditor
                question={questions.find((q) => q.id === editingQuestionId)!}
                onSave={handleUpdateQuestion}
                onCancel={() => setEditingQuestionId(null)}
              />
            )}

            {/* Add Question Button */}
            {!editingQuestionId && !showQuestionSelector && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowQuestionSelector(true)}
                className="w-full"
              >
                + Add Question
              </Button>
            )}

            {/* Question Type Selector */}
            {showQuestionSelector && !editingQuestionId && (
              <QuestionTypeSelector
                open={showQuestionSelector}
                onClose={() => setShowQuestionSelector(false)}
                onSelect={handleAddQuestion}
              />
            )}
          </CardContent>
        </Card>

        {/* Preview Section */}
        {questions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Preview</CardTitle>
              <CardDescription>
                This is how students will see your assignment
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {questions.map((question) => (
                <QuestionRenderer key={question.id} question={question} />
              ))}
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="flex gap-4 justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting || !pointsMatch}
            className="px-8"
          >
            {isSubmitting ? 'Creating...' : 'Create Assignment'}
          </Button>
        </div>
      </form>
    </div>
  );
}
