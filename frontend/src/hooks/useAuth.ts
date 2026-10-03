'use client'

import { useState, useEffect } from 'react'

export interface User {
  id: string
  email: string
  name: string
  role: 'admin' | 'instructor' | 'student'
  tenant_id: string
  permissions: string[]
}

export type UseAuthReturn = {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<{ user: User; redirect: string }>
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

/**
 * useAuth Hook
 * 
 * Manages authentication state and provides login/logout/refresh functions.
 * 
 * Returns:
 * - user: Current authenticated user or null
 * - isLoading: True while loading user from storage
 * - isAuthenticated: True if user is logged in
 * - login: Async function that returns user AND the redirect path to use
 * - logout: Async function to clear auth
 * - refresh: Async function to refresh token
 */
export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Load persisted user from localStorage on mount
  useEffect(() => {
    const loadPersistedUser = () => {
      try {
        const token = localStorage.getItem('accessToken')
        const userEmail = localStorage.getItem('userEmail')
        const userRole = localStorage.getItem('userRole')
        const userId = localStorage.getItem('userId')
        const userTenant = localStorage.getItem('userTenant')

        if (token && userEmail && userRole) {
          setUser({
            id: userId || '',
            email: userEmail,
            name: userEmail.split('@')[0],
            role: userRole as 'admin' | 'instructor' | 'student',
            tenant_id: userTenant || '',
            permissions: [],
          })
        }
      } catch (error) {
        console.error('Failed to load persisted user:', error)
        // Clear invalid data
        localStorage.removeItem('accessToken')
        localStorage.removeItem('refreshToken')
      } finally {
        setIsLoading(false)
      }
    }

    loadPersistedUser()
  }, [])

  /**
   * Login user and return user data + redirect path
   * 
   * The redirect path is determined by role:
   * - admin -> /dashboard/admin
   * - instructor -> /dashboard/instructor
   * - student -> /dashboard/student
   */
  const login = async (
    email: string,
    password: string,
  ): Promise<{ user: User; redirect: string }> => {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/v1/auth/login`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      },
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error?.message || 'Login failed')
    }

    const data = await response.json()

    // Normalize role to lowercase
    const role = data.user.role.toLowerCase() as 'admin' | 'instructor' | 'student'

    // Persist to localStorage
    localStorage.setItem('accessToken', data.access_token)
    localStorage.setItem('refreshToken', data.refresh_token)
    localStorage.setItem('userEmail', data.user.email)
    localStorage.setItem('userRole', role)
    localStorage.setItem('userId', data.user.id)
    localStorage.setItem('userTenant', data.user.tenant_id)

    // Create user object
    const user: User = {
      id: data.user.id,
      email: data.user.email,
      name: data.user.email.split('@')[0],
      role,
      tenant_id: data.user.tenant_id,
      permissions: data.user.permissions || [],
    }

    setUser(user)

    // Determine redirect path based on role
    const redirectPath = getRoleBasedPath(role)

    return { user, redirect: redirectPath }
  }

  const logout = async () => {
    try {
      const token = localStorage.getItem('accessToken')
      if (token) {
        await fetch(`${process.env.NEXT_PUBLIC_API_URL}/v1/auth/logout`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })
      }
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
      localStorage.removeItem('userEmail')
      localStorage.removeItem('userRole')
      localStorage.removeItem('userId')
      localStorage.removeItem('userTenant')
      setUser(null)
    }
  }

  const refresh = async () => {
    const refreshToken = localStorage.getItem('refreshToken')
    if (!refreshToken) {
      throw new Error('No refresh token')
    }

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/v1/auth/refresh`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      },
    )

    if (!response.ok) {
      throw new Error('Refresh failed')
    }

    const data = await response.json()
    localStorage.setItem('accessToken', data.access_token)
  }

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
    refresh,
  }
}

/**
 * Helper function to get the dashboard path based on user role
 * Returns the actual page with content (not an intermediate redirect page)
 */
export function getRoleBasedPath(role: 'admin' | 'instructor' | 'student'): string {
  switch (role) {
    case 'admin':
      return '/dashboard/admin/logs'
    case 'instructor':
      return '/dashboard/instructor/courses'
    case 'student':
      return '/dashboard/student/courses'
    default:
      return '/dashboard'
  }
}
