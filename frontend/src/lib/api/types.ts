export interface ApiResponse<T = unknown> {
  success: boolean
  data: T
  error: null | {
    code: string
    message: string
  }
  pagination?: {
    page: number
    limit: number
    total: number
  }
}

export interface ApiErrorResponse {
  success: false
  data: null
  error: {
    code: string
    message: string
    details?: Record<string, any>
  }
}
