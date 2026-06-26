import React from 'react';
import { cn } from './utils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className, ...props }: InputProps) {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-semibold mb-2 text-gray-800">
          {label}
        </label>
      )}
      <input
        className={cn(
          'w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all bg-white',
          error && 'border-red-300 focus:ring-red-500',
          className
        )}
        {...props}
      />
      {error && (
        <p className="text-xs text-red-600 mt-1">{error}</p>
      )}
    </div>
  );
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function Textarea({ label, error, className, ...props }: TextareaProps) {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-semibold mb-2 text-gray-800">
          {label}
        </label>
      )}
      <textarea
        className={cn(
          'w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none transition-all bg-white',
          error && 'border-red-300 focus:ring-red-500',
          className
        )}
        {...props}
      />
      {error && (
        <p className="text-xs text-red-600 mt-1">{error}</p>
      )}
    </div>
  );
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: Array<{ value: string; label: string }>;
}

export function Select({ label, error, options, className, ...props }: SelectProps) {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-semibold mb-2 text-gray-800">
          {label}
        </label>
      )}
      <select
        className={cn(
          'w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white transition-all',
          error && 'border-red-300 focus:ring-red-500',
          className
        )}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <p className="text-xs text-red-600 mt-1">{error}</p>
      )}
    </div>
  );
}

interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export function Checkbox({ label, className, ...props }: CheckboxProps) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <input
        type="checkbox"
        className={cn(
          'w-5 h-5 text-emerald-600 rounded focus:ring-2 focus:ring-emerald-500',
          className
        )}
        {...props}
      />
      <span className="text-sm text-gray-800">{label}</span>
    </label>
  );
}

interface RangeSliderProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  unit?: string;
  displayValue?: string | number;
}

export function RangeSlider({
  label,
  unit,
  displayValue,
  value,
  className,
  ...props
}: RangeSliderProps) {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-semibold mb-2 text-gray-800">
          {label}
        </label>
      )}
      <div className="flex items-center gap-3">
        <input
          type="range"
          value={value}
          className={cn(
            'flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-emerald-600',
            className
          )}
          {...props}
        />
        <span className="text-sm font-medium text-gray-700 w-16 text-right">
          {displayValue ?? value} {unit}
        </span>
      </div>
    </div>
  );
}

interface DifficultySelectorProps {
  selectedLevels: number[];
  onToggle: (level: number) => void;
  className?: string;
}

function difficultyColor(level: number): string {
  if (level === 0) return 'border-gray-500 bg-gray-100 text-gray-700';
  if (level <= 2) return 'border-green-500 bg-green-50 text-green-700';
  if (level === 3) return 'border-yellow-500 bg-yellow-50 text-yellow-700';
  return 'border-red-500 bg-red-50 text-red-700';
}

export function DifficultySelector({ selectedLevels, onToggle, className }: DifficultySelectorProps) {
  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      {[0, 1, 2, 3, 4, 5].map((level) => (
        <button
          key={level}
          type="button"
          onClick={() => onToggle(level)}
          className={cn(
            'flex-1 h-10 flex items-center justify-center rounded-lg border-2 transition-all text-sm font-bold',
            selectedLevels.includes(level)
              ? difficultyColor(level)
              : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
          )}
        >
          {level}
        </button>
      ))}
    </div>
  );
}
