import React, { useState, useRef, useEffect } from 'react';
import { X, Check } from 'lucide-react';
import { BivouacButton } from './ui/bivouac-button';

interface Point {
  x: number; // normalized 0..1, relative to the image
  y: number; // normalized 0..1, relative to the image
}

interface PhotoAnnotationToolProps {
  imageUrl: string;
  onSave: (annotatedImageUrl: string) => void;
  onCancel: () => void;
}

const DEFAULT_POINTS: Point[] = [
  { x: 0.35, y: 0.35 },
  { x: 0.65, y: 0.35 },
  { x: 0.65, y: 0.65 },
  { x: 0.35, y: 0.65 },
];

const HANDLE_RADIUS = 8;
const MIDPOINT_RADIUS = 6;

export function PhotoAnnotationTool({ imageUrl, onSave, onCancel }: PhotoAnnotationToolProps) {
  const [points, setPoints] = useState<Point[]>(DEFAULT_POINTS);
  const [gray, setGray] = useState(128);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const dragIndexRef = useRef<number | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setContainerSize({ width: entry.contentRect.width, height: entry.contentRect.height });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
  };

  // The container box does not always match the photo's aspect ratio (e.g. when
  // max-height clamps it), so the <img> (object-contain) ends up letterboxed inside
  // it. Compute the actual displayed image rect so points map to the real photo,
  // not to the full (possibly letterboxed) container.
  const getImageRect = () => {
    const { width: cw, height: ch } = containerSize;
    const { width: nw, height: nh } = naturalSize;
    if (!cw || !ch || !nw || !nh) {
      return { width: cw, height: ch, offsetX: 0, offsetY: 0 };
    }
    const scale = Math.min(cw / nw, ch / nh);
    const width = nw * scale;
    const height = nh * scale;
    return { width, height, offsetX: (cw - width) / 2, offsetY: (ch - height) / 2 };
  };

  const clientToNormalized = (clientX: number, clientY: number): Point => {
    const rect = containerRef.current!.getBoundingClientRect();
    const imageRect = getImageRect();
    const x = imageRect.width
      ? Math.min(1, Math.max(0, (clientX - rect.left - imageRect.offsetX) / imageRect.width))
      : 0;
    const y = imageRect.height
      ? Math.min(1, Math.max(0, (clientY - rect.top - imageRect.offsetY) / imageRect.height))
      : 0;
    return { x, y };
  };

  const handleVertexPointerDown = (index: number) => (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    dragIndexRef.current = index;
  };

  const handleMidpointPointerDown = (index: number) => (e: React.PointerEvent) => {
    e.stopPropagation();
    const a = points[index];
    const b = points[(index + 1) % points.length];
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const newPoints = [...points];
    newPoints.splice(index + 1, 0, mid);
    setPoints(newPoints);
    dragIndexRef.current = index + 1;
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (dragIndexRef.current === null) return;
    const normalized = clientToNormalized(e.clientX, e.clientY);
    const index = dragIndexRef.current;
    setPoints((prev) => prev.map((p, i) => (i === index ? normalized : p)));
  };

  const handlePointerUp = () => {
    dragIndexRef.current = null;
  };

  const handleSave = () => {
    if (!naturalSize.width || !naturalSize.height) return;
    const canvas = document.createElement('canvas');
    canvas.width = naturalSize.width;
    canvas.height = naturalSize.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, naturalSize.width, naturalSize.height);
      ctx.beginPath();
      points.forEach((p, i) => {
        const px = p.x * naturalSize.width;
        const py = p.y * naturalSize.height;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.closePath();
      ctx.fillStyle = `rgba(${gray}, ${gray}, ${gray}, 0.1)`;
      ctx.fill();
      ctx.strokeStyle = `rgb(${gray}, ${gray}, ${gray})`;
      const displayedImageWidth = getImageRect().width;
      ctx.lineWidth = displayedImageWidth ? Math.max(2, (naturalSize.width / displayedImageWidth) * 2) : 2;
      ctx.stroke();
      onSave(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.src = imageUrl;
  };

  const imageRect = getImageRect();

  const pointsAttr = points
    .map((p) => `${imageRect.offsetX + p.x * imageRect.width},${imageRect.offsetY + p.y * imageRect.height}`)
    .join(' ');

  return (
    <div className="fixed inset-0 bg-black z-[2000] flex flex-col">
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 bg-black/80">
        <h2 className="text-white font-semibold text-base">Annoter la photo</h2>
        <button
          onClick={onCancel}
          className="p-1.5 hover:bg-white/10 rounded-full transition-colors"
          aria-label="Annuler l'annotation"
        >
          <X className="w-5 h-5 text-white" />
        </button>
      </div>

      <div className="flex-1 min-h-0 flex flex-col md:flex-row items-center justify-center gap-3 p-4 overflow-hidden">
        <div
          ref={containerRef}
          className="relative touch-none select-none"
          style={{
            aspectRatio: naturalSize.width && naturalSize.height ? `${naturalSize.width} / ${naturalSize.height}` : undefined,
            width: '100%',
            maxHeight: '100%',
          }}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          <img
            src={imageUrl}
            onLoad={handleImageLoad}
            alt="Photo à annoter"
            className="absolute inset-0 w-full h-full object-contain pointer-events-none"
            draggable={false}
          />
          {containerSize.width > 0 && (
            <svg
              className="absolute inset-0 w-full h-full"
              width={containerSize.width}
              height={containerSize.height}
              viewBox={`0 0 ${containerSize.width} ${containerSize.height}`}
            >
              <polygon
                points={pointsAttr}
                fill={`rgba(${gray}, ${gray}, ${gray}, 0.1)`}
                stroke={`rgb(${gray}, ${gray}, ${gray})`}
                strokeWidth={2}
              />
              {points.map((p, i) => {
                const b = points[(i + 1) % points.length];
                const mid = { x: (p.x + b.x) / 2, y: (p.y + b.y) / 2 };
                return (
                  <circle
                    key={`mid-${i}`}
                    cx={imageRect.offsetX + mid.x * imageRect.width}
                    cy={imageRect.offsetY + mid.y * imageRect.height}
                    r={MIDPOINT_RADIUS}
                    fill="#ffffff"
                    stroke="#1f2937"
                    strokeWidth={2}
                    opacity={0.4}
                    onPointerDown={handleMidpointPointerDown(i)}
                    style={{ cursor: 'copy' }}
                  />
                );
              })}
              {points.map((p, i) => (
                <circle
                  key={`pt-${i}`}
                  cx={imageRect.offsetX + p.x * imageRect.width}
                  cy={imageRect.offsetY + p.y * imageRect.height}
                  r={HANDLE_RADIUS}
                  fill="#ffffff"
                  stroke="#1f2937"
                  strokeWidth={2}
                  opacity={1}
                  onPointerDown={handleVertexPointerDown(i)}
                  style={{ cursor: 'grab' }}
                />
              ))}
            </svg>
          )}
        </div>

        <div className="flex-shrink-0 flex flex-row md:flex-col items-center gap-3 bg-white/10 rounded-xl p-3 w-full md:w-auto">
          <div
            className="w-8 h-8 rounded-full border-2 border-white flex-shrink-0"
            style={{ backgroundColor: `rgb(${gray}, ${gray}, ${gray})` }}
          />
          <input
            type="range"
            min={0}
            max={255}
            value={gray}
            onChange={(e) => setGray(Number(e.target.value))}
            className="flex-1 md:w-32"
            aria-label="Nuance de gris"
          />
        </div>
      </div>

      <div className="flex-shrink-0 px-4 py-3 bg-black/80">
        <BivouacButton
          type="button"
          variant="primary"
          icon={<Check className="w-4 h-4" />}
          onClick={handleSave}
          className="w-full py-2.5"
        >
          Sauvegarder les modifications
        </BivouacButton>
      </div>
    </div>
  );
}
