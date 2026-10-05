'use client';

export const revalidate = 0; // Disable static generation

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { useAuth } from '@/hooks/useAuth';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';

import {
  QuestionRenderer,
  QuestionAnswerForm,
} from '@/components/questions';
import { QuestionList } from '@/components/assignments/QuestionList';
import {
  Question,
  Answer,
  AssignmentContent,
  SubmissionContent,
} from '@/lib/types/questions.types';

interface AnswerState {
  [questionId: string]: Answer;
}

/**
 * SubmitAssignment Page
 *
 * Allows students to answer assignment questions and submit.
 * Features:
 * - Display assignment questions
 * - Answer form with type-specific input fields
 * - Save draft functionality
 * - Submit for grading
 * - Show submission deadline
 * - Mark late submissions
 */
export default function SubmitAssignmentPage(): JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth(); // Get current user for tenant_id

  const assignmentId = searchParams.get('assignmentId');

  // State
  const [answers, setAnswers] = useState<AnswerState>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  // const [isDraft, setIsDraft] = useState(true);  // Track draft state
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [questionGroups, setQuestionGroups] = useState<any[]>([]); // Parsed content

  // Fetch assignment
  const { data: assignment, isLoading: assignmentLoading } = useQuery({
    queryKey: ['assignment', assignmentId],
    queryFn: async () => {
      const response = await axios.get(
        `/api/v1/assignments/${assignmentId}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
          },
        }
      );
      const assignmentData = response.data.data;
      
      // Parse content if available
      if (assignmentData.content && typeof assignmentData.content === 'object') {
        const groups: any[] = [];
        
        // Handle NEW format: { questions: [...] }
        if (Array.isArray(assignmentData.content.questions)) {
          const questions = assignmentData.content.questions as any[];
          
          // Group questions by type
          const questionsByType: Record<string, any[]> = {};
          questions.forEach((q: any) => {
            const type = q.type || 'UNKNOWN';
            if (!questionsByType[type]) {
              questionsByType[type] = [];
            }
            questionsByType[type].push(q);
          });
          
          // Create groups from grouped questions
          Object.entries(questionsByType).forEach(([type, qs]) => {
            const group: any = {
              type: type as any,
              questions: qs.map(q => ({
                prompt: q.prompt,
                result: q.expectedAnswer || q.answer || '',
                pointValue: q.pointValue || 0,
              })),
            };
            groups.push(group);
          });
          
          setQuestionGroups(groups);
        } else if (typeof assignmentData.content === 'object' && !Array.isArray(assignmentData.content)) {
          // Handle OLD format: { "Essay": { "RubricId": "...", "Question 1": {...} } }
          const typeMapping: Record<string, string> = {
            'Multiple Choice': 'MULTIPLE_CHOICE',
            'Short Answer': 'SHORT_ANSWER',
            'Fill in the Blank': 'FILL_BLANK',
            'Essay': 'ESSAY',
            'Code': 'CODE',
            'File Upload': 'FILE_UPLOAD',
            'Math': 'MATH',
            'Programming': 'PROGRAMMING',
          };

          Object.entries(assignmentData.content).forEach(([typeLabel, questionsData]: [string, any]) => {
            const type = typeMapping[typeLabel] || typeLabel;
            const questions: any[] = [];
            let rubricId: string | undefined;
            let rubricNote: string | undefined;

            if (questionsData && typeof questionsData === 'object') {
              Object.entries(questionsData).forEach(([key, value]: [string, any]) => {
                if (key === 'RubricId') {
                  rubricId = value;
                } else if (key === 'RubricNote') {
                  rubricNote = value;
                } else if (key.startsWith('Question ')) {
                  if (value && typeof value === 'object') {
                    const promptKey = Object.keys(value)[0];
                    const questionData = value[promptKey];
                    if (promptKey && questionData) {
                      questions.push({
                        prompt: promptKey,
                        result: questionData.Result || '',
                        pointValue: questionData.Points || 0,
                      });
                    }
                  }
                }
              });
            }

            if (questions.length > 0) {
              const group: any = {
                type: type as any,
                questions,
              };
              if (rubricId) {
                group.rubricId = rubricId;
              }
              if (rubricNote) {
                group.rubricNote = rubricNote;
              }
              groups.push(group);
            }
          });

          setQuestionGroups(groups);
        }
      }
      
      return assignmentData;
    },
    enabled: !!assignmentId,
  });

  // Check if any submission exists (commented out for now)
  // const { data: existingSubmission } = useQuery({
  //   queryKey: ['submission', assignmentId],
  //   queryFn: async () => {
  //     const response = await axios.get(
  //       `/api/v1/submissions?assignmentId=${assignmentId}`,
  //       {
  //         headers: {
  //           Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
  //         },
  //       }
  //     );
  //     return response.data.data?.[0];
  //   },
  //   enabled: !!assignmentId,
  // });

  // Submit mutation
  const submitMutation = useMutation({
    mutationFn: async (submissionData: SubmissionContent) => {
      const response = await axios.post(
        `/api/v1/submissions`,
        {
          assignmentId,
          content: submissionData,
          isIncremental: false,
        },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
          },
        }
      );
      return response.data.data;
    },
    onSuccess: () => {
      setSuccess('Assignment submitted successfully!');
      setTimeout(() => {
        router.push(`/dashboard/student/assignments/${assignmentId}/submitted`);
      }, 1500);
    },
    onError: (err: any) => {
      setError(err.response?.data?.error?.message || 'Failed to submit assignment');
    },
  });

  // Save draft mutation
  const saveDraftMutation = useMutation({
    mutationFn: async (submissionData: SubmissionContent) => {
      const response = await axios.post(
        `/api/v1/submissions/draft`,
        {
          assignmentId,
          content: submissionData,
        },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
          },
        }
      );
      return response.data.data;
    },
    onSuccess: () => {
      setSuccess('Draft saved successfully');
      setTimeout(() => setSuccess(null), 3000);
    },
    onError: (err: any) => {
      setError(err.response?.data?.error?.message || 'Failed to save draft');
    },
  });

  if (assignmentLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg text-gray-600">Loading assignment...</p>
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Alert variant="destructive">
          <AlertDescription>Assignment not found</AlertDescription>
        </Alert>
      </div>
    );
  }

  const content: AssignmentContent = assignment.content;
  const questions: Question[] = content?.questions || [];
  const currentQuestion = questions[currentQuestionIndex];
  const completionPercentage = Math.round(
    ((Object.keys(answers).length) / questions.length) * 100
  );

  // Check deadline
  const now = new Date();
  const hardDeadline = assignment.hardDeadline ? new Date(assignment.hardDeadline) : null;
  const softDeadline = assignment.softDeadline ? new Date(assignment.softDeadline) : null;
  const isOverdue = hardDeadline && now > hardDeadline;
  const isLate = softDeadline && now > softDeadline;

  const handleAnswerChange = (answer: Answer): void => {
    setAnswers({
      ...answers,
      [answer.questionId]: answer,
    });
  };

  const handleSaveDraft = async (): Promise<void> => {
    setError(null);
    const submissionContent: SubmissionContent = {
      answers: Object.values(answers),
      startedAt: new Date(),
      completedAt: new Date(),
    };
    await saveDraftMutation.mutateAsync(submissionContent);
  };

  const handleSubmit = async (): Promise<void> => {
    setError(null);
    setSuccess(null);

    // Validate all questions answered
    if (Object.keys(answers).length !== questions.length) {
      setError('Please answer all questions before submitting');
      return;
    }

    if (isOverdue) {
      setError('This assignment is past the deadline');
      return;
    }

    const submissionContent: SubmissionContent = {
      answers: Object.values(answers),
      startedAt: new Date(),
      completedAt: new Date(),
    };

    await submitMutation.mutateAsync(submissionContent);
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">{assignment.title}</h1>
        <p className="text-gray-600 mt-2">{assignment.description}</p>
      </div>

      {/* Deadline Alert */}
      {isOverdue && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>
            ⚠️ This assignment is past the deadline and cannot be submitted
          </AlertDescription>
        </Alert>
      )}

      {isLate && !isOverdue && (
        <Alert className="mb-6 bg-orange-50 border-orange-200">
          <AlertDescription className="text-orange-800">
            ⚠️ You are submitting after the soft deadline. A late penalty may apply.
          </AlertDescription>
        </Alert>
      )}

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

      {/* Assignment Content Display */}
      {questionGroups.length > 0 && (
        <Card className="mb-8 bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-lg">Assignment Content</CardTitle>
            <CardDescription>Review the assignment requirements and grading rubrics below</CardDescription>
          </CardHeader>
          <CardContent>
            <QuestionList
              questionGroups={questionGroups}
              tenantId={user?.tenant_id}
              userRole={user?.role as 'student' | 'instructor' | 'admin' | undefined}
              onRemoveGroup={() => {}} // No-op, display only
            />
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>
                Question {currentQuestionIndex + 1} of {questions.length}
              </CardTitle>
              <CardDescription>
                {currentQuestion?.type} • {currentQuestion?.pointValue} points
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Question */}
              {currentQuestion && (
                <>
                  <QuestionRenderer question={currentQuestion} />

                  {/* Answer Form */}
                  <QuestionAnswerForm
                    question={currentQuestion}
                    initialAnswer={answers[currentQuestion.id]}
                    onChange={handleAnswerChange}
                  />
                </>
              )}
            </CardContent>
          </Card>

          {/* Navigation */}
          <div className="flex gap-4 mt-6">
            <Button
              variant="outline"
              onClick={() => setCurrentQuestionIndex(Math.max(0, currentQuestionIndex - 1))}
              disabled={currentQuestionIndex === 0}
            >
              ← Previous
            </Button>

            <Button
              variant="outline"
              onClick={() =>
                setCurrentQuestionIndex(Math.min(questions.length - 1, currentQuestionIndex + 1))
              }
              disabled={currentQuestionIndex === questions.length - 1}
            >
              Next →
            </Button>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Progress */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Progress</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600">Answered</span>
                  <span className="font-semibold">
                    {Object.keys(answers).length} / {questions.length}
                  </span>
                </div>
                <Progress value={completionPercentage} />
              </div>
            </CardContent>
          </Card>

          {/* Deadline Info */}
          {(softDeadline || hardDeadline) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Deadline</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {softDeadline && (
                  <div>
                    <p className="text-gray-600">Soft Deadline:</p>
                    <p className="font-medium">
                      {softDeadline.toLocaleString()}
                    </p>
                  </div>
                )}
                {hardDeadline && (
                  <div>
                    <p className="text-gray-600">Hard Deadline:</p>
                    <p className="font-medium text-red-600">
                      {hardDeadline.toLocaleString()}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Question List */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Questions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {questions.map((q, idx) => (
                  <button
                    key={q.id}
                    onClick={() => setCurrentQuestionIndex(idx)}
                    className={`w-full text-left p-2 rounded text-sm transition-colors ${
                      currentQuestionIndex === idx
                        ? 'bg-blue-100 text-blue-900 font-semibold'
                        : answers[q.id]
                        ? 'bg-green-100 text-green-900'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs">
                        {answers[q.id] ? '✓' : '○'}
                      </span>
                      <span>Q{idx + 1}</span>
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="space-y-2">
            <Button
              variant="outline"
              className="w-full"
              onClick={handleSaveDraft}
              disabled={saveDraftMutation.isPending || (isOverdue ?? false)}
            >
              {saveDraftMutation.isPending ? 'Saving...' : 'Save Draft'}
            </Button>
            <Button
              className="w-full"
              onClick={handleSubmit}
              disabled={
                submitMutation.isPending ||
                Object.keys(answers).length !== questions.length ||
                (isOverdue ?? false)
              }
            >
              {submitMutation.isPending ? 'Submitting...' : 'Submit Assignment'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
