/**
 * API Endpoints Configuration
 * Centralized endpoint definitions for all API calls
 */

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

export const AUTH_ENDPOINTS = {
  LOGIN: '/auth/login',
  LOGOUT: '/auth/logout',
  REFRESH: '/auth/refresh',
  ME: '/auth/me',
}

export const API_ENDPOINTS = {
  // Auth endpoints
  AUTH: {
    LOGIN: '/auth/login',
    LOGOUT: '/auth/logout',
    REFRESH: '/auth/refresh',
    ME: '/auth/me',
  },

  // Users endpoints
  USERS: {
    LIST: '/users',
    GET: (id: string) => `/users/${id}`,
    CREATE: '/users',
    UPDATE: (id: string) => `/users/${id}`,
    DELETE: (id: string) => `/users/${id}`,
  },

  // Courses endpoints
  COURSES: {
    LIST: '/courses',
    GET: (id: string) => `/courses/${id}`,
    CREATE: '/courses',
    UPDATE: (id: string) => `/courses/${id}`,
    DELETE: (id: string) => `/courses/${id}`,
  },

  // Assignments endpoints
  ASSIGNMENTS: {
    LIST: '/assignments',
    GET: (id: string) => `/assignments/${id}`,
    CREATE: '/assignments',
    UPDATE: (id: string) => `/assignments/${id}`,
    DELETE: (id: string) => `/assignments/${id}`,
  },

  // Submissions endpoints
  SUBMISSIONS: {
    LIST: '/submissions',
    GET: (id: string) => `/submissions/${id}`,
    CREATE: '/submissions',
    UPDATE: (id: string) => `/submissions/${id}`,
  },

  // Grades endpoints
  GRADES: {
    LIST: '/grades',
    GET: (id: string) => `/grades/${id}`,
    CREATE: '/grades',
    UPDATE: (id: string) => `/grades/${id}`,
    OVERRIDE: (id: string) => `/grades/${id}/override`,
  },

  // Plagiarism endpoints
  PLAGIARISM: {
    CHECK: '/plagiarism/check',
    RESULTS: (submissionId: string) => `/plagiarism/results/${submissionId}`,
    FLAGS: '/plagiarism/flags',
    INVESTIGATE: (flagId: string) => `/plagiarism/flags/${flagId}/investigate`,
  },

  // Audit logs endpoints
  AUDIT_LOGS: {
    LIST: '/audit-logs',
    GET: (id: string) => `/audit-logs/${id}`,
  },

  // Analytics endpoints
  ANALYTICS: {
    DASHBOARD: '/analytics/dashboard',
    COURSE_STATS: (courseId: string) => `/analytics/courses/${courseId}`,
    ASSIGNMENT_STATS: (assignmentId: string) => `/analytics/assignments/${assignmentId}`,
  },
}
