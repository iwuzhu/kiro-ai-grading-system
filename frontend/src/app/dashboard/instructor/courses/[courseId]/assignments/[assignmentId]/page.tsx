'use client'

import React, { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { RoleGuard } from '@/components/auth/RoleGuard'
import { Card, LoadingSpinner, Modal, RubricDisplay } from '@/components/common'
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

interface Rubric {
  id: string
  name: string
  description?: string
  criteria: any[]
  is_template: boolean
  created_at: string
  updated_at: string
}

export default function AssignmentDetailPage() {
  const { user, logout } = useAuth()
  const router = useRouter()
  const params = useParams()
  const courseId = params.courseId as string
  const assignmentId = params.assignmentId as string
  
  const [assignment, setAssignment] = useState<Assignment | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Rubric modal state
  const [isRubricModalOpen, setIsRubricModalOpen] = useState(false)
  const [rubric, setRubric] = useState<Rubric | null>(null)
  const [rubricLoading, setRubricLoading] = useState(false)
  const [rubricError, setRubricError] = useState<string | null>(null)

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

  const handleBack = () => {
    router.back()
  }

  const handlePublish = async () => {
    if (!assignment || assignment.published_at) return
    
    try {
      const token = localStorage.getItem('accessToken')
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/v1/courses/assignments/${assignmentId}/publish`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      )

      if (response.ok) {
        const data = await response.json()
        setAssignment(data.data)
        alert('Assignment published successfully')
      } else {
        alert('Failed to publish assignment')
      }
    } catch (error) {
      console.error('Error publishing assignment:', error)
      alert('Error publishing assignment')
    }
  }

  const handleUnpublish = async () => {
    if (!assignment || !assignment.published_at) return
    
    try {
      const token = localStorage.getItem('accessToken')
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/v1/courses/assignments/${assignmentId}/unpublish`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      )

      if (response.ok) {
        const data = await response.json()
        setAssignment(data.data)
        alert('Assignment unpublished successfully')
      } else {
        alert('Failed to unpublish assignment')
      }
    } catch (error) {
      console.error('Error unpublishing assignment:', error)
      alert('Error unpublishing assignment')
    }
  }

  const handleDelete = async () => {
    if (!assignment) return

    // Confirmation dialog
    const confirmed = window.confirm(
      `Are you sure you want to delete "${assignment.title}"? This action cannot be undone.`
    )
    if (!confirmed) return

    try {
      const token = localStorage.getItem('accessToken')
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/v1/courses/assignments/${assignmentId}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      )

      if (response.ok) {
        alert('Assignment deleted successfully')
        // Navigate back to assignments list for the course
        router.push(`/dashboard/instructor/courses/${courseId}/assignments`)
      } else {
        const errorData = await response.json()
        alert(`Failed to delete assignment: ${errorData.message || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error deleting assignment:', error)
      alert('Error deleting assignment')
    }
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

    if (assignmentId && user?.role === 'instructor') {
      fetchAssignment()
    }
  }, [assignmentId, user])

  return (
    <RoleGuard roles={['instructor', 'admin']}>
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
                    {assignment.published_at ? (
                      <span className="inline-block px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                        Published
                      </span>
                    ) : (
                      <span className="inline-block px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
                        Draft
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
                    <p className="text-gray-900">
                      {formatDate(assignment.hard_deadline)}
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

                  {/* Rubric */}
                  <div>
                    <p className="text-sm font-semibold text-gray-700 mb-1">
                      Rubric
                    </p>
                    <div className="flex items-center gap-2">
                      <p className="text-gray-900">
                        {assignment.rubric_id ? 'Assigned' : 'Not assigned'}
                      </p>
                      {assignment.rubric_id && (
                        <button
                          onClick={handleViewRubric}
                          className="text-blue-600 hover:text-blue-700 font-medium text-sm"
                        >
                          View Rubric
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Actions */}
            <Card>
              <div className="space-y-3">
                <h3 className="font-semibold text-gray-900 mb-4">Actions</h3>
                
                <div className="flex flex-wrap gap-3">
                  {assignment.published_at ? (
                    <>
                      <button
                        onClick={handleUnpublish}
                        className="bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700 transition"
                      >
                        Unpublish Assignment
                      </button>
                      <button 
                        onClick={() => router.push(`/dashboard/instructor/courses/${courseId}/assignments/${assignmentId}/edit`)}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
                      >
                        Edit Assignment
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={handlePublish}
                        className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition"
                      >
                        Publish Assignment
                      </button>
                      <button 
                        onClick={() => router.push(`/dashboard/instructor/courses/${courseId}/assignments/${assignmentId}/edit`)}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
                      >
                        Edit Assignment
                      </button>
                    </>
                  )}
                  
                  <button 
                    onClick={() => router.push(`/dashboard/instructor/courses/${courseId}/assignments/${assignmentId}/submissions`)}
                    className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition"
                  >
                    View Submissions
                  </button>
                  
                  <button 
                    onClick={handleDelete}
                    className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition"
                  >
                    Delete Assignment
                  </button>
                </div>
              </div>
            </Card>

            {/* Statistics */}
            <Card>
              <div className="space-y-3">
                <h3 className="font-semibold text-gray-900 mb-4">Statistics</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Total Submissions</p>
                    <p className="text-2xl font-bold text-blue-600">0</p>
                  </div>
                  
                  <div className="bg-green-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Graded</p>
                    <p className="text-2xl font-bold text-green-600">0</p>
                  </div>
                  
                  <div className="bg-yellow-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Pending Review</p>
                    <p className="text-2xl font-bold text-yellow-600">0</p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        ) : null}

        {/* Rubric Modal */}
        <Modal
          isOpen={isRubricModalOpen}
          onClose={() => setIsRubricModalOpen(false)}
          title={rubric?.name || 'Rubric'}
        >
          <RubricDisplay
            rubric={rubric || {}}
            isLoading={rubricLoading}
            error={rubricError || undefined}
          />
        </Modal>
      </div>
    </RoleGuard>
  )
}
