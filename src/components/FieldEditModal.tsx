import React, { useState, useEffect } from 'react';
import { FieldDefinition, FieldDataType, SelectOption } from '../types';
import { db } from '../db';
import {
  FIELD_DATA_TYPE_LABELS,
  ALL_FIELD_DATA_TYPES,
  getFieldTypeLabel,
  isTypeTransitionAllowed,
  sanitizeConfigForTypeChange,
  DISALLOWED_TYPE_TRANSITION_REASON,
} from '../utils/fieldTypes';
import { ReminderConfigEditor } from './ReminderConfigEditor';
import {
  X,
  Sliders,
  Save,
  AlertTriangle,
  Check,
  Plus,
  Trash2,
  RefreshCw,
  ArrowRightLeft,
  Info,
} from 'lucide-react';

interface FieldEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  field: FieldDefinition | null;
  collectionId: string;
  zIndex?: string;
  onSaved?: (fieldId: string, oldType: FieldDataType, newType: FieldDataType) => void;
}

export const FieldEditModal: React.FC<FieldEditModalProps> = ({
  isOpen,
  onClose,
  field,
  collectionId,
  zIndex = 'z-70',
  onSaved,
}) => {
  // Form state
  const [name, setName] = useState('');
  const [isRequired, setIsRequired] = useState(false);
  const [unit, setUnit] = useState('');
  const [eventTypes, setEventTypes] = useState<string[]>([]);
  const [eventTypeInput, setEventTypeInput] = useState('');

  // Reminder state
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderDaysBefore, setReminderDaysBefore] = useState(30);

  // Missing values warning
  const [missingRecordsCount, setMissingRecordsCount] = useState<number | null>(null);

  // Single select options state
  const [options, setOptions] = useState<SelectOption[]>([]);
  const [newOptionLabel, setNewOptionLabel] = useState('');
  const [optionToDelete, setOptionToDelete] = useState<{
    option: SelectOption;
    usageCount: number;
  } | null>(null);

  // Type conversion state
  const [targetType, setTargetType] = useState<FieldDataType>('text');
  const [typeConversionError, setTypeConversionError] = useState<string | null>(null);
  const [typeConversionFailingValues, setTypeConversionFailingValues] = useState<string[]>([]);
  const [typeConversionPreviewCount, setTypeConversionPreviewCount] = useState<number | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);

  useEffect(() => {
    if (field && isOpen) {
      setName(field.name);
      setIsRequired(field.is_required);
      setUnit(field.unit || '');
      setEventTypes(field.event_types ? [...field.event_types] : []);
      setEventTypeInput('');
      setOptions(
        field.config?.options
          ? field.config.options.map((o) => ({ ...o }))
          : []
      );
      setTargetType(field.data_type);
      setReminderEnabled(field.config?.reminder?.enabled ?? false);
      setReminderDaysBefore(field.config?.reminder?.days_before ?? 30);
      setTypeConversionError(null);
      setTypeConversionFailingValues([]);
      setTypeConversionPreviewCount(null);
      setGeneralError(null);
      setOptionToDelete(null);

      // Check missing records count if required
      calculateMissingRecords(field, field.is_required);
    }
  }, [field, isOpen]);

  if (!isOpen || !field) return null;

  const calculateMissingRecords = async (fld: FieldDefinition, willBeRequired: boolean) => {
    if (!willBeRequired) {
      setMissingRecordsCount(null);
      return;
    }

    if (fld.target === 'ITEM') {
      const items = await db.items.where('collection_id').equals(collectionId).toArray();
      const missing = items.filter(
        (i) => i.data?.[fld.id] === undefined || i.data?.[fld.id] === null || i.data?.[fld.id] === ''
      ).length;
      setMissingRecordsCount(missing);
    } else {
      const items = await db.items.where('collection_id').equals(collectionId).toArray();
      const itemIds = items.map((i) => i.id);
      if (itemIds.length === 0) {
        setMissingRecordsCount(0);
        return;
      }
      const events = await db.events.where('item_id').anyOf(itemIds).toArray();
      const missing = events.filter(
        (e) => e.data?.[fld.id] === undefined || e.data?.[fld.id] === null || e.data?.[fld.id] === ''
      ).length;
      setMissingRecordsCount(missing);
    }
  };

  const handleRequiredToggle = (checked: boolean) => {
    setIsRequired(checked);
    calculateMissingRecords(field, checked);
  };

  // Option management
  const handleAddOption = () => {
    const trimmed = newOptionLabel.trim();
    if (!trimmed) return;
    setOptions((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        label: trimmed,
        is_deleted: false,
      },
    ]);
    setNewOptionLabel('');
  };

  const handleOptionLabelChange = (optId: string, newLabel: string) => {
    setOptions((prev) =>
      prev.map((o) => (o.id === optId ? { ...o, label: newLabel } : o))
    );
  };

  const handleInitiateDeleteOption = async (option: SelectOption) => {
    let usageCount = 0;
    if (field.target === 'ITEM') {
      const items = await db.items.where('collection_id').equals(collectionId).toArray();
      usageCount = items.filter((i) => i.data?.[field.id] === option.id).length;
    } else {
      const items = await db.items.where('collection_id').equals(collectionId).toArray();
      const itemIds = items.map((i) => i.id);
      if (itemIds.length > 0) {
        const events = await db.events.where('item_id').anyOf(itemIds).toArray();
        usageCount = events.filter((e) => e.data?.[field.id] === option.id).length;
      }
    }

    if (usageCount === 0) {
      setOptions((prev) => prev.filter((o) => o.id !== option.id));
    } else {
      setOptionToDelete({ option, usageCount });
    }
  };

  const handleConfirmDeprecateOption = () => {
    if (!optionToDelete) return;
    setOptions((prev) =>
      prev.map((o) => (o.id === optionToDelete.option.id ? { ...o, is_deleted: true } : o))
    );
    setOptionToDelete(null);
  };

  const handleRestoreOption = (optId: string) => {
    setOptions((prev) =>
      prev.map((o) => (o.id === optId ? { ...o, is_deleted: false } : o))
    );
  };

  // Type conversion validation and preview
  const handleTargetTypeChange = async (newType: FieldDataType) => {
    setTargetType(newType);
    setTypeConversionError(null);
    setTypeConversionFailingValues([]);
    setTypeConversionPreviewCount(null);

    if (newType === field.data_type) {
      return;
    }

    const currentType = field.data_type;

    if (!isTypeTransitionAllowed(currentType, newType)) {
      setTypeConversionError(
        'Tento převod není bezpečný. Vytvořte nové pole a původní archivujte.'
      );
      return;
    }

    // If text -> number: verify all stored values parse as valid numbers
    if (currentType === 'text' && newType === 'number') {
      const records =
        field.target === 'ITEM'
          ? await db.items.where('collection_id').equals(collectionId).toArray()
          : await (async () => {
              const items = await db.items.where('collection_id').equals(collectionId).toArray();
              const itemIds = items.map((i) => i.id);
              return itemIds.length > 0 ? await db.events.where('item_id').anyOf(itemIds).toArray() : [];
            })();

      const failing: string[] = [];
      let validCount = 0;

      for (const rec of records) {
        const raw = rec.data?.[field.id];
        if (raw !== undefined && raw !== null && String(raw).trim() !== '') {
          const str = String(raw).trim().replace(/\s+/g, '').replace(',', '.');
          const num = Number(str);
          if (isNaN(num)) {
            failing.push(String(raw));
          } else {
            validCount++;
          }
        }
      }

      if (failing.length > 0) {
        setTypeConversionError(
          `Některé existující hodnoty nelze převést na číslo (nalezeno ${failing.length} chyb):`
        );
        setTypeConversionFailingValues(failing.slice(0, 5));
        return;
      }

      setTypeConversionPreviewCount(validCount);
      return;
    }

    // For other allowed transitions, calculate count of converted non-empty values
    const records =
      field.target === 'ITEM'
        ? await db.items.where('collection_id').equals(collectionId).toArray()
        : await (async () => {
            const items = await db.items.where('collection_id').equals(collectionId).toArray();
            const itemIds = items.map((i) => i.id);
            return itemIds.length > 0 ? await db.events.where('item_id').anyOf(itemIds).toArray() : [];
          })();

    const countWithVal = records.filter(
      (r) => r.data?.[field.id] !== undefined && r.data?.[field.id] !== null && String(r.data?.[field.id]).trim() !== ''
    ).length;

    setTypeConversionPreviewCount(countWithVal);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setGeneralError('Zadejte prosím název vlastnosti');
      return;
    }

    if (typeConversionError) {
      return;
    }

    try {
      setIsSubmitting(true);
      const now = new Date().toISOString();
      const isConvertingType = targetType !== field.data_type;

      await db.transaction('rw', [db.field_definitions, db.items, db.events], async () => {
        // 1. If type is being converted, migrate all records in this collection
        if (isConvertingType) {
          if (field.target === 'ITEM') {
            const items = await db.items.where('collection_id').equals(collectionId).toArray();
            for (const item of items) {
              const raw = item.data?.[field.id];
              if (raw !== undefined && raw !== null && String(raw).trim() !== '') {
                let convertedVal: any = raw;

                if (field.data_type === 'text' && targetType === 'number') {
                  const str = String(raw).trim().replace(/\s+/g, '').replace(',', '.');
                  convertedVal = Number(str);
                } else if (field.data_type === 'single_select' && (targetType === 'text' || targetType === 'long_text')) {
                  const opt = options.find((o) => o.id === raw);
                  convertedVal = opt ? opt.label : String(raw);
                } else {
                  convertedVal = String(raw);
                }

                await db.items.update(item.id, {
                  data: {
                    ...item.data,
                    [field.id]: convertedVal,
                  },
                });
              }
            }
          } else {
            // Target EVENT
            const items = await db.items.where('collection_id').equals(collectionId).toArray();
            const itemIds = items.map((i) => i.id);
            if (itemIds.length > 0) {
              const events = await db.events.where('item_id').anyOf(itemIds).toArray();
              for (const event of events) {
                const raw = event.data?.[field.id];
                if (raw !== undefined && raw !== null && String(raw).trim() !== '') {
                  let convertedVal: any = raw;

                  if (field.data_type === 'text' && targetType === 'number') {
                    const str = String(raw).trim().replace(/\s+/g, '').replace(',', '.');
                    convertedVal = Number(str);
                  } else if (field.data_type === 'single_select' && (targetType === 'text' || targetType === 'long_text')) {
                    const opt = options.find((o) => o.id === raw);
                    convertedVal = opt ? opt.label : String(raw);
                  } else {
                    convertedVal = String(raw);
                  }

                  await db.events.update(event.id, {
                    data: {
                      ...event.data,
                      [field.id]: convertedVal,
                    },
                  });
                }
              }
            }
          }
        }

        // 2. Prepare updated config using sanitizeConfigForTypeChange
        let updatedConfig: any = sanitizeConfigForTypeChange(
          {
            ...field.config,
            ...(targetType === 'single_select' ? { options } : {}),
            ...(targetType === 'date' && reminderEnabled
              ? { reminder: { enabled: true, days_before: reminderDaysBefore } }
              : {}),
          },
          targetType
        );
        if (targetType === 'date' && !reminderEnabled) {
          delete updatedConfig.reminder;
        }

        // 3. Update field definition
        await db.field_definitions.update(field.id, {
          name: name.trim(),
          is_required: isRequired,
          data_type: targetType,
          unit: targetType === 'number' && unit.trim() ? unit.trim() : null,
          event_types: field.target === 'EVENT' ? eventTypes : [],
          config: updatedConfig,
          updated_at: now,
        });

        if (onSaved) {
          onSaved(field.id, field.data_type, targetType);
        }
      });

      onClose();
    } catch (err: any) {
      setGeneralError(err?.message || 'Uložení změn selhalo');
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeOptions = options.filter((o) => !o.is_deleted);
  const deprecatedOptions = options.filter((o) => o.is_deleted);

  return (
    <div className={`fixed inset-0 ${zIndex} overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4`}>
      <div className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-lg text-slate-900">
                Úprava vlastnosti: {field.name}
              </h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 uppercase">
                  {field.target === 'ITEM' ? 'Vlastnost položky' : 'Vlastnost události'}
                </span>
                <span className="text-xs text-slate-400">ID: {field.id.slice(0, 8)}</span>
              </div>
            </div>
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
        <form onSubmit={handleSave} className="flex flex-col grow overflow-hidden">
          <div className="p-6 overflow-y-auto space-y-5 grow">
            {generalError && (
              <div className="p-3 text-xs text-red-700 bg-red-50 rounded-xl border border-red-200">
                {generalError}
              </div>
            )}

            {/* Field Name */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                Název vlastnosti <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-sm bg-white"
              />
            </div>

            {/* Required Toggle & Missing Count Notice */}
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <span className="text-xs font-bold text-slate-800 block">
                    Povinná hodnota
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Vyžaduje vyplnění hodnoty při vytváření a ukládání
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={isRequired}
                  onChange={(e) => handleRequiredToggle(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
              </label>

              {/* Informative notice when required is ON and records are missing a value */}
              {isRequired && missingRecordsCount !== null && missingRecordsCount > 0 && (
                <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 flex items-start gap-2 animate-in fade-in">
                  <Info className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                  <span>
                    <strong>{missingRecordsCount} {field.target === 'ITEM' ? 'položek' : 'událostí'}</strong>{' '}
                    v této sekci nemá žádnou hodnotu; budou upozorněny při další úpravě.
                  </span>
                </div>
              )}
            </div>

            {/* Number Unit (if number or converting to number) */}
            {(targetType === 'number' || field.data_type === 'number') && (
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                  Jednotka (např. km, Kč, cm, kg, kW)
                </label>
                <input
                  type="text"
                  placeholder="Např. km, Kč, l/100km..."
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="w-full sm:w-1/2 px-3.5 py-2 rounded-xl border border-slate-300 focus:border-indigo-500 outline-none text-sm bg-white"
                />
              </div>
            )}

            {/* Reminder Config for date fields */}
            {targetType === 'date' && (
              <ReminderConfigEditor
                enabled={reminderEnabled}
                daysBefore={reminderDaysBefore}
                onToggle={setReminderEnabled}
                onChangeDaysBefore={setReminderDaysBefore}
              />
            )}

            {/* Event Types filter (for EVENT target) */}
            {field.target === 'EVENT' && (
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2.5">
                <span className="block text-xs font-bold text-slate-800 uppercase tracking-wide">
                  Filtr typů událostí
                </span>
                <span className="text-[11px] text-slate-500 block">
                  Určuje, pro které typy událostí se vlastnost nabízí (prázdné = všechny typy):
                </span>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Přidat typ (např. Servis, STK) a Enter..."
                    value={eventTypeInput}
                    onChange={(e) => setEventTypeInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const trimmed = eventTypeInput.trim();
                        if (trimmed && !eventTypes.includes(trimmed)) {
                          setEventTypes([...eventTypes, trimmed]);
                          setEventTypeInput('');
                        }
                      }
                    }}
                    className="grow px-3 py-1.5 text-xs rounded-xl border border-slate-300 outline-none bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const trimmed = eventTypeInput.trim();
                      if (trimmed && !eventTypes.includes(trimmed)) {
                        setEventTypes([...eventTypes, trimmed]);
                        setEventTypeInput('');
                      }
                    }}
                    className="px-3 py-1.5 text-xs font-bold bg-indigo-600 text-white rounded-xl cursor-pointer"
                  >
                    Přidat
                  </button>
                </div>

                <div className="flex flex-wrap gap-1 pt-1">
                  {eventTypes.length === 0 ? (
                    <span className="text-xs text-slate-500 italic">Všechny typy událostí</span>
                  ) : (
                    eventTypes.map((t, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-white border border-indigo-200 text-xs font-bold text-indigo-700 shadow-2xs"
                      >
                        <span>{t}</span>
                        <button
                          type="button"
                          onClick={() => setEventTypes(eventTypes.filter((_, i) => i !== idx))}
                          className="text-indigo-400 hover:text-red-500 cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Single Select Options Editor (if current or target is single_select) */}
            {targetType === 'single_select' && (
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                    Možnosti výběru ({activeOptions.length})
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Hodnoty jsou uloženy pod stálým ID
                  </span>
                </div>

                {/* Add option input */}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Nová možnost (např. Benzín, Nafta) a Enter..."
                    value={newOptionLabel}
                    onChange={(e) => setNewOptionLabel(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddOption();
                      }
                    }}
                    className="grow px-3.5 py-2 text-xs rounded-xl border border-slate-300 focus:border-indigo-500 outline-none bg-white"
                  />
                  <button
                    type="button"
                    onClick={handleAddOption}
                    className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl cursor-pointer"
                  >
                    Přidat
                  </button>
                </div>

                {/* Active options list */}
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {activeOptions.map((opt) => (
                    <div
                      key={opt.id}
                      className="flex items-center justify-between gap-2 p-2 bg-white rounded-xl border border-slate-200 shadow-2xs"
                    >
                      <input
                        type="text"
                        value={opt.label}
                        onChange={(e) => handleOptionLabelChange(opt.id, e.target.value)}
                        className="grow px-2 py-1 text-xs font-semibold text-slate-800 border-none outline-none focus:bg-indigo-50/50 rounded"
                      />
                      <button
                        type="button"
                        onClick={() => handleInitiateDeleteOption(opt)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        title="Odebrat možnost"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Deprecated/Archived options list */}
                {deprecatedOptions.length > 0 && (
                  <div className="pt-2 border-t border-slate-200 space-y-1.5">
                    <span className="text-[11px] font-bold text-amber-800 block">
                      Archivované možnosti ({deprecatedOptions.length}):
                    </span>
                    <div className="space-y-1">
                      {deprecatedOptions.map((opt) => (
                        <div
                          key={opt.id}
                          className="flex items-center justify-between p-2 bg-amber-50/60 rounded-xl border border-amber-200/80 text-xs"
                        >
                          <span className="font-medium text-slate-700">
                            {opt.label}{' '}
                            <span className="text-[10px] text-amber-700 font-bold ml-1">
                              (archivováno)
                            </span>
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRestoreOption(opt.id)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-bold text-indigo-700 bg-white hover:bg-indigo-50 border border-indigo-200 rounded-lg cursor-pointer"
                          >
                            <RefreshCw className="w-3 h-3" />
                            Obnovit
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Type Conversion Section */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4 text-indigo-600" />
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                  Změna datového typu
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                <div>
                  <span className="text-[11px] text-slate-500 block mb-1">Současný typ:</span>
                  <span className="px-3 py-2 bg-slate-200/80 text-slate-800 rounded-xl text-xs font-bold block truncate">
                    {getFieldTypeLabel(field.data_type)}
                  </span>
                </div>

                <div>
                  <span className="text-[11px] text-slate-500 block mb-1">Nový typ:</span>
                  <select
                    value={targetType}
                    onChange={(e) => handleTargetTypeChange(e.target.value as FieldDataType)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold bg-white outline-none focus:border-indigo-500"
                  >
                    {ALL_FIELD_DATA_TYPES.map((t) => {
                      const isCurrent = t === field.data_type;
                      const isAllowed = isTypeTransitionAllowed(field.data_type, t);
                      return (
                        <option
                          key={t}
                          value={t}
                          disabled={!isAllowed}
                          title={!isAllowed ? DISALLOWED_TYPE_TRANSITION_REASON : undefined}
                          className={!isAllowed ? 'text-slate-400 bg-slate-100 italic' : 'text-slate-900'}
                        >
                          {FIELD_DATA_TYPE_LABELS[t]}
                          {isCurrent ? ' (současný typ)' : !isAllowed ? ' — nepovolený převod' : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              {/* Explanatory notes below dropdown */}
              <div className="text-[11px] text-slate-500 leading-relaxed bg-white/70 p-2.5 rounded-xl border border-slate-200/60 space-y-1">
                <div>
                  ℹ️ <strong>Povolené bezpečné převody:</strong> Text ↔ Dlouhý text, Text → Číslo (pokud hodnoty parsují), Číslo → Text, Jednoduchý výběr → Text (uloží se názvy voleb), Datum → Text.
                </div>
                <div className="text-slate-600">
                  <span className="font-semibold text-amber-700">Šedé možnosti:</span> {DISALLOWED_TYPE_TRANSITION_REASON}
                </div>
              </div>

              {/* Error if transition fails value parsing */}
              {typeConversionError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 space-y-1 animate-in fade-in">
                  <div className="flex items-center gap-1.5 font-bold">
                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                    <span>{typeConversionError}</span>
                  </div>
                  {typeConversionFailingValues.length > 0 && (
                    <div className="pl-5 pt-1 text-[11px] text-red-700">
                      Ukázka neplatných hodnot:{' '}
                      <strong>{typeConversionFailingValues.map((v) => `"${v}"`).join(', ')}</strong>
                    </div>
                  )}
                </div>
              )}

              {/* Conversion preview if valid and different */}
              {!typeConversionError && targetType !== field.data_type && typeConversionPreviewCount !== null && (
                <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-xs text-indigo-900 flex items-center gap-2 animate-in fade-in">
                  <Check className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>
                    Povolený převod: <strong>Převede se {typeConversionPreviewCount} existujících hodnot</strong> v databázi.
                  </span>
                </div>
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
              disabled={isSubmitting || !!typeConversionError}
              className="inline-flex items-center gap-2 px-5 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md shadow-indigo-100 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              {isSubmitting ? 'Ukládám...' : 'Uložit změny'}
            </button>
          </div>
        </form>
      </div>

      {/* Confirmation Dialog for Option Deprecation (above modal: z-[80]) */}
      {optionToDelete && (
        <div className="fixed inset-0 z-[80] overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-2.5 text-amber-600">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h4 className="font-bold text-base text-slate-900">
                Možnost je používána
              </h4>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              <strong>{optionToDelete.usageCount}</strong> záznamů má tuto hodnotu. Možnost zůstane zachována jako{' '}
              <strong className="text-slate-900">„{optionToDelete.option.label} (archivováno)“</strong>,
              ale nebude nabízena pro nové záznamy.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setOptionToDelete(null)}
                className="px-3.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Zrušit
              </button>
              <button
                type="button"
                onClick={handleConfirmDeprecateOption}
                className="px-4 py-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-xs cursor-pointer"
              >
                Archivovat možnost
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
