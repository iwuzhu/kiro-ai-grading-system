'use client'

import React, { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { RoleGuard } from '@/components/auth/RoleGuard'
import { Card, LoadingSpinner } from '@/components/common'
import { useAuth } from '@/hooks/useAuth'

interface Submission {
  id: string
  student_id: string
  version: number
  is_late: boolean
  submitted_at: string
  file_path?: string
  file_type?: string
}

interface SubmissionStats {
  total: number
  unique_students: number
  late: number
  on_time: number
}

interface Assignment {
  id: string
  title: string
  point_value: number
  hard_deadline?: string
}

export default function SubmissionsPage() {
  const { user, logout } = useAuth()
  const router = useRouter()
  const params = useParams()
  const courseId = params.courseId as string
  const assignmentId = params.assignmentId as string
  
  const [assignment, setAssignment] = useState<Assignment | null>(null)
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [stats, setStats] = useState<SubmissionStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<'date' | 'status'>('date')

  const handleLogout = async () => {
    await logout()
    router.replace('/auth/login')
  }

  const handleBack = () => {
    router.back()
  }

  const handleDownload = async (submission: Submission) => {
    if (!submission.file_path) {
      alert('No file attached to this submission')
      return
    }

    try {
      const token = localStorage.getItem('accessToken')
      
      // Call backend endpoint to get file information
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/v1/submissions/download/${submission.id}`,
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

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Not submitted'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const isLate = (submittedAt: string, hardDeadline?: string) => {
    if (!hardDeadline) return false
    return new Date(submittedAt) > new Date(hardDeadline)
  }

  const getSortedSubmissions = () => {
    const sorted = [...submissions]
    
    if (sortBy === 'date') {
      return sorted.sort((a, b) => 
        new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()
      )
    } else {
      // Sort by status: late submissions first, then on-time
      return sorted.sort((a, b) => {
        const aLate = isLate(a.submitted_at, assignment?.hard_deadline)
        const bLate = isLate(b.submitted_at, assignment?.hard_deadline)
        
        if (aLate === bLate) {
          return new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()
        }
        return aLate ? -1 : 1
      })
    }
  }

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('accessToken')
        
        // Fetch assignment details (optional - for display purposes)
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
        } else {
          console.warn('Could not fetch assignment details:', assignmentResponse.status)
          // Continue anyway - we can still load submissions
        }

        // Fetch submissions for this assignment (primary data)
        const submissionsResponse = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/v1/submissions/assignment/${assignmentId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        )

        if (submissionsResponse.ok) {
          const submissionsData = await submissionsResponse.json()
          setSubmissions(submissionsData.data.submissions || [])
          setStats(submissionsData.data.stats)
        } else if (submissionsResponse.status === 404) {
          setError('No submissions found for this assignment yet.')
        } else {
          setError('Failed to load submissions')
        }
      } catch (error) {
        console.error('Failed to fetch submissions:', error)
        setError('An error occurred while loading submissions')
      } finally {
        setLoading(false)
      }
    }

    if (assignmentId && user?.role === 'instructor') {
      fetchData()
    }
  }, [assignmentId, user])

  return (
    <RoleGuard roles={['instructor', 'admin']}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Assignment Submissions
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

        {/* Statistics Card */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Total Submissions</p>
                <p className="text-3xl font-bold text-blue-600">{stats.total}</p>
              </div>
            </Card>
            
            <Card>
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">On Time</p>
                <p className="text-3xl font-bold text-green-600">{stats.on_time}</p>
              </div>
            </Card>
            
            <Card>
              <div className="bg-red-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Late</p>
                <p className="text-3xl font-bold text-red-600">{stats.late}</p>
              </div>
            </Card>
            
            <Card>
              <div className="bg-purple-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Unique Students</p>
                <p className="text-3xl font-bold text-purple-600">{stats.unique_students}</p>
              </div>
            </Card>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <Card>
            <LoadingSpinner message="Loading submissions..." />
          </Card>
        ) : error ? (
          <Card>
            <p className="text-red-600 text-center py-8">{error}</p>
          </Card>
        ) : submissions.length === 0 ? (
          <Card>
            <p className="text-gray-600 text-center py-8">
              No submissions found for this assignment.
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* Sort Options */}
            <Card>
              <div className="flex items-center gap-4">
                <label className="text-sm font-semibold text-gray-700">
                  Sort by:
                </label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'date' | 'status')}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                >
                  <option value="date">Most Recent</option>
                  <option value="status">Status (Late First)</option>
                </select>
              </div>
            </Card>

            {/* Submissions List */}
            <div className="space-y-3">
              {getSortedSubmissions().map((submission) => (
                <Card key={`${submission.student_id}-${submission.version}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-bold text-gray-900">
                          Student ID: {submission.student_id}
                        </h3>
                        {isLate(submission.submitted_at, assignment?.hard_deadline) ? (
                          <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            Late
                          </span>
                        ) : (
                          <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            On Time
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-gray-600">Submitted</p>
                          <p className="font-medium text-gray-900">
                            {formatDate(submission.submitted_at)}
                          </p>
                        </div>

                        <div>
                          <p className="text-gray-600">Version</p>
                          <p className="font-medium text-gray-900">
                            {submission.version}
                          </p>
                        </div>

                        <div>
                          <p className="text-gray-600">Submission ID</p>
                          <p className="font-medium text-gray-900 truncate text-xs">
                            {submission.id}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="ml-4 flex flex-col gap-2">
                      <button 
                        onClick={() => router.push(`/dashboard/instructor/courses/${courseId}/assignments/${assignmentId}/submissions/${submission.id}`)}
                        className="bg-blue-600 text-white px-3 py-2 rounded text-sm hover:bg-blue-700 transition"
                      >
                        View Details
                      </button>
                      <button 
                        onClick={() => router.push(`/dashboard/instructor/courses/${courseId}/assignments/${assignmentId}/submissions/${submission.id}/grade`)}
                        className="bg-purple-600 text-white px-3 py-2 rounded text-sm hover:bg-purple-700 transition"
                      >
                        Grade Submission
                      </button>
                      <button 
                        onClick={() => handleDownload(submission)}
                        className="bg-gray-600 text-white px-3 py-2 rounded text-sm hover:bg-gray-700 transition"
                      >
                        Download
                      </button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </RoleGuard>
  )
}
