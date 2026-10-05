import { useState } from 'react'
import axios from 'axios'

export interface AIGradeResponse {
  ai_score: number
  confidence: number
  feedback: string
  strengths: string[]
  improvements: string[]
  status: 'success' | 'error'
  aiProvider: string
  processingTimeMs: number
}

interface UseAIGradeOptions {
  onSuccess?: (data: AIGradeResponse) => void
  onError?: (error: string) => void
}

export const useAIGrade = (options?: UseAIGradeOptions) => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generateAIGrade = async (
    submissionId: string,
    assignmentId: string
  ): Promise<AIGradeResponse | null> => {
    setLoading(true)
    setError(null)

    try {
      const token = localStorage.getItem('accessToken')
      if (!token) {
        throw new Error('Authentication token not found. Please login again.')
      }

      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/v1/grading/ai-grade`,
        {
          submission_id: submissionId,
          assignment_id: assignmentId,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      )

      if (response.status !== 201) {
        throw new Error(`Unexpected response status: ${response.status}`)
      }

      const data = response.data

      if (data.status === 'error') {
        throw new Error(data.message || 'AI grading failed')
      }

      // Extract the grading result from the response
      const gradeResult: AIGradeResponse = {
        ai_score: data.ai_score || 0,
        confidence: data.confidence || 0,
        feedback: data.feedback || '',
        strengths: Array.isArray(data.strengths) ? data.strengths : [],
        improvements: Array.isArray(data.improvements) ? data.improvements : [],
        status: 'success',
        aiProvider: data.aiProvider || 'openai',
        processingTimeMs: data.processingTimeMs || 0,
      }

      if (options?.onSuccess) {
        options.onSuccess(gradeResult)
      }

      return gradeResult
    } catch (err) {
      const errorMessage =
        err instanceof axios.AxiosError
          ? err.response?.data?.error?.message || err.message
          : err instanceof Error
            ? err.message
            : 'An error occurred while generating AI grade'

      setError(errorMessage)

      if (options?.onError) {
        options.onError(errorMessage)
      }

      return null
    } finally {
      setLoading(false)
    }
  }

  return {
    generateAIGrade,
    loading,
    error,
    clearError: () => setError(null),
  }
}
