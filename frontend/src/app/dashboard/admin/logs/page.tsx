'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { RoleGuard } from '@/components/auth/RoleGuard'
import { Card, LoadingSpinner } from '@/components/common'
import { useAuth } from '@/hooks/useAuth'

interface AuditLog {
  id: string
  eventType: string
  actorUserId?: string
  resourceType?: string
  resourceId?: string
  actionDetails?: Record<string, any>
  ipAddress?: string
  createdAt: string
  actor?: {
    email: string
    role: string
  }
}

interface ApiResponse {
  success: boolean
  data: AuditLog[] | { data: AuditLog[]; total: number; page: number; pages: number }
  error?: any
}

export default function AdminLogsPage() {
  const { user, logout, refresh } = useAuth()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('logs')
  const [loading, setLoading] = useState(true)
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterRole, setFilterRole] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filteredUsers, setFilteredUsers] = useState<any[]>([])
  const [showAddUserModal, setShowAddUserModal] = useState(false)
  const [newUserFormData, setNewUserFormData] = useState({
    name: '',
    email: '',
    role: 'STUDENT',
    password: '',
  })
  const [addUserLoading, setAddUserLoading] = useState(false)

  const handleLogout = async () => {
    await logout()
    router.replace('/auth/login')
  }

  // Fetch audit logs
  useEffect(() => {
    const fetchAuditLogs = async () => {
      try {
        setLoading(true)
        const token = localStorage.getItem('accessToken')
        const tenantId = localStorage.getItem('userTenant')
        
        if (!token) {
          setError('Not authenticated')
          setLoading(false)
          return
        }

        // Fetch audit logs from the backend
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/v1/audit-logs?page=${page}&limit=50`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              ...(tenantId && { 'X-Tenant-ID': tenantId }),
            },
          }
        )

        if (response.ok) {
          const data: ApiResponse = await response.json()
          if (typeof data.data === 'object' && 'data' in data.data) {
            setAuditLogs(data.data.data)
            setTotalPages(data.data.pages)
          } else {
            setAuditLogs(data.data || [])
          }
        } else if (response.status === 404) {
          console.log('Audit logs endpoint not found')
          setAuditLogs([])
        } else {
          throw new Error(`Failed to fetch audit logs: ${response.status}`)
        }
      } catch (err) {
        console.error('Error fetching audit logs:', err)
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }

    if (activeTab === 'logs' && user?.role === 'admin') {
      fetchAuditLogs()
    }
  }, [activeTab, user, page])

  // Fetch users
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoading(true)
        const token = localStorage.getItem('accessToken')
        const tenantId = localStorage.getItem('userTenant')
        
        if (!token || !tenantId) {
          setError('Not authenticated')
          return
        }

        // Get institution ID from tenant ID (they're the same in this case)
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/v1/${tenantId}/users?page=1&limit=100`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        )

        if (response.ok) {
          const data = await response.json()
          if (data.data?.users) {
            setUsers(data.data.users)
          }
        } else if (response.status === 404) {
          console.log('Users endpoint not found')
          setUsers([])
        } else {
          throw new Error(`Failed to fetch users: ${response.status}`)
        }
      } catch (err) {
        console.error('Error fetching users:', err)
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }

    if (activeTab === 'users' && user?.role === 'admin') {
      fetchUsers()
    }
  }, [activeTab, user])

  // Apply filters whenever users, search, or filter values change
  useEffect(() => {
    let results = [...users]

    // Filter by search query (name or email)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      results = results.filter((u: any) =>
        u.name?.toLowerCase().includes(query) ||
        u.email?.toLowerCase().includes(query)
      )
    }

    // Filter by role
    if (filterRole) {
      results = results.filter((u: any) => u.role === filterRole)
    }

    // Filter by status
    if (filterStatus) {
      results = results.filter((u: any) => u.status === filterStatus)
    }

    setFilteredUsers(results)
  }, [users, searchQuery, filterRole, filterStatus])

  const getEventTypeColor = (eventType?: string): string => {
    if (!eventType) return 'bg-gray-100 text-gray-800'
    const type = eventType.toLowerCase()
    if (type.includes('grade')) return 'bg-blue-100 text-blue-800'
    if (type.includes('plagiarism')) return 'bg-red-100 text-red-800'
    if (type.includes('login') || type.includes('logout')) return 'bg-green-100 text-green-800'
    if (type.includes('user')) return 'bg-purple-100 text-purple-800'
    if (type.includes('submission')) return 'bg-indigo-100 text-indigo-800'
    return 'bg-gray-100 text-gray-800'
  }

  const formatEventType = (eventType?: string): string => {
    if (!eventType) return 'Unknown'
    return eventType
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString)
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const handleSuspendActivate = async (userId: string, currentStatus: string) => {
    try {
      setActionLoading(userId)
      let token = localStorage.getItem('accessToken')
      const tenantId = localStorage.getItem('userTenant')

      if (!token || !tenantId) {
        setError('Not authenticated')
        return
      }

      const newStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
      let response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/v1/${tenantId}/users/${userId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status: newStatus }),
        },
      )

      // If token expired (401), refresh and retry
      if (response.status === 401) {
        try {
          await refresh()
          token = localStorage.getItem('accessToken')
          if (!token) {
            setError('Session expired. Please login again.')
            return
          }

          response = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/v1/${tenantId}/users/${userId}`,
            {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ status: newStatus }),
            },
          )
        } catch (refreshError) {
          setError('Session expired. Please login again.')
          await logout()
          return
        }
      }

      if (response.ok) {
        // Update local state
        setUsers(users.map((u: any) => 
          u.id === userId ? { ...u, status: newStatus } : u
        ))
        setError(null)
      } else {
        const errorData = await response.json()
        setError(errorData.error?.message || 'Failed to update user status')
      }
    } catch (err) {
      console.error('Error updating user status:', err)
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setActionLoading(null)
    }
  }

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return
    }

    try {
      setActionLoading(userId)
      let token = localStorage.getItem('accessToken')
      const tenantId = localStorage.getItem('userTenant')

      if (!token || !tenantId) {
        setError('Not authenticated')
        return
      }

      let response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/v1/${tenantId}/users/${userId}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      )

      // If token expired (401), refresh and retry
      if (response.status === 401) {
        try {
          await refresh()
          token = localStorage.getItem('accessToken')
          if (!token) {
            setError('Session expired. Please login again.')
            return
          }

          response = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/v1/${tenantId}/users/${userId}`,
            {
              method: 'DELETE',
              headers: {
                Authorization: `Bearer ${token}`,
              },
            },
          )
        } catch (refreshError) {
          setError('Session expired. Please login again.')
          await logout()
          return
        }
      }

      if (response.ok) {
        // Remove from local state
        setUsers(users.filter((u: any) => u.id !== userId))
        setError(null)
      } else {
        const errorData = await response.json()
        setError(errorData.error?.message || 'Failed to delete user')
      }
    } catch (err) {
      console.error('Error deleting user:', err)
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setActionLoading(null)
    }
  }

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate form
    if (!newUserFormData.name.trim()) {
      setError('Name is required')
      return
    }
    if (!newUserFormData.email.trim()) {
      setError('Email is required')
      return
    }
    if (!newUserFormData.password.trim()) {
      setError('Password is required')
      return
    }

    try {
      setAddUserLoading(true)
      let token = localStorage.getItem('accessToken')
      const tenantId = localStorage.getItem('userTenant')

      if (!token || !tenantId) {
        setError('Not authenticated')
        return
      }

      let response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/v1/${tenantId}/users`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: newUserFormData.name,
            email: newUserFormData.email,
            role: newUserFormData.role,
            password: newUserFormData.password,
          }),
        },
      )

      // If token expired (401), refresh and retry
      if (response.status === 401) {
        console.log('Token expired, attempting refresh...')
        try {
          await refresh()
          token = localStorage.getItem('accessToken')
          
          if (!token) {
            setError('Session expired. Please login again.')
            return
          }

          // Retry the request with new token
          response = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/v1/${tenantId}/users`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                name: newUserFormData.name,
                email: newUserFormData.email,
                role: newUserFormData.role,
                password: newUserFormData.password,
              }),
            },
          )
        } catch (refreshError) {
          console.error('Token refresh failed:', refreshError)
          setError('Session expired. Please login again.')
          await logout()
          return
        }
      }

      if (response.ok) {
        const data = await response.json()
        // Add new user to the list
        setUsers([data.data, ...users])
        // Reset form and close modal
        setNewUserFormData({
          name: '',
          email: '',
          role: 'STUDENT',
          password: '',
        })
        setShowAddUserModal(false)
        setError(null)
      } else {
        const errorData = await response.json()
        setError(errorData.error?.message || 'Failed to create user')
      }
    } catch (err) {
      console.error('Error creating user:', err)
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setAddUserLoading(false)
    }
  }

  return (
    <RoleGuard roles={['admin']}>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 p-6">
          <div className="max-w-7xl mx-auto">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
                <p className="text-gray-600 mt-2">Welcome, {user?.email}</p>
              </div>
              <button
                onClick={handleLogout}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 font-medium transition"
              >
                Logout
              </button>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex gap-8">
              <button
                onClick={() => setActiveTab('logs')}
                className={`py-4 px-2 border-b-2 font-medium text-sm transition ${
                  activeTab === 'logs'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                Activity Logs
              </button>
              <button
                onClick={() => setActiveTab('users')}
                className={`py-4 px-2 border-b-2 font-medium text-sm transition ${
                  activeTab === 'users'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                Users
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={`py-4 px-2 border-b-2 font-medium text-sm transition ${
                  activeTab === 'settings'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                Settings
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-7xl mx-auto px-6 py-8">
          {error && (
            <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-6">
              {error}
            </div>
          )}

          {/* Activity Logs Tab */}
          {activeTab === 'logs' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Activity Logs</h2>
                <p className="text-gray-600">Track all system activities and changes</p>
              </div>

              {loading ? (
                <Card>
                  <LoadingSpinner message="Loading activity logs..." />
                </Card>
              ) : auditLogs.length === 0 ? (
                <Card>
                  <p className="text-gray-600 text-center py-12">No audit logs found</p>
                </Card>
              ) : (
                <>
                  <Card>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <h3 className="text-lg font-semibold">Recent Activities</h3>
                        <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                          Export
                        </button>
                      </div>

                      {/* Activity logs table */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-200">
                              <th className="text-left py-3 px-4 font-semibold text-gray-700">Time</th>
                              <th className="text-left py-3 px-4 font-semibold text-gray-700">Event</th>
                              <th className="text-left py-3 px-4 font-semibold text-gray-700">Actor</th>
                              <th className="text-left py-3 px-4 font-semibold text-gray-700">Resource</th>
                              <th className="text-left py-3 px-4 font-semibold text-gray-700">Details</th>
                            </tr>
                          </thead>
                          <tbody>
                            {auditLogs.map((log: AuditLog) => (
                              <tr key={log.id} className="border-b border-gray-100 hover:bg-gray-50">
                                <td className="py-3 px-4 text-gray-600">
                                  <span className="text-xs">{formatDate(log.createdAt)}</span>
                                </td>
                                <td className="py-3 px-4">
                                  <span className={`px-2 py-1 rounded text-xs font-medium ${getEventTypeColor(log.eventType)}`}>
                                    {formatEventType(log.eventType)}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-gray-700">
                                  {log.actor ? (
                                    <div className="text-xs">
                                      <p className="font-medium">{log.actor.email}</p>
                                      <p className="text-gray-500">{log.actor.role}</p>
                                    </div>
                                  ) : (
                                    <span className="text-xs text-gray-500">System</span>
                                  )}
                                </td>
                                <td className="py-3 px-4 text-gray-700">
                                  <span className="text-xs">
                                    {log.resourceType ? `${log.resourceType}: ${log.resourceId?.substring(0, 8)}...` : '—'}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-gray-600">
                                  {log.actionDetails && (
                                    <button 
                                      className="text-blue-600 hover:text-blue-700 text-xs font-medium"
                                      onClick={() => {
                                        setSelectedLog(log)
                                        setShowDetailsModal(true)
                                      }}
                                    >
                                      View →
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Pagination */}
                      {totalPages > 1 && (
                        <div className="flex justify-center gap-2 pt-4">
                          <button
                            onClick={() => setPage(Math.max(1, page - 1))}
                            disabled={page === 1}
                            className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
                          >
                            Previous
                          </button>
                          <span className="px-3 py-1 text-sm text-gray-600">
                            Page {page} of {totalPages}
                          </span>
                          <button
                            onClick={() => setPage(Math.min(totalPages, page + 1))}
                            disabled={page === totalPages}
                            className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
                          >
                            Next
                          </button>
                        </div>
                      )}
                    </div>
                  </Card>
                </>
              )}

              {/* Details Modal */}
              {showDetailsModal && selectedLog && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
                  <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                    <div className="space-y-6">
                      {/* Header */}
                      <div className="flex justify-between items-start border-b pb-4">
                        <div>
                          <h2 className="text-2xl font-bold text-gray-900">Event Details</h2>
                          <p className="text-sm text-gray-600 mt-1">
                            {formatEventType(selectedLog.eventType)}
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            setShowDetailsModal(false)
                            setSelectedLog(null)
                          }}
                          className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
                        >
                          ×
                        </button>
                      </div>

                      {/* Event Information */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Event Type
                          </label>
                          <p className="text-gray-900">{formatEventType(selectedLog.eventType)}</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Timestamp
                          </label>
                          <p className="text-gray-900">{formatDate(selectedLog.createdAt)}</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Actor
                          </label>
                          <p className="text-gray-900">
                            {selectedLog.actor?.email || selectedLog.actorUserId || 'System'}
                          </p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Resource
                          </label>
                          <p className="text-gray-900">
                            {selectedLog.resourceType ? `${selectedLog.resourceType}: ${selectedLog.resourceId}` : '—'}
                          </p>
                        </div>
                        {selectedLog.ipAddress && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              IP Address
                            </label>
                            <p className="text-gray-900 font-mono text-xs">{selectedLog.ipAddress}</p>
                          </div>
                        )}
                      </div>

                      {/* Action Details */}
                      {selectedLog.actionDetails && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Action Details
                          </label>
                          <div className="bg-gray-50 rounded-lg p-4 font-mono text-xs text-gray-700 overflow-x-auto max-h-48 overflow-y-auto border border-gray-200">
                            <pre>{JSON.stringify(selectedLog.actionDetails, null, 2)}</pre>
                          </div>
                        </div>
                      )}

                      {/* Close Button */}
                      <div className="flex justify-end gap-2 border-t pt-4">
                        <button
                          onClick={() => {
                            setShowDetailsModal(false)
                            setSelectedLog(null)
                          }}
                          className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-medium"
                        >
                          Close
                        </button>
                        <button
                          onClick={() => {
                            const json = JSON.stringify(selectedLog, null, 2)
                            const blob = new Blob([json], { type: 'application/json' })
                            const url = URL.createObjectURL(blob)
                            const a = document.createElement('a')
                            a.href = url
                            a.download = `audit-log-${selectedLog.id}.json`
                            a.click()
                            URL.revokeObjectURL(url)
                          }}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                        >
                          Export
                        </button>
                      </div>
                    </div>
                  </Card>
                </div>
              )}
            </div>
          )}

          {/* Users Tab */}
          {activeTab === 'users' && (
            <div className="space-y-6">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">User Management</h2>
                  <p className="text-gray-600 mt-2">Manage institution users and permissions</p>
                </div>
                <button 
                  onClick={() => {
                    console.log('Add User button clicked, opening modal')
                    setShowAddUserModal(true)
                  }}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium"
                >
                  Add User
                </button>
              </div>

              {/* Search and Filters */}
              <Card>
                <div className="space-y-4">
                  <input
                    type="text"
                    placeholder="Search by name or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="flex gap-4">
                    <select 
                      value={filterRole}
                      onChange={(e) => setFilterRole(e.target.value)}
                      className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">All Roles</option>
                      <option value="ADMIN">ADMIN</option>
                      <option value="INSTRUCTOR">INSTRUCTOR</option>
                      <option value="STUDENT">STUDENT</option>
                    </select>
                    <select 
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">All Status</option>
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="INACTIVE">INACTIVE</option>
                      <option value="INVITED">INVITED</option>
                    </select>
                  </div>
                </div>
              </Card>

              {loading ? (
                <Card>
                  <LoadingSpinner message="Loading users..." />
                </Card>
              ) : filteredUsers.length === 0 ? (
                <Card>
                  <p className="text-gray-600 text-center py-12">
                    {users.length === 0 ? 'No users found' : 'No users match your search criteria'}
                  </p>
                </Card>
              ) : (
                <Card>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-3 px-4 font-semibold text-gray-700">Name</th>
                          <th className="text-left py-3 px-4 font-semibold text-gray-700">Email</th>
                          <th className="text-left py-3 px-4 font-semibold text-gray-700">Role</th>
                          <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                          <th className="text-left py-3 px-4 font-semibold text-gray-700">Joined</th>
                          <th className="text-left py-3 px-4 font-semibold text-gray-700">Last Login</th>
                          <th className="text-left py-3 px-4 font-semibold text-gray-700">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredUsers.map((u: any) => (
                          <tr key={u.id} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="py-3 px-4 text-gray-900 font-medium">{u.name}</td>
                            <td className="py-3 px-4 text-gray-600 text-xs">{u.email}</td>
                            <td className="py-3 px-4">
                              <span className="px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-800">
                                {u.role}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                u.status === 'ACTIVE'
                                  ? 'bg-green-100 text-green-800'
                                  : u.status === 'INACTIVE'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-yellow-100 text-yellow-800'
                              }`}>
                                {u.status}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-gray-600 text-xs">
                              {u.created_at ? new Date(u.created_at).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit'
                              }) : '—'}
                            </td>
                            <td className="py-3 px-4 text-gray-600 text-xs">
                              {u.last_login ? new Date(u.last_login).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit'
                              }) : 'Never'}
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex gap-2">
                                <button 
                                  disabled={actionLoading === u.id}
                                  onClick={() => handleSuspendActivate(u.id, u.status)}
                                  className="text-blue-600 hover:text-blue-700 text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {actionLoading === u.id ? 'Processing...' : (u.status === 'ACTIVE' ? 'Suspend' : 'Activate')}
                                </button>
                                <button 
                                  disabled={actionLoading === u.id}
                                  onClick={() => handleDeleteUser(u.id)}
                                  className="text-red-600 hover:text-red-700 text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {actionLoading === u.id ? 'Deleting...' : 'Delete'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}

              {/* Add User Modal */}
              {showAddUserModal && (
                <>
                  {console.log('Rendering Add User Modal, showAddUserModal =', showAddUserModal)}
                  <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
                  <Card className="w-full max-w-md">
                    <form onSubmit={handleAddUser} className="space-y-4">
                      {/* Header */}
                      <div className="flex justify-between items-center border-b pb-4">
                        <h3 className="text-xl font-bold text-gray-900">Add New User</h3>
                        <button
                          type="button"
                          onClick={() => setShowAddUserModal(false)}
                          className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
                        >
                          ×
                        </button>
                      </div>

                      {/* Form Fields */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={newUserFormData.name}
                          onChange={(e) =>
                            setNewUserFormData({ ...newUserFormData, name: e.target.value })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="John Doe"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Email *
                        </label>
                        <input
                          type="email"
                          required
                          value={newUserFormData.email}
                          onChange={(e) =>
                            setNewUserFormData({ ...newUserFormData, email: e.target.value })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="john@example.com"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Role *
                        </label>
                        <select
                          required
                          value={newUserFormData.role}
                          onChange={(e) =>
                            setNewUserFormData({ ...newUserFormData, role: e.target.value })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="STUDENT">Student</option>
                          <option value="INSTRUCTOR">Instructor</option>
                          <option value="ADMIN">Admin</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Password *
                        </label>
                        <input
                          type="password"
                          required
                          value={newUserFormData.password}
                          onChange={(e) =>
                            setNewUserFormData({ ...newUserFormData, password: e.target.value })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="••••••••"
                        />
                      </div>

                      {/* Actions */}
                      <div className="flex justify-end gap-2 border-t pt-4 mt-6">
                        <button
                          type="button"
                          onClick={() => setShowAddUserModal(false)}
                          className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-medium"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={addUserLoading}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {addUserLoading ? 'Creating...' : 'Create User'}
                        </button>
                      </div>
                    </form>
                  </Card>
                </div>
                </>
              )}
            </div>
          )}

          {/* Settings Tab */}
          {activeTab === 'settings' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Institution Settings</h2>
                <p className="text-gray-600 mt-2">Configure your institution&apos;s policies and features</p>
              </div>

              <div className="space-y-4">
                <Card>
                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg">Plagiarism Detection</h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-gray-700">Enable plagiarism checks</label>
                        <input type="checkbox" defaultChecked className="w-4 h-4" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Plagiarism Threshold (%)</label>
                        <input
                          type="number"
                          defaultValue={20}
                          min={0}
                          max={100}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                        />
                      </div>
                    </div>
                  </div>
                </Card>

                <Card>
                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg">AI Grading</h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-gray-700">Enable AI grading</label>
                        <input type="checkbox" defaultChecked className="w-4 h-4" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">AI Provider</label>
                        <select className="w-full px-4 py-2 border border-gray-300 rounded-lg">
                          <option>OpenAI (GPT-4)</option>
                          <option>Claude (Anthropic)</option>
                          <option>AWS Bedrock</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </Card>

                <div className="flex gap-3">
                  <button className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 font-medium">
                    Save Changes
                  </button>
                  <button className="border border-gray-300 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-50 font-medium">
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </RoleGuard>
  )
}
