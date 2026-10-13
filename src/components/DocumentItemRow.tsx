import React from 'react';
import { Attachment } from '../types';
import { FileText, ExternalLink, Download, Edit2, Trash2 } from 'lucide-react';
import { formatBytes } from '../utils/storage';
import { openPdfDocument, downloadPdfDocument } from '../utils/attachments';

interface DocumentItemRowProps {
  document: Attachment;
  onRename: (doc: Attachment) => void;
  onDelete: (doc: Attachment) => void;
}

export const DocumentItemRow: React.FC<DocumentItemRowProps> = ({
  document,
  onRename,
  onDelete,
}) => {
  const formattedDate = React.useMemo(() => {
    try {
      return new Date(document.created_at).toLocaleDateString('cs-CZ', {
        day: 'numeric',
        month: 'numeric',
        year: 'numeric',
      });
    } catch {
      return '';
    }
  }, [document.created_at]);

  const handleOpen = () => {
    if (document.blob) {
      openPdfDocument(document.blob);
    }
  };

  const handleDownload = () => {
    if (document.blob) {
      downloadPdfDocument(document.blob, document.file_name);
    }
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-white rounded-xl border border-slate-200/80 shadow-2xs gap-2.5 hover:border-slate-300 transition-colors">
      {/* File metadata */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-lg bg-red-50 border border-red-200 flex items-center justify-center shrink-0 text-red-600">
          <FileText className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          {/* File name as strictly plain text */}
          <div
            className="text-xs font-bold text-slate-800 truncate"
            title={document.file_name}
          >
            {document.file_name}
          </div>
          <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
            <span>{formatBytes(document.size_bytes)}</span>
            <span className="text-slate-300 select-none">·</span>
            <span>Přidáno {formattedDate}</span>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-1 shrink-0 self-end sm:self-center">
        <button
          type="button"
          onClick={handleOpen}
          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 rounded-lg transition-colors cursor-pointer"
          title="Otevřít v novém okně"
        >
          <ExternalLink className="w-3 h-3" />
          <span>Otevřít</span>
        </button>

        <button
          type="button"
          onClick={handleDownload}
          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 rounded-lg transition-colors cursor-pointer"
          title="Stáhnout do počítače"
        >
          <Download className="w-3 h-3" />
          <span>Stáhnout</span>
        </button>

        <button
          type="button"
          onClick={() => onRename(document)}
          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-slate-700 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 rounded-lg transition-colors cursor-pointer"
          title="Přejmenovat soubor"
        >
          <Edit2 className="w-3 h-3" />
          <span className="sr-only sm:not-sr-only">Přejmenovat</span>
        </button>

        <button
          type="button"
          onClick={() => onDelete(document)}
          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-slate-700 hover:text-red-600 hover:bg-red-50 border border-slate-200 rounded-lg transition-colors cursor-pointer"
          title="Smazat soubor"
        >
          <Trash2 className="w-3 h-3 text-red-500" />
          <span className="sr-only sm:not-sr-only text-red-600">Smazat</span>
        </button>
      </div>
    </div>
  );
};
