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
  rubric_id?: string
}

interface FormData {
  title: string
  description: string
  point_value: number
  soft_deadline: string
  hard_deadline: string
  allow_incremental: boolean
  late_penalty_percent: number
}

export default function EditAssignmentPage() {
  const { user, logout } = useAuth()
  const router = useRouter()
  const params = useParams()
  const courseId = params.courseId as string
  const assignmentId = params.assignmentId as string
  
  const [assignment, setAssignment] = useState<Assignment | null>(null)
  const [formData, setFormData] = useState<FormData>({
    title: '',
    description: '',
    point_value: 0,
    soft_deadline: '',
    hard_deadline: '',
    allow_incremental: false,
    late_penalty_percent: 0,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const handleLogout = async () => {
    await logout()
    router.replace('/auth/login')
  }

  const handleBack = () => {
    router.back()
  }

  const formatDateForInput = (dateString?: string) => {
    if (!dateString) return ''
    // Convert to local datetime-local format (YYYY-MM-DDTHH:mm)
    const date = new Date(dateString)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day}T${hours}:${minutes}`
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target as HTMLInputElement | HTMLTextAreaElement & { type: string }
    
    if (type === 'checkbox') {
      setFormData(prev => ({
        ...prev,
        [name]: (e.target as HTMLInputElement).checked,
      }))
    } else if (type === 'number') {
      setFormData(prev => ({
        ...prev,
        [name]: parseFloat(value),
      }))
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value,
      }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccessMessage(null)

    try {
      // Validation
      if (!formData.title.trim()) {
        setError('Title is required')
        setSaving(false)
        return
      }

      if (formData.point_value <= 0) {
        setError('Point value must be greater than 0')
        setSaving(false)
        return
      }

      if (formData.soft_deadline && formData.hard_deadline) {
        const softDate = new Date(formData.soft_deadline)
        const hardDate = new Date(formData.hard_deadline)
        if (softDate > hardDate) {
          setError('Soft deadline must be before hard deadline')
          setSaving(false)
          return
        }
      }

      if (formData.late_penalty_percent < 0 || formData.late_penalty_percent > 100) {
        setError('Late penalty must be between 0 and 100')
        setSaving(false)
        return
      }

      const token = localStorage.getItem('accessToken')
      
      // Prepare update payload
      const updatePayload: any = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        point_value: formData.point_value,
        allow_incremental: formData.allow_incremental,
        late_penalty_percent: formData.late_penalty_percent,
      }

      // Only include deadline if provided
      if (formData.soft_deadline) {
        updatePayload.soft_deadline = new Date(formData.soft_deadline).toISOString()
      }

      if (formData.hard_deadline) {
        updatePayload.hard_deadline = new Date(formData.hard_deadline).toISOString()
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/v1/courses/assignments/${assignmentId}`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updatePayload),
        }
      )

      if (response.ok) {
        const data = await response.json()
        setSuccessMessage('Assignment updated successfully')
        
        // Redirect back to detail page after 1.5 seconds
        setTimeout(() => {
          router.push(`/dashboard/instructor/courses/${courseId}/assignments/${assignmentId}`)
        }, 1500)
      } else {
        const errorData = await response.json()
        setError(errorData.error?.message || 'Failed to update assignment')
      }
    } catch (error) {
      console.error('Error updating assignment:', error)
      setError('An error occurred while updating the assignment')
    } finally {
      setSaving(false)
    }
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
          const assignment = data.data as Assignment
          setAssignment(assignment)
          
          // Populate form with existing data
          setFormData({
            title: assignment.title,
            description: assignment.description || '',
            point_value: assignment.point_value,
            soft_deadline: formatDateForInput(assignment.soft_deadline),
            hard_deadline: formatDateForInput(assignment.hard_deadline),
            allow_incremental: assignment.allow_incremental,
            late_penalty_percent: assignment.late_penalty_percent,
          })
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
              Edit Assignment
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
        ) : error && !successMessage ? (
          <Card>
            <p className="text-red-600 text-center py-8">{error}</p>
          </Card>
        ) : assignment ? (
          <div className="space-y-4">
            {/* Success Message */}
            {successMessage && (
              <Card>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-green-800 font-semibold">✓ {successMessage}</p>
                </div>
              </Card>
            )}

            {/* Form */}
            <Card>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Title */}
                <div>
                  <label htmlFor="title" className="block text-sm font-semibold text-gray-700 mb-2">
                    Title *
                  </label>
                  <input
                    type="text"
                    id="title"
                    name="title"
                    value={formData.title}
                    onChange={handleInputChange}
                    placeholder="Enter assignment title"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>

                {/* Description */}
                <div>
                  <label htmlFor="description" className="block text-sm font-semibold text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    placeholder="Enter assignment description"
                    rows={4}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Points */}
                <div>
                  <label htmlFor="point_value" className="block text-sm font-semibold text-gray-700 mb-2">
                    Point Value *
                  </label>
                  <input
                    type="number"
                    id="point_value"
                    name="point_value"
                    value={formData.point_value}
                    onChange={handleInputChange}
                    placeholder="100"
                    min="0.01"
                    step="0.01"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>

                {/* Deadlines Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Soft Deadline */}
                  <div>
                    <label htmlFor="soft_deadline" className="block text-sm font-semibold text-gray-700 mb-2">
                      Soft Deadline
                    </label>
                    <input
                      type="datetime-local"
                      id="soft_deadline"
                      name="soft_deadline"
                      value={formData.soft_deadline}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  {/* Hard Deadline */}
                  <div>
                    <label htmlFor="hard_deadline" className="block text-sm font-semibold text-gray-700 mb-2">
                      Hard Deadline
                    </label>
                    <input
                      type="datetime-local"
                      id="hard_deadline"
                      name="hard_deadline"
                      value={formData.hard_deadline}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Late Penalty */}
                <div>
                  <label htmlFor="late_penalty_percent" className="block text-sm font-semibold text-gray-700 mb-2">
                    Late Submission Penalty (%)
                  </label>
                  <input
                    type="number"
                    id="late_penalty_percent"
                    name="late_penalty_percent"
                    value={formData.late_penalty_percent}
                    onChange={handleInputChange}
                    placeholder="0"
                    min="0"
                    max="100"
                    step="1"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Allow Incremental Submissions */}
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="allow_incremental"
                    name="allow_incremental"
                    checked={formData.allow_incremental}
                    onChange={handleInputChange}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <label htmlFor="allow_incremental" className="ml-3 text-sm font-medium text-gray-700">
                    Allow multiple submissions (incremental grading)
                  </label>
                </div>

                {/* Error Message */}
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-red-800 text-sm">{error}</p>
                  </div>
                )}

                {/* Submit Buttons */}
                <div className="flex gap-4 pt-4 border-t border-gray-200">
                  <button
                    type="submit"
                    disabled={saving}
                    className={`px-6 py-2 rounded-lg text-white font-medium transition ${
                      saving
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-green-600 hover:bg-green-700'
                    }`}
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button
                    type="button"
                    onClick={handleBack}
                    className="px-6 py-2 rounded-lg text-gray-700 font-medium border border-gray-300 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </Card>

            {/* Information Box */}
            <Card>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-blue-800 font-semibold mb-2">ℹ️ Assignment Information</p>
                <ul className="text-blue-700 text-sm space-y-1">
                  <li>• Assignment Type: {assignment.type}</li>
                  <li>• Status: {assignment.published_at ? 'Published' : 'Draft'}</li>
                  <li>• Note: Assignment type and rubric cannot be changed after creation</li>
                </ul>
              </div>
            </Card>
          </div>
        ) : null}
      </div>
    </RoleGuard>
  )
}
