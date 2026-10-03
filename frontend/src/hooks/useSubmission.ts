import { useState, useCallback } from 'react'

export interface SubmissionResponse {
  id: string
  assignment_id: string
  student_id?: string
  version: number
  file_path?: string
  file_type?: string
  is_late: boolean
  submitted_at: string
}

export interface UseSubmissionReturn {
  loading: boolean
  error: string | null
  success: boolean
  submission: SubmissionResponse | null
  submitAssignment: (assignmentId: string, data: SubmissionData) => Promise<void>
  resetState: () => void
}

export interface SubmissionData {
  content?: string
  filePath?: string
  fileType?: string
  fileName?: string
}

/**
 * Hook for managing assignment submissions
 * Handles file uploads and text submissions with error handling
 *
 * Usage:
 * const { loading, error, submitAssignment } = useSubmission()
 * await submitAssignment(assignmentId, { content: 'essay text' })
 */
export function useSubmission(): UseSubmissionReturn {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [submission, setSubmission] = useState<SubmissionResponse | null>(null)

  const submitAssignment = useCallback(
    async (assignmentId: string, data: SubmissionData): Promise<void> => {
      setLoading(true)
      setError(null)
      setSuccess(false)

      try {
        const token = localStorage.getItem('accessToken')
        if (!token) {
          throw new Error('Authentication required')
        }

        // Validate assignment ID
        if (!assignmentId || typeof assignmentId !== 'string') {
          throw new Error('Invalid assignment ID')
        }

        // Prepare submission payload
        // Note: In production, file would be uploaded to S3 first, then S3 path sent here
        const payload = {
          file_path: data.filePath || `submissions/${assignmentId}/${data.fileName || 'submission'}`,
          file_type: data.fileType || 'txt',
          content: data.content,
        }

        // Call backend API
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/v1/submissions/assignments/${assignmentId}/submit`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
          }
        )

        // Handle response
        if (!response.ok) {
          const errorData = await response.json().catch(() => null)
          const errorMessage =
            errorData?.error?.message ||
            errorData?.message ||
            `Submission failed (${response.status})`
          throw new Error(errorMessage)
        }

        const responseData = await response.json()

        // Validate response structure
        if (!responseData.success || !responseData.data) {
          throw new Error(responseData.error?.message || 'Invalid response from server')
        }

        // Update state with successful submission
        setSubmission(responseData.data)
        setSuccess(true)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred'
        setError(errorMessage)
        setSubmission(null)
        throw err
      } finally {
        setLoading(false)
      }
    },
    []
  )

  const resetState = useCallback(() => {
    setLoading(false)
    setError(null)
    setSuccess(false)
    setSubmission(null)
  }, [])

  return {
    loading,
    error,
    success,
    submission,
    submitAssignment,
    resetState,
  }
}
