import { useState, useEffect, useCallback } from 'react'

export interface Submission {
  id: string
  assignment_id: string
  student_id?: string
  version: number
  file_path?: string
  file_type?: string
  is_late: boolean
  submitted_at: string
  created_at: string
  updated_at?: string
}

export interface UseAssignmentSubmissionsReturn {
  submissions: Submission[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

/**
 * Hook for fetching assignment submissions for current student
 * Used for displaying submission history and previous versions
 *
 * Usage:
 * const { submissions, loading, error } = useAssignmentSubmissions(assignmentId)
 */
export function useAssignmentSubmissions(
  assignmentId: string | undefined | null
): UseAssignmentSubmissionsReturn {
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchSubmissions = useCallback(async (): Promise<void> => {
    if (!assignmentId) {
      setSubmissions([])
      setError(null)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const token = localStorage.getItem('accessToken')
      if (!token) {
        throw new Error('Authentication required')
      }

      // Fetch submissions for this assignment (for current user)
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/v1/submissions/assignments/${assignmentId}/history`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )

      if (!response.ok) {
        if (response.status === 404) {
          // No submissions yet, which is normal
          setSubmissions([])
          return
        }
        const errorData = await response.json().catch(() => null)
        const errorMessage =
          errorData?.error?.message ||
          errorData?.message ||
          `Failed to fetch submissions (${response.status})`
        throw new Error(errorMessage)
      }

      const data = await response.json()

      // Handle both array response and nested data response
      const submissionsData = Array.isArray(data) ? data : data.data || []

      if (Array.isArray(submissionsData)) {
        // Sort by version descending (newest first)
        submissionsData.sort((a, b) => b.version - a.version)
        setSubmissions(submissionsData)
      } else {
        setSubmissions([])
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred'
      setError(errorMessage)
      setSubmissions([])
    } finally {
      setLoading(false)
    }
  }, [assignmentId])

  // Fetch submissions on component mount and when assignmentId changes
  useEffect(() => {
    fetchSubmissions()
  }, [fetchSubmissions])

  return {
    submissions,
    loading,
    error,
    refetch: fetchSubmissions,
  }
}
