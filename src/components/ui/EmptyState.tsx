import React from 'react';

interface EmptyStateProps {
  title: string;
  message?: string;
  icon?: React.ReactNode;
}

export function EmptyState({ title, message, icon }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      {icon && (
        <div className="mb-4 text-navy/30">
          {icon}
        </div>
      )}
      <h3 className="font-heading text-lg text-navy/60 mb-2">
        {title}
      </h3>
      {message && (
        <p className="text-sm font-body text-navy/40 max-w-sm">
          {message}
        </p>
      )}
    </div>
  );
}
