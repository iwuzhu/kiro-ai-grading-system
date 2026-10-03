'use client'

import React, { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { RoleGuard } from '@/components/auth/RoleGuard'
import { Card, LoadingSpinner, SubmissionViewer } from '@/components/common'
import { useAuth } from '@/hooks/useAuth'

interface Submission {
  id: string
  assignment_id: string
  student_id: string
  version: number
  file_path?: string
  file_type?: string
  is_late: boolean
  submitted_at: string
}

interface Assignment {
  id: string
  title: string
  point_value: number
  type: string
  description?: string
  hard_deadline?: string
}

interface GradeFormData {
  score: number
  feedback: string
  strengths: string
  improvements: string
}

export default function GradeSubmissionPage() {
  const { user, logout } = useAuth()
  const router = useRouter()
  const params = useParams()
  const courseId = params.courseId as string
  const assignmentId = params.assignmentId as string
  const submissionId = params.submissionId as string
  
  const [submission, setSubmission] = useState<Submission | null>(null)
  const [assignment, setAssignment] = useState<Assignment | null>(null)
  const [formData, setFormData] = useState<GradeFormData>({
    score: 0,
    feedback: '',
    strengths: '',
    improvements: '',
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    
    if (name === 'score') {
      setFormData(prev => ({
        ...prev,
        [name]: parseFloat(value) || 0,
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
      if (formData.score < 0 || formData.score > (assignment?.point_value || 100)) {
        setError(`Score must be between 0 and ${assignment?.point_value || 100}`)
        setSaving(false)
        return
      }

      if (!formData.feedback.trim()) {
        setError('Feedback is required')
        setSaving(false)
        return
      }

      if (!formData.strengths.trim()) {
        setError('Please identify at least one strength')
        setSaving(false)
        return
      }

      if (!formData.improvements.trim()) {
        setError('Please identify at least one area for improvement')
        setSaving(false)
        return
      }

      const token = localStorage.getItem('accessToken')

      if (!token) {
        setError('Authentication token not found. Please login again.')
        setSaving(false)
        return
      }

      // Parse strengths and improvements from newline-separated input
      const strengths = formData.strengths
        .split('\n')
        .map(s => s.trim())
        .filter(s => s.length > 0)

      const improvements = formData.improvements
        .split('\n')
        .map(s => s.trim())
        .filter(s => s.length > 0)

      // Prepare grade payload
      const gradePayload = {
        submission_id: submissionId,
        assignment_id: assignmentId,
        score: formData.score,
        feedback: formData.feedback,
        strengths: strengths,
        improvements: improvements,
        confidence: 85, // Default instructor confidence
      }

      // Call backend API to create grade
      const gradeResponse = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/v1/grading`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(gradePayload),
        }
      )

      if (!gradeResponse.ok) {
        const errorData = await gradeResponse.json()
        throw new Error(
          errorData.error?.message || 'Failed to save grade'
        )
      }

      const gradeData = await gradeResponse.json()
      
      if (!gradeData.success) {
        throw new Error(gradeData.error?.message || 'Grade creation failed')
      }

      setSuccessMessage('Grade saved successfully!')
      
      setTimeout(() => {
        router.push(`/dashboard/instructor/courses/${courseId}/assignments/${assignmentId}/submissions/${submissionId}`)
      }, 1500)

    } catch (error) {
      console.error('Error saving grade:', error)
      setError('An error occurred while saving the grade')
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('accessToken')
        
        // Fetch submission details
        const submissionResponse = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/v1/submissions/${submissionId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        )

        if (submissionResponse.ok) {
          const submissionData = await submissionResponse.json()
          setSubmission(submissionData.data)
        } else {
          setError('Submission not found')
        }

        // Fetch assignment details
        const assignmentResponse = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/v1/courses/assignments/${assignmentId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        )

        if (assignmentResponse.ok) {
          const assignmentData = await assignmentResponse.json()
          setAssignment(assignmentData.data)
          // Set default max score
          setFormData(prev => ({
            ...prev,
            score: assignmentData.data.point_value || 0,
          }))
        }

      } catch (error) {
        console.error('Failed to fetch data:', error)
        setError('An error occurred while loading data')
      } finally {
        setLoading(false)
      }
    }

    if (submissionId && user?.role === 'instructor') {
      fetchData()
    }
  }, [submissionId, user])

  return (
    <RoleGuard roles={['instructor', 'admin']}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Grade Submission
            </h1>
            {assignment && (
              <p className="text-gray-600 mt-2">{assignment.title}</p>
            )}
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
            <LoadingSpinner message="Loading submission..." />
          </Card>
        ) : error && !successMessage ? (
          <Card>
            <p className="text-red-600 text-center py-8">{error}</p>
          </Card>
        ) : submission && assignment ? (
          <div className="space-y-4">
            {/* Success Message */}
            {successMessage && (
              <Card>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-green-800 font-semibold">✓ {successMessage}</p>
                </div>
              </Card>
            )}

            {/* Two Column Layout: Submission Viewer + Grading Form */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Left Column: Submission Viewer (1/3 width on large screens) */}
              <div className="lg:col-span-1">
                <Card>
                  <SubmissionViewer
                    submissionId={submission.id}
                    filePath={submission.file_path}
                    fileType={submission.file_type}
                    assignmentType={assignment.type}
                    isLoading={loading}
                  />
                </Card>
              </div>

              {/* Right Column: Submission Info + Grading Form (2/3 width on large screens) */}
              <div className="lg:col-span-2 space-y-4">
                {/* Submission Summary */}
                <Card>
                  <div className="space-y-3">
                    <h2 className="text-xl font-semibold text-gray-900">Submission Information</h2>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-gray-600">Student ID</p>
                        <p className="font-medium text-gray-900 truncate">
                          {submission.student_id}
                        </p>
                      </div>
                      
                      <div>
                        <p className="text-gray-600">Submitted</p>
                        <p className="font-medium text-gray-900">
                          {new Date(submission.submitted_at).toLocaleDateString()}
                        </p>
                      </div>
                      
                      <div>
                        <p className="text-gray-600">Status</p>
                        <p className={`font-medium ${submission.is_late ? 'text-red-600' : 'text-green-600'}`}>
                          {submission.is_late ? 'Late' : 'On Time'}
                        </p>
                      </div>
                    </div>
                  </div>
                </Card>

                {/* Grading Form */}
                <Card>
                  <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Score */}
                    <div>
                      <label htmlFor="score" className="block text-sm font-semibold text-gray-700 mb-2">
                        Score *
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          id="score"
                          name="score"
                          value={formData.score}
                          onChange={handleInputChange}
                          min="0"
                          max={assignment.point_value}
                          step="0.01"
                          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                          required
                        />
                        <span className="text-gray-600">/ {assignment.point_value}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Enter a score between 0 and {assignment.point_value}
                      </p>
                    </div>

                    {/* Feedback */}
                    <div>
                      <label htmlFor="feedback" className="block text-sm font-semibold text-gray-700 mb-2">
                        Feedback *
                      </label>
                      <textarea
                        id="feedback"
                        name="feedback"
                        value={formData.feedback}
                        onChange={handleInputChange}
                        placeholder="Provide detailed feedback about this submission. Include specific line references or quotes for inline comments."
                        rows={5}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Minimum 20 characters required. Add specific references to the submission for targeted feedback.
                      </p>
                    </div>

                    {/* Strengths */}
                    <div>
                      <label htmlFor="strengths" className="block text-sm font-semibold text-gray-700 mb-2">
                        Strengths *
                      </label>
                      <textarea
                        id="strengths"
                        name="strengths"
                        value={formData.strengths}
                        onChange={handleInputChange}
                        placeholder="List strengths of this submission (one per line)"
                        rows={3}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Enter at least one strength (press Enter for multiple)
                      </p>
                    </div>

                    {/* Improvements */}
                    <div>
                      <label htmlFor="improvements" className="block text-sm font-semibold text-gray-700 mb-2">
                        Areas for Improvement *
                      </label>
                      <textarea
                        id="improvements"
                        name="improvements"
                        value={formData.improvements}
                        onChange={handleInputChange}
                        placeholder="List areas for improvement (one per line)"
                        rows={3}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Enter at least one area for improvement (press Enter for multiple)
                      </p>
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
                        {saving ? 'Saving...' : 'Save Grade'}
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

                {/* Info Box */}
                <Card>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-blue-800 font-semibold mb-2">ℹ️ Grading Guidelines</p>
                    <ul className="text-blue-700 text-sm space-y-1">
                      <li>• Provide constructive feedback that is actionable and specific</li>
                      <li>• Highlight strengths to reinforce good practices</li>
                      <li>• Suggest areas for improvement to support student growth</li>
                      <li>• Score should reflect the assignment rubric requirements</li>
                      <li>• Late penalty of {assignment.point_value * 0.1} points will be applied if applicable</li>
                    </ul>
                  </div>
                </Card>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </RoleGuard>
  )
}
