'use client'

import React, { useEffect, useState } from 'react'
import { LoadingSpinner } from './LoadingSpinner'
import { QuestionList } from '@/components/assignments/QuestionList'
import { QuestionGroup } from '@/components/assignments/QuestionCreationDialog'

interface SubmissionViewerProps {
  submissionId: string
  assignmentId?: string
  filePath?: string
  fileType?: string
  assignmentType: string
  tenantId?: string
  isLoading?: boolean
  onAIGradeClick?: (submissionId: string) => void
  aiGradeLoading?: boolean
}

interface Rubric {
  id: string
  name: string
  criteria: any
}

export const SubmissionViewer: React.FC<SubmissionViewerProps> = ({
  submissionId,
  assignmentId: _assignmentId,
  filePath,
  assignmentType: _assignmentType,
  tenantId: _tenantId,
  isLoading = false,
  onAIGradeClick,
  aiGradeLoading = false,
}) => {
  const [fileContent, setFileContent] = useState<string | null>(null)
  const [fileBlobUrl, setFileBlobUrl] = useState<string | null>(null)
  const [fileLoading, setFileLoading] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [assignment, setAssignment] = useState<any>(null)
  const [rubric, setRubric] = useState<Rubric | null>(null)
  const [dataLoading, setDataLoading] = useState(false)

  // Extract filename from path
  useEffect(() => {
    if (filePath) {
      const name = filePath.split('/').pop() || 'submission'
      setFileName(name)
    }
  }, [filePath])

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      if (fileBlobUrl) {
        URL.revokeObjectURL(fileBlobUrl)
        console.log('[SubmissionViewer] Blob URL revoked on unmount')
      }
    }
  }, [])

  // Fetch assignment, rubric, and file content
  useEffect(() => {
    if (!submissionId || !_assignmentId) return
    fetchAssignmentAndRubric()
    fetchFileContent()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submissionId, _assignmentId])

  const getFileExtension = (filename: string): string => {
    return filename?.split('.')?.pop()?.toLowerCase() || ''
  }

  const isTextFileExtension = (filename: string): boolean => {
    const textExtensions = ['txt', 'md', 'json', 'xml', 'csv', 'js', 'ts', 'py', 'java', 'cpp', 'c', 'h', 'html', 'css', 'sql', 'sh', 'yaml', 'yml']
    const ext = getFileExtension(filename)
    return textExtensions.includes(ext)
  }

  const fetchAssignmentAndRubric = async () => {
    if (!_assignmentId) return

    setDataLoading(true)

    try {
      const token = localStorage.getItem('accessToken')
      if (!token) throw new Error('Authentication required')

      // Fetch assignment with content field
      const assignmentResponse = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/v1/courses/assignments/${_assignmentId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      )

      if (assignmentResponse.ok) {
        const assignmentData = await assignmentResponse.json()
        const assignmentObj = assignmentData.data
        setAssignment(assignmentObj)
        console.log('[SubmissionViewer] Assignment loaded:', assignmentObj.title)
        console.log('[SubmissionViewer] Assignment content:', assignmentObj.content)

        // Extract rubricId from content
        if (assignmentObj.content && assignmentObj.content.rubricId) {
          const rubricId = assignmentObj.content.rubricId
          console.log('[SubmissionViewer] Fetching rubric with ID:', rubricId)

          // Fetch all rubrics and filter by ID
          const rubricResponse = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/v1/courses/rubrics`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
                'X-Tenant-ID': _tenantId || '',
              },
            }
          )

          if (rubricResponse.ok) {
            const rubricData = await rubricResponse.json()
            const allRubrics = rubricData.data
            console.log('[SubmissionViewer] All rubrics:', allRubrics)

            // Find rubric with matching ID
            const foundRubric = allRubrics.find((r: any) => r.id === rubricId)
            if (foundRubric) {
              setRubric(foundRubric)
              console.log('[SubmissionViewer] Rubric found and set:', foundRubric.name)
            } else {
              console.warn('[SubmissionViewer] Rubric with ID', rubricId, 'not found in response')
            }
          } else {
            console.warn('[SubmissionViewer] Failed to fetch rubrics:', rubricResponse.status)
          }
        } else {
          console.log('[SubmissionViewer] No rubricId in assignment content')
        }
      } else {
        console.warn('[SubmissionViewer] Failed to fetch assignment:', assignmentResponse.status)
      }
    } catch (err) {
      console.error('[SubmissionViewer] Error fetching assignment/rubric:', err)
    } finally {
      setDataLoading(false)
    }
  }

  const fetchFileContent = async () => {
    if (!submissionId) return

    setFileLoading(true)

    try {
      const token = localStorage.getItem('accessToken')
      if (!token) throw new Error('Authentication required')

      // First, fetch as blob
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/v1/submissions/view/${submissionId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      )

      if (!response.ok) {
        console.error('[SubmissionViewer] Failed to fetch file:', response.status, response.statusText)
        throw new Error(`Failed to load file: ${response.statusText}`)
      }

      const blob = await response.blob()
      console.log('[SubmissionViewer] Blob received, size:', blob.size, 'type:', blob.type)
      
      if (blob.size === 0) {
        console.error('[SubmissionViewer] Received empty blob')
        throw new Error('File is empty')
      }

      // Determine if this is a text file
      const shouldReadAsText = isTextFileExtension(fileName || '') && blob.type.startsWith('text/')

      if (shouldReadAsText) {
        try {
          const text = await blob.text()
          console.log('[SubmissionViewer] Read as text, length:', text.length)
          setFileContent(text)
          setFileBlobUrl(null)
        } catch (textError) {
          console.log('[SubmissionViewer] Could not read as text, creating blob URL instead')
          const blobUrl = URL.createObjectURL(blob)
          setFileBlobUrl(blobUrl)
          setFileContent(null)
        }
      } else {
        // For binary files or when not text file extension
        const blobUrl = URL.createObjectURL(blob)
        console.log('[SubmissionViewer] Blob URL created:', blobUrl, 'for extension:', getFileExtension(fileName || ''))
        setFileBlobUrl(blobUrl)
        setFileContent(null)
      }
    } catch (err) {
      console.error('[SubmissionViewer] File content fetch error:', err)
      setFileContent(null)
      setFileBlobUrl(null)
    } finally {
      setFileLoading(false)
    }
  }

  const handleDownload = async () => {
    if (!submissionId) return

    setDownloading(true)

    try {
      const token = localStorage.getItem('accessToken')
      if (!token) throw new Error('Authentication required')

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/v1/submissions/download/${submissionId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      )

      if (!response.ok) throw new Error('Failed to download file')

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = fileName || 'submission'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error('[SubmissionViewer] Download error:', err)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header with buttons */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Submission Content</h3>
        <div className="flex gap-2">
          {onAIGradeClick && (
            <button
              onClick={() => onAIGradeClick(submissionId)}
              disabled={aiGradeLoading || !submissionId}
              className={`text-sm px-3 py-1 rounded transition ${
                aiGradeLoading || !submissionId
                  ? 'bg-purple-400 text-white cursor-not-allowed'
                  : 'bg-purple-600 text-white hover:bg-purple-700'
              }`}
            >
              {aiGradeLoading ? '⚙️ Grading...' : '🤖 AI Grade'}
            </button>
          )}
          {filePath && (
            <button
              onClick={handleDownload}
              disabled={downloading || !submissionId}
              className={`text-sm px-3 py-1 rounded transition ${
                downloading || !submissionId
                  ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {downloading ? '⬇️ Downloading...' : '⬇️ Download'}
            </button>
          )}
        </div>
      </div>

      {/* Submission Content Box */}
      {isLoading || fileLoading || dataLoading ? (
        <LoadingSpinner message="Loading submission and assignment..." />
      ) : (
        <div className="space-y-4">
          {/* 1. Grading Rubric */}
          {rubric && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm font-semibold text-green-900 mb-3">
                📋 Grading Rubric: {rubric.name}
              </p>
              {rubric.criteria && (
                <div>
                  {typeof rubric.criteria === 'string' ? (
                    <p className="text-sm text-gray-700">{rubric.criteria}</p>
                  ) : Array.isArray(rubric.criteria) ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="bg-green-100">
                            <th className="border border-green-300 px-2 py-1 text-left font-semibold">
                              Criterion
                            </th>
                            <th className="border border-green-300 px-2 py-1 text-left font-semibold">
                              Description
                            </th>
                            <th className="border border-green-300 px-2 py-1 text-center font-semibold w-16">
                              Points
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {rubric.criteria.map((criterion: any, idx: number) => (
                            <tr key={idx} className="hover:bg-green-100">
                              <td className="border border-green-200 px-2 py-1 font-medium">
                                {criterion.name || criterion.title || `Criterion ${idx + 1}`}
                              </td>
                              <td className="border border-green-200 px-2 py-1">
                                {criterion.description || criterion.details || '-'}
                              </td>
                              <td className="border border-green-200 px-2 py-1 text-center">
                                {criterion.points || criterion.weight || '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          )}

          {/* 2. Assignment Content - EXACT COPY from Edit Assignment page */}
          {assignment && (
            <div>
              {(() => {
                // Use same data processing logic as Edit Assignment page
                const groups: QuestionGroup[] = []
                
                if (assignment.content && typeof assignment.content === 'object') {
                  // Handle NEW format: { questions: [...] }
                  if (Array.isArray(assignment.content.questions)) {
                    const questions = assignment.content.questions
                    
                    // Group questions by type
                    const questionsByType: Record<string, any[]> = {}
                    questions.forEach((q: any) => {
                      const type = q.type || 'UNKNOWN'
                      if (!questionsByType[type]) {
                        questionsByType[type] = []
                      }
                      questionsByType[type].push(q)
                    })
                    
                    // Create groups from grouped questions
                    Object.entries(questionsByType).forEach(([type, qs]) => {
                      const group: QuestionGroup = {
                        type: type as any,
                        rubricId: assignment.content.rubricId,
                        questions: qs.map((q: any) => ({
                          prompt: q.prompt,
                          result: q.expectedAnswer || q.answer || q.result || '',
                          pointValue: q.pointValue || 0,
                        })),
                      }
                      groups.push(group)
                    })
                  } else if (typeof assignment.content === 'object' && !Array.isArray(assignment.content)) {
                    // Handle OLD format: { "Essay": { "RubricId": "...", "Question 1": {...} } }
                    const typeMapping: Record<string, string> = {
                      'Multiple Choice': 'MULTIPLE_CHOICE',
                      'Short Answer': 'SHORT_ANSWER',
                      'Fill in the Blank': 'FILL_BLANK',
                      'Essay': 'ESSAY',
                      'Code': 'CODE',
                      'File Upload': 'FILE_UPLOAD',
                      'Math': 'MATH',
                      'Programming': 'PROGRAMMING',
                    }

                    Object.entries(assignment.content).forEach(([typeLabel, questionsData]: [string, any]) => {
                      const type = typeMapping[typeLabel] || typeLabel
                      const questions: any[] = []
                      let rubricId: string | undefined
                      let rubricNote: string | undefined

                      if (questionsData && typeof questionsData === 'object') {
                        Object.entries(questionsData).forEach(([key, value]: [string, any]) => {
                          if (key === 'RubricId') {
                            rubricId = value
                          } else if (key === 'RubricNote') {
                            rubricNote = value
                          } else if (key.startsWith('Question ')) {
                            if (value && typeof value === 'object') {
                              const promptKey = Object.keys(value)[0]
                              const questionData = value[promptKey]
                              if (promptKey && questionData) {
                                questions.push({
                                  prompt: promptKey,
                                  result: questionData.Result || '',
                                  pointValue: questionData.Points || 0,
                                })
                              }
                            }
                          }
                        })
                      }

                      if (questions.length > 0) {
                        const group: QuestionGroup = {
                          type: type as any,
                          questions,
                        }
                        if (rubricId) {
                          group.rubricId = rubricId
                        }
                        if (rubricNote) {
                          group.rubricNote = rubricNote
                        }
                        groups.push(group)
                      }
                    })
                  }
                }

                return groups.length > 0 ? (
                  <div className="mb-6">
                    <p className="text-sm text-gray-600 mb-4">
                      The following question groups have been assigned to this assignment:
                    </p>
                    <QuestionList
                      questionGroups={groups}
                      tenantId={_tenantId}
                      userRole="instructor"
                      onRemoveGroup={() => {}}
                    />
                  </div>
                ) : (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
                    <p className="text-gray-600 text-sm">No assignment content has been added yet.</p>
                  </div>
                )
              })()}
            </div>
          )}

          {/* 3. Student Submission File Content */}
          {fileContent ? (
            // Text file preview
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <p className="text-sm font-medium text-gray-900 mb-3">📄 File Content:</p>
              <div className="bg-white border border-gray-300 rounded p-4 max-h-96 overflow-y-auto">
                <pre className="text-xs text-gray-700 font-mono whitespace-pre-wrap break-words">
                  {fileContent.length > 5000 
                    ? fileContent.substring(0, 5000) + '\n\n...(truncated, download to view full content)'
                    : fileContent}
                </pre>
              </div>
              {fileContent.length > 5000 && (
                <p className="text-xs text-gray-600 mt-2 italic">
                  File is large ({fileContent.length} characters). Download to view the complete file.
                </p>
              )}
            </div>
          ) : fileBlobUrl ? (
            // Binary file viewer
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <p className="text-sm font-medium text-gray-900 mb-3">📄 File Content:</p>
              
              {getFileExtension(fileName || '') === 'pdf' ? (
                // PDF viewer
                <div className="border border-gray-300 rounded overflow-hidden" style={{ height: '600px' }}>
                  <iframe
                    src={fileBlobUrl}
                    title="PDF Viewer"
                    width="100%"
                    height="100%"
                    style={{ border: 'none' }}
                    onError={() => console.error('[SubmissionViewer] PDF iframe failed to load:', fileBlobUrl)}
                    onLoad={() => console.log('[SubmissionViewer] PDF iframe loaded successfully')}
                  />
                </div>
              ) : ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(getFileExtension(fileName || '')) ? (
                // Image viewer
                <div className="flex justify-center border border-gray-300 rounded bg-gray-50 p-4">
                  <img
                    src={fileBlobUrl}
                    alt={fileName || 'Submission'}
                    style={{ maxHeight: '500px', maxWidth: '100%' }}
                    onError={() => console.error('[SubmissionViewer] Image failed to load:', fileBlobUrl)}
                    onLoad={() => console.log('[SubmissionViewer] Image loaded successfully')}
                  />
                </div>
              ) : (
                // Other binary files
                <div className="p-6 text-center border border-gray-300 rounded bg-gray-50">
                  <p className="text-gray-700 mb-4">
                    📦 {getFileExtension(fileName || '').toUpperCase()} file - Download to view
                  </p>
                  <button
                    onClick={handleDownload}
                    disabled={downloading || !submissionId}
                    className={`px-4 py-2 rounded text-sm font-medium ${
                      downloading || !submissionId
                        ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {downloading ? '⬇️ Downloading...' : '⬇️ Download'}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p className="text-gray-700 text-sm">
                ℹ️ No submission file available
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
