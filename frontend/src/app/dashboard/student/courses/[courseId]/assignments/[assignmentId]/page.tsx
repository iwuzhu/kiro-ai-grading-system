'use client'

import React, { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { RoleGuard } from '@/components/auth/RoleGuard'
import { Card, LoadingSpinner } from '@/components/common'
import { useAuth } from '@/hooks/useAuth'

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
}

export default function StudentAssignmentDetailPage() {
  const { user, logout } = useAuth()
  const router = useRouter()
  const params = useParams()
  const courseId = params.courseId as string
  const assignmentId = params.assignmentId as string
  
  const [assignment, setAssignment] = useState<Assignment | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const handleLogout = async () => {
    await logout()
    router.replace('/auth/login')
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
        
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/v1/courses/assignments/${assignmentId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        )

        if (response.ok) {
          const data = await response.json()
          setAssignment(data.data)
        } else if (response.status === 404) {
          setError('Assignment not found')
        } else {
          setError('Failed to load assignment details')
        }
      } catch (error) {
        console.error('Failed to fetch assignment:', error)
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
                    <p className="text-gray-900">Not submitted</p>
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
                    disabled={isOverdue(assignment.hard_deadline)}
                    className={`px-4 py-2 rounded-lg transition text-white ${
                      isOverdue(assignment.hard_deadline)
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-green-600 hover:bg-green-700'
                    }`}
                  >
                    {isOverdue(assignment.hard_deadline)
                      ? 'Submission Closed'
                      : 'Submit Assignment'}
                  </button>
                  
                  <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition">
                    View Rubric
                  </button>

                  {assignment.allow_incremental && (
                    <button className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition">
                      View Previous Submissions
                    </button>
                  )}
                </div>
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
    </RoleGuard>
  )
}
