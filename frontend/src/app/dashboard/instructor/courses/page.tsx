'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
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

export default function InstructorCoursesPage() {
  const { user, logout } = useAuth()
  const router = useRouter()
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)

  const handleLogout = async () => {
    await logout()
    router.replace('/auth/login')
  }

  const handleViewCourse = (courseId: string) => {
    router.push(`/dashboard/instructor/courses/${courseId}`)
  }

  const handleCreateCourse = () => {
    router.push(`/dashboard/instructor/courses/create`)
  }

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/v1/courses`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
            },
          }
        )
        if (response.ok) {
          const data = await response.json()
          setCourses(data.data || [])
        }
      } catch (error) {
        console.error('Failed to fetch courses:', error)
      } finally {
        setLoading(false)
      }
    }
    if (user?.role === 'instructor' || user?.role === 'admin') {
      fetchCourses()
    }
  }, [user])

  return (
    <RoleGuard roles={['instructor', 'admin']}>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">My Courses</h1>
            <p className="text-gray-600 mt-2">Manage your courses and assignments</p>
          </div>
          <div className="flex gap-4">
            <button 
              onClick={handleCreateCourse}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              Create Course
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
            <LoadingSpinner message="Loading courses..." />
          </Card>
        ) : courses.length === 0 ? (
          <Card>
            <p className="text-gray-600 text-center py-8">No courses found</p>
          </Card>
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Code</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Title</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Semester</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {courses.map((course) => (
                    <tr key={course.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 text-gray-900 font-medium">{course.code}</td>
                      <td className="py-3 px-4 text-gray-600">{course.title}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          course.status === 'ACTIVE'
                            ? 'bg-green-100 text-green-800'
                            : course.status === 'ARCHIVED'
                            ? 'bg-gray-100 text-gray-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {course.status || 'ACTIVE'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-600 text-xs">
                        {course.semester_start 
                          ? new Date(course.semester_start).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                            })
                          : '—'}
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => handleViewCourse(course.id)}
                          className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                        >
                          View Course
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </RoleGuard>
  )
}
