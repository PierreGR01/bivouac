import { useState } from 'react';
import { X, RotateCcw, Pencil, Check, Loader2 } from 'lucide-react';
import { BivouacButton } from './ui/bivouac-button';
import { PhotoAnnotationTool } from './PhotoAnnotationTool';

interface PhotoCaptureModalProps {
  imageUrl: string;
  onConfirm: (finalImageUrl: string, caption: string) => void;
  onRetake: () => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function PhotoCaptureModal({ imageUrl, onConfirm, onRetake, onCancel, isSubmitting = false }: PhotoCaptureModalProps) {
  const [mode, setMode] = useState<'preview' | 'annotate'>('preview');
  const [currentImageUrl, setCurrentImageUrl] = useState(imageUrl);
  const [caption, setCaption] = useState('');

  if (mode === 'annotate') {
    return (
      <PhotoAnnotationTool
        imageUrl={currentImageUrl}
        onSave={(annotated) => {
          setCurrentImageUrl(annotated);
          setMode('preview');
        }}
        onCancel={() => setMode('preview')}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-black z-[2000] flex flex-col">
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 bg-black/80">
        <h2 className="text-white font-semibold text-base">Aperçu de la photo</h2>
        <button
          onClick={onCancel}
          disabled={isSubmitting}
          className="p-1.5 hover:bg-white/10 rounded-full transition-colors disabled:opacity-50"
          aria-label="Fermer"
        >
          <X className="w-5 h-5 text-white" />
        </button>
      </div>

      <div className="flex-1 min-h-0 flex items-center justify-center p-4">
        <img src={currentImageUrl} alt="Aperçu de la photo" className="max-w-full max-h-full object-contain rounded-lg" />
      </div>

      <div className="flex-shrink-0 px-4 py-3 bg-black/80 flex flex-col gap-2">
        <input
          type="text"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Légende de la photo (optionnel)"
          maxLength={140}
          disabled={isSubmitting}
          className="w-full px-3 py-2 rounded-lg border border-white/20 bg-white/95 text-sm text-gray-800 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
        />
        <div className="flex gap-2">
          <BivouacButton
            type="button"
            variant="secondary"
            icon={<RotateCcw className="w-4 h-4" />}
            onClick={onRetake}
            disabled={isSubmitting}
            className="flex-1"
          >
            Reprendre
          </BivouacButton>
          <BivouacButton
            type="button"
            variant="secondary"
            icon={<Pencil className="w-4 h-4" />}
            onClick={() => setMode('annotate')}
            disabled={isSubmitting}
            className="flex-1"
          >
            Annoter
          </BivouacButton>
        </div>
        <BivouacButton
          type="button"
          variant="primary"
          icon={isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          onClick={() => onConfirm(currentImageUrl, caption)}
          disabled={isSubmitting}
          className="w-full py-2.5"
        >
          {isSubmitting ? 'Envoi...' : 'Valider'}
        </BivouacButton>
      </div>
    </div>
  );
}
