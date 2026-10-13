import React, { useState, useEffect, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { Attachment } from '../types';
import { useAttachmentUrl } from '../hooks/useAttachmentUrl';

interface FullscreenPhotoViewerProps {
  attachments: Attachment[];
  initialIndex?: number;
  onClose: () => void;
}

export const FullscreenPhotoViewer: React.FC<FullscreenPhotoViewerProps> = ({
  attachments,
  initialIndex = 0,
  onClose,
}) => {
  const [currentIndex, setCurrentIndex] = useState(
    Math.max(0, Math.min(initialIndex, attachments.length - 1))
  );

  const currentAttachment = attachments[currentIndex];
  const photoUrl = useAttachmentUrl(currentAttachment?.blob);

  // Touch swipe handling
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : attachments.length - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < attachments.length - 1 ? prev + 1 : 0));
  };

  // Keyboard navigation & Esc key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [attachments.length]);

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartXRef.current = touch.clientX;
    touchStartYRef.current = touch.clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null || touchStartYRef.current === null) return;

    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartXRef.current;
    const deltaY = touch.clientY - touchStartYRef.current;

    // Only swipe if mostly horizontal and past threshold
    if (Math.abs(deltaX) > 40 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2) {
      if (deltaX > 0) {
        handlePrev();
      } else {
        handleNext();
      }
    }

    touchStartXRef.current = null;
    touchStartYRef.current = null;
  };

  if (!currentAttachment) return null;

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/95 text-white select-none"
      role="dialog"
      aria-modal="true"
      aria-label="Prohlížeč fotografií"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/40 backdrop-blur border-b border-neutral-800">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-sm font-medium text-neutral-300">
            {currentIndex + 1} / {attachments.length}
          </span>
          <span className="text-neutral-500">·</span>
          <span className="text-sm text-neutral-400 truncate max-w-[200px] sm:max-w-md">
            {currentAttachment.file_name}
          </span>
          <span className="hidden sm:inline text-xs text-neutral-500">
            ({formatSize(currentAttachment.size_bytes)})
          </span>
        </div>

        <div className="flex items-center gap-2">
          {photoUrl && (
            <a
              href={photoUrl}
              download={currentAttachment.file_name}
              className="p-2 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors"
              title="Stáhnout fotografii"
              aria-label="Stáhnout fotografii"
            >
              <Download className="w-5 h-5" />
            </a>
          )}
          <button
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors"
            title="Zavřít (Esc)"
            aria-label="Zavřít"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Main viewer stage */}
      <div className="relative flex-1 flex items-center justify-center p-4 min-h-0 overflow-hidden">
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={currentAttachment.file_name}
            className="max-h-full max-w-full object-contain rounded select-none shadow-2xl transition-all duration-150"
            draggable={false}
          />
        ) : (
          <div className="text-neutral-500 text-sm">Načítání fotografie...</div>
        )}

        {/* Previous button */}
        {attachments.length > 1 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handlePrev();
            }}
            className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-neutral-900/80 hover:bg-neutral-850 text-white hover:scale-105 active:scale-95 shadow-lg border border-neutral-700 transition"
            aria-label="Předchozí fotografie"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        {/* Next button */}
        {attachments.length > 1 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleNext();
            }}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-neutral-900/80 hover:bg-neutral-850 text-white hover:scale-105 active:scale-95 shadow-lg border border-neutral-700 transition"
            aria-label="Další fotografie"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* Bottom thumbnails strip if multiple photos */}
      {attachments.length > 1 && (
        <div className="flex items-center justify-center gap-2 p-3 bg-black/60 overflow-x-auto border-t border-neutral-800">
          {attachments.map((att, idx) => (
            <button
              key={att.id}
              onClick={() => setCurrentIndex(idx)}
              className={`relative flex-shrink-0 w-12 h-12 rounded border-2 overflow-hidden transition ${
                idx === currentIndex
                  ? 'border-emerald-500 ring-2 ring-emerald-500/30'
                  : 'border-transparent opacity-50 hover:opacity-100'
              }`}
              title={att.file_name}
            >
              <ThumbnailImage attachment={att} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const ThumbnailImage: React.FC<{ attachment: Attachment }> = ({ attachment }) => {
  const url = useAttachmentUrl(attachment.blob);
  if (!url) return <div className="w-full h-full bg-neutral-800" />;
  return <img src={url} alt={attachment.file_name} className="w-full h-full object-cover" />;
};
