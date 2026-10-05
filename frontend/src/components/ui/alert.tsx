import React from 'react';

const cn = (...classes: (string | undefined | null)[]) => {
  return classes.filter(Boolean).join(' ');
};

interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'destructive';
}

export const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    const variantStyles = {
      default: 'bg-blue-50 border-blue-200 text-blue-900',
      destructive: 'bg-red-50 border-red-200 text-red-900',
    };

    return (
      <div
        ref={ref}
        className={cn(
          'rounded-lg border p-4',
          variantStyles[variant],
          className
        )}
        {...props}
      />
    );
  }
);
Alert.displayName = 'Alert';

interface AlertDescriptionProps extends React.HTMLAttributes<HTMLDivElement> {}

export const AlertDescription = React.forwardRef<
  HTMLDivElement,
  AlertDescriptionProps
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('text-sm', className)}
    {...props}
  />
));
AlertDescription.displayName = 'AlertDescription';
