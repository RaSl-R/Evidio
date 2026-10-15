import React, { useState, useMemo } from 'react';
import { Item, FieldDefinition, ItemEvent, Attachment, Tag } from '../types';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { processImageFile } from '../utils/image';
import { getTagColorOption } from '../utils/tagColors';
import {
  validatePdfFile,
  MAX_DOCUMENTS_PER_TARGET,
} from '../utils/attachments';
import { ItemPhotoThumbnail } from './ItemPhotoThumbnail';
import { FullscreenPhotoViewer } from './FullscreenPhotoViewer';
import { DocumentItemRow } from './DocumentItemRow';
import { RenameDocumentModal } from './RenameDocumentModal';
import {
  X,
  Edit2,
  Trash2,
  Plus,
  Clock,
  Calendar,
  Layers,
  ChevronRight,
  ChevronDown,
  History,
  Archive,
  Image as ImageIcon,
  FileText,
  Upload,
  Loader2,
  AlertCircle,
  Bell,
} from 'lucide-react';
import { ReminderItem, formatRelativeDays } from '../utils/reminders';

interface ItemDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: Item | null;
  fields: FieldDefinition[];
  tags?: Tag[];
  urgentReminder?: ReminderItem | null;
  totalRemindersCount?: number;
  itemReminders?: ReminderItem[];
  onEditItem: (item: Item) => void;
  onDeleteItem: (item: Item) => void;
  onOpenCreateEvent: (item: Item) => void;
  onOpenEditEvent: (event: ItemEvent) => void;
}

