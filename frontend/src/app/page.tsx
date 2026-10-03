'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth, getRoleBasedPath } from '@/hooks/useAuth'
import { LoadingSpinner } from '@/components/common'
import Link from 'next/link'

export default function HomePage() {
  const router = useRouter()
  const { isLoading, isAuthenticated, user } = useAuth()

  useEffect(() => {
    // Redirect authenticated users to their role-specific dashboard (content page)
    if (!isLoading && isAuthenticated && user && user.role) {
      console.log(`[HomePage] User authenticated: ${user.email} (${user.role})`)
      
      const dashboardPath = getRoleBasedPath(user.role)
      console.log(`[HomePage] Redirecting to ${dashboardPath}`)
      router.replace(dashboardPath)
    }
  }, [isAuthenticated, isLoading, user, router])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner message="Loading..." />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            AI Grading System
          </h1>
          <p className="text-xl text-gray-600">
            Intelligent automated grading and plagiarism detection for educators
          </p>
        </div>

        {/* Auth Section */}
        <div className="flex justify-center gap-4">
          <Link
            href="/auth/login"
            className="bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
          >
            Login
          </Link>
          <Link
            href="/auth/signup"
            className="bg-gray-200 text-gray-900 px-8 py-3 rounded-lg font-semibold hover:bg-gray-300 transition"
          >
            Sign Up
          </Link>
        </div>

        {/* Features Section */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Automated Grading
            </h3>
            <p className="text-gray-600">
              AI-powered grading aligned with your rubrics
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Plagiarism Detection
            </h3>
            <p className="text-gray-600">
              Comprehensive plagiarism and AI content detection
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Detailed Feedback
            </h3>
            <p className="text-gray-600">
              Constructive, personalized feedback for each submission
            </p>
          </div>
        </div>

        {/* Status */}
        <div className="mt-12 text-center">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 inline-block">
            <p className="text-sm text-blue-900">
              ✓ Frontend is running at <code className="bg-blue-100 px-2 py-1 rounded">localhost:3000</code>
            </p>
            <p className="text-sm text-blue-900 mt-2">
              Backend API at <code className="bg-blue-100 px-2 py-1 rounded">localhost:3001/api</code>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
