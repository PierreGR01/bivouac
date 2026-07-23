import React, { useRef, useState } from 'react';
import { X } from 'lucide-react';
import { cn } from './utils';

interface PanelProps {
  onClose: () => void;
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  mobileMaxHeight?: string;
  stickyFooter?: React.ReactNode;
  headerAction?: React.ReactNode;
}

// Minimal bar height when the sheet is collapsed, and the height below which
// releasing the drag handle snaps it into that collapsed state.
const COLLAPSED_HEIGHT = 64;
const COLLAPSE_THRESHOLD = 140;

export function Panel({
  onClose,
  title,
  icon,
  children,
  className,
  mobileMaxHeight = 'calc(100vh - 120px)',
  stickyFooter,
  headerAction,
}: PanelProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragInfo = useRef<{ startY: number; startHeight: number; currentHeight: number; moved: boolean } | null>(null);
  const collapsedRef = useRef(false);
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  collapsedRef.current = collapsed;

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = sheetRef.current;
    if (!el) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const startHeight = el.getBoundingClientRect().height;
    dragInfo.current = { startY: e.clientY, startHeight, currentHeight: startHeight, moved: false };
    setIsDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const info = dragInfo.current;
    if (!info) return;
    const delta = e.clientY - info.startY;
    if (Math.abs(delta) > 3) info.moved = true;
    const maxAllowed = window.innerHeight - 80;
    const newHeight = Math.min(Math.max(info.startHeight - delta, 0), maxAllowed);
    info.currentHeight = newHeight;
    setDragHeight(newHeight);
    if (collapsedRef.current && newHeight > COLLAPSED_HEIGHT + 20) setCollapsed(false);
  };

  const handlePointerUp = () => {
    const info = dragInfo.current;
    dragInfo.current = null;
    setIsDragging(false);
    if (!info) return;

    if (!info.moved) {
      // Plain tap on the handle: reopen a collapsed sheet at its default height.
      if (collapsedRef.current) {
        setCollapsed(false);
        setDragHeight(null);
      }
      return;
    }

    if (info.currentHeight <= COLLAPSE_THRESHOLD) {
      setCollapsed(true);
      setDragHeight(COLLAPSED_HEIGHT);
    } else {
      setCollapsed(false);
    }
  };

  const sheetStyle: React.CSSProperties = collapsed
    ? { height: COLLAPSED_HEIGHT, transition: isDragging ? 'none' : 'height 0.2s ease-out' }
    : dragHeight != null
      ? { height: dragHeight, transition: isDragging ? 'none' : 'height 0.2s ease-out' }
      : { maxHeight: mobileMaxHeight, animation: 'slideUp 0.3s ease-out' };

  return (
    <>
      {/* Mobile: bottom sheet */}
      <div
        ref={sheetRef}
        className={cn(
          'md:hidden fixed inset-x-0 bottom-0 bg-white rounded-t-3xl shadow-2xl z-[1000] flex flex-col',
          className
        )}
        style={sheetStyle}
      >
        {/* Drag handle + title */}
        <div className="flex-shrink-0 relative px-4 pt-2 pb-2">
          <div
            className="flex justify-center pb-2 touch-none cursor-grab active:cursor-grabbing"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
          </div>
          <div className="absolute top-3 right-4 flex items-center gap-1">
            {headerAction}
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
              aria-label="Fermer"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>
          <div className={cn('flex items-center gap-2', collapsed && 'pr-16')}>
            {icon && <span className="flex-shrink-0 text-gray-600">{icon}</span>}
            <h2 className={cn('text-lg font-bold text-gray-800', collapsed && 'truncate')}>{title}</h2>
          </div>
        </div>

        {!collapsed && (
          <>
            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-4 pb-6" style={{ scrollbarGutter: 'stable both-edges' }}>{children}</div>
            {stickyFooter && (
              <div className="flex-shrink-0 px-4 py-3 border-t border-gray-100 bg-white">
                {stickyFooter}
              </div>
            )}
          </>
        )}
      </div>

      {/* Desktop: left sidebar */}
      <div
        className={cn(
          'hidden md:flex flex-col fixed top-[82px] left-6 w-[480px] bg-white shadow-2xl z-[500] rounded-b-xl',
          className
        )}
        style={{ animation: 'fadeIn 0.3s ease-out', maxHeight: 'calc(100vh - 6rem)' }}
      >
        {/* Header */}
        <div className="flex-shrink-0 flex items-start justify-between px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {icon && <span className="flex-shrink-0 text-gray-600">{icon}</span>}
            <h2 className="text-xl font-bold text-gray-800">{title}</h2>
          </div>
          <div className="flex-shrink-0 flex items-center gap-1 ml-3">
            {headerAction}
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              aria-label="Fermer"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-4 py-5" style={{ scrollbarGutter: 'stable both-edges' }}>{children}</div>
        {stickyFooter && (
          <div className="flex-shrink-0 px-4 py-3 border-t border-gray-100 bg-white">
            {stickyFooter}
          </div>
        )}
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
