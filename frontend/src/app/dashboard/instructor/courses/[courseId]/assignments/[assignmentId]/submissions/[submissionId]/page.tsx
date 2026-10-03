'use client'

import React, { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { RoleGuard } from '@/components/auth/RoleGuard'
import { Card, LoadingSpinner } from '@/components/common'
import { useAuth } from '@/hooks/useAuth'

interface Submission {
  id: string
  assignment_id: string
  student_id: string
  version: number
  file_path?: string
  file_type?: string
  is_late: boolean
  is_incremental: boolean
  submitted_at: string
  created_at: string
}

interface Assignment {
  id: string
  title: string
  point_value: number
  type: string
  hard_deadline?: string
}

interface Grade {
  id: string
  score: number
  feedback: string
  confidence: number
  ai_score?: number
  manual_score?: number
  created_at: string
}

export default function SubmissionDetailPage() {
  const { user, logout } = useAuth()
  const router = useRouter()
  const params = useParams()
  const courseId = params.courseId as string
  const assignmentId = params.assignmentId as string
  const submissionId = params.submissionId as string
  
  const [submission, setSubmission] = useState<Submission | null>(null)
  const [assignment, setAssignment] = useState<Assignment | null>(null)
  const [grades, setGrades] = useState<Grade[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const handleLogout = async () => {
    await logout()
    router.replace('/auth/login')
  }

  const handleBack = () => {
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

  const getFileIcon = (fileType?: string) => {
    if (!fileType) return '📄'
    
    const icons: Record<string, string> = {
      'pdf': '📕',
      'docx': '📘',
      'doc': '📘',
      'txt': '📄',
      'py': '🐍',
      'js': '🟨',
      'java': '☕',
      'cpp': '⚙️',
      'c': '⚙️',
      'html': '🌐',
      'css': '🎨',
      'json': '📦',
    }
    
    return icons[fileType.toLowerCase()] || '📄'
  }

  const handleDownload = async () => {
    if (!submission?.file_path) {
      alert('No file attached to this submission')
      return
    }

    try {
      const token = localStorage.getItem('accessToken')
      
      // Call backend endpoint to get file information
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/v1/submissions/download/${submissionId}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )

      if (!response.ok) {
        throw new Error('Failed to download submission')
      }

      const data = await response.json()

      if (data.success && data.data?.download_url) {
        const fileName = data.data.file_name || 'submission'
        const downloadUrl = data.data.download_url
        
        // Encode the S3 path as base64 for URL safety
        const encodedPath = btoa(downloadUrl)
        
        // Use fetch to download with auth headers
        const downloadLink = `${process.env.NEXT_PUBLIC_API_URL}/v1/files/download/${encodedPath}`
        
        const fileResponse = await fetch(downloadLink, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (!fileResponse.ok) {
          throw new Error('Failed to download file from server')
        }

        // Get the file blob
        const blob = await fileResponse.blob()

        // Create a blob URL and trigger download
        const blobUrl = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = blobUrl
        link.download = fileName
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        
        // Clean up the blob URL after download
        setTimeout(() => URL.revokeObjectURL(blobUrl), 100)
      } else {
        alert('Failed to generate download link')
      }
    } catch (error) {
      console.error('Download error:', error)
      alert('Failed to download submission')
    }
  }

  const handleGradeSubmission = () => {
    // Navigate to grading page
    router.push(`/dashboard/instructor/courses/${courseId}/assignments/${assignmentId}/submissions/${submissionId}/grade`)
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
        } else if (submissionResponse.status === 404) {
          setError('Submission not found')
        } else {
          setError('Failed to load submission')
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
        }

        // Fetch grades for this submission
        const gradesResponse = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/v1/submissions/${submissionId}/grades`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        )

        if (gradesResponse.ok) {
          const gradesData = await gradesResponse.json()
          if (gradesData.data) {
            // Handle both single grade and array of grades
            const gradeArray = Array.isArray(gradesData.data) ? gradesData.data : [gradesData.data]
            setGrades(gradeArray)
          }
        }
        // If no grades found, grades array remains empty

      } catch (error) {
        console.error('Failed to fetch data:', error)
        setError('An error occurred while loading submission details')
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
              Submission Details
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
            <LoadingSpinner message="Loading submission details..." />
          </Card>
        ) : error ? (
          <Card>
            <p className="text-red-600 text-center py-8">{error}</p>
          </Card>
        ) : submission ? (
          <div className="space-y-4">
            {/* Submission Info Card */}
            <Card>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-gray-900">
                    Student Submission
                  </h2>
                  <div className="flex items-center gap-3">
                    {submission.is_late ? (
                      <span className="inline-block px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                        ⏰ Late
                      </span>
                    ) : (
                      <span className="inline-block px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                        ✓ On Time
                      </span>
                    )}
                    {submission.is_incremental && (
                      <span className="inline-block px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                        Version {submission.version}
                      </span>
                    )}
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-4 space-y-3">
                  {/* Submission ID */}
                  <div>
                    <p className="text-sm font-semibold text-gray-700 mb-1">
                      Submission ID
                    </p>
                    <p className="font-mono text-sm text-gray-600 break-all">
                      {submission.id}
                    </p>
                  </div>

                  {/* Student ID */}
                  <div>
                    <p className="text-sm font-semibold text-gray-700 mb-1">
                      Student ID
                    </p>
                    <p className="font-mono text-sm text-gray-600 break-all">
                      {submission.student_id}
                    </p>
                  </div>

                  {/* Submitted At */}
                  <div>
                    <p className="text-sm font-semibold text-gray-700 mb-1">
                      Submitted
                    </p>
                    <p className="text-gray-900">
                      {formatDate(submission.submitted_at)}
                    </p>
                  </div>

                  {/* File Information */}
                  {submission.file_path && (
                    <div>
                      <p className="text-sm font-semibold text-gray-700 mb-1">
                        Submitted File
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">
                          {getFileIcon(submission.file_type)}
                        </span>
                        <div>
                          <p className="text-gray-900 break-all">
                            {submission.file_path.split('/').pop()}
                          </p>
                          <p className="text-sm text-gray-600">
                            {submission.file_type && `Type: ${submission.file_type}`}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Card>

            {/* Grading Card */}
            <Card>
              <div className="space-y-4">
                <h3 className="text-xl font-semibold text-gray-900">Grading</h3>
                
                {grades.length > 0 ? (
                  <div className="space-y-4">
                    {grades.map((grade, index) => (
                      <div key={grade.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <p className="font-semibold text-gray-900">
                            Grade {index + 1}
                          </p>
                          <span className="text-2xl font-bold text-blue-600">
                            {grade.score}
                          </span>
                        </div>
                        
                        <p className="text-sm text-gray-600 mb-3">
                          Created: {formatDate(grade.created_at)}
                        </p>

                        {grade.confidence !== undefined && (
                          <p className="text-sm text-gray-600 mb-3">
                            Confidence: {grade.confidence}%
                          </p>
                        )}

                        <p className="text-gray-700">{grade.feedback}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
                    <p className="text-gray-600 mb-4">
                      No grades assigned yet
                    </p>
                    <button
                      onClick={handleGradeSubmission}
                      className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition"
                    >
                      Grade This Submission
                    </button>
                  </div>
                )}
              </div>
            </Card>

            {/* Actions Card */}
            <Card>
              <div className="space-y-3">
                <h3 className="font-semibold text-gray-900 mb-4">Actions</h3>
                
                <div className="flex flex-wrap gap-3">
                  {submission.file_path && (
                    <button
                      onClick={handleDownload}
                      className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition"
                    >
                      ⬇️ Download Submission
                    </button>
                  )}
                  
                  <button
                    onClick={handleGradeSubmission}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
                  >
                    ✏️ Grade Submission
                  </button>
                </div>
              </div>
            </Card>

            {/* Additional Info */}
            <Card>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-blue-800 font-semibold mb-2">ℹ️ Submission Information</p>
                <ul className="text-blue-700 text-sm space-y-1">
                  <li>• Assignment Points: {assignment?.point_value}</li>
                  <li>• Assignment Type: {assignment?.type}</li>
                  <li>• Submission Status: {submission.is_incremental ? 'Incremental' : 'Final'}</li>
                  {submission.is_late && (
                    <li>• Note: This submission was submitted after the soft deadline</li>
                  )}
                </ul>
              </div>
            </Card>
          </div>
        ) : null}
      </div>
    </RoleGuard>
  )
}
