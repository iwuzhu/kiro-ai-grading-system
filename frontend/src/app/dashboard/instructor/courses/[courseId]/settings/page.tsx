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
  semester_start?: string
  semester_end?: string
}

interface CourseSettingsForm {
  title: string
  description?: string
  status?: string
  semester_start?: string
  semester_end?: string
}

export default function CourseSettingsPage() {
  const { user, logout } = useAuth()
  const router = useRouter()
  const params = useParams()
  const courseId = params.courseId as string
  
  const [course, setCourse] = useState<Course | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  
  const [formData, setFormData] = useState<CourseSettingsForm>({
    title: '',
    description: '',
    status: 'ACTIVE',
    semester_start: '',
    semester_end: '',
  })

  const handleLogout = async () => {
    await logout()
    router.replace('/auth/login')
  }

  const handleBackToCourse = () => {
    router.back()
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(false)

    try {
      const token = localStorage.getItem('accessToken')
      
      const updateData = {
        title: formData.title,
        description: formData.description,
        status: formData.status,
        ...(formData.semester_start && { semester_start: formData.semester_start }),
        ...(formData.semester_end && { semester_end: formData.semester_end }),
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/v1/courses/${courseId}`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updateData),
        }
      )

      if (response.ok) {
        const data = await response.json()
        setCourse(data.data)
        setSuccess(true)
        setTimeout(() => setSuccess(false), 3000)
      } else {
        const errorData = await response.json()
        setError(errorData.error?.message || 'Failed to save course settings')
      }
    } catch (error) {
      console.error('Error saving course settings:', error)
      setError('An error occurred while saving course settings')
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    const fetchCourse = async () => {
      try {
        const token = localStorage.getItem('accessToken')
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/v1/courses/${courseId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        )

        if (response.ok) {
          const data = await response.json()
          setCourse(data.data)
          setFormData({
            title: data.data.title,
            description: data.data.description || '',
            status: data.data.status || 'ACTIVE',
            semester_start: data.data.semester_start ? new Date(data.data.semester_start).toISOString().split('T')[0] : '',
            semester_end: data.data.semester_end ? new Date(data.data.semester_end).toISOString().split('T')[0] : '',
          })
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

    if (courseId && (user?.role === 'instructor' || user?.role === 'admin')) {
      fetchCourse()
    }
  }, [courseId, user])

  return (
    <RoleGuard roles={['instructor', 'admin']}>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Course Settings
            </h1>
            {course && (
              <p className="text-gray-600 mt-2">{course.code} - {course.title}</p>
            )}
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
            <LoadingSpinner message="Loading course settings..." />
          </Card>
        ) : error && !course ? (
          <Card>
            <p className="text-red-600 text-center py-8">{error}</p>
          </Card>
        ) : course ? (
          <Card>
            <div className="space-y-6">
              {error && (
                <div className="bg-red-50 text-red-700 p-4 rounded-lg border border-red-200">
                  {error}
                </div>
              )}
              
              {success && (
                <div className="bg-green-50 text-green-700 p-4 rounded-lg border border-green-200">
                  ✓ Course settings saved successfully
                </div>
              )}

              <form onSubmit={handleSave} className="space-y-6">
                {/* Course Title */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Course Title
                  </label>
                  <input
                    type="text"
                    name="title"
                    value={formData.title}
                    onChange={handleInputChange}
                    disabled={saving}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                    placeholder="Enter course title"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    disabled={saving}
                    rows={4}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                    placeholder="Enter course description"
                  />
                </div>

                {/* Status */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status
                  </label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                    disabled={saving}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="ARCHIVED">Archived</option>
                    <option value="DRAFT">Draft</option>
                  </select>
                </div>

                {/* Semester Start */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Semester Start Date
                  </label>
                  <input
                    type="date"
                    name="semester_start"
                    value={formData.semester_start}
                    onChange={handleInputChange}
                    disabled={saving}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                  />
                </div>

                {/* Semester End */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Semester End Date
                  </label>
                  <input
                    type="date"
                    name="semester_end"
                    value={formData.semester_end}
                    onChange={handleInputChange}
                    disabled={saving}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4 border-t border-gray-200">
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition font-medium"
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button
                    type="button"
                    onClick={handleBackToCourse}
                    disabled={saving}
                    className="flex-1 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 disabled:bg-gray-400 transition font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </Card>
        ) : null}
      </div>
    </RoleGuard>
  )
}
