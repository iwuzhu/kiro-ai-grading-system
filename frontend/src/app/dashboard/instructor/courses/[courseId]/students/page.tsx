'use client'

import React, { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { RoleGuard } from '@/components/auth/RoleGuard'
import { Card, LoadingSpinner } from '@/components/common'
import { useAuth } from '@/hooks/useAuth'

interface User {
  id: string
  email: string
  name?: string
}

interface CourseEnrollment {
  id: string
  user: User
  role: string
  enrolled_at: string
  unenrolled_at?: string
}

interface Student {
  id: string
  email: string
  name?: string
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
  const [enrollmentError, setEnrollmentError] = useState<string | null>(null)
  const [enrollmentSuccess, setEnrollmentSuccess] = useState<string | null>(null)
  const [studentEmail, setStudentEmail] = useState('')
  const [enrolling, setEnrolling] = useState(false)
  const [showEnrollForm, setShowEnrollForm] = useState(false)

  const handleLogout = async () => {
    await logout()
    router.replace('/auth/login')
  }

  const handleBackToCourse = () => {
    router.back()
  }

  const handleEnrollStudent = async (e: React.FormEvent) => {
    e.preventDefault()
    setEnrollmentError(null)
    setEnrollmentSuccess(null)
    
    if (!studentEmail.trim()) {
      setEnrollmentError('Please enter a student email address')
      return
    }

    setEnrolling(true)
    try {
      const token = localStorage.getItem('accessToken')
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/v1/courses/${courseId}/enroll`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: studentEmail.trim(),
          }),
        }
      )

      if (response.ok) {
        setEnrollmentSuccess(`Student ${studentEmail} enrolled successfully!`)
        setStudentEmail('')
        setShowEnrollForm(false)
        
        // Refresh the student list
        setTimeout(() => {
          window.location.reload()
        }, 1500)
      } else if (response.status === 400) {
        const data = await response.json()
        setEnrollmentError(data.message || 'Invalid email address')
      } else if (response.status === 404) {
        setEnrollmentError('Student not found. Please check the email address.')
      } else if (response.status === 409) {
        setEnrollmentError('Student is already enrolled in this course')
      } else {
        setEnrollmentError('Failed to enroll student. Please try again.')
      }
    } catch (error) {
      console.error('Failed to enroll student:', error)
      setEnrollmentError('An error occurred while enrolling the student')
    } finally {
      setEnrolling(false)
    }
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
          console.log('Enrolled students data:', data)
          // Map enrollment objects to student format
          const enrollmentData = data.data || []
          console.log('Enrollment array:', enrollmentData)
          const mappedStudents: Student[] = enrollmentData.map((enrollment: CourseEnrollment) => ({
            id: enrollment.user?.id || enrollment.id,
            email: enrollment.user?.email || 'N/A',
            name: enrollment.user?.name,
            status: 'ACTIVE', // All returned enrollments are active (unenrolled_at is null)
            enrolled_at: enrollment.enrolled_at,
          }))
          console.log('Mapped students:', mappedStudents)
          setStudents(mappedStudents)
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

    if (courseId && (user?.role === 'instructor' || user?.role === 'admin')) {
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
              onClick={() => setShowEnrollForm(!showEnrollForm)}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
            >
              {showEnrollForm ? 'Cancel' : '+ Enroll Student'}
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

        {showEnrollForm && (
          <Card>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Enroll New Student</h2>
            {enrollmentError && (
              <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-800 rounded">
                {enrollmentError}
              </div>
            )}
            {enrollmentSuccess && (
              <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-800 rounded">
                {enrollmentSuccess}
              </div>
            )}
            <form onSubmit={handleEnrollStudent} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Student Email Address
                </label>
                <input
                  type="email"
                  value={studentEmail}
                  onChange={(e) => setStudentEmail(e.target.value)}
                  placeholder="student@example.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={enrolling}
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={enrolling}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:bg-gray-400"
                >
                  {enrolling ? 'Enrolling...' : 'Enroll Student'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowEnrollForm(false)
                    setStudentEmail('')
                    setEnrollmentError(null)
                    setEnrollmentSuccess(null)
                  }}
                  className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
                >
                  Cancel
                </button>
              </div>
            </form>
          </Card>
        )}

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
                        {student.name || 'N/A'}
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
