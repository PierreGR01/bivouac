import React from 'react';
import { cn } from './utils';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function Card({ children, className, ...props }: CardProps) {
  return (
    <div
      className={cn('bg-white rounded-xl shadow-lg p-6', className)}
      {...props}
    >
      {children}
    </div>
  );
}

interface InfoCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  value: string | number;
  variant?: 'blue' | 'emerald' | 'orange' | 'gray';
}

const variantClasses = {
  blue: 'bg-blue-50 text-blue-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  orange: 'bg-orange-50 text-orange-600',
  gray: 'bg-gray-50 text-gray-600',
};

const valueClasses = {
  blue: 'text-blue-700',
  emerald: 'text-emerald-700',
  orange: 'text-orange-700',
  gray: 'text-gray-700',
};

export function InfoCard({ title, value, variant = 'blue', className, ...props }: InfoCardProps) {
  return (
    <div
      className={cn('rounded-lg p-3', variantClasses[variant], className)}
      {...props}
    >
      <p className="text-xs font-medium mb-1">{title}</p>
      <p className={cn('text-2xl font-bold', valueClasses[variant])}>{value}</p>
    </div>
  );
}

interface AlertCardProps extends React.HTMLAttributes<HTMLDivElement> {
  type: 'success' | 'warning' | 'error' | 'info' | 'orange';
  children: React.ReactNode;
}

const alertClasses = {
  success: 'bg-emerald-50 border-emerald-400',
  warning: 'bg-yellow-50 border-yellow-400',
  error: 'bg-red-50 border-red-400',
  info: 'bg-blue-50 border-blue-400',
  orange: 'bg-orange-50 border-orange-400',
};

const alertTextClasses = {
  success: 'text-emerald-800',
  warning: 'text-yellow-800',
  error: 'text-red-800',
  info: 'text-blue-800',
  orange: 'text-orange-800',
};

export function AlertCard({ type, children, className, ...props }: AlertCardProps) {
  return (
    <div
      className={cn(
        'border-l-4 p-3 rounded-r-lg',
        alertClasses[type],
        alertTextClasses[type],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
