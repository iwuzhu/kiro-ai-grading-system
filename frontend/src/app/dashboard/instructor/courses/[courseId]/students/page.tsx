'use client'

import React, { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { RoleGuard } from '@/components/auth/RoleGuard'
import { Card, LoadingSpinner } from '@/components/common'
import { useAuth } from '@/hooks/useAuth'

interface Student {
  id: string
  email: string
  full_name?: string
  status?: string
  enrolled_at?: string
}

export default function EnrolledStudentsPage() {
  const { user, logout } = useAuth()
  const router = useRouter()
  const params = useParams()
  const courseId = params.courseId as string
  
  const [students, setStudents] = useState<Student[]>([])
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

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getStatusColor = (status?: string) => {
    const colors: Record<string, string> = {
      ACTIVE: 'bg-green-100 text-green-800',
      INACTIVE: 'bg-gray-100 text-gray-800',
      DROPPED: 'bg-red-100 text-red-800',
    }
    return colors[status || 'ACTIVE'] || 'bg-blue-100 text-blue-800'
  }

  useEffect(() => {
    const fetchEnrolledStudents = async () => {
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

        // Then get enrolled students
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/v1/courses/${courseId}/students`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        )

        if (response.ok) {
          const data = await response.json()
          setStudents(data.data || [])
        } else if (response.status === 404) {
          setError('Course not found')
        } else {
          setError('Failed to load enrolled students')
        }
      } catch (error) {
        console.error('Failed to fetch enrolled students:', error)
        setError('An error occurred while loading enrolled students')
      } finally {
        setLoading(false)
      }
    }

    if (courseId && user?.role === 'instructor') {
      fetchEnrolledStudents()
    }
  }, [courseId, user])

  return (
    <RoleGuard roles={['instructor', 'admin']}>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Enrolled Students
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
            <LoadingSpinner message="Loading enrolled students..." />
          </Card>
        ) : error ? (
          <Card>
            <p className="text-red-600 text-center py-8">{error}</p>
          </Card>
        ) : students.length === 0 ? (
          <Card>
            <p className="text-gray-600 text-center py-8">
              No students are enrolled in this course.
            </p>
          </Card>
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Enrolled Date
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {students.map((student) => (
                    <tr key={student.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {student.full_name || 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {student.email}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span
                          className={`inline-block px-2 py-1 rounded text-xs font-medium ${getStatusColor(
                            student.status
                          )}`}
                        >
                          {student.status || 'ACTIVE'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {formatDate(student.enrolled_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-600">
                Total Students: <span className="font-semibold text-gray-900">{students.length}</span>
              </p>
            </div>
          </Card>
        )}
      </div>
    </RoleGuard>
  )
}
