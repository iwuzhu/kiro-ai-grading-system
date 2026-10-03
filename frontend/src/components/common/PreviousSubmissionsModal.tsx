'use client'

import React, { useState } from 'react'
import { Modal } from './Modal'
import { LoadingSpinner } from './LoadingSpinner'

export interface Submission {
  id: string
  assignment_id: string
  student_id?: string
  version: number
  file_path?: string
  file_type?: string
  content?: string
  is_late: boolean
  submitted_at: string
  created_at: string
  updated_at?: string
  grade?: {
    id: string
    score: number
    feedback: string
    confidence: number
    created_at: string
  }
}

interface PreviousSubmissionsModalProps {
  isOpen: boolean
  onClose: () => void
  submissions: Submission[]
  loading: boolean
  error?: string | null
  assignmentTitle: string
}

export const PreviousSubmissionsModal: React.FC<PreviousSubmissionsModalProps> = ({
  isOpen,
  onClose,
  submissions,
  loading,
  error,
  assignmentTitle,
}) => {
  const [expandedSubmissionId, setExpandedSubmissionId] = useState<string | null>(null)

  const toggleExpanded = (submissionId: string) => {
    setExpandedSubmissionId(expandedSubmissionId === submissionId ? null : submissionId)
  }

  const handleDownloadSubmission = async (submission: Submission) => {
    if (!submission.file_path) {
      alert('No file associated with this submission')
      return
    }

    try {
      const token = localStorage.getItem('accessToken')
      if (!token) {
        alert('Authentication required')
        return
      }

      // Call backend to get signed download URL
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/v1/submissions/download/${submission.id}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )

      if (response.ok) {
        const data = await response.json()
        if (data.data?.download_url) {
          // Open signed URL in new tab for download
          window.open(data.data.download_url, '_blank')
        } else {
          alert('Failed to generate download link')
        }
      } else {
        const errorData = await response.json().catch(() => ({}))
        alert(
          errorData?.error?.message ||
          `Failed to download submission (${response.status})`
        )
      }
    } catch (error) {
      console.error('Error downloading submission:', error)
      alert('Failed to download submission')
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getFileNameFromPath = (filePath?: string) => {
    if (!filePath) return 'No file'
    // Extract filename from S3 URI or path
    const parts = filePath.split('/')
    return parts[parts.length - 1] || 'download'
  }

  if (!isOpen) return null

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Previous Submissions - ${assignmentTitle}`}>
      <div className="space-y-4">
        {loading ? (
          <LoadingSpinner message="Loading submission history..." />
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800 font-semibold">Error Loading Submissions</p>
            <p className="text-red-700 text-sm mt-1">{error}</p>
          </div>
        ) : submissions.length === 0 ? (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-blue-800 text-center">No submissions found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {submissions.map((submission) => (
              <div key={submission.id} className="border border-gray-200 rounded-lg overflow-hidden">
                {/* Submission Header (Always Visible) */}
                <button
                  onClick={() => toggleExpanded(submission.id)}
                  className="w-full bg-gray-50 hover:bg-gray-100 px-4 py-3 flex justify-between items-center text-left transition"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-gray-900">
                        Submission #{submission.version}
                      </span>
                      {submission.is_late && (
                        <span className="inline-block px-2 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                          Late
                        </span>
                      )}
                      {submission.grade && (
                        <span className="inline-block px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">
                          Graded: {submission.grade.score}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      Submitted: {formatDate(submission.submitted_at)}
                    </p>
                  </div>
                  <span className="text-gray-400 text-xl ml-4">
                    {expandedSubmissionId === submission.id ? '−' : '+'}
                  </span>
                </button>

                {/* Submission Details (Expandable) */}
                {expandedSubmissionId === submission.id && (
                  <div className="bg-white border-t border-gray-200 px-4 py-3 space-y-4">
                    {/* File Information */}
                    {submission.file_path && (
                      <div>
                        <p className="text-sm font-semibold text-gray-700 mb-2">File</p>
                        <div className="flex items-center justify-between bg-gray-50 rounded p-3">
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {getFileNameFromPath(submission.file_path)}
                            </p>
                            {submission.file_type && (
                              <p className="text-xs text-gray-600">{submission.file_type}</p>
                            )}
                          </div>
                          <button
                            onClick={() => handleDownloadSubmission(submission)}
                            className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                          >
                            Download
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Submission Content (if available) */}
                    {submission.content && !submission.file_path && (
                      <div>
                        <p className="text-sm font-semibold text-gray-700 mb-2">Content</p>
                        <div className="bg-gray-50 rounded p-3 max-h-40 overflow-y-auto">
                          <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">
                            {submission.content}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Grade Information */}
                    {submission.grade ? (
                      <div className="bg-blue-50 border border-blue-200 rounded p-3">
                        <p className="text-sm font-semibold text-blue-900 mb-2">Grade</p>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-sm text-blue-800">Score:</span>
                            <span className="text-sm font-bold text-blue-900">
                              {submission.grade.score}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-blue-800">Confidence:</span>
                            <span className="text-sm font-bold text-blue-900">
                              {submission.grade.confidence}%
                            </span>
                          </div>
                          <div>
                            <p className="text-sm text-blue-800 mb-1">Feedback:</p>
                            <p className="text-sm text-blue-900 bg-white rounded p-2 whitespace-pre-wrap break-words">
                              {submission.grade.feedback}
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-gray-50 border border-gray-200 rounded p-3">
                        <p className="text-sm text-gray-600">Not yet graded</p>
                      </div>
                    )}

                    {/* Metadata */}
                    <div className="border-t border-gray-200 pt-3 text-xs text-gray-600 space-y-1">
                      <p>ID: <span className="font-mono text-gray-500">{submission.id}</span></p>
                      <p>Created: {formatDate(submission.created_at)}</p>
                      {submission.updated_at && (
                        <p>Updated: {formatDate(submission.updated_at)}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Summary */}
        {submissions.length > 0 && !loading && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mt-4">
            <p className="text-sm text-gray-600">
              Total Submissions: <span className="font-bold text-gray-900">{submissions.length}</span>
            </p>
            {submissions.some(s => s.grade) && (
              <p className="text-sm text-gray-600 mt-1">
                Graded: <span className="font-bold text-gray-900">
                  {submissions.filter(s => s.grade).length}
                </span>
              </p>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
