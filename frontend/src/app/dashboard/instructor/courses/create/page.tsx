'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { RoleGuard } from '@/components/auth/RoleGuard'
import { Card } from '@/components/common'
import { useAuth } from '@/hooks/useAuth'

interface CreateCourseForm {
  code: string
  title: string
  description?: string
  semester_start?: string
  semester_end?: string
}

export default function CreateCoursePage() {
  const { user, logout } = useAuth()
  const router = useRouter()
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [institutionId, setInstitutionId] = useState<string | null>(null)
  
  const [formData, setFormData] = useState<CreateCourseForm>({
    code: '',
    title: '',
    description: '',
    semester_start: '',
    semester_end: '',
  })

  const handleLogout = async () => {
    await logout()
    router.replace('/auth/login')
  }

  const handleBack = () => {
    router.back()
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    // Validate required fields
    if (!formData.code.trim()) {
      setError('Course code is required')
      setLoading(false)
      return
    }

    if (!formData.title.trim()) {
      setError('Course title is required')
      setLoading(false)
      return
    }

    if (formData.semester_start && formData.semester_end) {
      const startDate = new Date(formData.semester_start)
      const endDate = new Date(formData.semester_end)
      if (startDate > endDate) {
        setError('Semester start date must be before end date')
        setLoading(false)
        return
      }
    }

    try {
      const token = localStorage.getItem('accessToken')
      
      const createData = {
        code: formData.code.toUpperCase(),
        title: formData.title,
        description: formData.description || null,
        institution_id: institutionId,
        ...(formData.semester_start && { semester_start: formData.semester_start }),
        ...(formData.semester_end && { semester_end: formData.semester_end }),
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/v1/courses`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(createData),
        }
      )

      if (response.ok) {
        const data = await response.json()
        // Navigate to the new course detail page
        router.push(`/dashboard/instructor/courses/${data.data.id}`)
      } else if (response.status === 409) {
        setError('Course code already exists in this institution')
      } else {
        const errorData = await response.json()
        setError(errorData.error?.message || 'Failed to create course')
      }
    } catch (error) {
      console.error('Error creating course:', error)
      setError('An error occurred while creating the course')
    } finally {
      setLoading(false)
    }
  }

  // Get institution_id from user context or fetch it
  useEffect(() => {
    // For now, we'll need to get institution_id from user data
    // This would typically come from the JWT token or user profile
    // For this implementation, we'll fetch it from the API or pass it via context
    // As a workaround, we can fetch the user's first course to get institution_id
    const fetchInstitutionId = async () => {
      try {
        const token = localStorage.getItem('accessToken')
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/v1/courses`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        )
        
        if (response.ok) {
          const data = await response.json()
          // If user has courses, get institution_id from first course
          // Otherwise, we'll need to handle this differently
          if (data.data && data.data.length > 0 && data.data[0].institution_id) {
            setInstitutionId(data.data[0].institution_id)
          }
        }
      } catch (error) {
        console.error('Failed to fetch institution ID:', error)
      }
    }

    if (user?.role === 'instructor' || user?.role === 'admin') {
      fetchInstitutionId()
    }
  }, [user])

  return (
    <RoleGuard roles={['instructor', 'admin']}>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Create New Course
            </h1>
            <p className="text-gray-600 mt-2">Set up a new course for your students</p>
          </div>
          <div className="flex gap-4">
            <button
              onClick={handleBack}
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

        <Card>
          <div className="space-y-6">
            {error && (
              <div className="bg-red-50 text-red-700 p-4 rounded-lg border border-red-200">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Course Code */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Course Code <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  name="code"
                  value={formData.code}
                  onChange={handleInputChange}
                  disabled={loading}
                  placeholder="e.g., CS101, MATH201"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                />
                <p className="text-xs text-gray-500 mt-1">Unique code to identify this course</p>
              </div>

              {/* Course Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Course Title <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  disabled={loading}
                  placeholder="e.g., Introduction to Computer Science"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description (Optional)
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  disabled={loading}
                  rows={4}
                  placeholder="Enter a course description"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                />
              </div>

              {/* Semester Start */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Semester Start Date (Optional)
                </label>
                <input
                  type="date"
                  name="semester_start"
                  value={formData.semester_start}
                  onChange={handleInputChange}
                  disabled={loading}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                />
              </div>

              {/* Semester End */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Semester End Date (Optional)
                </label>
                <input
                  type="date"
                  name="semester_end"
                  value={formData.semester_end}
                  onChange={handleInputChange}
                  disabled={loading}
                  placeholder="Select end date"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  type="submit"
                  disabled={loading || !institutionId}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition font-medium"
                >
                  {loading ? 'Creating Course...' : 'Create Course'}
                </button>
                <button
                  type="button"
                  onClick={handleBack}
                  disabled={loading}
                  className="flex-1 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 disabled:bg-gray-400 transition font-medium"
                >
                  Cancel
                </button>
              </div>

              <p className="text-xs text-gray-500 text-center">
                You will be automatically enrolled as an instructor for the course you create.
              </p>
            </form>
          </div>
        </Card>
      </div>
    </RoleGuard>
  )
}
