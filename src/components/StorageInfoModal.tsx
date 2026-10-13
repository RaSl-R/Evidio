import React, { useEffect, useState } from 'react';
import { X, HardDrive, Image as ImageIcon, Database, FileText } from 'lucide-react';
import { formatBytes, getStorageStats, StorageStats } from '../utils/storage';

interface StorageInfoModalProps {
  collectionId?: string;
  collectionName?: string;
  onClose: () => void;
}

export const StorageInfoModal: React.FC<StorageInfoModalProps> = ({
  collectionId,
  collectionName,
  onClose,
}) => {
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    getStorageStats(collectionId).then((res) => {
      if (mounted) {
        setStats(res);
        setLoading(false);
      }
    });
    return () => {
      mounted = false;
    };
  }, [collectionId]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="storage-modal-title"
    >
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <h2 id="storage-modal-title" className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
              Využití úložiště
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
            aria-label="Zavřít"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {loading ? (
            <div className="py-8 text-center text-sm text-neutral-500">
              Zjišťuji stav úložiště...
            </div>
          ) : stats ? (
            <>
              {collectionId && (
                <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-850/60 border border-neutral-200 dark:border-neutral-800 space-y-3">
                  <div className="text-xs font-bold text-neutral-600 dark:text-neutral-400 uppercase tracking-wide">
                    Sekce: {collectionName || 'Aktuální sekce'}
                  </div>

                  {/* Section Photos */}
                  <div className="flex items-center justify-between pt-1 border-t border-neutral-200/60 dark:border-neutral-750">
                    <div className="flex items-center gap-2">
                      <ImageIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-xs text-neutral-700 dark:text-neutral-300 font-medium">Fotografie</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                        {formatBytes(stats.sectionPhotoBytes)}
                      </span>
                      <span className="text-[11px] text-neutral-500 ml-1.5">
                        ({stats.sectionPhotoCount} {stats.sectionPhotoCount === 1 ? 'fotka' : stats.sectionPhotoCount < 5 ? 'fotky' : 'fotek'})
                      </span>
                    </div>
                  </div>

                  {/* Section Documents */}
                  <div className="flex items-center justify-between pt-1 border-t border-neutral-200/60 dark:border-neutral-750">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-red-500" />
                      <span className="text-xs text-neutral-700 dark:text-neutral-300 font-medium">Dokumenty (PDF)</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                        {formatBytes(stats.sectionDocBytes)}
                      </span>
                      <span className="text-[11px] text-neutral-500 ml-1.5">
                        ({stats.sectionDocCount} {stats.sectionDocCount === 1 ? 'dokument' : stats.sectionDocCount < 5 ? 'dokumenty' : 'dokumentů'})
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* All files in App */}
              <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-850/60 border border-neutral-200 dark:border-neutral-800 space-y-3">
                <div className="text-xs font-bold text-neutral-600 dark:text-neutral-400 uppercase tracking-wide">
                  Vše v aplikaci
                </div>

                {/* All Photos */}
                <div className="flex items-center justify-between pt-1 border-t border-neutral-200/60 dark:border-neutral-750">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-xs text-neutral-700 dark:text-neutral-300 font-medium">Fotografie celkem</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                      {formatBytes(stats.totalPhotoBytes)}
                    </span>
                    <span className="text-[11px] text-neutral-500 ml-1.5">
                      ({stats.totalPhotoCount} {stats.totalPhotoCount === 1 ? 'fotka' : stats.totalPhotoCount < 5 ? 'fotky' : 'fotek'})
                    </span>
                  </div>
                </div>

                {/* All Documents */}
                <div className="flex items-center justify-between pt-1 border-t border-neutral-200/60 dark:border-neutral-750">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-red-500" />
                    <span className="text-xs text-neutral-700 dark:text-neutral-300 font-medium">Dokumenty celkem</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                      {formatBytes(stats.totalDocBytes)}
                    </span>
                    <span className="text-[11px] text-neutral-500 ml-1.5">
                      ({stats.totalDocCount} {stats.totalDocCount === 1 ? 'dokument' : stats.totalDocCount < 5 ? 'dokumenty' : 'dokumentů'})
                    </span>
                  </div>
                </div>
              </div>

              {stats.browserUsageBytes !== undefined && (
                <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-850/60 border border-neutral-200 dark:border-neutral-800">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-neutral-500 uppercase tracking-wide">
                      Odhad IndexedDB prohlížeče
                    </span>
                  </div>
                  <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                    {formatBytes(stats.browserUsageBytes)}
                    {stats.browserQuotaBytes ? (
                      <span className="text-xs font-normal text-neutral-500 ml-1.5">
                        z celkové kvóty {formatBytes(stats.browserQuotaBytes)}
                      </span>
                    ) : null}
                  </div>
                  {stats.browserQuotaBytes && stats.browserQuotaBytes > 0 && (
                    <div className="mt-2 w-full bg-neutral-200 dark:bg-neutral-700 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-emerald-500 h-full rounded-full transition-all"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.max(
                              1,
                              (stats.browserUsageBytes / stats.browserQuotaBytes) * 100
                            )
                          )}%`,
                        }}
                      />
                    </div>
                  )}
                </div>
              )}
            </>
          ) : null}

          <div className="text-xs text-neutral-500 leading-relaxed pt-1">
            Přílohy (fotografie a dokumenty) jsou uloženy lokálně ve vašem prohlížeči (IndexedDB). Pro zachování dat nezapomeňte pravidelně exportovat zálohu.
          </div>
        </div>

        <div className="px-5 py-3.5 bg-neutral-50 dark:bg-neutral-850 border-t border-neutral-200 dark:border-neutral-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-200 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-750 transition"
          >
            Zavřít
          </button>
        </div>
      </div>
    </div>
  );
};
