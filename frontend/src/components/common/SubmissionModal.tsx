'use client'

import React, { useState } from 'react'
import { Modal } from './Modal'

export interface SubmissionModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: SubmissionData) => Promise<void>
  assignmentType: 'ESSAY' | 'CODE' | 'QUIZ' | 'SHORT_ANSWER' | 'FILE'
  assignmentTitle: string
  isLoading?: boolean
  error?: string | null
}

export interface SubmissionData {
  content?: string
  filePath?: string
  fileType?: string
  fileName?: string
}

export const SubmissionModal: React.FC<SubmissionModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  assignmentType,
  assignmentTitle,
  isLoading = false,
  error = null,
}) => {
  const [content, setContent] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)
  const [fileContent, setFileContent] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const isTextBased = ['ESSAY', 'SHORT_ANSWER', 'QUIZ'].includes(assignmentType)
  const isFileBased = ['FILE', 'CODE'].includes(assignmentType)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file size (max 50MB)
    if (file.size > 50 * 1024 * 1024) {
      setSubmitError('File size must be less than 50MB')
      return
    }

    setFileName(file.name)
    setSubmitError(null)

    // For now, just store filename and size
    // In production, would upload to S3 and get signed URL
    const reader = new FileReader()
    reader.onload = (event) => {
      const base64Content = event.target?.result as string
      setFileContent(base64Content)
    }
    reader.readAsDataURL(file)
  }

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value)
    setSubmitError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError(null)
    setSubmitting(true)

    try {
      // Validate input
      if (isTextBased && !content.trim()) {
        throw new Error('Please enter your submission text')
      }

      if (isFileBased && !fileName) {
        throw new Error('Please select a file to submit')
      }

      // Prepare submission data
      const submissionData: SubmissionData = isTextBased
        ? { content: content.trim() }
        : {
            fileName: fileName || undefined,
            fileType: fileName?.split('.').pop() || 'txt',
            filePath: fileContent || undefined,
          }

      // Call parent submit handler
      await onSubmit(submissionData)

      // Reset form on success
      setContent('')
      setFileName(null)
      setFileContent(null)
      onClose()
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Submission failed')
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    if (!submitting) {
      setContent('')
      setFileName(null)
      setFileContent(null)
      setSubmitError(null)
      onClose()
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={`Submit: ${assignmentTitle}`}
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Assignment Type Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-900">
            <span className="font-semibold">Assignment Type:</span> {getAssignmentTypeLabel(assignmentType)}
          </p>
        </div>

        {/* Text-based submission */}
        {isTextBased && (
          <div className="space-y-3">
            <label className="block">
              <span className="block text-sm font-semibold text-gray-700 mb-2">
                Your Submission
              </span>
              <textarea
                value={content}
                onChange={handleTextChange}
                placeholder="Enter your submission text here..."
                rows={10}
                disabled={submitting || isLoading}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
              <p className="text-xs text-gray-600 mt-1">
                Character count: {content.length}
              </p>
            </label>
          </div>
        )}

        {/* File-based submission */}
        {isFileBased && (
          <div className="space-y-3">
            <label className="block">
              <span className="block text-sm font-semibold text-gray-700 mb-2">
                Upload File
              </span>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-blue-500 transition cursor-pointer">
                <input
                  type="file"
                  onChange={handleFileChange}
                  disabled={submitting || isLoading}
                  className="hidden"
                  id="file-input"
                />
                <label htmlFor="file-input" className="cursor-pointer block text-center">
                  {fileName ? (
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-green-600">✓ File selected</p>
                      <p className="text-xs text-gray-600">{fileName}</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-gray-700">
                        Click to upload or drag and drop
                      </p>
                      <p className="text-xs text-gray-600">
                        Supported formats: pdf, docx, txt, py, js, java, cpp, etc.
                      </p>
                      <p className="text-xs text-gray-600">Max file size: 50MB</p>
                    </div>
                  )}
                </label>
              </div>
            </label>
          </div>
        )}

        {/* Error Messages */}
        {(submitError || error) && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-700">
              <span className="font-semibold">Error:</span> {submitError || error}
            </p>
          </div>
        )}

        {/* Info Box */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <p className="text-xs text-gray-700 space-y-1">
            <span className="block font-semibold mb-2">📋 Before you submit:</span>
            <span className="block">• Make sure your submission is complete and ready</span>
            <span className="block">• You can resubmit if incremental submissions are allowed</span>
            <span className="block">• Late submissions may incur a penalty</span>
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={handleClose}
            disabled={submitting || isLoading}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || isLoading}
            className="px-4 py-2 text-white bg-green-600 rounded-lg hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {submitting || isLoading ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                Submitting...
              </>
            ) : (
              'Submit Assignment'
            )}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function getAssignmentTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    ESSAY: 'Essay',
    CODE: 'Code',
    QUIZ: 'Quiz',
    SHORT_ANSWER: 'Short Answer',
    FILE: 'File Upload',
  }
  return labels[type] || type
}
