'use client'

import React, { useState, useEffect } from 'react'
import { QuestionGroup, QuestionItem, Rubric } from './QuestionCreationDialog'

interface QuestionListProps {
  questionGroups: QuestionGroup[]
  tenantId?: string
  userRole?: 'student' | 'instructor' | 'admin'
  onRemoveGroup: (groupIndex: number) => void
}

export function QuestionList({
  questionGroups,
  tenantId,
  userRole = 'student',
  onRemoveGroup,
}: QuestionListProps) {
  const [rubrics, setRubrics] = useState<Map<string, Rubric>>(new Map())

  // Fetch rubrics when component mounts or groups change
  useEffect(() => {
    const rubricIds = questionGroups
      .filter(g => g.rubricId)
      .map(g => g.rubricId as string)
    
    console.log('[QuestionList] useEffect triggered:', {
      questionGroupsCount: questionGroups.length,
      rubricIdsNeeded: rubricIds,
      tenantId,
      timestamp: new Date().toISOString(),
    })

    if (rubricIds.length > 0 && tenantId) {
      console.log('[QuestionList] Fetching rubrics...', {
        rubricIdsCount: rubricIds.length,
      })
      fetchRubrics()
    } else {
      console.log('[QuestionList] Skipping rubric fetch:', {
        reason: rubricIds.length === 0 ? 'no rubric IDs' : 'no tenant ID',
        rubricIds,
        tenantId,
      })
    }
  }, [questionGroups, tenantId])

  const fetchRubrics = async () => {
    try {
      const token = localStorage.getItem('accessToken')
      
      console.log('[QuestionList] Fetching rubrics from API...', {
        apiUrl: `${process.env.NEXT_PUBLIC_API_URL}/v1/courses/rubrics`,
        tenantId,
        timestamp: new Date().toISOString(),
      })

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/v1/courses/rubrics`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'X-Tenant-ID': tenantId || '',
          },
        }
      )

      console.log('[QuestionList] Rubrics API response:', {
        status: response.status,
        statusText: response.statusText,
      })

      if (response.ok) {
        const data = await response.json()
        console.log('[QuestionList] Rubrics received:', {
          rubricCount: data.data?.length || 0,
          rubrics: data.data?.map((r: any) => ({ id: r.id, name: r.name })) || [],
        })

        const rubricMap = new Map<string, Rubric>()
        data.data?.forEach((rubric: Rubric) => {
          rubricMap.set(rubric.id, rubric)
        })
        setRubrics(rubricMap)
        
        console.log('[QuestionList] Rubric map updated:', {
          mapSize: rubricMap.size,
          keys: Array.from(rubricMap.keys()),
        })
      } else {
        console.error('[QuestionList] Failed to fetch rubrics', {
          status: response.status,
          statusText: response.statusText,
        })
      }
    } catch (error) {
      console.error('[QuestionList] Exception fetching rubrics:', error, {
        timestamp: new Date().toISOString(),
      })
    }
  }
  const typeLabels: Record<string, string> = {
    MULTIPLE_CHOICE: 'Multiple Choice',
    SHORT_ANSWER: 'Short Answer',
    FILL_BLANK: 'Fill in the Blank',
    ESSAY: 'Essay',
    CODE: 'Code',
    FILE_UPLOAD: 'File Upload',
    MATH: 'Math',
    PROGRAMMING: 'Programming',
  }

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      MULTIPLE_CHOICE: 'bg-blue-50 border-blue-200',
      SHORT_ANSWER: 'bg-green-50 border-green-200',
      FILL_BLANK: 'bg-yellow-50 border-yellow-200',
      ESSAY: 'bg-purple-50 border-purple-200',
      CODE: 'bg-gray-50 border-gray-200',
      FILE_UPLOAD: 'bg-orange-50 border-orange-200',
      MATH: 'bg-indigo-50 border-indigo-200',
      PROGRAMMING: 'bg-pink-50 border-pink-200',
    }
    return colors[type] || 'bg-gray-50 border-gray-200'
  }

  const getBadgeColor = (type: string) => {
    const colors: Record<string, string> = {
      MULTIPLE_CHOICE: 'bg-blue-100 text-blue-800',
      SHORT_ANSWER: 'bg-green-100 text-green-800',
      FILL_BLANK: 'bg-yellow-100 text-yellow-800',
      ESSAY: 'bg-purple-100 text-purple-800',
      CODE: 'bg-gray-100 text-gray-800',
      FILE_UPLOAD: 'bg-orange-100 text-orange-800',
      MATH: 'bg-indigo-100 text-indigo-800',
      PROGRAMMING: 'bg-pink-100 text-pink-800',
    }
    return colors[type] || 'bg-gray-100 text-gray-800'
  }

  const calculateGroupTotal = (questions: QuestionItem[]): number => {
    return questions.reduce((sum, q) => sum + q.pointValue, 0)
  }

  // Helper function to render formatted text content
  const renderFormattedContent = (content: string): React.ReactNode => {
    if (!content) return null

    // Split by newlines and process each line
    const lines = content.split('\n')
    
    return (
      <div className="space-y-2">
        {lines.map((line, idx) => {
          const trimmed = line.trim()
          
          // Skip empty lines
          if (!trimmed) return null
          
          // Detect list items (starting with -, *, •, or numbers followed by .)
          const listItemMatch = trimmed.match(/^[-*•]\s+(.+)$|^\d+\.\s+(.+)$/)
          if (listItemMatch) {
            return (
              <li key={idx} className="ml-4 text-gray-700">
                {listItemMatch[1] || listItemMatch[2]}
              </li>
            )
          }
          
          // Detect headers (lines starting with # or ALL CAPS)
          if (trimmed.startsWith('#') || (trimmed === trimmed.toUpperCase() && trimmed.length > 2)) {
            const headerText = trimmed.replace(/^#+\s*/, '')
            return (
              <h4 key={idx} className="font-semibold text-gray-800 mt-2">
                {headerText}
              </h4>
            )
          }
          
          // Regular text
          return (
            <p key={idx} className="text-gray-700">
              {trimmed}
            </p>
          )
        })}
      </div>
    )
  }

  if (questionGroups.length === 0) {
    console.log('[QuestionList] Rendering: No question groups', {
      timestamp: new Date().toISOString(),
    })
    return (
      <div className="text-center py-8 text-gray-500">
        No questions added yet. Select a type and create your first question group.
      </div>
    )
  }

  console.log('[QuestionList] Rendering question groups:', {
    groupsCount: questionGroups.length,
    rubricMapSize: rubrics.size,
    groups: questionGroups.map((g, i) => ({
      index: i,
      type: g.type,
      questionCount: g.questions.length,
      rubricId: g.rubricId,
      rubricLoaded: g.rubricId ? rubrics.has(g.rubricId) : false,
    })),
    timestamp: new Date().toISOString(),
  })

  return (
    <div className="space-y-6">
      {questionGroups.map((group, groupIdx) => (
        <div
          key={groupIdx}
          className={`border rounded-lg p-4 ${getTypeColor(group.type)}`}
        >
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1">
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                {typeLabels[group.type]} ({group.questions.length} question
                {group.questions.length !== 1 ? 's' : ''})
              </h3>
              <p className="text-sm text-gray-600 mb-2">
                Total: {calculateGroupTotal(group.questions)} points
              </p>
              
              {/* Display rubric criteria or note */}
              {group.rubricId && rubrics.has(group.rubricId) ? (
                <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded">
                  <p className="font-medium text-green-900 text-sm mb-2">
                    Rubric: {rubrics.get(group.rubricId)?.name}
                  </p>
                  {rubrics.get(group.rubricId)?.criteria && (
                    <div>
                      {typeof rubrics.get(group.rubricId)?.criteria === 'string' ? (
                        <p className="text-sm text-gray-700">{rubrics.get(group.rubricId)?.criteria}</p>
                      ) : Array.isArray(rubrics.get(group.rubricId)?.criteria) ? (
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs border-collapse">
                            <thead>
                              <tr className="bg-green-100">
                                <th className="border border-green-300 px-2 py-1 text-left font-semibold">Criterion</th>
                                <th className="border border-green-300 px-2 py-1 text-left font-semibold">Description</th>
                                <th className="border border-green-300 px-2 py-1 text-center font-semibold w-16">Points</th>
                              </tr>
                            </thead>
                            <tbody>
                              {rubrics.get(group.rubricId)?.criteria.map((criterion: any, idx: number) => (
                                <tr key={idx} className="hover:bg-green-100">
                                  <td className="border border-green-200 px-2 py-1 font-medium">{criterion.name || criterion.title || `Criterion ${idx + 1}`}</td>
                                  <td className="border border-green-200 px-2 py-1">{criterion.description || criterion.details || '-'}</td>
                                  <td className="border border-green-200 px-2 py-1 text-center">{criterion.points || criterion.weight || '-'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : typeof rubrics.get(group.rubricId)?.criteria === 'object' ? (
                        <div className="bg-white p-2 rounded border border-green-100 text-sm">
                          {Object.entries(rubrics.get(group.rubricId)?.criteria || {}).map(([key, value]: [string, any]) => (
                            <div key={key} className="mb-2 pb-2 border-b border-green-100 last:border-b-0">
                              <div className="font-medium text-gray-800">{key}</div>
                              <div className="text-gray-600">
                                {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              ) : group.rubricNote ? (
                <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded">
                  <p className="font-medium text-blue-900 text-sm">Rubric Note:</p>
                  <p className="text-sm text-gray-700">{group.rubricNote}</p>
                </div>
              ) : null}
            </div>
            <button
              onClick={() => onRemoveGroup(groupIdx)}
              className="text-red-600 hover:text-red-800 font-medium text-sm ml-4 flex-shrink-0"
            >
              Remove Group
            </button>
          </div>

          <div className="space-y-3">
            {group.questions.map((question, qIdx) => (
              <div
                key={qIdx}
                className="bg-white border border-gray-200 rounded-lg p-4"
              >
                <div className="flex justify-between items-start mb-3">
                  <span className="text-sm font-medium text-gray-600">
                    Question {qIdx + 1}
                  </span>
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${getBadgeColor(
                      group.type
                    )}`}
                  >
                    {question.pointValue} pts
                  </span>
                </div>

                {/* Question Prompt - with formatting */}
                <div className="mb-3">
                  <p className="text-sm text-gray-600 font-medium mb-2">Question:</p>
                  <div className="text-gray-800 whitespace-pre-wrap">
                    {renderFormattedContent(question.prompt)}
                  </div>
                </div>

                {/* Expected Result - Only show to instructors/admins */}
                {(userRole === 'instructor' || userRole === 'admin') && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <p className="font-medium text-gray-800 mb-2">Expected Result:</p>
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded text-sm text-gray-700">
                      {renderFormattedContent(question.result)}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
