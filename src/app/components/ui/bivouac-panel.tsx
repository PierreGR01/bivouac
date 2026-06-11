import React from 'react';
import { X } from 'lucide-react';
import { cn } from './utils';

interface PanelProps {
  onClose: () => void;
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  mobileMaxHeight?: string;
}

export function Panel({
  onClose,
  title,
  icon,
  children,
  className,
  mobileMaxHeight = 'calc(100vh - 120px)',
}: PanelProps) {
  return (
    <>
      {/* Mobile: bottom sheet */}
      <div
        className={cn(
          'md:hidden fixed inset-x-0 bottom-0 bg-white rounded-t-3xl shadow-2xl z-[1000] flex flex-col',
          className
        )}
        style={{ maxHeight: mobileMaxHeight, animation: 'slideUp 0.3s ease-out' }}
      >
        {/* Drag handle + title */}
        <div className="flex-shrink-0 relative px-6 pt-3 pb-3">
          <div className="flex justify-center pb-3">
            <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
          </div>
          <button
            onClick={onClose}
            className="absolute top-3 right-4 p-1.5 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Fermer"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex items-center gap-2">
            {icon && <span className="flex-shrink-0 text-gray-600">{icon}</span>}
            <h2 className="text-lg font-bold text-gray-800">{title}</h2>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 pb-6">{children}</div>
      </div>

      {/* Desktop: left sidebar */}
      <div
        className={cn(
          'hidden md:flex flex-col fixed top-[158px] left-6 w-[480px] bg-white shadow-2xl z-[500] rounded-b-xl',
          className
        )}
        style={{ animation: 'fadeIn 0.3s ease-out', maxHeight: 'calc(100vh - 10.5rem)' }}
      >
        {/* Header */}
        <div className="flex-shrink-0 flex items-start justify-between px-6 py-5 border-b border-gray-100">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {icon && <span className="flex-shrink-0 text-gray-600">{icon}</span>}
            <h2 className="text-xl font-bold text-gray-800">{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 ml-3 p-2 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Fermer"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </>
  );
}

interface PanelSectionProps {
  children: React.ReactNode;
  className?: string;
}

export function PanelSection({ children, className }: PanelSectionProps) {
  return <div className={cn('mb-4', className)}>{children}</div>;
}

interface PanelActionsProps {
  children: React.ReactNode;
  className?: string;
}

export function PanelActions({ children, className }: PanelActionsProps) {
  return <div className={cn('flex gap-3', className)}>{children}</div>;
}
