import React from 'react';
import { Trash2, Star, Eye } from 'lucide-react';
import { useAttachmentUrl } from '../hooks/useAttachmentUrl';

interface ItemPhotoThumbnailProps {
  id: string;
  fileName: string;
  blob?: Blob | null;
  sizeBytes: number;
  isMain: boolean;
  onSetMain?: () => void;
  onDelete?: () => void;
  onClick?: () => void;
}

export const ItemPhotoThumbnail: React.FC<ItemPhotoThumbnailProps> = ({
  fileName,
  blob,
  sizeBytes,
  isMain,
  onSetMain,
  onDelete,
  onClick,
}) => {
  const url = useAttachmentUrl(blob);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div
      onClick={onClick}
      className={`group relative aspect-square rounded-xl overflow-hidden border bg-slate-100 flex items-center justify-center transition-all ${
        isMain
          ? 'ring-2 ring-emerald-500 border-emerald-500 shadow-xs'
          : 'border-slate-200 hover:border-indigo-300'
      } ${onClick ? 'cursor-pointer' : ''}`}
    >
      {url ? (
        <img
          src={url}
          alt={fileName}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
        />
      ) : (
        <div className="text-slate-400 text-xs">Načítání...</div>
      )}

      {/* Main photo badge */}
      {isMain && (
        <div className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded-md bg-emerald-600/90 text-white text-[10px] font-bold shadow-xs flex items-center gap-1 backdrop-blur-xs">
          <Star className="w-3 h-3 fill-white" />
          <span>Hlavní</span>
        </div>
      )}

      {/* Hover action overlay */}
      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-white/90 truncate max-w-[70px] drop-shadow-xs">
            {formatSize(sizeBytes)}
          </span>

          {onDelete && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="p-1 rounded bg-black/60 hover:bg-red-600 text-white transition-colors cursor-pointer"
              title="Smazat fotografii"
              aria-label="Smazat fotografii"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center justify-center gap-1">
          {onClick && (
            <button
              type="button"
              onClick={onClick}
              className="p-1 rounded bg-black/60 hover:bg-black/80 text-white transition-colors cursor-pointer"
              title="Zobrazit na celou obrazovku"
            >
              <Eye className="w-3.5 h-3.5" />
            </button>
          )}

          {!isMain && onSetMain && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSetMain();
              }}
              className="px-2 py-1 rounded bg-black/60 hover:bg-emerald-600 text-white text-[10px] font-semibold transition-colors cursor-pointer flex items-center gap-1"
              title="Nastavit jako hlavní fotografii"
            >
              <Star className="w-3 h-3" />
              <span>Nastavit jako hlavní</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
