'use client'

import React, { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { LoadingSpinner, Card } from '@/components/common'
import Link from 'next/link'

export default function DashboardPage() {
  const { user, isLoading } = useAuth()
  const [redirected, setRedirected] = useState(false)

  useEffect(() => {
    if (!isLoading && user) {
      // Redirect to role-specific dashboard
      if (user.role === 'admin') {
        window.location.href = '/dashboard/admin/logs'
      } else if (user.role === 'instructor') {
        window.location.href = '/dashboard/instructor/courses'
      } else {
        window.location.href = '/dashboard/student/courses'
      }
      setRedirected(true)
    }
  }, [user, isLoading])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner message="Loading dashboard..." />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Not Authenticated
            </h2>
            <p className="text-gray-600 mb-6">
              Please log in to access the dashboard
            </p>
            <Link
              href="/auth/login"
              className="inline-block bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              Go to Login
            </Link>
          </div>
        </Card>
      </div>
    )
  }

  if (redirected) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner message="Redirecting..." />
      </div>
    )
  }

  return null
}
