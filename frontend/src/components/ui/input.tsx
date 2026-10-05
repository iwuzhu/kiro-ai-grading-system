import React from 'react';

const cn = (...classes: (string | undefined | null)[]) => {
  return classes.filter(Boolean).join(' ');
};

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          'w-full px-3 py-2 border border-gray-300 rounded-lg',
          'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
          'disabled:bg-gray-100 disabled:cursor-not-allowed',
          'transition-colors',
          className
        )}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';
