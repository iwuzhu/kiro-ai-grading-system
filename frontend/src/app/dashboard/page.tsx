'use client'

import React, { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth, getRoleBasedPath } from '@/hooks/useAuth'
import { LoadingSpinner, Card } from '@/components/common'
import Link from 'next/link'

export default function DashboardPage() {
  const router = useRouter()
  const { user, isLoading } = useAuth()

  useEffect(() => {
    // Only redirect if we've finished loading AND user exists AND has valid role
    if (!isLoading && user && user.role) {
      console.log(`[Dashboard] User loaded: ${user.email}, role: ${user.role}`)
      
      const contentPath = getRoleBasedPath(user.role)
      console.log(`[Dashboard] Redirecting to: ${contentPath}`)
      
      router.replace(contentPath)
    } else {
      console.log(`[Dashboard] Loading state: isLoading=${isLoading}, user=${!!user}, role=${user?.role}`)
    }
  }, [user, isLoading, router])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner message="Loading..." />
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

  // If we get here with user but still loading redirect, show loading
  return (
    <div className="flex items-center justify-center min-h-screen">
      <LoadingSpinner message="Redirecting to your dashboard..." />
    </div>
  )
}
