'use client'

import React, { useState, useEffect } from 'react'

export interface Rubric {
  id: string
  name: string
  description?: string
  criteria: any[]
}

export interface QuestionItem {
  prompt: string
  result: string
  pointValue: number
}

export interface QuestionGroup {
  type: 'MULTIPLE_CHOICE' | 'SHORT_ANSWER' | 'FILL_BLANK' | 'ESSAY' | 'CODE' | 'FILE_UPLOAD' | 'MATH' | 'PROGRAMMING'
  rubricId?: string // Rubric ID for Essay, Code, Math, Programming, File Upload
  rubricNote?: string // Text note for other types
  questions: QuestionItem[]
}

interface QuestionCreationDialogProps {
  isOpen: boolean
  selectedType: string
  tenantId?: string
  onClose: () => void
  onAddQuestionGroup: (group: QuestionGroup) => void
}

export function QuestionCreationDialog({
  isOpen,
  selectedType,
  tenantId,
  onClose,
  onAddQuestionGroup,
}: QuestionCreationDialogProps) {
  const [rubricId, setRubricId] = useState<string>('')
  const [rubricNote, setRubricNote] = useState('')
  const [rubrics, setRubrics] = useState<Rubric[]>([])
  const [loadingRubrics, setLoadingRubrics] = useState(false)
  const [questions, setQuestions] = useState<QuestionItem[]>([
    { prompt: '', result: '', pointValue: 5 },
  ])

  // Fetch rubrics for question types that require them
  useEffect(() => {
    const rubricRequiredTypes = ['ESSAY', 'CODE', 'MATH', 'PROGRAMMING', 'FILE_UPLOAD']
    
    if (isOpen && rubricRequiredTypes.includes(selectedType) && tenantId) {
      fetchRubrics()
    }
  }, [isOpen, selectedType, tenantId])

  const fetchRubrics = async () => {
    try {
      setLoadingRubrics(true)
      const token = localStorage.getItem('accessToken')
      
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/v1/courses/rubrics`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'X-Tenant-ID': tenantId || '',
          },
        }
      )

      if (response.ok) {
        const data = await response.json()
        setRubrics(data.data || [])
      }
    } catch (error) {
      console.error('Failed to fetch rubrics:', error)
    } finally {
      setLoadingRubrics(false)
    }
  }

  const handleAddMoreQuestion = () => {
    setQuestions([
      ...questions,
      { prompt: '', result: '', pointValue: 5 },
    ])
  }

  const handleRemoveQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index))
  }

  const handleQuestionChange = (
    index: number,
    field: keyof QuestionItem,
    value: any
  ) => {
    const updated = [...questions]
    updated[index] = { ...updated[index], [field]: value }
    setQuestions(updated)
  }

  const handleAddQuestionGroup = () => {
    // Rubric is required for ESSAY, CODE, MATH, PROGRAMMING, FILE_UPLOAD
    const rubricRequiredTypes = ['ESSAY', 'CODE', 'MATH', 'PROGRAMMING', 'FILE_UPLOAD']
    
    if (rubricRequiredTypes.includes(selectedType)) {
      if (!rubricId) {
        alert('Please select a grading rubric for this question type')
        return
      }
    }

    // Validate all questions
    for (let i = 0; i < questions.length; i++) {
      if (!questions[i].prompt.trim()) {
        alert(`Question ${i + 1}: Prompt is required`)
        return
      }
      if (!questions[i].result.trim()) {
        alert(`Question ${i + 1}: Expected Result is required`)
        return
      }
      if (questions[i].pointValue <= 0) {
        alert(`Question ${i + 1}: Points must be greater than 0`)
        return
      }
    }

    const group: QuestionGroup = {
      type: selectedType as any,
      ...(rubricRequiredTypes.includes(selectedType)
        ? { rubricId }
        : { rubricNote }),
      questions,
    }

    onAddQuestionGroup(group)

    // Reset
    setRubricId('')
    setRubricNote('')
    setQuestions([{ prompt: '', result: '', pointValue: 5 }])
    onClose()
  }

  if (!isOpen) return null

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

  const selectedRubric = rubrics.find(r => r.id === rubricId)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b p-4 flex justify-between items-center">
          <h2 className="text-lg font-bold text-gray-900">
            Add {typeLabels[selectedType] || selectedType} Questions
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Grading Rubric - Applies to all questions in this group */}
          <div className="border-b pb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Grading Rubric {
                ['ESSAY', 'CODE', 'MATH', 'PROGRAMMING', 'FILE_UPLOAD'].includes(selectedType)
                  ? '*'
                  : '(optional)'
              }
            </label>
            
            {['ESSAY', 'CODE', 'MATH', 'PROGRAMMING', 'FILE_UPLOAD'].includes(selectedType) ? (
              // Dropdown for rubric-required types
              <div>
                <select
                  value={rubricId}
                  onChange={(e) => setRubricId(e.target.value)}
                  disabled={loadingRubrics}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">
                    {loadingRubrics ? 'Loading rubrics...' : 'Select a rubric'}
                  </option>
                  {rubrics.map((rubric) => (
                    <option key={rubric.id} value={rubric.id}>
                      {rubric.name}
                      {rubric.description ? ` - ${rubric.description}` : ''}
                    </option>
                  ))}
                </select>
                {rubrics.length === 0 && !loadingRubrics && (
                  <p className="text-sm text-gray-500 mt-2">
                    No rubrics available. Please create a rubric first.
                  </p>
                )}
                
                {/* Display selected rubric criteria */}
                {selectedRubric && selectedRubric.criteria && (
                  <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
                    <p className="text-sm font-medium text-blue-900 mb-2">Rubric Criteria:</p>
                    {typeof selectedRubric.criteria === 'string' ? (
                      <p className="text-sm text-gray-700">{selectedRubric.criteria}</p>
                    ) : Array.isArray(selectedRubric.criteria) ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs border-collapse">
                          <thead>
                            <tr className="bg-blue-100">
                              <th className="border border-blue-300 px-2 py-1 text-left font-semibold">Criterion</th>
                              <th className="border border-blue-300 px-2 py-1 text-left font-semibold">Description</th>
                              <th className="border border-blue-300 px-2 py-1 text-center font-semibold w-16">Points</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedRubric.criteria.map((criterion: any, idx: number) => (
                              <tr key={idx} className="hover:bg-blue-100">
                                <td className="border border-blue-200 px-2 py-1 font-medium">{criterion.name || criterion.title || `Criterion ${idx + 1}`}</td>
                                <td className="border border-blue-200 px-2 py-1">{criterion.description || criterion.details || '-'}</td>
                                <td className="border border-blue-200 px-2 py-1 text-center">{criterion.points || criterion.weight || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : typeof selectedRubric.criteria === 'object' ? (
                      <div className="bg-white p-2 rounded border border-blue-100 text-sm">
                        {Object.entries(selectedRubric.criteria).map(([key, value]: [string, any]) => (
                          <div key={key} className="mb-2 pb-2 border-b border-blue-100 last:border-b-0">
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
            ) : (
              // Text field for rubric-optional types
              <textarea
                value={rubricNote}
                onChange={(e) => setRubricNote(e.target.value)}
                placeholder="e.g., How to evaluate student answers, key points to look for, common mistakes to avoid"
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            )}
          </div>

          {/* Questions */}
          {questions.map((question, qIdx) => (
            <div
              key={qIdx}
              className="border rounded-lg p-4 bg-gray-50 space-y-4"
            >
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-semibold text-gray-900">Question {qIdx + 1}</h3>
                {questions.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveQuestion(qIdx)}
                    className="text-red-600 hover:text-red-800 text-sm font-medium"
                  >
                    Remove Question
                  </button>
                )}
              </div>

              {/* Question Prompt */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Question Prompt *
                </label>
                <textarea
                  value={question.prompt}
                  onChange={(e) =>
                    handleQuestionChange(qIdx, 'prompt', e.target.value)
                  }
                  placeholder="Enter the question text"
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Expected Result */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Expected Result / Instructor Answer *
                </label>
                <textarea
                  value={question.result}
                  onChange={(e) =>
                    handleQuestionChange(qIdx, 'result', e.target.value)
                  }
                  placeholder="Enter the expected answer or result for this question"
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Points */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Points *
                </label>
                <input
                  type="number"
                  value={question.pointValue}
                  onChange={(e) =>
                    handleQuestionChange(qIdx, 'pointValue', parseFloat(e.target.value))
                  }
                  min="0.5"
                  step="0.5"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          ))}

          {/* Add More Button */}
          <button
            type="button"
            onClick={handleAddMoreQuestion}
            className="w-full bg-blue-100 hover:bg-blue-200 text-blue-700 font-medium py-2 px-4 rounded-lg border-2 border-dashed border-blue-300"
          >
            + Add More Questions
          </button>
        </div>

        <div className="sticky bottom-0 bg-gray-50 border-t p-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={handleAddQuestionGroup}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
          >
            Add Question Group
          </button>
        </div>
      </div>
    </div>
  )
}
