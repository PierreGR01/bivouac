import React from 'react';
import { X } from 'lucide-react';
import { cn } from './utils';

interface PanelProps {
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}

/**
 * Panel responsive avec design mobile (bottom) et desktop (left sidebar)
 * Suit les patterns de l'application bivouac
 */
export function Panel({ onClose, children, className }: PanelProps) {
  return (
    <>
      {/* Mobile: panneau du bas */}
      <div
        className={cn(
          'md:hidden fixed inset-x-0 bottom-0 bg-white rounded-t-3xl shadow-2xl z-[1000]',
          className
        )}
        style={{
          maxHeight: 'calc(100vh - 120px)',
          animation: 'slideUp 0.3s ease-out',
        }}
      >
        <style>{`
          @keyframes slideUp {
            from {
              transform: translateY(100%);
            }
            to {
              transform: translateY(0);
            }
          }
        `}</style>

        {/* Poignée de glissement */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
        </div>

        {/* Bouton fermer */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2 bg-white rounded-full shadow-lg hover:bg-gray-100 transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Contenu scrollable */}
        <div
          className="overflow-y-auto px-6 pb-6"
          style={{ maxHeight: 'calc(100vh - 180px)' }}
        >
          {children}
        </div>
      </div>

      {/* Desktop: panneau latéral gauche */}
      <div
        className={cn(
          'hidden md:block fixed top-[158px] left-6 w-[480px] bg-white shadow-2xl z-[500] rounded-b-xl',
          className
        )}
        style={{
          animation: 'fadeIn 0.3s ease-out',
          maxHeight: 'calc(100vh - 10.5rem)',
        }}
      >
        <style>{`
          @keyframes fadeIn {
            from {
              opacity: 0;
            }
            to {
              opacity: 1;
            }
          }
        `}</style>

        {/* Contenu scrollable */}
        <div
          className="overflow-y-auto px-6 py-6"
          style={{ maxHeight: 'calc(100vh - 10.5rem)' }}
        >
          {children}
        </div>
      </div>
    </>
  );
}

interface PanelHeaderProps {
  title: string;
  icon?: React.ReactNode;
  onClose?: () => void;
  className?: string;
}

export function PanelHeader({ title, icon, onClose, className }: PanelHeaderProps) {
  return (
    <div className={cn('flex items-center justify-between mb-4', className)}>
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="text-xl font-bold text-gray-800 drop-shadow-sm">{title}</h2>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <X className="w-5 h-5 text-gray-800" />
        </button>
      )}
    </div>
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
