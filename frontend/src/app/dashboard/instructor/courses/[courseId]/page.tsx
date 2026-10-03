'use client'

import React, { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { RoleGuard } from '@/components/auth/RoleGuard'
import { Card, LoadingSpinner } from '@/components/common'
import { useAuth } from '@/hooks/useAuth'

interface Course {
  id: string
  code: string
  title: string
  description?: string
  status?: string
  created_at?: string
  semester_start?: string
  semester_end?: string
}

export default function InstructorCourseDetailPage() {
  const { user, logout } = useAuth()
  const router = useRouter()
  const params = useParams()
  const courseId = params.courseId as string
  
  const [course, setCourse] = useState<Course | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const handleLogout = async () => {
    await logout()
    router.replace('/auth/login')
  }

  const handleBackToCourses = () => {
    router.back()
  }

  const handleViewAssignments = () => {
    router.push(`/dashboard/instructor/courses/${courseId}/assignments`)
  }

  const handleViewEnrolledStudents = () => {
    router.push(`/dashboard/instructor/courses/${courseId}/students`)
  }

  const handleCourseSettings = () => {
    router.push(`/dashboard/instructor/courses/${courseId}/settings`)
  }

  useEffect(() => {
    const fetchCourse = async () => {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/v1/courses/${courseId}`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
            },
          }
        )
        if (response.ok) {
          const data = await response.json()
          setCourse(data.data || null)
        } else if (response.status === 404) {
          setError('Course not found')
        } else {
          setError('Failed to load course')
        }
      } catch (error) {
        console.error('Failed to fetch course:', error)
        setError('An error occurred while loading the course')
      } finally {
        setLoading(false)
      }
    }

    if (courseId && user?.role === 'instructor') {
      fetchCourse()
    }
  }, [courseId, user])

  return (
    <RoleGuard roles={['instructor', 'admin']}>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {loading ? 'Loading...' : course?.title || 'Course Details'}
            </h1>
            {course && (
              <p className="text-gray-600 mt-2">
                {course.code} • {course.status || 'ACTIVE'}
              </p>
            )}
          </div>
          <div className="flex gap-4">
            <button
              onClick={handleBackToCourses}
              className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
            >
              Back to Courses
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
            <LoadingSpinner message="Loading course..." />
          </Card>
        ) : error ? (
          <Card>
            <p className="text-red-600 text-center py-8">{error}</p>
          </Card>
        ) : course ? (
          <div className="space-y-6">
            <Card>
              <div className="space-y-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 mb-4">Course Information</h2>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Code</p>
                      <p className="font-medium text-gray-900">{course.code}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Status</p>
                      <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                        course.status === 'ACTIVE'
                          ? 'bg-green-100 text-green-800'
                          : course.status === 'ARCHIVED'
                          ? 'bg-gray-100 text-gray-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {course.status || 'ACTIVE'}
                      </span>
                    </div>
                  </div>
                </div>

                {course.description && (
                  <div>
                    <h3 className="font-medium text-gray-900 mb-2">Description</h3>
                    <p className="text-gray-600">{course.description}</p>
                  </div>
                )}

                {course.semester_start && (
                  <div>
                    <h3 className="font-medium text-gray-900 mb-2">Semester</h3>
                    <p className="text-gray-600">
                      {new Date(course.semester_start).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                      {course.semester_end && (
                        <>
                          {' - '}
                          {new Date(course.semester_end).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </>
                      )}
                    </p>
                  </div>
                )}
              </div>
            </Card>

            <Card>
              <h2 className="text-xl font-bold text-gray-900 mb-4">Course Management</h2>
              <p className="text-gray-600 mb-4">
                Additional course management features will be available here.
              </p>
              <div className="space-y-2">
                <button
                  onClick={handleViewAssignments}
                  className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                >
                  View Assignments
                </button>
                <button 
                  onClick={handleViewEnrolledStudents}
                  className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                >
                  View Enrolled Students
                </button>
                <button 
                  onClick={handleCourseSettings}
                  className="w-full bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
                >
                  Course Settings
                </button>
              </div>
            </Card>
          </div>
        ) : null}
      </div>
    </RoleGuard>
  )
}
