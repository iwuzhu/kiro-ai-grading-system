import React from 'react';

const cn = (...classes: (string | undefined | null)[]) => {
  return classes.filter(Boolean).join(' ');
};

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number;
  max?: number;
}

export const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, max = 100, ...props }, ref) => {
    const percentage = Math.min((value / max) * 100, 100);

    return (
      <div
        ref={ref}
        className={cn('w-full h-2 bg-gray-200 rounded-full overflow-hidden', className)}
        {...props}
      >
        <div
          className="h-full bg-blue-600 rounded-full transition-all"
          style={{ width: `${percentage}%` }}
        />
      </div>
    );
  }
);

Progress.displayName = 'Progress';
