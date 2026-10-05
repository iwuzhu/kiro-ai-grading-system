import React from 'react';

const cn = (...classes: (string | undefined | null)[]) => {
  return classes.filter(Boolean).join(' ');
};

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

export const Dialog: React.FC<DialogProps> = ({ open, onOpenChange, children }) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          onClick={() => onOpenChange(false)}
        />
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          {children}
        </div>
      </div>
    </div>
  );
};

interface DialogContentProps {
  children: React.ReactNode;
  className?: string;
}

export const DialogContent: React.FC<DialogContentProps> = ({ children, className }) => (
  <div className={cn('p-6', className)}>{children}</div>
);

interface DialogHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export const DialogHeader: React.FC<DialogHeaderProps> = ({ children, className }) => (
  <div className={cn('mb-4', className)}>{children}</div>
);

interface DialogTitleProps {
  children: React.ReactNode;
  className?: string;
}

export const DialogTitle: React.FC<DialogTitleProps> = ({ children, className }) => (
  <h2 className={cn('text-lg font-semibold text-gray-900', className)}>{children}</h2>
);

interface DialogDescriptionProps {
  children: React.ReactNode;
  className?: string;
}

export const DialogDescription: React.FC<DialogDescriptionProps> = ({ children, className }) => (
  <p className={cn('text-sm text-gray-600 mt-1', className)}>{children}</p>
);

interface DialogFooterProps {
  children: React.ReactNode;
  className?: string;
}

export const DialogFooter: React.FC<DialogFooterProps> = ({ children, className }) => (
  <div className={cn('mt-6 flex justify-end gap-2', className)}>{children}</div>
);

interface DialogTriggerProps {
  children: React.ReactNode;
  onClick: () => void;
  className?: string;
}

export const DialogTrigger: React.FC<DialogTriggerProps> = ({ children, onClick, className }) => (
  <button onClick={onClick} className={className}>
    {children}
  </button>
);
