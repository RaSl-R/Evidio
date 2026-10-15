import React, { useState, useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ItemEvent, FieldDefinition, FieldDataType, SelectOption, Attachment, FieldConfig, ReminderConfig } from '../types';
import { db } from '../db';
import { normalizeSearchText } from '../utils/search';
import { FIELD_DATA_TYPE_LABELS, CREATABLE_FIELD_TYPES } from '../utils/fieldTypes';
import { validatePdfFile, MAX_DOCUMENTS_PER_TARGET } from '../utils/attachments';
import { formatBytes } from '../utils/storage';
import { useToday } from '../hooks/useToday';
import { ReminderQuickPopover } from './ReminderQuickPopover';
import { ReminderConfigEditor } from './ReminderConfigEditor';
import { FieldEditModal } from './FieldEditModal';
import { FieldCreateModal } from './FieldCreateModal';
import { X, Calendar, Clock, Tag, Save, Plus, Sliders, FileText, Upload, Trash2, AlertCircle, Edit2, BellOff } from 'lucide-react';

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemId: string;
  itemName: string;
  collectionId: string;
  collectionName: string;
  fieldDefinitions: FieldDefinition[];
  existingEventTypes: string[];
  eventToEdit?: ItemEvent | null;
}

export const EventModal: React.FC<EventModalProps> = ({
  isOpen,
  onClose,
  itemId,
  itemName,
  collectionId,
  collectionName,
  fieldDefinitions,
  existingEventTypes,
  eventToEdit,
}) => {
  const [eventType, setEventType] = useState('');
  const [title, setTitle] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [dataValues, setDataValues] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reminder state
  const todayStr = useToday();
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [reminderDaysBefore, setReminderDaysBefore] = useState(30);
  const [initialReminderState, setInitialReminderState] = useState<{
    enabled: boolean;
    daysBefore: number;
    hadExplicit: boolean;
  }>({
    enabled: true,
    daysBefore: 30,
    hadExplicit: false,
  });

  // Document attachments state
  const [existingDocs, setExistingDocs] = useState<Attachment[]>([]);
  const [stagedDocs, setStagedDocs] = useState<File[]>([]);
  const [deletedDocIds, setDeletedDocIds] = useState<string[]>([]);
  const [docError, setDocError] = useState<string | null>(null);

  // Sub-dialog state: Adding new EVENT field via FieldCreateModal
  const [isAddingField, setIsAddingField] = useState(false);
  const [highlightedFieldId, setHighlightedFieldId] = useState<string | null>(null);

  // Shortcut to edit custom event property (FieldEditModal)
  const [fieldToEdit, setFieldToEdit] = useState<FieldDefinition | null>(null);

  // Live query for field definitions
  const liveFieldDefinitions = useLiveQuery<FieldDefinition[]>(
    () =>
      collectionId
        ? db.field_definitions.where('collection_id').equals(collectionId).sortBy('sort_order')
        : Promise.resolve([]),
    [collectionId]
  );
  const currentFieldDefs = liveFieldDefinitions || fieldDefinitions;

  const currentFieldToEdit = fieldToEdit
    ? currentFieldDefs.find((f) => f.id === fieldToEdit.id) || fieldToEdit
    : null;

  const handleFieldSaved = async (fieldId: string, oldType: FieldDataType, newType: FieldDataType) => {
    if (oldType !== newType) {
      if (eventToEdit) {
        const freshEvent = await db.events.get(eventToEdit.id);
        const storedVal = freshEvent?.data?.[fieldId];
        setDataValues((prev) => ({
          ...prev,
          [fieldId]: storedVal !== undefined ? storedVal : (newType === 'boolean' ? false : ''),
        }));
      } else {
        setDataValues((prev) => ({
          ...prev,
          [fieldId]: newType === 'boolean' ? false : '',
        }));
      }
    }
  };

  const defaultTypes = ['Servis', 'STK', 'Údržba', 'Oprava', 'Přezutí', 'Kontrola', 'Nákup dílu'];
  const allSuggestions = Array.from(new Set([...existingEventTypes, ...defaultTypes])).filter(Boolean);

  useEffect(() => {
    let isCancelled = false;
    if (eventToEdit) {
      setEventType(eventToEdit.event_type || '');
      setTitle(eventToEdit.title || '');
      setEventDate(eventToEdit.event_date || '');
      setEventTime(eventToEdit.event_time || '');
      setDataValues({ ...(eventToEdit.data || {}) });

      const hadExplicit = eventToEdit.reminder !== undefined;
      const remEnabled = eventToEdit.reminder?.enabled ?? true;
      const remDays = eventToEdit.reminder?.days_before ?? 30;
      setReminderEnabled(remEnabled);
      setReminderDaysBefore(remDays);
      setInitialReminderState({
        enabled: remEnabled,
        daysBefore: remDays,
        hadExplicit,
      });

      db.attachments
        .where('event_id')
        .equals(eventToEdit.id)
        .filter((a) => a.mime_type === 'application/pdf')
        .toArray()
        .then((docs) => {
          if (!isCancelled) {
            setExistingDocs(docs);
          }
        });
    } else {
      setEventType(existingEventTypes[0] || 'Servis');
      setTitle('');
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      setEventDate(`${yyyy}-${mm}-${dd}`);
      setEventTime('');
      setDataValues({});
      setExistingDocs([]);

      setReminderEnabled(true);
      setReminderDaysBefore(30);
      setInitialReminderState({
        enabled: true,
        daysBefore: 30,
        hadExplicit: false,
      });
    }
    setStagedDocs([]);
    setDeletedDocIds([]);
    setDocError(null);
    setErrors({});
    setIsAddingField(false);

    return () => {
      isCancelled = true;
    };
  }, [eventToEdit, isOpen]);

  const isPastEvent = Boolean(eventDate && eventDate < todayStr);

  const activeExistingDocs = existingDocs.filter((d) => !deletedDocIds.includes(d.id));
  const totalDocCount = activeExistingDocs.length + stagedDocs.length;

  const handleDocFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remainingSlots = MAX_DOCUMENTS_PER_TARGET - totalDocCount;
    if (remainingSlots <= 0) {
      setDocError(`Maximální počet dokumentů na událost je ${MAX_DOCUMENTS_PER_TARGET}.`);
      e.target.value = '';
      return;
    }

    const filesToProcess = Array.from(files).slice(0, remainingSlots);
    if (files.length > remainingSlots) {
      alert(`Lze přidat ještě nejvýše ${remainingSlots} dokumentů. Ostatní byly přeskočeny.`);
    }

    setDocError(null);
    const validFiles: File[] = [];

    for (const file of filesToProcess) {
      const validation = await validatePdfFile(file);
      if (!validation.isValid) {
        setDocError(validation.error || `Soubor „${file.name}“ není platným PDF dokumentem.`);
        continue;
      }
      validFiles.push(file);
    }

    if (validFiles.length > 0) {
      setStagedDocs((prev) => [...prev, ...validFiles]);
    }
    e.target.value = '';
  };

  // Determine which EVENT fields apply to the currently selected event type
  const normCurrentType = normalizeSearchText(eventType);
  const visibleEventFields = useMemo(() => {
    return currentFieldDefs.filter((f) => {
      if (f.target !== 'EVENT' || f.is_archived) return false;
      // Empty or null event_types means field applies universally to all event types
      if (!f.event_types || f.event_types.length === 0) return true;
      // Otherwise, match case and diacritics insensitively
      return f.event_types.some((t) => normalizeSearchText(t) === normCurrentType);
    });
  }, [currentFieldDefs, normCurrentType]);

  if (!isOpen) return null;

  const handleFieldChange = (fieldId: string, val: any) => {
    setDataValues((prev) => ({
      ...prev,
      [fieldId]: val,
    }));
    if (errors[fieldId]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[fieldId];
        return next;
      });
    }
  };

  const handleFieldCreated = (newField: FieldDefinition) => {
    setHighlightedFieldId(newField.id);
    if (newField.data_type === 'boolean') {
      setDataValues((prev) => ({
        ...prev,
        [newField.id]: false,
      }));
    }
    setTimeout(() => {
      const el = document.getElementById(`event-field-row-${newField.id}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const input = el.querySelector('input, select, textarea') as HTMLElement | null;
        if (input) input.focus();
      }
    }, 120);

    setTimeout(() => {
      setHighlightedFieldId((prev) => (prev === newField.id ? null : prev));
    }, 2500);
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!title.trim()) {
      errs.title = 'Zadejte prosím název události';
    }
    if (!eventDate.trim()) {
      errs.eventDate = 'Vyberte prosím datum události';
    }

    // Required validation applies ONLY to currently visible fields!
    for (const field of visibleEventFields) {
      if (field.is_required) {
        const val = dataValues[field.id];
        if (
          val === undefined ||
          val === null ||
          val === '' ||
          (field.data_type === 'boolean' && val !== true && val !== false)
        ) {
          errs[field.id] = `Pole „${field.name}“ je povinné`;
        }
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      setIsSubmitting(true);
      const now = new Date().toISOString();

      // Clean number fields but keep hidden field values intact in data
      const cleanedData: Record<string, any> = { ...dataValues };
      for (const field of visibleEventFields) {
        const val = dataValues[field.id];
        if (val !== undefined && val !== null && val !== '') {
          if (field.data_type === 'number') {
            const num = Number(val);
            if (!isNaN(num)) {
              cleanedData[field.id] = num;
            }
          }
        }
      }

      const targetEventId = eventToEdit ? eventToEdit.id : crypto.randomUUID();

      await db.transaction('rw', [db.events, db.attachments], async () => {
        // Delete removed attachments if any
        if (deletedDocIds.length > 0) {
          await db.attachments.bulkDelete(deletedDocIds);
        }

        // Add staged documents
        for (const file of stagedDocs) {
          const att: Attachment = {
            id: crypto.randomUUID(),
            item_id: itemId,
            event_id: targetEventId,
            file_name: file.name,
            mime_type: 'application/pdf',
            size_bytes: file.size,
            sort_order: 0,
            blob: file,
            created_at: now,
            updated_at: now,
          };
          await db.attachments.add(att);
        }

        const isReminderChanged =
          reminderEnabled !== initialReminderState.enabled ||
          reminderDaysBefore !== initialReminderState.daysBefore;

        let reminderToSave: ReminderConfig | undefined;
        if (isReminderChanged) {
          reminderToSave = {
            enabled: reminderEnabled,
            days_before: reminderDaysBefore,
          };
        } else if (initialReminderState.hadExplicit && eventToEdit?.reminder) {
          reminderToSave = eventToEdit.reminder;
        }

        if (eventToEdit) {
          const updateData: Partial<ItemEvent> = {
            event_type: eventType.trim() || 'Událost',
            title: title.trim(),
            event_date: eventDate.trim(), // Stored strictly as YYYY-MM-DD
            event_time: eventTime.trim() ? eventTime.trim() : null,
            data: cleanedData,
            updated_at: now,
          };
          if (reminderToSave !== undefined) {
            updateData.reminder = reminderToSave;
          }
          await db.events.update(eventToEdit.id, updateData);
        } else {
          const newEvent: ItemEvent = {
            id: targetEventId,
            item_id: itemId,
            event_type: eventType.trim() || 'Událost',
            title: title.trim(),
            event_date: eventDate.trim(), // Stored strictly as YYYY-MM-DD
            event_time: eventTime.trim() ? eventTime.trim() : null,
            ...(reminderToSave !== undefined ? { reminder: reminderToSave } : {}),
            data: cleanedData,
            created_at: now,
            updated_at: now,
          };
          await db.events.add(newEvent);
        }
      });

      onClose();
    } catch (err: any) {
      setErrors({ global: err?.message || 'Uložení události selhalo' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-60 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70 shrink-0">
          <div>
            <h3 className="font-semibold text-lg text-slate-900">
              {eventToEdit ? 'Upravit událost' : 'Nová událost v historii'}
            </h3>
            <p className="text-xs text-slate-500">
              Položka: <strong className="text-slate-700">{itemName}</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-col grow overflow-hidden">
          <div className="p-6 overflow-y-auto space-y-4 grow">
            {errors.global && (
              <div className="p-3 text-xs text-red-700 bg-red-50 rounded-xl border border-red-200">
                {errors.global}
              </div>
            )}

            {/* Event Type with Suggestions */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                Typ události <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  list="event-types-list"
                  placeholder="Např. Servis, STK, Výměna oleje..."
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-sm bg-white"
                />
                <datalist id="event-types-list">
                  {allSuggestions.map((type) => (
                    <option key={type} value={type} />
                  ))}
                </datalist>
              </div>

              {/* Quick-pick chips */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                <span className="text-[11px] text-slate-400 py-0.5">Doporučené:</span>
                {allSuggestions.slice(0, 6).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setEventType(type)}
                    className={`text-[11px] font-medium px-2 py-0.5 rounded-md border transition-colors cursor-pointer ${
                      eventType.trim().toLowerCase() === type.toLowerCase()
                        ? 'bg-indigo-50 border-indigo-300 text-indigo-700 font-bold'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                Název / Popis události <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                autoFocus
                placeholder="Např. Výměna motorového oleje a filtrů..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={`w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none transition-all ${
                  errors.title
                    ? 'border-red-400 bg-red-50/30'
                    : 'border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100'
                }`}
              />
              {errors.title && (
                <p className="mt-1 text-xs text-red-600">{errors.title}</p>
              )}
            </div>

            {/* Date & Time Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                  Datum <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className={`w-full px-3.5 py-2 rounded-xl border text-sm outline-none bg-white ${
                    errors.eventDate
                      ? 'border-red-400 bg-red-50/30'
                      : 'border-slate-300 focus:border-indigo-500'
                  }`}
                />
                <p className="text-[11px] text-slate-400 mt-1">Datum (YYYY-MM-DD)</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                  Čas (volitelně)
                </label>
                <input
                  type="time"
                  value={eventTime}
                  onChange={(e) => setEventTime(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:border-indigo-500 outline-none text-sm bg-white"
                />
                <p className="text-[11px] text-slate-400 mt-1">Čas úkonu (HH:mm)</p>
              </div>
            </div>

            {/* Reminder Row */}
            <div className="pt-2 pb-1 border-t border-slate-100">
              {isPastEvent ? (
                <div className="flex items-center gap-1.5 py-1 text-xs text-slate-400 italic">
                  <BellOff className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>Minulá událost: bez upozornění</span>
                </div>
              ) : (
                <ReminderConfigEditor
                  compact
                  enabled={reminderEnabled}
                  daysBefore={reminderDaysBefore}
                  onToggle={setReminderEnabled}
                  onChangeDaysBefore={setReminderDaysBefore}
                  label="Upozornit na termín události"
                />
              )}
            </div>

            {/* Custom EVENT Fields Section */}
            <div className="pt-3 border-t border-slate-100 space-y-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Vlastnosti události ({visibleEventFields.length})
                </span>

                <button
                  type="button"
                  onClick={() => setIsAddingField(true)}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>+ Přidat vlastnost události</span>
                </button>
              </div>

              {/* Render Visible Event Fields */}
              {visibleEventFields.length === 0 ? (
                <div className="py-2 text-center text-slate-400 text-xs italic">
                  Pro typ „{eventType || 'tento typ'}“ nejsou nadefinována žádná specifická pole.
                </div>
              ) : (
                visibleEventFields.map((field) => {
                  const val = dataValues[field.id] ?? '';
                  const fieldError = errors[field.id];
                  const isHighlighted = highlightedFieldId === field.id;

                  return (
                    <div
                      key={field.id}
                      id={`event-field-row-${field.id}`}
                      className={`space-y-1 p-2 rounded-xl transition-all duration-300 ${
                        isHighlighted
                          ? 'ring-2 ring-indigo-500 bg-indigo-50/70 shadow-xs'
                          : ''
                      }`}
                    >
                    <div className="flex items-center justify-between text-xs font-medium text-slate-700">
                      <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                        <span className="truncate">
                          {field.name}
                          {field.is_required && (
                            <span className="text-red-500 ml-0.5">*</span>
                          )}
                        </span>

                        {/* Reminder Quick Edit for date fields */}
                        {field.data_type === 'date' && (
                          <ReminderQuickPopover
                            field={field}
                            scopeNote="Platí pro všechny události"
                            onOpenFieldEdit={(f) => setFieldToEdit(f)}
                          />
                        )}

                        {/* Edit Property button */}
                        <button
                          type="button"
                          onClick={() => setFieldToEdit(field)}
                          className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                          title="Upravit vlastnost"
                          aria-label="Upravit vlastnost"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                      </div>

                      {field.unit && (
                        <span className="text-[11px] text-slate-500 font-semibold bg-slate-100 px-1.5 py-0.5 rounded shrink-0 ml-2">
                          {field.unit}
                        </span>
                      )}
                    </div>

                      {/* Text */}
                      {field.data_type === 'text' && (
                        <input
                          type="text"
                          value={val}
                          onChange={(e) => handleFieldChange(field.id, e.target.value)}
                          className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-sm bg-white"
                        />
                      )}

                      {/* Long text */}
                      {field.data_type === 'long_text' && (
                        <textarea
                          rows={3}
                          value={val}
                          onChange={(e) => handleFieldChange(field.id, e.target.value)}
                          className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-sm resize-none bg-white"
                        />
                      )}

                      {/* Number */}
                      {field.data_type === 'number' && (
                        <div className="relative">
                          <input
                            type="number"
                            step="any"
                            value={val}
                            onChange={(e) => handleFieldChange(field.id, e.target.value)}
                            className="w-full px-3.5 py-2 pr-12 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-sm bg-white"
                          />
                          {field.unit && (
                            <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-xs text-slate-500 font-semibold">
                              {field.unit}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Date */}
                      {field.data_type === 'date' && (
                        <input
                          type="date"
                          value={val}
                          onChange={(e) => handleFieldChange(field.id, e.target.value)}
                          className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-sm bg-white"
                        />
                      )}

                      {/* Boolean */}
                      {field.data_type === 'boolean' && (
                        <div className="pt-1">
                          <label className="inline-flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={Boolean(val)}
                              onChange={(e) => handleFieldChange(field.id, e.target.checked)}
                              className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <span className="text-sm text-slate-800">
                              {val ? 'Ano' : 'Ne'}
                            </span>
                          </label>
                        </div>
                      )}

                      {/* Single Select */}
                      {field.data_type === 'single_select' && (
                        <select
                          value={val}
                          onChange={(e) => handleFieldChange(field.id, e.target.value)}
                          className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-sm bg-white"
                        >
                          <option value="">-- Vyberte --</option>
                          {field.config?.options
                            ?.filter((opt) => !opt.is_deleted || val === opt.id)
                            .map((opt) => (
                              <option key={opt.id} value={opt.id}>
                                {opt.label} {opt.is_deleted ? '(archivováno)' : ''}
                              </option>
                            ))}
                        </select>
                      )}

                      {fieldError && (
                        <p className="text-xs text-red-600">{fieldError}</p>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Event Documents Section */}
            <div className="pt-3 border-t border-slate-100 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-red-500" />
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Dokumenty ({totalDocCount} / {MAX_DOCUMENTS_PER_TARGET})
                  </span>
                </div>

                {totalDocCount < MAX_DOCUMENTS_PER_TARGET && (
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-white hover:bg-indigo-50 border border-slate-200 shadow-2xs rounded-xl transition-colors cursor-pointer">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Přidat dokument</span>
                    <input
                      type="file"
                      accept="application/pdf"
                      multiple
                      onChange={handleDocFilesSelected}
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

              {totalDocCount > 0 ? (
                <div className="space-y-2">
                  {/* Existing documents */}
                  {activeExistingDocs.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <FileText className="w-4 h-4 text-red-500 shrink-0" />
                        <span className="font-semibold text-slate-800 truncate" title={doc.file_name}>
                          {doc.file_name}
                        </span>
                        <span className="text-[11px] text-slate-400 shrink-0">
                          ({formatBytes(doc.size_bytes)})
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setDeletedDocIds((prev) => [...prev, doc.id])}
                        className="p-1 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors cursor-pointer shrink-0 ml-2"
                        title="Odebrat dokument"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}

                  {/* Staged new documents */}
                  {stagedDocs.map((file, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2.5 bg-emerald-50/60 rounded-xl border border-emerald-200 text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <FileText className="w-4 h-4 text-red-500 shrink-0" />
                        <span className="font-semibold text-slate-800 truncate" title={file.name}>
                          {file.name}
                        </span>
                        <span className="text-[10px] bg-emerald-100 text-emerald-700 font-bold px-1.5 py-0.5 rounded">
                          Nové
                        </span>
                        <span className="text-[11px] text-slate-400 shrink-0">
                          ({formatBytes(file.size)})
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setStagedDocs((prev) => prev.filter((_, i) => i !== idx))}
                        className="p-1 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors cursor-pointer shrink-0 ml-2"
                        title="Odebrat soubor"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center p-5 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50 hover:bg-slate-100/50 transition-colors cursor-pointer text-slate-400 hover:text-slate-600">
                  <FileText className="w-6 h-6 stroke-[1.5] mb-1 text-slate-300" />
                  <span className="text-xs font-semibold text-slate-600">
                    Přidat PDF dokumenty k této události
                  </span>
                  <span className="text-[11px] text-slate-400 mt-0.5">
                    Až 20 dokumentů · max. 10 MB na soubor · pouze formát PDF
                  </span>
                  <input
                    type="file"
                    accept="application/pdf"
                    multiple
                    onChange={handleDocFilesSelected}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200/50 rounded-xl transition-colors cursor-pointer"
            >
              Zrušit
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md shadow-indigo-100 transition-colors cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {isSubmitting ? 'Ukládám...' : eventToEdit ? 'Uložit změny' : 'Přidat událost'}
            </button>
          </div>
        </form>
      </div>

      {/* Field Edit Modal (z-70, on top of EventModal z-60) */}
      <FieldEditModal
        isOpen={!!currentFieldToEdit}
        onClose={() => setFieldToEdit(null)}
        field={currentFieldToEdit}
        collectionId={collectionId}
        zIndex="z-70"
        onSaved={handleFieldSaved}
      />

      {/* Field Create Modal (z-70, on top of EventModal z-60) */}
      <FieldCreateModal
        isOpen={isAddingField}
        onClose={() => setIsAddingField(false)}
        collectionId={collectionId}
        collectionName={collectionName}
        target="EVENT"
        currentEventType={eventType}
        existingFieldsCount={visibleEventFields.length}
        onFieldCreated={handleFieldCreated}
      />
    </div>
  );
};
