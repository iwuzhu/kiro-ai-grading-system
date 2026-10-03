'use client'

import React from 'react'

interface Criterion {
  id: string
  name: string
  description?: string
  points: number
  levels?: Array<{
    name: string
    points: number
    description?: string
  }>
}

interface Rubric {
  id: string
  name: string
  description?: string
  criteria: Criterion[]
  is_template: boolean
  created_at: string
  updated_at: string
}

interface RubricDisplayProps {
  rubric: Rubric
  isLoading?: boolean
  error?: string
}

export const RubricDisplay: React.FC<RubricDisplayProps> = ({ rubric, isLoading = false, error }) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">{error}</p>
      </div>
    )
  }

  if (!rubric) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <p className="text-gray-600">No rubric data available</p>
      </div>
    )
  }

  const totalPoints = rubric.criteria.reduce((sum, criterion) => sum + criterion.points, 0)

  return (
    <div className="space-y-6">
      {/* Rubric Header */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-2xl font-bold text-gray-900">{rubric.name}</h3>
          {rubric.is_template && (
            <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
              Template
            </span>
          )}
        </div>
        {rubric.description && (
          <p className="text-gray-600 mb-4">{rubric.description}</p>
        )}
        <div className="flex gap-4 text-sm text-gray-500">
          <span>Total Points: <strong className="text-gray-900">{totalPoints}</strong></span>
          <span>Criteria: <strong className="text-gray-900">{rubric.criteria.length}</strong></span>
        </div>
      </div>

      {/* Criteria */}
      <div className="space-y-4">
        {rubric.criteria.map((criterion, index) => (
          <div
            key={criterion.id || index}
            className="border border-gray-200 rounded-lg overflow-hidden"
          >
            {/* Criterion Header */}
            <div className="bg-gray-50 p-4 border-b border-gray-200">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-semibold text-gray-900">{criterion.name}</h4>
                  {criterion.description && (
                    <p className="text-sm text-gray-600 mt-1">{criterion.description}</p>
                  )}
                </div>
                <span className="inline-block px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 whitespace-nowrap ml-4">
                  {criterion.points} pts
                </span>
              </div>
            </div>

            {/* Performance Levels */}
            {criterion.levels && criterion.levels.length > 0 && (
              <div className="divide-y divide-gray-200">
                {criterion.levels.map((level, levelIndex) => (
                  <div key={levelIndex} className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h5 className="font-medium text-gray-900">{level.name}</h5>
                      <span className="text-sm font-medium text-gray-700">
                        {level.points} pts
                      </span>
                    </div>
                    {level.description && (
                      <p className="text-sm text-gray-600">{level.description}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* No levels message */}
            {(!criterion.levels || criterion.levels.length === 0) && (
              <div className="p-4 text-gray-500 text-sm">
                No performance levels defined for this criterion
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Empty state */}
      {rubric.criteria.length === 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <p className="text-gray-600 text-center">No criteria defined in this rubric</p>
        </div>
      )}

      {/* Metadata */}
      <div className="bg-gray-50 rounded-lg p-4 text-xs text-gray-500 space-y-1">
        <p>Created: {new Date(rubric.created_at).toLocaleDateString()}</p>
        <p>Last Updated: {new Date(rubric.updated_at).toLocaleDateString()}</p>
      </div>
    </div>
  )
}
