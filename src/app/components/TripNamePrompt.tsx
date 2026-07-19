import React, { useState } from 'react';
import { Check, X } from 'lucide-react';
import { BivouacButton } from './ui/bivouac-button';
import { Input } from './ui/bivouac-input';

interface TripNamePromptProps {
  onConfirm: (name: string) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function TripNamePrompt({ onConfirm, onCancel, isSubmitting = false }: TripNamePromptProps) {
  const [name, setName] = useState('');

  return (
    <div className="border border-gray-200 rounded-lg p-3 space-y-3">
      <Input
        label="Nom du tracé"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Ex. Tour du lac Blanc"
        disabled={isSubmitting}
        autoFocus
      />
      <div className="flex gap-2">
        <BivouacButton
          variant="secondary"
          icon={<X className="w-4 h-4" />}
          onClick={onCancel}
          disabled={isSubmitting}
          className="flex-1 py-2"
        >
          Annuler
        </BivouacButton>
        <BivouacButton
          variant="primary"
          icon={<Check className="w-4 h-4" />}
          onClick={() => onConfirm(name.trim())}
          disabled={isSubmitting || !name.trim()}
          className="flex-1 py-2"
        >
          {isSubmitting ? 'Enregistrement…' : 'Enregistrer'}
        </BivouacButton>
      </div>
    </div>
  );
}
