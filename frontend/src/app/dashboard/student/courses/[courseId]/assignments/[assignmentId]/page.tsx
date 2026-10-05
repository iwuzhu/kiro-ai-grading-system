'use client'

import React, { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { RoleGuard } from '@/components/auth/RoleGuard'
import { Card, LoadingSpinner, Modal, RubricDisplay, SubmissionModal, SubmissionData, PreviousSubmissionsModal } from '@/components/common'
import { useAuth } from '@/hooks/useAuth'
import { useSubmission } from '@/hooks/useSubmission'
import { useAssignmentSubmissions } from '@/hooks/useAssignmentSubmissions'
import { QuestionGroup } from '@/components/assignments/QuestionCreationDialog'
import { QuestionList } from '@/components/assignments/QuestionList'

interface Assignment {
  id: string
  title: string
  description?: string
  type: 'ESSAY' | 'CODE' | 'QUIZ' | 'SHORT_ANSWER' | 'FILE'
  point_value: number
  soft_deadline?: string
  hard_deadline?: string
  published_at?: string
  allow_incremental: boolean
  late_penalty_percent: number
  rubric_id?: string
  content?: Record<string, any>
}

interface Rubric {
  id: string
  name: string
  description?: string
  criteria: any[]
  is_template: boolean
  created_at: string
  updated_at: string
}

export default function StudentAssignmentDetailPage() {
  const { user, logout } = useAuth()
  const router = useRouter()
  const params = useParams()
  const assignmentId = params.assignmentId as string
  
  const [assignment, setAssignment] = useState<Assignment | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [questionGroups, setQuestionGroups] = useState<QuestionGroup[]>([])
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  // Rubric modal state
  const [isRubricModalOpen, setIsRubricModalOpen] = useState(false)
  const [rubric, setRubric] = useState<Rubric | null>(null)
  const [rubricLoading, setRubricLoading] = useState(false)
  const [rubricError, setRubricError] = useState<string | null>(null)

  // Submission modal state
  const [isSubmissionModalOpen, setIsSubmissionModalOpen] = useState(false)
  const { loading: submitting, error: submissionError, submitAssignment } = useSubmission()
  const { submissions, loading: submissionsLoading, error: submissionsError, refetch: refetchSubmissions } = useAssignmentSubmissions(assignmentId)

  // Previous submissions modal state
  const [isPreviousSubmissionsModalOpen, setIsPreviousSubmissionsModalOpen] = useState(false)

  const handleLogout = async () => {
    await logout()
    router.replace('/auth/login')
  }

  const handleViewRubric = async () => {
    if (!assignment?.rubric_id) return

    setIsRubricModalOpen(true)
    setRubricLoading(true)
    setRubricError(null)

    try {
      const token = localStorage.getItem('accessToken')
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/v1/courses/rubrics/${assignment.rubric_id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )

      if (response.ok) {
        const data = await response.json()
        setRubric(data.data)
      } else if (response.status === 404) {
        setRubricError('Rubric not found')
      } else {
        setRubricError('Failed to load rubric')
      }
    } catch (error) {
      console.error('Error fetching rubric:', error)
      setRubricError('Error loading rubric')
    } finally {
      setRubricLoading(false)
    }
  }

  const handleSubmitAssignment = async (data: SubmissionData) => {
    if (!assignment) return

    try {
      await submitAssignment(assignment.id, data)
      // Refetch submissions to show the new one
      await refetchSubmissions()
    } catch (err) {
      // Error is already handled in the hook and displayed in the modal
      console.error('Submission error:', err)
    }
  }

  const handleOpenPreviousSubmissionsModal = () => {
    setIsPreviousSubmissionsModalOpen(true)
  }

  const handleBack = () => {
    router.back()
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Not set'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getAssignmentTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      ESSAY: 'Essay',
      CODE: 'Code',
      QUIZ: 'Quiz',
      SHORT_ANSWER: 'Short Answer',
      FILE: 'File Upload',
    }
    return labels[type] || type
  }

  const isOverdue = (hardDeadline?: string) => {
    if (!hardDeadline) return false
    return new Date(hardDeadline) < new Date()
  }

  const isDueSoon = (hardDeadline?: string) => {
    if (!hardDeadline) return false
    const now = new Date()
    const deadline = new Date(hardDeadline)
    const daysUntilDue = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    return daysUntilDue > 0 && daysUntilDue <= 3
  }

  const getDaysUntilDue = (hardDeadline?: string) => {
    if (!hardDeadline) return null
    const now = new Date()
    const deadline = new Date(hardDeadline)
    const daysUntilDue = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    return daysUntilDue
  }

  useEffect(() => {
    const fetchAssignment = async () => {
      try {
        const token = localStorage.getItem('accessToken')
        
        console.log('[StudentAssignmentDetail] Fetching assignment...', {
          assignmentId,
          apiUrl: process.env.NEXT_PUBLIC_API_URL,
          timestamp: new Date().toISOString(),
        })
        
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/v1/courses/assignments/${assignmentId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        )

        console.log('[StudentAssignmentDetail] API Response status:', response.status)

        if (response.ok) {
          const data = await response.json()
          const assignmentData = data.data
          
          console.log('[StudentAssignmentDetail] Assignment data received:', {
            id: assignmentData.id,
            title: assignmentData.title,
            hasContent: !!assignmentData.content,
            contentType: typeof assignmentData.content,
            contentKeys: assignmentData.content ? Object.keys(assignmentData.content) : [],
            contentPreview: assignmentData.content ? JSON.stringify(assignmentData.content).substring(0, 200) : 'N/A',
            timestamp: new Date().toISOString(),
          })
          
          setAssignment(assignmentData)

          // Parse content into question groups
          if (assignmentData.content && typeof assignmentData.content === 'object') {
            try {
              const groups: QuestionGroup[] = []
              
              console.log('[StudentAssignmentDetail] Starting content parsing...', {
                contentIsArray: Array.isArray(assignmentData.content),
                timestamp: new Date().toISOString(),
              })

              // Handle NEW format: { questions: [...] }
              if (Array.isArray(assignmentData.content.questions)) {
                console.log('[StudentAssignmentDetail] Detected NEW format (questions array)', {
                  questionsLength: assignmentData.content.questions.length,
                })
                
                const questions = assignmentData.content.questions as any[]
                
                // Group questions by type
                const questionsByType: Record<string, any[]> = {}
                questions.forEach((q: any) => {
                  const type = q.type || 'UNKNOWN'
                  if (!questionsByType[type]) {
                    questionsByType[type] = []
                  }
                  questionsByType[type].push(q)
                })
                
                console.log('[StudentAssignmentDetail] Grouped questions by type:', {
                  types: Object.keys(questionsByType),
                  groupCounts: Object.entries(questionsByType).map(([k, v]) => ({ [k]: v.length })),
                })
                
                // Create groups from grouped questions
                Object.entries(questionsByType).forEach(([type, qs]) => {
                  const group: QuestionGroup = {
                    type: type as any,
                    questions: qs.map((q: any) => ({
                      prompt: q.prompt,
                      result: q.expectedAnswer || q.answer || '',
                      pointValue: q.pointValue || 0,
                    })),
                  }
                  if (qs[0]?.rubricId) {
                    group.rubricId = qs[0].rubricId
                  }
                  groups.push(group)
                })
                
                console.log('[StudentAssignmentDetail] Created question groups from NEW format:', {
                  groupsCount: groups.length,
                  groups: groups.map(g => ({ type: g.type, questionCount: g.questions.length })),
                })
              } else if (typeof assignmentData.content === 'object' && !Array.isArray(assignmentData.content)) {
                // Handle OLD format: { "Essay": { "RubricId": "...", "Question 1": {...} } }
                console.log('[StudentAssignmentDetail] Detected OLD format (nested object)', {
                  topLevelKeys: Object.keys(assignmentData.content),
                })
                
                const typeMapping: Record<string, string> = {
                  'Multiple Choice': 'MULTIPLE_CHOICE',
                  'Short Answer': 'SHORT_ANSWER',
                  'Fill in the Blank': 'FILL_BLANK',
                  'Essay': 'ESSAY',
                  'Code': 'CODE',
                  'File Upload': 'FILE_UPLOAD',
                  'Math': 'MATH',
                  'Programming': 'PROGRAMMING',
                }

                Object.entries(assignmentData.content).forEach(([typeLabel, questionsData]: [string, any]) => {
                  const type = typeMapping[typeLabel] || typeLabel
                  const questions: any[] = []
                  let rubricId: string | undefined
                  let rubricNote: string | undefined

                  if (questionsData && typeof questionsData === 'object') {
                    Object.entries(questionsData).forEach(([key, value]: [string, any]) => {
                      if (key === 'RubricId') {
                        rubricId = value
                      } else if (key === 'RubricNote') {
                        rubricNote = value
                      } else if (key.startsWith('Question ')) {
                        if (value && typeof value === 'object') {
                          const promptKey = Object.keys(value)[0]
                          const questionData = value[promptKey]
                          if (promptKey && questionData) {
                            questions.push({
                              prompt: promptKey,
                              result: questionData.Result || '',
                              pointValue: questionData.Points || 0,
                            })
                          }
                        }
                      }
                    })
                  }

                  if (questions.length > 0) {
                    const group: QuestionGroup = {
                      type: type as any,
                      questions,
                    }
                    if (rubricId) {
                      group.rubricId = rubricId
                    }
                    if (rubricNote) {
                      group.rubricNote = rubricNote
                    }
                    groups.push(group)
                  }
                })
                
                console.log('[StudentAssignmentDetail] Created question groups from OLD format:', {
                  groupsCount: groups.length,
                  groups: groups.map(g => ({ type: g.type, questionCount: g.questions.length })),
                })
              } else {
                console.warn('[StudentAssignmentDetail] Content format not recognized', {
                  contentType: typeof assignmentData.content,
                  isArray: Array.isArray(assignmentData.content),
                  keys: Object.keys(assignmentData.content),
                })
              }

              setQuestionGroups(groups)
              
              console.log('[StudentAssignmentDetail] Question groups set:', {
                totalGroups: groups.length,
                totalQuestions: groups.reduce((sum, g) => sum + g.questions.length, 0),
              })
            } catch (parseError) {
              console.error('[StudentAssignmentDetail] Error parsing content:', parseError, {
                content: assignmentData.content,
              })
            }
          } else {
            console.log('[StudentAssignmentDetail] No content to parse', {
              hasContent: !!assignmentData.content,
              contentType: typeof assignmentData.content,
            })
          }
        } else if (response.status === 404) {
          console.warn('[StudentAssignmentDetail] Assignment not found (404)')
          setError('Assignment not found')
        } else {
          console.error('[StudentAssignmentDetail] Failed to load assignment', {
            status: response.status,
            statusText: response.statusText,
          })
          setError('Failed to load assignment details')
        }
      } catch (error) {
        console.error('[StudentAssignmentDetail] Exception fetching assignment:', error)
        setError('An error occurred while loading assignment details')
      } finally {
        setLoading(false)
      }
    }

    if (assignmentId && user?.role === 'student') {
      fetchAssignment()
    }
  }, [assignmentId, user])

  return (
    <RoleGuard roles={['student']}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Assignment Details
            </h1>
          </div>
          <div className="flex gap-4">
            <button
              onClick={handleBack}
              className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
            >
              Back
            </button>
            <button
              onClick={handleLogout}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <Card>
            <LoadingSpinner message="Loading assignment details..." />
          </Card>
        ) : error ? (
          <Card>
            <p className="text-red-600 text-center py-8">{error}</p>
          </Card>
        ) : assignment ? (
          <div className="space-y-4">
            {/* Main Details */}
            <Card>
              <div className="space-y-4">
                {/* Title and Type */}
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    {assignment.title}
                  </h2>
                  <div className="flex items-center gap-3">
                    <span className="inline-block px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                      {getAssignmentTypeLabel(assignment.type)}
                    </span>
                    {isOverdue(assignment.hard_deadline) && (
                      <span className="inline-block px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                        Overdue
                      </span>
                    )}
                    {isDueSoon(assignment.hard_deadline) && !isOverdue(assignment.hard_deadline) && (
                      <span className="inline-block px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
                        Due Soon
                      </span>
                    )}
                  </div>
                </div>

                {/* Description */}
                {assignment.description && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">
                      Description
                    </h3>
                    <p className="text-gray-600 whitespace-pre-wrap">
                      {assignment.description}
                    </p>
                  </div>
                )}

                {/* Assignment Content Display */}
                {questionGroups.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">
                      Assignment Content & Rubrics
                    </h3>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <QuestionList
                        questionGroups={questionGroups}
                        tenantId={user?.tenant_id}
                        userRole={user?.role as 'student' | 'instructor' | 'admin' | undefined}
                        onRemoveGroup={() => {}} // No-op, display only
                      />
                    </div>
                  </div>
                )}

                {questionGroups.length === 0 && assignment.content && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">
                      Assignment Content & Rubrics
                    </h3>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <p className="text-gray-600 text-sm">
                        Assignment content could not be parsed. This may be a system issue.
                      </p>
                    </div>
                  </div>
                )}

                {/* Submit Assignment Button */}
                <div className="flex gap-3 mt-4">
                  {/* Upload Work File Button */}
                  <label
                    className="px-6 py-3 rounded-lg transition font-medium text-white bg-blue-600 hover:bg-blue-700 cursor-pointer inline-block"
                    title="click to upload your submission"
                  >
                    📁 Upload Work File
                    <input
                      type="file"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          setUploadedFile(file)
                          console.log('[StudentAssignmentDetail] File selected:', {
                            filename: file.name,
                            size: file.size,
                            type: file.type,
                          })
                        }
                      }}
                      className="hidden"
                      accept="*/*"
                    />
                  </label>

                  {/* Show selected file info */}
                  {uploadedFile && (
                    <div className="flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-200 rounded-lg">
                      <span className="text-green-700 text-sm font-medium">
                        ✅ Selected: {uploadedFile.name}
                      </span>
                      <button
                        onClick={() => setUploadedFile(null)}
                        className="text-green-600 hover:text-green-800 text-xs font-medium"
                      >
                        ✕ Clear
                      </button>
                    </div>
                  )}
                  
                  {assignment.rubric_id && (
                    <button
                      onClick={handleViewRubric}
                      className="px-6 py-3 rounded-lg transition font-medium text-white bg-blue-600 hover:bg-blue-700"
                    >
                      📋 View Rubric
                    </button>
                  )}
                </div>

                {/* Divider */}
                <div className="border-t border-gray-200"></div>

                {/* Key Information Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Points */}
                  <div>
                    <p className="text-sm font-semibold text-gray-700 mb-1">
                      Total Points
                    </p>
                    <p className="text-2xl font-bold text-blue-600">
                      {assignment.point_value}
                    </p>
                  </div>

                  {/* Soft Deadline */}
                  <div>
                    <p className="text-sm font-semibold text-gray-700 mb-1">
                      Soft Deadline
                    </p>
                    <p className="text-gray-900">
                      {formatDate(assignment.soft_deadline)}
                    </p>
                  </div>

                  {/* Hard Deadline */}
                  <div>
                    <p className="text-sm font-semibold text-gray-700 mb-1">
                      Hard Deadline
                    </p>
                    <p
                      className={`font-medium ${
                        isOverdue(assignment.hard_deadline)
                          ? 'text-red-600'
                          : isDueSoon(assignment.hard_deadline)
                          ? 'text-yellow-600'
                          : 'text-gray-900'
                      }`}
                    >
                      {formatDate(assignment.hard_deadline)}
                      {!isOverdue(assignment.hard_deadline) &&
                        getDaysUntilDue(assignment.hard_deadline) !== null && (
                          <span className="text-sm text-gray-600 ml-2">
                            ({getDaysUntilDue(assignment.hard_deadline)} days remaining)
                          </span>
                        )}
                    </p>
                  </div>

                  {/* Late Penalty */}
                  <div>
                    <p className="text-sm font-semibold text-gray-700 mb-1">
                      Late Submission Penalty
                    </p>
                    <p className="text-gray-900">
                      {assignment.late_penalty_percent}%
                    </p>
                  </div>

                  {/* Incremental Submissions */}
                  <div>
                    <p className="text-sm font-semibold text-gray-700 mb-1">
                      Multiple Submissions
                    </p>
                    <p className="text-gray-900">
                      {assignment.allow_incremental ? 'Allowed' : 'Not allowed'}
                    </p>
                  </div>

                  {/* Submission Status */}
                  <div>
                    <p className="text-sm font-semibold text-gray-700 mb-1">
                      Submission Status
                    </p>
                    <p className="text-gray-900">
                      {submissionsLoading ? 'Loading...' : submissions.length > 0 ? `${submissions.length} submission(s)` : 'Not submitted'}
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Actions */}
            <Card>
              <div className="space-y-3">
                <h3 className="font-semibold text-gray-900 mb-4">Actions</h3>
                
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={async () => {
                      if (!uploadedFile) {
                        setError('Please upload a file first')
                        return
                      }
                      
                      setUploading(true)
                      setError(null)
                      
                      try {
                        console.log('[StudentAssignmentDetail] Submitting assignment with file...', {
                          fileName: uploadedFile.name,
                          fileSize: uploadedFile.size,
                          assignmentId,
                          timestamp: new Date().toISOString(),
                        })
                        
                        // Create FormData for file upload
                        const formData = new FormData()
                        formData.append('file', uploadedFile)
                        formData.append('assignmentId', assignmentId)
                        
                        const token = localStorage.getItem('accessToken')
                        const response = await fetch(
                          `${process.env.NEXT_PUBLIC_API_URL}/v1/submissions/upload`,
                          {
                            method: 'POST',
                            headers: {
                              Authorization: `Bearer ${token}`,
                            },
                            body: formData,
                          }
                        )
                        
                        console.log('[StudentAssignmentDetail] Upload response status:', response.status)
                        
                        if (response.ok) {
                          const result = await response.json()
                          console.log('[StudentAssignmentDetail] Submission successful:', {
                            submissionId: result.data?.id,
                            fileUri: result.data?.content?.answer,
                          })
                          
                          setSuccess('✅ Assignment submitted successfully!')
                          setUploadedFile(null)
                          setError(null)
                          
                          // Refetch submissions
                          await refetchSubmissions()
                          
                          // Redirect after 2 seconds to course detail page
                          setTimeout(() => {
                            router.push(`/dashboard/student/courses/${params.courseId as string}`)
                          }, 2000)
                        } else {
                          const errorData = await response.json()
                          const errorMsg = errorData.error?.message || 'Failed to submit assignment'
                          console.error('[StudentAssignmentDetail] Upload failed:', errorMsg)
                          setError(errorMsg)
                        }
                      } catch (err) {
                        const errorMsg = err instanceof Error ? err.message : 'An error occurred while submitting'
                        console.error('[StudentAssignmentDetail] Submission error:', err)
                        setError(errorMsg)
                      } finally {
                        setUploading(false)
                      }
                    }}
                    disabled={isOverdue(assignment.hard_deadline) || !uploadedFile || uploading}
                    className={`px-4 py-2 rounded-lg transition text-white font-medium ${
                      isOverdue(assignment.hard_deadline)
                        ? 'bg-gray-400 cursor-not-allowed'
                        : !uploadedFile
                        ? 'bg-gray-400 cursor-not-allowed'
                        : uploading
                        ? 'bg-yellow-500 cursor-wait'
                        : 'bg-green-600 hover:bg-green-700'
                    }`}
                  >
                    {uploading ? '⏳ Submitting...' : isOverdue(assignment.hard_deadline) ? 'Submission Closed' : 'Submit Assignment'}
                  </button>
                  
                  {assignment.rubric_id && (
                    <button
                      onClick={handleViewRubric}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
                    >
                      View Rubric
                    </button>
                  )}

                  {assignment.allow_incremental && (
                    <button
                      onClick={handleOpenPreviousSubmissionsModal}
                      className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition"
                    >
                      View Previous Submissions
                    </button>
                  )}
                </div>
                
                {/* Success Message */}
                {success && (
                  <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-green-800 text-sm font-medium">{success}</p>
                  </div>
                )}
                
                {/* Error Message */}
                {error && (
                  <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-red-800 text-sm font-medium">{error}</p>
                  </div>
                )}
              </div>
            </Card>

            {/* Important Notes */}
            {isOverdue(assignment.hard_deadline) && (
              <Card>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-red-800 font-semibold mb-2">📌 Assignment Closed</p>
                  <p className="text-red-700 text-sm">
                    The hard deadline for this assignment has passed. Submissions are no longer being accepted.
                  </p>
                </div>
              </Card>
            )}

            {isDueSoon(assignment.hard_deadline) && !isOverdue(assignment.hard_deadline) && (
              <Card>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-yellow-800 font-semibold mb-2">⏰ Due Soon</p>
                  <p className="text-yellow-700 text-sm">
                    This assignment is due in {getDaysUntilDue(assignment.hard_deadline)} days. Make sure to submit before the deadline!
                  </p>
                </div>
              </Card>
            )}
          </div>
        ) : null}
      </div>

      {/* Rubric Modal */}
      <Modal
        isOpen={isRubricModalOpen}
        onClose={() => setIsRubricModalOpen(false)}
        title={rubric?.name || 'Rubric'}
      >
        <RubricDisplay
          rubric={rubric as any}
          isLoading={rubricLoading}
          error={rubricError || undefined}
        />
      </Modal>

      {/* Submission Modal */}
      <SubmissionModal
        isOpen={isSubmissionModalOpen}
        onClose={() => setIsSubmissionModalOpen(false)}
        onSubmit={handleSubmitAssignment}
        assignmentType={assignment?.type as any}
        assignmentTitle={assignment?.title || 'Assignment'}
        isLoading={submitting}
        error={submissionError}
      />

      {/* Previous Submissions Modal */}
      <PreviousSubmissionsModal
        isOpen={isPreviousSubmissionsModalOpen}
        onClose={() => setIsPreviousSubmissionsModalOpen(false)}
        submissions={submissions}
        loading={submissionsLoading}
        error={submissionsError}
        assignmentTitle={assignment?.title || 'Assignment'}
      />

      {/* Previous Submissions Section (for incremental assignments) */}
      {assignment?.allow_incremental && submissions.length > 0 && (
        <Card>
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900 mb-4">Previous Submissions</h3>
            
            {submissionsLoading ? (
              <LoadingSpinner message="Loading submission history..." />
            ) : submissionsError ? (
              <p className="text-red-600 text-sm">{submissionsError}</p>
            ) : (
              <div className="space-y-3">
                {submissions.map((submission) => (
                  <div key={submission.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-gray-900">
                          Submission #{submission.version}
                        </p>
                        <p className="text-sm text-gray-600 mt-1">
                          Submitted: {new Date(submission.submitted_at).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                        {submission.is_late && (
                          <p className="text-sm text-red-600 mt-1">
                            ⏰ Submitted after soft deadline (late penalty may apply)
                          </p>
                        )}
                      </div>
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                        submission.is_late
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {submission.is_late ? 'Late' : 'On Time'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      )}
    </RoleGuard>
  )
}
