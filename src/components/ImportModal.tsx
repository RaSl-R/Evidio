import React, { useState, useRef } from 'react';
import {
  Upload,
  FileCheck,
  AlertCircle,
  Copy,
  RotateCcw,
  X,
  Layers,
  Package,
  Calendar,
  Tag as TagIcon,
  Paperclip,
  CheckCircle2,
  FolderKanban,
  Sliders,
} from 'lucide-react';
import { EvidioPackage } from '../types';
import {
  validateEvidioPackage,
  getImportPreview,
  prepareImportCopy,
  prepareImportRestore,
  ImportPreviewInfo,
  ValidationResult,
} from '../utils/import';
import {
  getExistingDbSnapshot,
  executeImportTransaction,
  ensureDefaultCollectionGroup,
} from '../db';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: (primaryCollectionId: string | null) => void;
}

export const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  onClose,
  onImportSuccess,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [previewInfo, setPreviewInfo] = useState<ImportPreviewInfo | null>(null);
  const [importMode, setImportMode] = useState<'copy' | 'restore'>('copy');
  const [isProcessing, setIsProcessing] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccessMessage, setImportSuccessMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleReset = () => {
    setSelectedFile(null);
    setValidationResult(null);
    setPreviewInfo(null);
    setImportMode('copy');
    setIsProcessing(false);
    setImportError(null);
    setImportSuccessMessage(null);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const processFile = (file: File) => {
    setSelectedFile(file);
    setImportError(null);
    setImportSuccessMessage(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = JSON.parse(text);
        const validated = validateEvidioPackage(parsed);
        setValidationResult(validated);

        if (validated.isValid && validated.parsedPackage) {
          const preview = getImportPreview(validated.parsedPackage, file.size);
          setPreviewInfo(preview);
        } else {
          setPreviewInfo(null);
        }
      } catch (err: any) {
        setValidationResult({
          isValid: false,
          errors: ['Soubor není platný JSON: ' + (err?.message || 'Chyba při čtení.')],
        });
        setPreviewInfo(null);
      }
    };
    reader.onerror = () => {
      setValidationResult({
        isValid: false,
        errors: ['Nepodařilo se přečíst soubor ze zařízení.'],
      });
      setPreviewInfo(null);
    };
    reader.readAsText(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleExecuteImport = async () => {
    if (!validationResult?.isValid || !validationResult.parsedPackage) return;

    setIsProcessing(true);
    setImportError(null);

    try {
      const snapshot = await getExistingDbSnapshot();
      const defaultGroup = await ensureDefaultCollectionGroup();
      const pkg = validationResult.parsedPackage;

      // Prepare data completely BEFORE starting Dexie transaction
      const preparedData =
        importMode === 'copy'
          ? prepareImportCopy(
              pkg,
              snapshot.collections,
              snapshot.groups,
              defaultGroup.id
            )
          : prepareImportRestore(pkg, {
              ...snapshot,
              defaultGroupId: defaultGroup.id,
            });

      // Write in ONE atomic Dexie transaction
      await executeImportTransaction(preparedData);

      const countMsg = `Import dokončen: ${preparedData.collectionsToPut.length} sekcí, ${preparedData.itemsToPut.length} položek, ${preparedData.eventsToPut.length} událostí.`;
      setImportSuccessMessage(countMsg);

      setTimeout(() => {
        onImportSuccess(preparedData.primaryCollectionId);
        handleClose();
      }, 1200);
    } catch (err: any) {
      setImportError(
        'Při importu došlo k chybě a všechny změny byly vráceny: ' +
          (err?.message || 'Neznámá chyba transakce.')
      );
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-lg text-slate-900">
                Import balíčku a obnova dat
              </h3>
              <p className="text-xs text-slate-500">
                Podporuje formát <code>evidio_package</code> verze 1
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 grow">
          {importSuccessMessage && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center gap-3 text-emerald-800 text-sm">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{importSuccessMessage}</span>
            </div>
          )}

          {importError && (
            <div className="p-4 rounded-2xl bg-red-50 border border-red-200 flex items-start gap-3 text-red-800 text-sm">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Chyba importu:</p>
                <p className="text-xs mt-0.5">{importError}</p>
              </div>
            </div>
          )}

          {/* Drag & Drop Zone */}
          {!selectedFile && (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-3xl p-8 text-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-indigo-500 bg-indigo-50/60 scale-[1.01]'
                  : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50/60'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 mx-auto flex items-center justify-center mb-3">
                <Upload className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-sm text-slate-800 mb-1">
                Přetáhněte sem soubor zálohy JSON nebo klikněte pro výběr
              </h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Vyberte exportovaný soubor sekce nebo kompletní zálohu Evidio (<code>.json</code>).
              </p>
            </div>
          )}

          {/* File Selected & Validation Summary */}
          {selectedFile && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-xl bg-white border border-slate-200 text-indigo-600 shrink-0">
                    <FileCheck className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-800 truncate">
                      {selectedFile.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {(selectedFile.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
                >
                  Změnit soubor
                </button>
              </div>

              {/* Validation errors */}
              {validationResult && !validationResult.isValid && (
                <div className="p-4 rounded-2xl bg-red-50 border border-red-200 space-y-2">
                  <div className="flex items-center gap-2 text-red-800 font-bold text-xs uppercase tracking-wide">
                    <AlertCircle className="w-4 h-4 text-red-600" />
                    <span>Import nelze provést — nalezeny chyby ve struktuře:</span>
                  </div>
                  <ul className="list-disc list-inside text-xs text-red-700 space-y-1 pl-1">
                    {validationResult.errors.map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Package Content Preview */}
              {previewInfo && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Obsah nalezený v balíčku
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-2.5">
                        <Layers className="w-4 h-4 text-indigo-600 shrink-0" />
                        <div>
                          <div className="text-base font-extrabold text-slate-900 leading-none">
                            {previewInfo.sectionsCount}
                          </div>
                          <div className="text-[11px] text-slate-500 font-medium">Sekce</div>
                        </div>
                      </div>

                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-2.5">
                        <FolderKanban className="w-4 h-4 text-violet-600 shrink-0" />
                        <div>
                          <div className="text-base font-extrabold text-slate-900 leading-none">
                            {previewInfo.categoriesCount}
                          </div>
                          <div className="text-[11px] text-slate-500 font-medium">Kategorie</div>
                        </div>
                      </div>

                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-2.5">
                        <Package className="w-4 h-4 text-emerald-600 shrink-0" />
                        <div>
                          <div className="text-base font-extrabold text-slate-900 leading-none">
                            {previewInfo.itemsCount}
                          </div>
                          <div className="text-[11px] text-slate-500 font-medium">Položky</div>
                        </div>
                      </div>

                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-2.5">
                        <Calendar className="w-4 h-4 text-amber-600 shrink-0" />
                        <div>
                          <div className="text-base font-extrabold text-slate-900 leading-none">
                            {previewInfo.eventsCount}
                          </div>
                          <div className="text-[11px] text-slate-500 font-medium">Události</div>
                        </div>
                      </div>

                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-2.5">
                        <Sliders className="w-4 h-4 text-sky-600 shrink-0" />
                        <div>
                          <div className="text-base font-extrabold text-slate-900 leading-none">
                            {previewInfo.fieldsCount}
                          </div>
                          <div className="text-[11px] text-slate-500 font-medium">Definice polí</div>
                        </div>
                      </div>

                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-2.5">
                        <TagIcon className="w-4 h-4 text-pink-600 shrink-0" />
                        <div>
                          <div className="text-base font-extrabold text-slate-900 leading-none">
                            {previewInfo.tagsCount}
                          </div>
                          <div className="text-[11px] text-slate-500 font-medium">Štítky</div>
                        </div>
                      </div>

                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-2.5">
                        <Paperclip className="w-4 h-4 text-indigo-600 shrink-0" />
                        <div>
                          <div className="text-base font-extrabold text-slate-900 leading-none">
                            {previewInfo.attachmentsCount}
                          </div>
                          <div className="text-[11px] text-slate-500 font-medium">Přílohy</div>
                        </div>
                      </div>

                      <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100 flex items-center gap-2.5">
                        <FileCheck className="w-4 h-4 text-indigo-600 shrink-0" />
                        <div>
                          <div className="text-base font-extrabold text-indigo-950 leading-none">
                            {previewInfo.totalSizeMB} MB
                          </div>
                          <div className="text-[11px] text-indigo-700 font-medium">Velikost dat</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Mode Selector */}
                  <div className="space-y-2.5 pt-2">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Způsob importu dat
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <label
                        className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                          importMode === 'copy'
                            ? 'border-indigo-600 bg-indigo-50/40 shadow-xs'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                              <Copy className="w-4 h-4 text-indigo-600" />
                              Importovat jako kopii
                            </span>
                            <input
                              type="radio"
                              name="importMode"
                              value="copy"
                              checked={importMode === 'copy'}
                              onChange={() => setImportMode('copy')}
                              className="text-indigo-600"
                            />
                          </div>
                          <p className="text-xs text-slate-500 leading-relaxed">
                            Vygeneruje nová unikátní ID pro všechny záznamy. Pokud sekce již existuje, vytvoří se nová s příponou „(kopie)“. Bezpečné pro sloučení bez přepsání existujících dat.
                          </p>
                        </div>
                        <div className="pt-2">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Doporučeno (výchozí)
                          </span>
                        </div>
                      </label>

                      <label
                        className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                          importMode === 'restore'
                            ? 'border-indigo-600 bg-indigo-50/40 shadow-xs'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                              <RotateCcw className="w-4 h-4 text-indigo-600" />
                              Obnovit ze zálohy
                            </span>
                            <input
                              type="radio"
                              name="importMode"
                              value="restore"
                              checked={importMode === 'restore'}
                              onChange={() => setImportMode('restore')}
                              className="text-indigo-600"
                            />
                          </div>
                          <p className="text-xs text-slate-500 leading-relaxed">
                            Zachová původní ID. Pro existující záznamy vyhrává novější datum úpravy (Last-Write-Wins). Místní záznamy, které v záloze nejsou, zůstanou zachovány.
                          </p>
                        </div>
                        <div className="pt-2">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                            Pro synchronizaci / obnovu
                          </span>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={handleClose}
            disabled={isProcessing}
            className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200/50 rounded-xl transition-colors cursor-pointer"
          >
            Zrušit
          </button>

          <button
            type="button"
            onClick={handleExecuteImport}
            disabled={!validationResult?.isValid || isProcessing}
            className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-xs cursor-pointer ${
              validationResult?.isValid && !isProcessing
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white hover:scale-[1.01]'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            {isProcessing ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Probíhá import...</span>
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                <span>Spustit import</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
