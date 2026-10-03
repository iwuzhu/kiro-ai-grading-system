'use client'

import React, { useEffect, useState } from 'react'
import { LoadingSpinner } from './LoadingSpinner'

interface SubmissionViewerProps {
  submissionId: string
  filePath?: string
  fileType?: string
  assignmentType: string
  isLoading?: boolean
}

export const SubmissionViewer: React.FC<SubmissionViewerProps> = ({
  submissionId,
  filePath,
  fileType,
  assignmentType,
  isLoading = false,
}) => {
  const [content, setContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)

  useEffect(() => {
    if (!submissionId || !filePath) {
      setError('No submission file available')
      return
    }

    // Extract file name from path
    const extractedFileName = filePath.split('/').pop() || 'submission'
    setFileName(extractedFileName)

    const fetchContent = async () => {
      setLoading(true)
      setError(null)

      try {
        const token = localStorage.getItem('accessToken')
        if (!token) {
          throw new Error('Authentication required')
        }

        // For text-based files, fetch and display content
        if (isTextFile(fileType)) {
          const contentResponse = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/v1/submissions/${submissionId}`,
            {
              method: 'GET',
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          )

          if (contentResponse.ok) {
            const submissionData = await contentResponse.json()
            if (submissionData.data?.content) {
              setContent(submissionData.data.content)
            }
          }
        }
      } catch (err) {
        console.error('Error fetching submission:', err)
        setError(err instanceof Error ? err.message : 'Failed to load submission content')
      } finally {
        setLoading(false)
      }
    }

    fetchContent()
  }, [submissionId, filePath])

  const handleDownload = async () => {
    if (!submissionId) return

    setDownloading(true)
    setError(null)

    try {
      const token = localStorage.getItem('accessToken')
      if (!token) {
        throw new Error('Authentication required')
      }

      // Fetch the file from backend
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/v1/submissions/download/${submissionId}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )

      if (!response.ok) {
        throw new Error('Failed to download file')
      }

      // Get the binary data
      const blob = await response.blob()

      // Create a blob URL and trigger download
      const blobUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = fileName || 'submission'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(blobUrl)
    } catch (err) {
      console.error('Error downloading file:', err)
      setError(err instanceof Error ? err.message : 'Failed to download file')
    } finally {
      setDownloading(false)
    }
  }

  const isTextFile = (type?: string): boolean => {
    if (!type) return false
    const textTypes = ['txt', 'md', 'py', 'js', 'ts', 'json', 'html', 'css', 'sql', 'xml']
    return textTypes.includes(type.toLowerCase())
  }

  const getFileIcon = (type?: string): string => {
    if (!type) return '📄'
    const typeMap: Record<string, string> = {
      pdf: '📕',
      doc: '📗',
      docx: '📗',
      txt: '📝',
      md: '📝',
      py: '🐍',
      js: '⚙️',
      ts: '⚙️',
      json: '📋',
      html: '🌐',
      css: '🎨',
      java: '☕',
      cpp: '⚡',
      sql: '🗄️',
      zip: '🗜️',
      rar: '🗜️',
    }
    return typeMap[type.toLowerCase()] || '📄'
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Submission Content</h3>
        <button
          onClick={handleDownload}
          disabled={downloading || !submissionId}
          className={`text-sm px-3 py-1 rounded transition ${
            downloading || !submissionId
              ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
          title={downloading ? 'Downloading...' : 'Download file to your computer'}
        >
          {downloading ? '⬇️ Downloading...' : '⬇️ Download File'}
        </button>
      </div>

      {/* File Info */}
      {filePath && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 flex items-center gap-3">
          <span className="text-2xl">{getFileIcon(fileType)}</span>
          <div>
            <p className="text-sm font-medium text-gray-900">
              {filePath.split('/').pop() || 'submission'}
            </p>
            {fileType && (
              <p className="text-xs text-gray-600">.{fileType}</p>
            )}
          </div>
        </div>
      )}

      {/* Content Display */}
      {loading && isLoading === false ? (
        <LoadingSpinner message="Loading submission content..." />
      ) : error ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800 text-sm">{error}</p>
          <p className="text-yellow-700 text-xs mt-2">
            💡 Click &quot;Download File&quot; to save the submission locally.
          </p>
        </div>
      ) : content ? (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          {/* Code/Text Viewer */}
          <div className="max-h-96 overflow-y-auto bg-gray-50">
            <pre className="p-4 text-sm text-gray-800 whitespace-pre-wrap break-words font-mono">
              {content}
            </pre>
          </div>

          {/* Line counter hint */}
          <div className="bg-gray-100 border-t border-gray-200 px-4 py-2 text-xs text-gray-600">
            {content.split('\n').length} lines of code/text
          </div>
        </div>
      ) : assignmentType === 'ESSAY' || assignmentType === 'SHORT_ANSWER' ? (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <p className="text-gray-700 text-sm">
            The submission content could not be displayed directly. 
          </p>
          <p className="text-gray-600 text-sm mt-2">
            Click &quot;Download File&quot; above to save and view it locally.
          </p>
        </div>
      ) : (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <p className="text-gray-700 text-sm">
            ℹ️ This submission is a {assignmentType.toLowerCase()} file. 
          </p>
          <p className="text-gray-600 text-sm mt-2">
            Click &quot;Download File&quot; above to save and open it in the appropriate application.
          </p>
        </div>
      )}

      {/* Inline Commenting Hint */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <p className="text-blue-800 text-xs">
          💡 <strong>Tip:</strong> Add specific line references or quotes in your Feedback section to provide inline comments on the submission.
        </p>
      </div>
    </div>
  )
}
