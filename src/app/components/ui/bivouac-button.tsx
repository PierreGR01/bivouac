import React from 'react';
import { cn } from './utils';

export type BivouacButtonVariant = 'primary' | 'secondary' | 'outline' | 'destructive' | 'ghost';
export type BivouacButtonSize = 'sm' | 'md' | 'lg';

interface BivouacButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BivouacButtonVariant;
  size?: BivouacButtonSize;
  icon?: React.ReactNode;
  children?: React.ReactNode;
}

const variantClasses: Record<BivouacButtonVariant, string> = {
  primary: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-md',
  secondary: 'bg-blue-600 text-white hover:bg-blue-700 shadow-md',
  outline: 'border-2 border-gray-300 text-gray-700 hover:bg-gray-50',
  destructive: 'border-2 border-red-300 text-red-600 hover:bg-red-50',
  ghost: 'bg-white/20 hover:bg-white/30',
};

const sizeClasses: Record<BivouacButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-base',
  lg: 'px-6 py-3 text-lg',
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
        'flex items-center justify-center gap-2 font-semibold rounded-lg transition-colors',
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
