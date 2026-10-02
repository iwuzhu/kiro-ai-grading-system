'use client'

import React, { useEffect, useState } from 'react'
import { RoleGuard } from '@/components/auth/RoleGuard'
import { Card, LoadingSpinner } from '@/components/common'
import { useAuth } from '@/hooks/useAuth'

interface EnrolledCourse {
  id: string
  code: string
  title: string
  instructor: string
  grade?: number
  completionPercentage: number
}

export default function StudentCoursesPage() {
  const { user } = useAuth()
  const [courses, setCourses] = useState<EnrolledCourse[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/courses`,
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

    if (user?.role === 'student') {
      fetchCourses()
    }
  }, [user])

  return (
    <RoleGuard roles={['student']}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Courses</h1>
          <p className="text-gray-600 mt-2">View your enrolled courses and assignments</p>
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
                  <p className="text-sm text-gray-600">Instructor: {course.instructor}</p>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Progress</span>
                    <span className="font-semibold">{course.completionPercentage}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${course.completionPercentage}%` }}
                    />
                  </div>
                  {course.grade && (
                    <p className="text-sm text-gray-600">Grade: {course.grade}%</p>
                  )}
                  <button className="w-full mt-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                    View Assignments
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
