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
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!submissionId || !filePath) {
      setError('No submission file available')
      return
    }

    const fetchContent = async () => {
      setLoading(true)
      setError(null)

      try {
        const token = localStorage.getItem('accessToken')
        if (!token) {
          throw new Error('Authentication required')
        }

        // Get signed download URL
        const downloadResponse = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/v1/submissions/download/${submissionId}`,
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        )

        if (!downloadResponse.ok) {
          throw new Error('Failed to get download URL')
        }

        const downloadData = await downloadResponse.json()
        if (downloadData.data?.download_url) {
          setDownloadUrl(downloadData.data.download_url)

          // For text-based files, fetch and display content
          if (isTextFile(fileType)) {
            const contentResponse = await fetch(downloadData.data.download_url)
            if (contentResponse.ok) {
              const contentText = await contentResponse.text()
              setContent(contentText)
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
        {downloadUrl && (
          <a
            href={downloadUrl}
            download
            className="text-sm px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Download File
          </a>
        )}
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
          {downloadUrl && (
            <p className="text-yellow-700 text-xs mt-2">
              📥 Download the file directly to view it: <a href={downloadUrl} className="underline">Download</a>
            </p>
          )}
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
          {downloadUrl && (
            <p className="text-gray-600 text-sm mt-2">
              Please <a href={downloadUrl} className="text-blue-600 hover:underline">download the file</a> to view it.
            </p>
          )}
        </div>
      ) : (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <p className="text-gray-700 text-sm">
            ℹ️ This submission is a {assignmentType.toLowerCase()} file. 
          </p>
          {downloadUrl && (
            <p className="text-gray-600 text-sm mt-2">
              <a href={downloadUrl} className="text-blue-600 hover:underline">Download</a> to view or open it in the appropriate application.
            </p>
          )}
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
