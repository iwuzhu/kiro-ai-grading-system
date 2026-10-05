'use client'

import React, { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { RoleGuard } from '@/components/auth/RoleGuard'
import { Card, LoadingSpinner } from '@/components/common'
import { useAuth } from '@/hooks/useAuth'
import { QuestionCreationDialog, QuestionGroup } from '@/components/assignments/QuestionCreationDialog'
import { QuestionList } from '@/components/assignments/QuestionList'

interface Assignment {
  id: string
  title: string
  description?: string
  type?: 'ESSAY' | 'CODE' | 'QUIZ' | 'SHORT_ANSWER' | 'FILE'
  point_value: number
  soft_deadline?: string
  hard_deadline?: string
  published_at?: string
  allow_incremental: boolean
  late_penalty_percent: number
  content?: Record<string, any> // JSONB content for multi-question
}

export default function InstructorAssignmentsPage() {
  const { user, logout } = useAuth()
  const router = useRouter()
  const params = useParams()
  const courseId = params.courseId as string

  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [courseName, setCourseName] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [createSuccess, setCreateSuccess] = useState<string | null>(null)

  // Multi-question state
  const [questionGroups, setQuestionGroups] = useState<QuestionGroup[]>([])
  const [selectedType, setSelectedType] = useState<string>('Select a type')
  const [showQuestionDialog, setShowQuestionDialog] = useState(false)

  // Form data for assignment metadata
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    soft_deadline: '',
    hard_deadline: '',
    allow_incremental: false,
    late_penalty_percent: 0,
  })

  const handleLogout = async () => {
    await logout()
    router.replace('/auth/login')
  }

  const handleBackToCourse = () => {
    router.back()
  }

  const handleTypeChange = (newType: string) => {
    if (newType !== 'Select a type') {
      setSelectedType(newType)
      setShowQuestionDialog(true)
    }
  }

  const handleAddQuestionGroup = (group: QuestionGroup) => {
    setQuestionGroups([...questionGroups, group])
    setShowQuestionDialog(false)
  }

  const handleRemoveQuestionGroup = (groupIndex: number) => {
    setQuestionGroups(questionGroups.filter((_, i) => i !== groupIndex))
  }

  // Convert question groups to organized content structure
  const buildAssignmentContent = (): Record<string, any> => {
    const content: Record<string, any> = {}

    questionGroups.forEach((group) => {
      const typeLabel = {
        MULTIPLE_CHOICE: 'Multiple Choice',
        SHORT_ANSWER: 'Short Answer',
        FILL_BLANK: 'Fill in the Blank',
        ESSAY: 'Essay',
        CODE: 'Code',
        FILE_UPLOAD: 'File Upload',
        MATH: 'Math',
        PROGRAMMING: 'Programming',
      }[group.type] || group.type

      // Build questions dict with Question N as keys
      const questionsDict: Record<string, any> = {}
      
      // Store rubricId or rubricNote depending on type
      if (group.rubricId) {
        questionsDict.RubricId = group.rubricId
      } else if (group.rubricNote) {
        questionsDict.RubricNote = group.rubricNote
      }

      group.questions.forEach((q, idx) => {
        questionsDict[`Question ${idx + 1}`] = {
          [q.prompt]: {
            Result: q.result,
            Answer: '',
            Points: q.pointValue,
          },
        }
      })

      content[typeLabel] = questionsDict
    })

    return content
  }

  const calculateTotalPoints = (): number => {
    return questionGroups.reduce(
      (sum, group) =>
        sum +
        group.questions.reduce((groupSum, q) => groupSum + q.pointValue, 0),
      0
    )
  }

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreateError(null)
    setCreateSuccess(null)

    if (!formData.title.trim()) {
      setCreateError('Assignment title is required')
      return
    }

    if (questionGroups.length === 0) {
      setCreateError('At least one question group is required')
      return
    }

    setCreating(true)
    try {
      const token = localStorage.getItem('accessToken')
      const assignmentContent = buildAssignmentContent()

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/v1/courses/${courseId}/assignments`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: formData.title,
            description: formData.description || undefined,
            content: assignmentContent,
            soft_deadline: formData.soft_deadline || undefined,
            hard_deadline: formData.hard_deadline || undefined,
            allow_incremental: formData.allow_incremental,
            late_penalty_percent: formData.late_penalty_percent || 0,
            published_status: 'draft',
          }),
        }
      )

      if (response.ok) {
        setCreateSuccess(`Assignment "${formData.title}" created successfully!`)
        setFormData({
          title: '',
          description: '',
          soft_deadline: '',
          hard_deadline: '',
          allow_incremental: false,
          late_penalty_percent: 0,
        })
        setQuestionGroups([])
        setSelectedType('Select a type')
        setShowCreateForm(false)

        // Refresh the assignments list
        setTimeout(() => {
          window.location.reload()
        }, 1500)
      } else if (response.status === 400) {
        const data = await response.json()
        setCreateError(data.message || 'Invalid assignment data')
      } else {
        setCreateError('Failed to create assignment. Please try again.')
      }
    } catch (error) {
      console.error('Failed to create assignment:', error)
      setCreateError('An error occurred while creating the assignment')
    } finally {
      setCreating(false)
    }
  }

  const getAssignmentTypeColor = (type?: string) => {
    const colors: Record<string, string> = {
      ESSAY: 'bg-blue-100 text-blue-800',
      CODE: 'bg-purple-100 text-purple-800',
      QUIZ: 'bg-green-100 text-green-800',
      SHORT_ANSWER: 'bg-yellow-100 text-yellow-800',
      FILE: 'bg-orange-100 text-orange-800',
    }
    return (type && colors[type]) || 'bg-gray-100 text-gray-800'
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'No deadline'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const isOverdue = (hardDeadline?: string) => {
    if (!hardDeadline) return false
    return new Date(hardDeadline) < new Date()
  }

  useEffect(() => {
    const fetchAssignments = async () => {
      try {
        const token = localStorage.getItem('accessToken')

        // First, get course info to show course name
        const courseResponse = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/v1/courses/${courseId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        )

        if (courseResponse.ok) {
          const courseData = await courseResponse.json()
          setCourseName(courseData.data?.title || 'Course')
        }

        // Then get assignments
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/v1/courses/${courseId}/assignments`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        )

        if (response.ok) {
          const data = await response.json()
          setAssignments(data.data || [])
        } else if (response.status === 404) {
          setError('Course not found')
        } else {
          setError('Failed to load assignments')
        }
      } catch (error) {
        console.error('Failed to fetch assignments:', error)
        setError('An error occurred while loading assignments')
      } finally {
        setLoading(false)
      }
    }

    if (courseId && user?.role === 'instructor') {
      fetchAssignments()
    }
  }, [courseId, user])

  return (
    <RoleGuard roles={['instructor', 'admin']}>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Course Assignments
            </h1>
            <p className="text-gray-600 mt-2">{courseName}</p>
          </div>
          <div className="flex gap-4">
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
            >
              {showCreateForm ? 'Cancel' : '+ Create Assignment'}
            </button>
            <button
              onClick={handleBackToCourse}
              className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
            >
              Back to Course
            </button>
            <button
              onClick={handleLogout}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
            >
              Logout
            </button>
          </div>
        </div>

        {loading ? (
          <Card>
            <LoadingSpinner message="Loading assignments..." />
          </Card>
        ) : error ? (
          <Card>
            <p className="text-red-600 text-center py-8">{error}</p>
          </Card>
        ) : (
          <>
            {showCreateForm && (
              <Card>
                <h2 className="text-xl font-bold text-gray-900 mb-4">Create New Assignment</h2>
                {createError && (
                  <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-800 rounded">
                    {createError}
                  </div>
                )}
                {createSuccess && (
                  <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-800 rounded">
                    {createSuccess}
                  </div>
                )}
                <form onSubmit={handleCreateAssignment} className="space-y-6">
                  {/* Assignment Metadata */}
                  <div className="border-b pb-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Assignment Details
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Assignment Title *
                        </label>
                        <input
                          type="text"
                          value={formData.title}
                          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                          placeholder="e.g., Midterm Exam"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          disabled={creating}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Late Penalty (%)
                        </label>
                        <input
                          type="number"
                          value={formData.late_penalty_percent}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              late_penalty_percent: parseInt(e.target.value),
                            })
                          }
                          min="0"
                          max="100"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          disabled={creating}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Soft Deadline
                        </label>
                        <input
                          type="datetime-local"
                          value={formData.soft_deadline}
                          onChange={(e) =>
                            setFormData({ ...formData, soft_deadline: e.target.value })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          disabled={creating}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Hard Deadline
                        </label>
                        <input
                          type="datetime-local"
                          value={formData.hard_deadline}
                          onChange={(e) =>
                            setFormData({ ...formData, hard_deadline: e.target.value })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          disabled={creating}
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Description
                        </label>
                        <textarea
                          value={formData.description}
                          onChange={(e) =>
                            setFormData({ ...formData, description: e.target.value })
                          }
                          placeholder="Assignment instructions and requirements..."
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          disabled={creating}
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={formData.allow_incremental}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                allow_incremental: e.target.checked,
                              })
                            }
                            disabled={creating}
                            className="w-4 h-4"
                          />
                          <span className="text-sm text-gray-700">
                            Allow Multiple Submissions
                          </span>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Questions Section */}
                  <div className="border-b pb-6">
                    <div className="flex justify-between items-center mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          Questions * ({questionGroups.reduce((sum, g) => sum + g.questions.length, 0)})
                        </h3>
                        <p className="text-sm text-gray-600">
                          Total Points: {calculateTotalPoints()}
                        </p>
                      </div>
                      <select
                        value={selectedType}
                        onChange={(e) => handleTypeChange(e.target.value)}
                        disabled={creating}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="Select a type">+ Select a type</option>
                        <option value="MULTIPLE_CHOICE">Multiple Choice</option>
                        <option value="SHORT_ANSWER">Short Answer</option>
                        <option value="FILL_BLANK">Fill in the Blank</option>
                        <option value="ESSAY">Essay</option>
                        <option value="CODE">Code</option>
                        <option value="FILE_UPLOAD">File Upload</option>
                        <option value="MATH">Math</option>
                        <option value="PROGRAMMING">Programming</option>
                      </select>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-lg">
                      <QuestionList
                        questionGroups={questionGroups}
                        tenantId={user?.tenant_id || ''}
                        onRemoveGroup={handleRemoveQuestionGroup}
                      />
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="submit"
                      disabled={creating || questionGroups.length === 0}
                      className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:bg-gray-400"
                    >
                      {creating ? 'Creating...' : 'Create Assignment'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateForm(false)
                        setFormData({
                          title: '',
                          description: '',
                          soft_deadline: '',
                          hard_deadline: '',
                          allow_incremental: false,
                          late_penalty_percent: 0,
                        })
                        setQuestionGroups([])
                        setSelectedType('Select a type')
                        setCreateError(null)
                        setCreateSuccess(null)
                      }}
                      className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
                    >
                      Cancel
                    </button>
                  </div>
                </form>

                {/* Question Creation Dialog */}
                <QuestionCreationDialog
                  isOpen={showQuestionDialog}
                  selectedType={selectedType}
                  tenantId={user?.tenant_id || ''}
                  onClose={() => setShowQuestionDialog(false)}
                  onAddQuestionGroup={handleAddQuestionGroup}
                />
              </Card>
            )}

            {assignments.length === 0 && !showCreateForm ? (
              <Card>
                <p className="text-gray-600 text-center py-8">
                  No assignments found for this course.
                </p>
              </Card>
            ) : (
              <div className="space-y-4">
                {assignments.map((assignment) => (
                  <Card key={assignment.id}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-bold text-gray-900">
                            {assignment.title}
                          </h3>
                          <span
                            className={`inline-block px-2 py-1 rounded text-xs font-medium ${getAssignmentTypeColor(
                              assignment.type
                            )}`}
                          >
                            {assignment.type || 'Multi-Question'}
                          </span>
                          {assignment.published_at && (
                            <span className="inline-block px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">
                              Published
                            </span>
                          )}
                        </div>

                        {assignment.description && (
                          <p className="text-gray-600 mb-3 line-clamp-2">
                            {assignment.description}
                          </p>
                        )}

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-gray-600">Points</p>
                            <p className="font-medium text-gray-900">
                              {assignment.point_value}
                            </p>
                          </div>

                          {assignment.soft_deadline && (
                            <div>
                              <p className="text-gray-600">Soft Deadline</p>
                              <p className="font-medium text-gray-900">
                                {formatDate(assignment.soft_deadline)}
                              </p>
                            </div>
                          )}

                          {assignment.hard_deadline && (
                            <div>
                              <p className="text-gray-600">Hard Deadline</p>
                              <p
                                className={`font-medium ${
                                  isOverdue(assignment.hard_deadline)
                                    ? 'text-red-600'
                                    : 'text-gray-900'
                                }`}
                              >
                                {formatDate(assignment.hard_deadline)}
                              </p>
                            </div>
                          )}

                          {assignment.late_penalty_percent > 0 && (
                            <div>
                              <p className="text-gray-600">Late Penalty</p>
                              <p className="font-medium text-gray-900">
                                {assignment.late_penalty_percent}%
                              </p>
                            </div>
                          )}

                          {assignment.allow_incremental && (
                            <div>
                              <p className="text-gray-600">Submissions</p>
                              <p className="font-medium text-blue-600">Multiple</p>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="ml-4 flex flex-col gap-2">
                        <button
                          onClick={() =>
                            router.push(
                              `/dashboard/instructor/courses/${courseId}/assignments/${assignment.id}`
                            )
                          }
                          className="bg-blue-600 text-white px-3 py-2 rounded text-sm hover:bg-blue-700"
                        >
                          View Details
                        </button>
                        <button
                          onClick={() =>
                            router.push(
                              `/dashboard/instructor/courses/${courseId}/assignments/${assignment.id}/submissions`
                            )
                          }
                          className="bg-gray-600 text-white px-3 py-2 rounded text-sm hover:bg-gray-700"
                        >
                          View Submissions
                        </button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </RoleGuard>
  )
}
