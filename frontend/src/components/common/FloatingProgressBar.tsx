'use client'

import React from 'react'

interface FloatingProgressBarProps {
  show: boolean
  message?: string
}

export const FloatingProgressBar: React.FC<FloatingProgressBarProps> = ({
  show,
  message = 'Processing...',
}) => {
  if (!show) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-50">
      {/* Floating container */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-white rounded-lg shadow-lg border border-blue-200 p-4 min-w-64">
        {/* Message */}
        <div className="flex items-center gap-3 mb-3">
          <div className="relative w-5 h-5">
            {/* Animated spinner */}
            <svg
              className="absolute inset-0 animate-spin"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75 text-blue-600"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </div>
          <span className="font-semibold text-gray-900">{message}</span>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
          <div
            className="bg-gradient-to-r from-blue-400 to-blue-600 h-full rounded-full"
            style={{
              animation: 'indeterminate 1.5s infinite',
              width: '30%',
            }}
          />
        </div>

        {/* Subtext */}
        <p className="text-xs text-gray-500 mt-2 text-center">
          This usually takes 2-3 seconds...
        </p>
      </div>

      {/* CSS for animation */}
      <style>{`
        @keyframes indeterminate {
          0% {
            left: -100%;
          }
          100% {
            left: 100%;
          }
        }
        
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  )
}
