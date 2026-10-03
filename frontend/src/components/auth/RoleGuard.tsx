import React from 'react'
import { useAuth } from '@/hooks/useAuth'
import { LoadingSpinner } from '@/components/common'

interface RoleGuardProps {
  children: React.ReactNode
  roles: string[]
  fallback?: React.ReactNode
}

export const RoleGuard: React.FC<RoleGuardProps> = ({ 
  children, 
  roles, 
  fallback 
}) => {
  const { user, isLoading } = useAuth()

  // Show loading state while checking authentication
  if (isLoading) {
    return <LoadingSpinner message="Verifying authentication..." />
  }

  if (!user) {
    return <>{fallback || <div className="p-4 text-red-600">Not authenticated</div>}</>
  }

  if (!roles.includes(user.role)) {
    return (
      <>
        {fallback || (
          <div className="p-4 text-red-600">
            You do not have permission to access this resource
          </div>
        )}
      </>
    )
  }

  return <>{children}</>
}