export const ItemDetailModal: React.FC<ItemDetailModalProps> = ({
  isOpen,
  onClose,
  item,
  fields,
  tags = [],
  urgentReminder,
  totalRemindersCount,
  itemReminders = [],
  onEditItem,
  onDeleteItem,
  onOpenCreateEvent,
  onOpenEditEvent,
}) => {
  const [eventToDelete, setEventToDelete] = useState<ItemEvent | null>(null);
  const [isArchivedExpanded, setIsArchivedExpanded] = useState(false);
  const [fullscreenPhotoIndex, setFullscreenPhotoIndex] = useState<number | null>(null);
  const [isProcessingPhotos, setIsProcessingPhotos] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  // Documents state
  const [isProcessingDocs, setIsProcessingDocs] = useState(false);
  const [docError, setDocError] = useState<string | null>(null);
  const [docToRename, setDocToRename] = useState<Attachment | null>(null);
  const [docToDelete, setDocToDelete] = useState<Attachment | null>(null);

  // Live query for events belonging to this item
  const rawEvents = useLiveQuery<ItemEvent[]>(
    () =>
      item
        ? db.events.where('item_id').equals(item.id).toArray()
        : Promise.resolve([] as ItemEvent[]),
    [item?.id]
  );

  // Live query for PHOTOS belonging to this item (image/* only, event_id = null)
  const rawPhotoAttachments = useLiveQuery<Attachment[]>(
    () =>
      item
        ? db.attachments
            .where('item_id')
            .equals(item.id)
            .filter((a) => !a.event_id && (a.mime_type?.startsWith('image/') ?? false))
            .toArray()
        : Promise.resolve([] as Attachment[]),
    [item?.id]
  );

  const photos = (rawPhotoAttachments ? [...rawPhotoAttachments] : []).sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
  );

  // Live query for DOCUMENTS belonging directly to this item (application/pdf, event_id = null)
  const itemDocuments = useLiveQuery<Attachment[]>(
    () =>
      item
        ? db.attachments
            .where('item_id')
            .equals(item.id)
            .filter((a) => !a.event_id && a.mime_type === 'application/pdf')
            .toArray()
        : Promise.resolve([] as Attachment[]),
    [item?.id]
  );

  // Live query for all event documents belonging to this item's events
  const allEventDocuments = useLiveQuery<Attachment[]>(
    () =>
      item
        ? db.attachments
            .where('item_id')
            .equals(item.id)
            .filter((a) => Boolean(a.event_id) && a.mime_type === 'application/pdf')
            .toArray()
        : Promise.resolve([] as Attachment[]),
    [item?.id]
  );

  // Map event_id -> Attachment[] (PDF documents)
  const eventDocsByEventId = useMemo(() => {
    const map = new Map<string, Attachment[]>();
    if (allEventDocuments) {
      for (const doc of allEventDocuments) {
        if (doc.event_id) {
          const list = map.get(doc.event_id) || [];
          list.push(doc);
          map.set(doc.event_id, list);
        }
      }
    }
    return map;
  }, [allEventDocuments]);

  const itemRemindersMap = useMemo(() => {
    const map = new Map<string, ReminderItem>();
    if (itemReminders) {
      for (const r of itemReminders) {
        map.set(r.fieldId, r);
      }
    }
    return map;
  }, [itemReminders]);

  const itemTags = item ? tags.filter((t) => item.tag_ids?.includes(t.id)) : [];

  if (!isOpen || !item) return null;

  // Sort: event_date desc, event_time desc, created_at desc
  const sortedEvents = (rawEvents ? [...rawEvents] : []).sort((a, b) => {
    if (a.event_date !== b.event_date) {
      return b.event_date.localeCompare(a.event_date);
    }
    const timeA = a.event_time || '';
    const timeB = b.event_time || '';
    if (timeA !== timeB) {
      if (!timeA) return 1;
      if (!timeB) return -1;
      return timeB.localeCompare(timeA);
    }
    return b.created_at.localeCompare(a.created_at);
  });

  const activeItemFields = fields.filter((f) => f.target === 'ITEM' && !f.is_archived);

  // Archived item fields that have a non-empty stored value on this item
  const archivedItemFieldsWithValues = fields.filter(
    (f) =>
      f.target === 'ITEM' &&
      f.is_archived &&
      item.data?.[f.id] !== undefined &&
      item.data?.[f.id] !== null &&
      item.data?.[f.id] !== ''
  );

  const eventFieldsMap = new Map(fields.filter((f) => f.target === 'EVENT').map((f) => [f.id, f]));

  const formatFieldValue = (field: FieldDefinition, val: any) => {
    if (val === undefined || val === null || val === '') return null;

    if (field.data_type === 'single_select') {
      const option = field.config?.options?.find((o) => o.id === val);
      return (
        <span
          className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-800"
          style={
            option?.color
              ? { backgroundColor: `${option.color}15`, color: option.color }
              : undefined
          }
        >
          {option ? option.label : String(val)}
        </span>
      );
    }

    if (field.data_type === 'boolean') {
      return (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold ${
            val ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
          }`}
        >
          {val ? 'Ano' : 'Ne'}
        </span>
      );
    }

    if (field.data_type === 'number') {
      const formatted =
        typeof val === 'number'
          ? new Intl.NumberFormat('cs-CZ').format(val)
          : String(val);
      return (
        <span className="font-semibold text-slate-900">
          {formatted} {field.unit ? `${field.unit}` : ''}
        </span>
      );
    }

    if (field.data_type === 'date') {
      try {
        const parts = String(val).split('-');
        if (parts.length === 3) {
          return `${parseInt(parts[2], 10)}. ${parseInt(parts[1], 10)}. ${parts[0]}`;
        }
      } catch {
        // fallback
      }
      return String(val);
    }

    return String(val);
  };

  const formatDateLabel = (dateStr: string) => {
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        return `${parseInt(parts[2], 10)}. ${parseInt(parts[1], 10)}. ${parts[0]}`;
      }
    } catch {
      // fallback
    }
    return dateStr;
  };

  // Format event custom fields string for timeline card with archived badge if applicable
  const renderEventFieldsSnippet = (eventData: Record<string, any> = {}) => {
    const entries: React.ReactNode[] = [];

    for (const [fieldId, val] of Object.entries(eventData)) {
      if (val === undefined || val === null || val === '') continue;
      const field = eventFieldsMap.get(fieldId);
      if (!field) continue;

      let formattedVal = String(val);
      if (field.data_type === 'number') {
        const num = typeof val === 'number' ? val : Number(val);
        formattedVal = !isNaN(num)
          ? new Intl.NumberFormat('cs-CZ').format(num)
          : String(val);
        if (field.unit) formattedVal += ` ${field.unit}`;
      } else if (field.data_type === 'single_select') {
        const opt = field.config?.options?.find((o) => o.id === val);
        if (opt) formattedVal = opt.label;
      } else if (field.data_type === 'boolean') {
        formattedVal = val ? 'Ano' : 'Ne';
      } else if (field.data_type === 'date') {
        formattedVal = formatDateLabel(String(val));
      }

      const fieldReminder = itemRemindersMap.get(fieldId);

      entries.push(
        <span key={fieldId} className="inline-flex items-center gap-1.5 flex-wrap">
          <strong className="text-slate-600 font-medium">{field.name}:</strong>{' '}
          <span className="text-slate-900 font-semibold">{formattedVal}</span>
          {fieldReminder && (
            <span
              className={`inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.2 rounded ${
                fieldReminder.status === 'overdue' || fieldReminder.status === 'today'
                  ? 'bg-red-100 text-red-800'
                  : fieldReminder.status === 'soon'
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-indigo-100 text-indigo-800'
              }`}
              title={`Termín: ${fieldReminder.dueDate} (${formatRelativeDays(fieldReminder.daysLeft)})`}
            >
              <Bell className="w-2 h-2" />
              <span>{formatRelativeDays(fieldReminder.daysLeft)}</span>
            </span>
          )}
          {field.is_archived && (
            <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 border border-amber-200 font-bold">
              archivováno
            </span>
          )}
        </span>
      );
    }

    if (entries.length === 0) return null;

    return (
      <div className="mt-2.5 pt-2 border-t border-slate-100 text-xs text-slate-700 flex flex-wrap items-center gap-x-2.5 gap-y-1">
        {entries.map((entry, index) => (
          <React.Fragment key={index}>
            {entry}
            {index < entries.length - 1 && (
              <span className="text-slate-300 font-bold select-none">·</span>
            )}
          </React.Fragment>
        ))}
      </div>
    );
  };

  const handleDeleteEventConfirm = async () => {
    if (!eventToDelete) return;
    try {
      await db.transaction('rw', [db.events, db.attachments], async () => {
        await db.attachments.where('event_id').equals(eventToDelete.id).delete();
        await db.events.delete(eventToDelete.id);
      });
      setEventToDelete(null);
    } catch (err: any) {
      alert('Chyba při mazání události: ' + (err?.message || 'Neznámá chyba'));
    }
  };

  const handleItemDocFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !item) return;

    const currentDocs = itemDocuments ? [...itemDocuments] : [];
    const remainingSlots = MAX_DOCUMENTS_PER_TARGET - currentDocs.length;
    if (remainingSlots <= 0) {
      setDocError(`Maximální počet dokumentů na položku je ${MAX_DOCUMENTS_PER_TARGET}.`);
      e.target.value = '';
      return;
    }

    const filesToProcess = Array.from(files).slice(0, remainingSlots);
    if (files.length > remainingSlots) {
      alert(`Lze přidat ještě nejvýše ${remainingSlots} dokumentů. Ostatní byly přeskočeny.`);
    }

    setIsProcessingDocs(true);
    setDocError(null);
    const now = new Date().toISOString();

    for (const file of filesToProcess) {
      const validation = await validatePdfFile(file);
      if (!validation.isValid) {
        setDocError(validation.error || `Soubor „${file.name}“ není platným PDF dokumentem.`);
        continue;
      }

      try {
        const newAttachment: Attachment = {
          id: crypto.randomUUID(),
          item_id: item.id,
          event_id: null,
          file_name: file.name,
          mime_type: 'application/pdf',
          size_bytes: file.size,
          sort_order: 0,
          blob: file,
          created_at: now,
          updated_at: now,
        };
        await db.attachments.add(newAttachment);
      } catch (err: any) {
        setDocError(err?.message || `Soubor „${file.name}“ se nepodařilo uložit.`);
      }
    }

    setIsProcessingDocs(false);
    e.target.value = '';
  };

  const handleEventDocFilesSelected = async (
    eventId: string,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !item) return;

    const currentDocs = eventDocsByEventId.get(eventId) || [];
    const remainingSlots = MAX_DOCUMENTS_PER_TARGET - currentDocs.length;
    if (remainingSlots <= 0) {
      alert(`Maximální počet dokumentů na událost je ${MAX_DOCUMENTS_PER_TARGET}.`);
      e.target.value = '';
      return;
    }

    const filesToProcess = Array.from(files).slice(0, remainingSlots);
    if (files.length > remainingSlots) {
      alert(`Lze přidat ještě nejvýše ${remainingSlots} dokumentů. Ostatní byly přeskočeny.`);
    }

    const now = new Date().toISOString();

    for (const file of filesToProcess) {
      const validation = await validatePdfFile(file);
      if (!validation.isValid) {
        alert(validation.error || `Soubor „${file.name}“ není platným PDF dokumentem.`);
        continue;
      }

      try {
        const newAttachment: Attachment = {
          id: crypto.randomUUID(),
          item_id: item.id,
          event_id: eventId,
          file_name: file.name,
          mime_type: 'application/pdf',
          size_bytes: file.size,
          sort_order: 0,
          blob: file,
          created_at: now,
          updated_at: now,
        };
        await db.attachments.add(newAttachment);
      } catch (err: any) {
        alert(`Chyba při ukládání souboru „${file.name}“: ${err?.message || 'Neznámá chyba'}`);
      }
    }

    e.target.value = '';
  };

  const handleRenameDoc = async (newName: string) => {
    if (!docToRename) return;
    const now = new Date().toISOString();
    await db.attachments.update(docToRename.id, {
      file_name: newName,
      updated_at: now,
    });
    setDocToRename(null);
  };

  const handleDeleteDocConfirm = async () => {
    if (!docToDelete) return;
    try {
      await db.attachments.delete(docToDelete.id);
      setDocToDelete(null);
    } catch (err: any) {
      alert('Chyba při mazání dokumentu: ' + (err?.message || 'Neznámá chyba'));
    }
  };

  const handlePhotoFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !item) return;

    const remainingSlots = 10 - photos.length;
    if (remainingSlots <= 0) {
      alert('Maximální počet fotografií na položku je 10.');
      e.target.value = '';
      return;
    }

    const filesToProcess = Array.from(files).slice(0, remainingSlots);
    if (files.length > remainingSlots) {
      alert(`Lze přidat ještě nejvýše ${remainingSlots} fotografií. Ostatní byly přeskočeny.`);
    }

    setIsProcessingPhotos(true);
    setPhotoError(null);
    const now = new Date().toISOString();
    let nextSortOrder = photos.length;

    for (const file of filesToProcess) {
      try {
        const processed = await processImageFile(file);
        const newAttachment: Attachment = {
          id: crypto.randomUUID(),
          item_id: item.id,
          event_id: null,
          file_name: processed.file_name,
          mime_type: processed.mime_type,
          size_bytes: processed.size_bytes,
          sort_order: nextSortOrder++,
          blob: processed.blob,
          created_at: now,
          updated_at: now,
        };
        await db.attachments.add(newAttachment);
      } catch (err: any) {
        setPhotoError(err?.message || `Soubor „${file.name}“ se nepodařilo zpracovat.`);
      }
    }

    setIsProcessingPhotos(false);
    e.target.value = '';
  };

  const handleSetMainPhoto = async (photoId: string) => {
    const nextList = [...photos];
    const idx = nextList.findIndex((p) => p.id === photoId);
    if (idx <= 0) return;
    const [chosen] = nextList.splice(idx, 1);
    nextList.unshift(chosen);

    const now = new Date().toISOString();
    try {
      await db.transaction('rw', db.attachments, async () => {
        for (let i = 0; i < nextList.length; i++) {
          await db.attachments.update(nextList[i].id, {
            sort_order: i,
            updated_at: now,
          });
        }
      });
    } catch (err: any) {
      alert('Chyba při změně hlavní fotografie: ' + (err?.message || 'Neznámá chyba'));
    }
  };

  const handleDeletePhoto = async (photoId: string) => {
    if (window.confirm('Opravdu chcete smazat tuto fotografii?')) {
      try {
        await db.attachments.delete(photoId);
      } catch (err: any) {
        alert('Chyba při mazání fotografie: ' + (err?.message || 'Neznámá chyba'));
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-slate-100 bg-slate-50/70 shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 uppercase tracking-wide">
                Detail položky
              </span>
              <span className="text-xs text-slate-400">ID: {item.id.slice(0, 8)}</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 leading-snug">
              {item.name}
            </h2>
            {itemTags.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap mt-2">
                {itemTags.map((tag) => {
                  const opt = getTagColorOption(tag.color);
                  return (
                    <span
                      key={tag.id}
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                        opt
                          ? `${opt.bgClass} ${opt.textClass} ${opt.borderClass}`
                          : ''
                      }`}
                      style={
                        !opt
                          ? {
                              backgroundColor: `${tag.color}15`,
                              color: tag.color,
                              borderColor: `${tag.color}35`,
                            }
                          : undefined
                      }
                    >
                      {tag.name}
                    </span>
                  );
                })}
              </div>
            )}

            {/* Urgent reminder chip in header */}
            {urgentReminder && (
              <div className="flex items-center gap-1.5 flex-wrap mt-2">
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                    urgentReminder.status === 'overdue' || urgentReminder.status === 'today'
                      ? 'bg-red-50 text-red-700 border-red-200'
                      : urgentReminder.status === 'soon'
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                  title={`${urgentReminder.fieldName}: ${formatDateLabel(urgentReminder.dueDate)} (${formatRelativeDays(urgentReminder.daysLeft)})`}
                >
                  <Bell className="w-3 h-3 shrink-0" />
                  <span>
                    {urgentReminder.fieldName}: {formatRelativeDays(urgentReminder.daysLeft)}
                  </span>
                </span>
                {totalRemindersCount && totalRemindersCount > 1 && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
                    +{totalRemindersCount - 1}
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onEditItem(item)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 hover:text-indigo-700 bg-white hover:bg-indigo-50 border border-slate-200 shadow-2xs transition-colors cursor-pointer"
              title="Upravit položku"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>Upravit</span>
            </button>

            <button
              type="button"
              onClick={() => onDeleteItem(item)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 hover:text-red-700 bg-white hover:bg-red-50 border border-slate-200 shadow-2xs transition-colors cursor-pointer"
              title="Smazat položku"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Smazat</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-6 grow">
          {/* Custom Item Properties Box */}
          <div className="bg-slate-50/70 rounded-2xl p-4 border border-slate-200/70 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Vlastnosti položky
              </h3>
              <span className="text-[11px] text-slate-400 font-medium">
                {activeItemFields.length} definovaných polí
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {activeItemFields.map((field) => {
                const val = item.data?.[field.id];
                const formatted = formatFieldValue(field, val);
                const fieldReminder = itemRemindersMap.get(field.id);
                const isOverdueOrToday =
                  fieldReminder &&
                  (fieldReminder.status === 'overdue' || fieldReminder.status === 'today');
                const isSoon = fieldReminder && fieldReminder.status === 'soon';

                return (
                  <div
                    key={field.id}
                    className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 shadow-2xs transition-colors ${
                      isOverdueOrToday
                        ? 'bg-red-50/50 border-red-300 ring-1 ring-red-200'
                        : isSoon
                        ? 'bg-amber-50/50 border-amber-300 ring-1 ring-amber-200'
                        : 'bg-white border-slate-200/60'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-xs text-slate-600 font-medium truncate">
                        {field.name}
                      </span>
                      {fieldReminder && (
                        <span
                          className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.2 rounded shrink-0 ${
                            isOverdueOrToday
                              ? 'bg-red-100 text-red-800'
                              : isSoon
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-indigo-100 text-indigo-800'
                          }`}
                          title={`Termín: ${fieldReminder.dueDate} (${formatRelativeDays(fieldReminder.daysLeft)})`}
                        >
                          <Bell className="w-2.5 h-2.5" />
                          <span>{formatRelativeDays(fieldReminder.daysLeft)}</span>
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-right truncate">
                      {formatted !== null ? (
                        formatted
                      ) : (
                        <span className="text-slate-300 italic">Nevyplněno</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Collapsed Section for Archived Properties with Values */}
          {archivedItemFieldsWithValues.length > 0 && (
            <div className="bg-slate-50/80 rounded-2xl border border-slate-200/80 overflow-hidden">
              <button
                type="button"
                onClick={() => setIsArchivedExpanded(!isArchivedExpanded)}
                className="w-full flex items-center justify-between p-3.5 text-xs font-bold text-slate-700 hover:bg-slate-100/70 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Archive className="w-3.5 h-3.5 text-amber-600" />
                  <span>Archivované vlastnosti ({archivedItemFieldsWithValues.length})</span>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 transition-transform ${
                    isArchivedExpanded ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {isArchivedExpanded && (
                <div className="p-3.5 pt-1 grid grid-cols-1 sm:grid-cols-2 gap-2.5 border-t border-slate-200/60 bg-white/50">
                  {archivedItemFieldsWithValues.map((field) => {
                    const val = item.data?.[field.id];
                    const formatted = formatFieldValue(field, val);

                    return (
                      <div
                        key={field.id}
                        className="p-2.5 bg-white rounded-xl border border-slate-200/70 flex items-center justify-between gap-2 shadow-2xs"
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-xs text-slate-500 font-medium truncate">
                            {field.name}
                          </span>
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 border border-amber-200 font-bold shrink-0">
                            archivováno
                          </span>
                        </div>
                        <div className="text-xs text-right truncate">
                          {formatted}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Timeline of Events */}
          <div className="space-y-4 pt-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Historie a události ({sortedEvents.length})
                </h3>
              </div>

              <button
                type="button"
                onClick={() => onOpenCreateEvent(item)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-all hover:scale-[1.01] cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Přidat událost</span>
              </button>
            </div>

            {/* Empty Events state */}
            {sortedEvents.length === 0 ? (
              <div className="text-center py-10 px-4 bg-slate-50/50 rounded-2xl border border-dashed border-slate-300">
                <Calendar className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-700 mb-1">
                  Zatím žádné zaznamenané události
                </p>
                <p className="text-[11px] text-slate-400 max-w-sm mx-auto mb-3">
                  Zaznamenejte pravidelný servis, výměnu dílů, technickou kontrolu nebo jiné důležité milníky.
                </p>
                <button
                  type="button"
                  onClick={() => onOpenCreateEvent(item)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Přidat první událost</span>
                </button>
              </div>
            ) : (
              /* Vertical Timeline */
              <div className="relative pl-6 space-y-4 before:content-[''] before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-indigo-100">
                {sortedEvents.map((event) => (
                  <div key={event.id} className="relative group">
                    {/* Node Dot */}
                    <div className="absolute -left-[19px] top-3.5 w-3 h-3 rounded-full bg-indigo-600 ring-4 ring-white" />

                    {/* Timeline Card */}
                    <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs hover:shadow-xs transition-shadow">
                      <div className="flex items-start justify-between gap-3 mb-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                            {event.event_type}
                          </span>
                          <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            {formatDateLabel(event.event_date)}
                          </span>
                          {event.event_time && (
                            <span className="text-[11px] font-medium text-slate-500 flex items-center gap-0.5">
                              <Clock className="w-3 h-3 text-slate-400" />
                              {event.event_time}
                            </span>
                          )}
                        </div>

                        {/* Event Actions */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => onOpenEditEvent(event)}
                            className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                            title="Upravit událost"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEventToDelete(event)}
                            className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="Smazat událost"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <h4 className="font-semibold text-sm text-slate-900 leading-snug">
                        {event.title}
                      </h4>

                      {/* Display EVENT custom fields */}
                      {renderEventFieldsSnippet(event.data)}

                      {/* Event Documents */}
                      {(() => {
                        const eventDocs = eventDocsByEventId.get(event.id) || [];
                        return (
                          <div className="mt-3 pt-2.5 border-t border-slate-100 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                                <FileText className="w-3.5 h-3.5 text-red-500" />
                                <span>Dokumenty ({eventDocs.length} / {MAX_DOCUMENTS_PER_TARGET})</span>
                              </span>
                              {eventDocs.length < MAX_DOCUMENTS_PER_TARGET && (
                                <label className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg cursor-pointer transition-colors border border-indigo-100">
                                  <Plus className="w-3 h-3" />
                                  <span>Přidat dokument</span>
                                  <input
                                    type="file"
                                    accept="application/pdf"
                                    multiple
                                    onChange={(e) => handleEventDocFilesSelected(event.id, e)}
                                    className="hidden"
                                  />
                                </label>
                              )}
                            </div>

                            {eventDocs.length > 0 && (
                              <div className="space-y-1.5">
                                {eventDocs.map((doc) => (
                                  <DocumentItemRow
                                    key={doc.id}
                                    document={doc}
                                    onRename={(d) => setDocToRename(d)}
                                    onDelete={(d) => setDocToDelete(d)}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Item Photos Gallery Box */}
          <div className="bg-slate-50/70 rounded-2xl p-4 border border-slate-200/70 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-slate-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Fotografie ({photos.length} / 10)
                </h3>
              </div>

              {photos.length < 10 && (
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-white hover:bg-indigo-50 border border-slate-200 shadow-2xs rounded-xl transition-colors cursor-pointer">
                  {isProcessingPhotos ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Zpracovávám...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5" />
                      <span>Přidat fotky</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    disabled={isProcessingPhotos}
                    onChange={handlePhotoFilesSelected}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            {photoError && (
              <div className="flex items-center gap-2 p-2.5 text-xs text-red-700 bg-red-50 rounded-xl border border-red-200">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                <span>{photoError}</span>
              </div>
            )}

            {photos.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {photos.map((photo, idx) => (
                  <ItemPhotoThumbnail
                    key={photo.id}
                    id={photo.id}
                    fileName={photo.file_name}
                    blob={photo.blob}
                    sizeBytes={photo.size_bytes}
                    isMain={idx === 0}
                    onSetMain={idx > 0 ? () => handleSetMainPhoto(photo.id) : undefined}
                    onDelete={() => handleDeletePhoto(photo.id)}
                    onClick={() => setFullscreenPhotoIndex(idx)}
                  />
                ))}
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200 rounded-xl bg-white hover:bg-slate-50 transition-colors cursor-pointer text-slate-400 hover:text-slate-600">
                <ImageIcon className="w-7 h-7 stroke-[1.5] mb-1.5 text-slate-300" />
                <span className="text-xs font-semibold text-slate-600">
                  Přidat fotografie k této položce
                </span>
                <span className="text-[11px] text-slate-400 mt-0.5">
                  Až 10 fotografií · automatická optimalizace (max 1600 px)
                </span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  disabled={isProcessingPhotos}
                  onChange={handlePhotoFilesSelected}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {/* Item Documents Section */}
          <div className="bg-slate-50/70 rounded-2xl p-4 border border-slate-200/70 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-red-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Dokumenty ({(itemDocuments?.length || 0)} / {MAX_DOCUMENTS_PER_TARGET})
                </h3>
              </div>

              {(itemDocuments?.length || 0) < MAX_DOCUMENTS_PER_TARGET && (
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-white hover:bg-indigo-50 border border-slate-200 shadow-2xs rounded-xl transition-colors cursor-pointer">
                  {isProcessingDocs ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Ukládám...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5" />
                      <span>Přidat dokument</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="application/pdf"
                    multiple
                    disabled={isProcessingDocs}
                    onChange={handleItemDocFilesSelected}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            {docError && (
              <div className="flex items-center gap-2 p-2.5 text-xs text-red-700 bg-red-50 rounded-xl border border-red-200">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                <span>{docError}</span>
              </div>
            )}

            {itemDocuments && itemDocuments.length > 0 ? (
              <div className="space-y-2">
                {itemDocuments.map((doc) => (
                  <DocumentItemRow
                    key={doc.id}
                    document={doc}
                    onRename={(d) => setDocToRename(d)}
                    onDelete={(d) => setDocToDelete(d)}
                  />
                ))}
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200 rounded-xl bg-white hover:bg-slate-50 transition-colors cursor-pointer text-slate-400 hover:text-slate-600">
                <FileText className="w-7 h-7 stroke-[1.5] mb-1.5 text-slate-300" />
                <span className="text-xs font-semibold text-slate-600">
                  Přidat PDF dokumenty k této položce
                </span>
                <span className="text-[11px] text-slate-400 mt-0.5">
                  Až 20 dokumentů · max. 10 MB na soubor · pouze formát PDF
                </span>
                <input
                  type="file"
                  accept="application/pdf"
                  multiple
                  disabled={isProcessingDocs}
                  onChange={handleItemDocFilesSelected}
                  className="hidden"
                />
              </label>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-400">
            Vytvořeno{' '}
            {new Date(item.created_at).toLocaleDateString('cs-CZ', {
              day: 'numeric',
              month: 'numeric',
              year: 'numeric',
            })}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200/50 rounded-xl transition-colors cursor-pointer"
          >
            Zavřít detail
          </button>
        </div>
      </div>

      {/* Delete Event Confirmation Modal */}
      {eventToDelete && (
        <div className="fixed inset-0 z-70 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
            <h4 className="font-bold text-base text-slate-900">
              Smazat událost z historie?
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Opravdu chcete smazat událost{' '}
              <strong className="text-slate-900">„{eventToDelete.title}“</strong>?
              Tuto akci nelze vrátit zpět.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEventToDelete(null)}
                className="px-3.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Zrušit
              </button>
              <button
                type="button"
                onClick={handleDeleteEventConfirm}
                className="px-4 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-xs cursor-pointer"
              >
                Smazat událost
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Delete Document Confirmation Modal */}
      {docToDelete && (
        <div className="fixed inset-0 z-70 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
            <h4 className="font-bold text-base text-slate-900">
              Smazat dokument?
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Opravdu chcete smazat dokument{' '}
              <strong className="text-slate-900">„{docToDelete.file_name}“</strong>?
              Tuto akci nelze vrátit zpět.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDocToDelete(null)}
                className="px-3.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Zrušit
              </button>
              <button
                type="button"
                onClick={handleDeleteDocConfirm}
                className="px-4 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-xs cursor-pointer"
              >
                Smazat dokument
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Document Modal */}
      {docToRename && (
        <RenameDocumentModal
          isOpen={true}
          currentName={docToRename.file_name}
          onClose={() => setDocToRename(null)}
          onRename={handleRenameDoc}
        />
      )}

      {/* Fullscreen Photo Viewer */}
      {fullscreenPhotoIndex !== null && photos[fullscreenPhotoIndex] && (
        <FullscreenPhotoViewer
          attachments={photos}
          initialIndex={fullscreenPhotoIndex}
          onClose={() => setFullscreenPhotoIndex(null)}
        />
      )}
    </div>
  );
};
