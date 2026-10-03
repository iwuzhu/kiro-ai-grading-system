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
  description: string
  studentCount?: number
  assignmentCount?: number
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
    if (user?.role === 'instructor') {
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
            <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map((course) => (
              <Card key={course.id} title={course.code}>
                <div className="space-y-3">
                  <h3 className="font-semibold text-gray-900">{course.title}</h3>
                  <p className="text-gray-600 text-sm">{course.description}</p>
                  <div className="flex gap-4 text-sm text-gray-600">
                    {course.studentCount !== undefined && <span>{course.studentCount} students</span>}
                    {course.assignmentCount !== undefined && <span>{course.assignmentCount} assignments</span>}
                  </div>
                  <button className="w-full mt-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                    View Course
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </RoleGuard>
  )
}
