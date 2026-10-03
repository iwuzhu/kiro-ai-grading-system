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
}

export default function StudentAssignmentsPage() {
  const { user, logout } = useAuth()
  const router = useRouter()
  const params = useParams()
  const courseId = params.courseId as string
  
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [courseName, setCourseName] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const handleLogout = async () => {
    await logout()
    router.replace('/auth/login')
  }

  const handleBackToCourse = () => {
    router.back()
  }

  const getAssignmentTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      ESSAY: 'bg-blue-100 text-blue-800',
      CODE: 'bg-purple-100 text-purple-800',
      QUIZ: 'bg-green-100 text-green-800',
      SHORT_ANSWER: 'bg-yellow-100 text-yellow-800',
      FILE: 'bg-orange-100 text-orange-800',
    }
    return colors[type] || 'bg-gray-100 text-gray-800'
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

  const isDueSoon = (hardDeadline?: string) => {
    if (!hardDeadline) return false
    const now = new Date()
    const deadline = new Date(hardDeadline)
    const daysUntilDue = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    return daysUntilDue > 0 && daysUntilDue <= 3
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
        // Note: tenant_id is extracted from JWT by the backend, no need to include in URL
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

    if (courseId && user?.role === 'student') {
      fetchAssignments()
    }
  }, [courseId, user])

  return (
    <RoleGuard roles={['student']}>
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
        ) : assignments.length === 0 ? (
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
                        {assignment.type}
                      </span>
                      {isOverdue(assignment.hard_deadline) && (
                        <span className="inline-block px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-800">
                          Overdue
                        </span>
                      )}
                      {isDueSoon(assignment.hard_deadline) && !isOverdue(assignment.hard_deadline) && (
                        <span className="inline-block px-2 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                          Due Soon
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
                                : isDueSoon(assignment.hard_deadline)
                                ? 'text-yellow-600'
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
                    </div>
                  </div>

                  <div className="ml-4 flex flex-col gap-2">
                    <button 
                      onClick={() => router.push(`/dashboard/student/courses/${courseId}/assignments/${assignment.id}`)}
                      className="bg-blue-600 text-white px-3 py-2 rounded text-sm hover:bg-blue-700"
                    >
                      View Details
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </RoleGuard>
  )
}
