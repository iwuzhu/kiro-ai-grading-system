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
    assignmentId: string,
    submissionContent?: string,  // NEW: Accept submission content from page
    rubricText?: string,          // NEW: Accept rubric from page
    assignmentDescription?: string // NEW: Accept assignment details from page
  ): Promise<AIGradeResponse | null> => {
    setLoading(true)
    setError(null)

    try {
      const token = localStorage.getItem('accessToken')
      if (!token) {
        throw new Error('Authentication token not found. Please login again.')
      }

      console.log('[useAIGrade] Sending AI grade request:', {
        submissionId,
        assignmentId,
        hasSubmissionContent: !!submissionContent,
        hasRubric: !!rubricText,
        hasAssignmentDescription: !!assignmentDescription,
        apiUrl: process.env.NEXT_PUBLIC_API_URL,
      })

      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/v1/grading/ai-grade`,
        {
          submission_id: submissionId,
          assignment_id: assignmentId,
          submission_content: submissionContent,  // NEW: Send content from page
          rubric_text: rubricText,                 // NEW: Send rubric from page
          assignment_description: assignmentDescription, // NEW: Send assignment from page
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      )

      console.log('[useAIGrade] Received response:', {
        status: response.status,
        statusText: response.statusText,
        dataKeys: Object.keys(response.data),
        success: response.data.success,
        hasError: !!response.data.error,
      })

      if (response.status !== 201) {
        console.error('[useAIGrade] Unexpected response status:', response.status)
        throw new Error(`Unexpected response status: ${response.status}`)
      }

      const data = response.data

      if (data.status === 'error') {
        console.error('[useAIGrade] Response indicates error:', data.message)
        throw new Error(data.message || 'AI grading failed')
      }

      // Check if response contains actual grading data
      if (!data.data) {
        console.error('[useAIGrade] No data object in response:', data)
        throw new Error(data.error?.message || 'AI grading failed: No grade data returned')
      }

      if (data.data.ai_score === undefined && data.data.confidence === undefined) {
        console.error('[useAIGrade] Missing score/confidence in response:', data.data)
        throw new Error('AI grading failed: No score or confidence in response')
      }

      console.log('[useAIGrade] Grade data received successfully:', {
        ai_score: data.data.ai_score,
        confidence: data.data.confidence,
        feedback_length: data.data.feedback?.length || 0,
        strengths_count: Array.isArray(data.data.strengths) ? data.data.strengths.length : 0,
        improvements_count: Array.isArray(data.data.improvements) ? data.data.improvements.length : 0,
      })

      // Extract the grading result from the response
      const gradeResult: AIGradeResponse = {
        ai_score: data.data.ai_score ?? 0,
        confidence: data.data.confidence ?? 0,
        feedback: data.data.feedback || '',
        strengths: Array.isArray(data.data.strengths) ? data.data.strengths : [],
        improvements: Array.isArray(data.data.improvements) ? data.data.improvements : [],
        status: 'success',
        aiProvider: data.data.aiProvider || 'openai',
        processingTimeMs: data.data.processingTimeMs || 0,
      }

      if (options?.onSuccess) {
        options.onSuccess(gradeResult)
      }

      return gradeResult
    } catch (err) {
      console.error('[useAIGrade] Error during AI grading:', {
        errorType: err instanceof axios.AxiosError ? 'AxiosError' : err instanceof Error ? 'Error' : 'Unknown',
        errorMessage: err instanceof Error ? err.message : String(err),
        axiosResponse: err instanceof axios.AxiosError ? err.response?.data : undefined,
      })

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
