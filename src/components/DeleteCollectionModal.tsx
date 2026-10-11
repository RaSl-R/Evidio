import React, { useState, useEffect } from 'react';
import { Collection } from '../types';
import { getCollectionStats, deleteCollectionCascade } from '../db';
import { exportCollectionPackage } from '../utils/export';
import { AlertTriangle, Download, Trash2, X } from 'lucide-react';

interface DeleteCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  collection: Collection | null;
  onDeleted: () => void;
}

export const DeleteCollectionModal: React.FC<DeleteCollectionModalProps> = ({
  isOpen,
  onClose,
  collection,
  onDeleted,
}) => {
  const [stats, setStats] = useState<{
    itemCount: number;
    fieldCount: number;
    tagCount: number;
    eventCount: number;
    attachmentCount: number;
  } | null>(null);

  const [hasExported, setHasExported] = useState(false);
  const [confirmedCheck, setConfirmedCheck] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (collection && isOpen) {
      setConfirmedCheck(false);
      setHasExported(false);
      setError(null);
      getCollectionStats(collection.id).then(setStats);
    }
  }, [collection, isOpen]);

  if (!isOpen || !collection) return null;

  const handleExportBackup = async () => {
    try {
      await exportCollectionPackage(collection.id);
      setHasExported(true);
    } catch (err: any) {
      setError(err?.message || 'Chyba při exportu zálohy');
    }
  };

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      setError(null);
      await deleteCollectionCascade(collection.id);
      onDeleted();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Chyba při mazání sekce');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-red-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-red-100 bg-red-50/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-red-100 text-red-600">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-lg text-red-950">
              Smazat sekci „{collection.name}“
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-600 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {error && (
            <div className="p-3 text-sm text-red-700 bg-red-50 rounded-xl border border-red-200">
              {error}
            </div>
          )}

          <p className="text-sm text-slate-600 leading-relaxed">
            Tato akce je <strong>nevratná</strong>. Celá sekce a všechna její data budou
            okamžitě smazána z lokálního úložiště prohlížeče v jedné atomické transakci:
          </p>

          {/* Counts breakdown */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
            <div className="p-2 bg-white rounded-lg border border-slate-100 shadow-2xs">
              <span className="block text-slate-600">Položky</span>
              <span className="text-base font-bold text-slate-900">
                {stats ? stats.itemCount : '...'}
              </span>
            </div>
            <div className="p-2 bg-white rounded-lg border border-slate-100 shadow-2xs">
              <span className="block text-slate-600">Vlastní vlastnosti</span>
              <span className="text-base font-bold text-slate-900">
                {stats ? stats.fieldCount : '...'}
              </span>
            </div>
            <div className="p-2 bg-white rounded-lg border border-slate-100 shadow-2xs">
              <span className="block text-slate-600">Události</span>
              <span className="text-base font-bold text-slate-900">
                {stats ? stats.eventCount : '...'}
              </span>
            </div>
          </div>

          {/* Backup recommendation */}
          <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-xs text-amber-900">
              <strong className="block text-sm font-semibold mb-0.5">
                Doporučujeme stáhnout zálohu
              </strong>
              Před smazáním si můžete stáhnout kompletní JSON balíček pro případné obnovení.
            </div>
            <button
              type="button"
              onClick={handleExportBackup}
              className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors ${
                hasExported
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                  : 'bg-white text-slate-800 border-amber-300 hover:bg-amber-100/50 shadow-xs'
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              {hasExported ? 'Záloha stažena ✓' : 'Stáhnout zálohu'}
            </button>
          </div>

          {/* Confirmation Checkbox */}
          <label className="flex items-start gap-2.5 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={confirmedCheck}
              onChange={(e) => setConfirmedCheck(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
            />
            <span className="text-xs text-slate-700 leading-normal">
              Potvrzuji, že chci nenávratně odstranit tuto sekci a všechna její data.
            </span>
          </label>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isDeleting}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Zrušit
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={!confirmedCheck || isDeleting}
              className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-md shadow-red-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Trash2 className="w-4 h-4" />
              {isDeleting ? 'Probíhá mazání...' : 'Smazat sekci'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
