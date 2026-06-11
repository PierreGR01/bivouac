import React from 'react';
import { cn } from './utils';

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
