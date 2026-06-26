import React from 'react';
import { cn } from './utils';
import { Check } from 'lucide-react';

export type BivouacButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'destructive'
  | 'ghost';
export type BivouacButtonSize = 'sm' | 'md' | 'lg';

interface BivouacButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BivouacButtonVariant;
  size?: BivouacButtonSize;
  icon?: React.ReactNode;
  children?: React.ReactNode;
}

const variantClasses: Record<BivouacButtonVariant, string> = {
  primary: 'bg-emerald-600 text-white hover:bg-emerald-700',
  secondary: 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50',
  outline: 'border border-gray-200 text-gray-700 hover:bg-gray-50',
  destructive: 'bg-red-600 text-white hover:bg-red-700',
  ghost: 'text-gray-600 hover:bg-gray-100',
};

const sizeClasses: Record<BivouacButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base',
};

interface FilterChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active: boolean;
  activeColor?: string;
  showCheckmark?: boolean;
  children: React.ReactNode;
}

export function FilterChip({
  active,
  activeColor = 'border-emerald-500 bg-emerald-50 text-emerald-800',
  showCheckmark = true,
  children,
  className,
  ...props
}: FilterChipProps) {
  return (
    <button
      className={cn(
        'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border-2 transition-all text-sm font-medium',
        active ? activeColor : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50',
        className
      )}
      {...props}
    >
      {children}
      {active && showCheckmark && (
        <div className="w-3.5 h-3.5 rounded-full bg-current flex items-center justify-center ml-1 opacity-70 flex-shrink-0">
          <Check className="w-2 h-2 text-white" strokeWidth={3} />
        </div>
      )}
    </button>
  );
}

export function BivouacButton({
  variant = 'primary',
  size = 'md',
  icon,
  children,
  className,
  disabled,
  ...props
}: BivouacButtonProps) {
  return (
    <button
      className={cn(
        'flex items-center justify-center gap-2 font-medium rounded-lg transition-colors',
        variantClasses[variant],
        sizeClasses[size],
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
      disabled={disabled}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}
