import React, { useState } from 'react';
import { Item, FieldDefinition, ItemEvent } from '../types';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
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
} from 'lucide-react';

interface ItemDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: Item | null;
  fields: FieldDefinition[];
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
  onEditItem,
  onDeleteItem,
  onOpenCreateEvent,
  onOpenEditEvent,
}) => {
  const [eventToDelete, setEventToDelete] = useState<ItemEvent | null>(null);
  const [isArchivedExpanded, setIsArchivedExpanded] = useState(false);

  // Live query for events belonging to this item
  const rawEvents = useLiveQuery<ItemEvent[]>(
    () =>
      item
        ? db.events.where('item_id').equals(item.id).toArray()
        : Promise.resolve([] as ItemEvent[]),
    [item?.id]
  );

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

      entries.push(
        <span key={fieldId} className="inline-flex items-center gap-1.5 flex-wrap">
          <strong className="text-slate-600 font-medium">{field.name}:</strong>{' '}
          <span className="text-slate-900 font-semibold">{formattedVal}</span>
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
      await db.events.delete(eventToDelete.id);
      setEventToDelete(null);
    } catch (err: any) {
      alert('Chyba při mazání události: ' + (err?.message || 'Neznámá chyba'));
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

                return (
                  <div
                    key={field.id}
                    className="p-2.5 bg-white rounded-xl border border-slate-200/60 flex items-center justify-between gap-2 shadow-2xs"
                  >
                    <span className="text-xs text-slate-500 font-medium truncate">
                      {field.name}
                    </span>
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
                    </div>
                  </div>
                ))}
              </div>
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
    </div>
  );
};
