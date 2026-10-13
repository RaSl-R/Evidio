import React from 'react';
import { AlertTriangle, Download, ImageOff, X } from 'lucide-react';
import { formatBytes } from '../utils/storage';

interface ExportWarningModalProps {
  totalPhotoBytes: number;
  isFullBackup: boolean;
  onConfirm: (excludePhotos: boolean) => void;
  onCancel: () => void;
}

export const ExportWarningModal: React.FC<ExportWarningModalProps> = ({
  totalPhotoBytes,
  isFullBackup,
  onConfirm,
  onCancel,
}) => {
  const isOver100MB = totalPhotoBytes > 100 * 1024 * 1024;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-warning-title"
    >
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <h2 id="export-warning-title" className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
              Upozornění na velikost exportu
            </h2>
          </div>
          <button
            onClick={onCancel}
            className="p-1.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
            aria-label="Zavřít"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">
            {isFullBackup ? 'Záloha' : 'Export'} obsahuje přílohy (fotografie a dokumenty) o celkové velikosti{' '}
            <strong className="text-neutral-900 dark:text-neutral-100 font-semibold">
              {formatBytes(totalPhotoBytes)}
            </strong>
            .
          </p>

          {isOver100MB ? (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-lg text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
              Velikost příloh přesahuje 100 MB. Při kódování do souboru JSON může dojít k vysoké zátěži paměti prohlížeče. Doporučujeme exportovat zálohu bez fotek a dokumentů nebo uvolnit místo.
            </div>
          ) : (
            <p className="text-xs text-neutral-500 leading-relaxed">
              Export většího množství příloh může trvat několik sekund v závislosti na výkonu zařízení.
            </p>
          )}
        </div>

        <div className="px-5 py-3.5 bg-neutral-50 dark:bg-neutral-850 border-t border-neutral-200 dark:border-neutral-800 flex flex-col sm:flex-row gap-2 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-300 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-750 transition order-3 sm:order-1"
          >
            Zrušit
          </button>

          <button
            onClick={() => onConfirm(true)}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-200 bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-700 transition order-2"
          >
            <ImageOff className="w-4 h-4 text-neutral-500" />
            Exportovat bez fotek a dokumentů
          </button>

          <button
            onClick={() => onConfirm(false)}
            className={`inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg text-white transition order-1 sm:order-3 ${
              isOver100MB
                ? 'bg-neutral-800 hover:bg-neutral-700'
                : 'bg-emerald-600 hover:bg-emerald-500'
            }`}
          >
            <Download className="w-4 h-4" />
            Pokračovat s přílohami
          </button>
        </div>
      </div>
    </div>
  );
};
