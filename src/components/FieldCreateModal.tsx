import React, { useState, useEffect } from 'react';
import { FieldDefinition, FieldDataType, FieldConfig } from '../types';
import { db } from '../db';
import { CREATABLE_FIELD_TYPES, FIELD_DATA_TYPE_LABELS } from '../utils/fieldTypes';
import {
  X,
  Sliders,
  Save,
  Plus,
  Bell,
  ChevronDown,
  AlertCircle,
} from 'lucide-react';

interface FieldCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  collectionId: string;
  collectionName: string;
  target: 'ITEM' | 'EVENT';
  currentEventType?: string;
  existingFieldsCount?: number;
  onFieldCreated: (newField: FieldDefinition) => void;
}

export const FieldCreateModal: React.FC<FieldCreateModalProps> = ({
  isOpen,
  onClose,
  collectionId,
  collectionName,
  target,
  currentEventType,
  existingFieldsCount = 0,
  onFieldCreated,
}) => {
  const [name, setName] = useState('');
  const [dataType, setDataType] = useState<FieldDataType>('text');
  const [unit, setUnit] = useState('');
  const [isRequired, setIsRequired] = useState(false);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Single select options
  const [options, setOptions] = useState<string[]>([]);
  const [optionInput, setOptionInput] = useState('');

  // Date reminder state (default: enabled, 30 days)
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [reminderDaysBefore, setReminderDaysBefore] = useState(30);
  const [isReminderExpanded, setIsReminderExpanded] = useState(false);

  // Event scope
  const [eventScope, setEventScope] = useState<'current' | 'all'>('current');

  useEffect(() => {
    if (isOpen) {
      setName('');
      setDataType('text');
      setUnit('');
      setIsRequired(false);
      setIsAdvancedOpen(false);
      setError(null);
      setOptions([]);
      setOptionInput('');
      setReminderEnabled(true);
      setReminderDaysBefore(30);
      setIsReminderExpanded(false);
      setEventScope('current');
      setIsSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAddOptionChip = () => {
    const trimmed = optionInput.trim();
    if (trimmed && !options.includes(trimmed)) {
      setOptions((prev) => [...prev, trimmed]);
      setOptionInput('');
    }
  };

  const handleRemoveOptionChip = (idxToRemove: number) => {
    setOptions((prev) => prev.filter((_, idx) => idx !== idxToRemove));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Zadejte název vlastnosti');
      return;
    }

    const finalOptions = [...options];
    if (dataType === 'single_select') {
      if (optionInput.trim() && !finalOptions.includes(optionInput.trim())) {
        finalOptions.push(optionInput.trim());
      }
      if (finalOptions.length === 0) {
        setError('Přidejte alespoň jednu možnost výběru');
        return;
      }
    }

    try {
      setIsSubmitting(true);
      const now = new Date().toISOString();
      const fieldId = crypto.randomUUID();
      const key = name
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9_]/g, '_')
        .slice(0, 32);

      let config: FieldConfig = {};
      if (dataType === 'single_select') {
        config = {
          options: finalOptions.map((label) => ({
            id: crypto.randomUUID(),
            label,
          })),
        };
      } else if (dataType === 'date' && reminderEnabled) {
        config = {
          reminder: {
            enabled: true,
            days_before: reminderDaysBefore,
          },
        };
      }

      const assignedEventTypes =
        target === 'EVENT' && eventScope === 'current'
          ? [currentEventType?.trim() || 'Servis']
          : [];

      const newField: FieldDefinition = {
        id: fieldId,
        collection_id: collectionId,
        target,
        key: key || `${target.toLowerCase()}_field_${Date.now()}`,
        name: name.trim(),
        data_type: dataType,
        unit: dataType === 'number' && unit.trim() ? unit.trim() : null,
        event_types: assignedEventTypes,
        is_required: isRequired,
        is_archived: false,
        display_order: existingFieldsCount + 1,
        config,
        validation_rules: {},
        created_at: now,
        updated_at: now,
      };

      await db.field_definitions.add(newField);
      onFieldCreated(newField);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Chyba při vytváření vlastnosti');
    } finally {
      setIsSubmitting(false);
    }
  };

  const presetDays = [7, 14, 30, 60, 90];
  const isCustomPreset = !presetDays.includes(reminderDaysBefore);

  return (
    <div className="fixed inset-0 z-70 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-[420px] w-full flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 overflow-hidden">
        {/* Header - Fixed */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-indigo-600" />
            <h3 className="font-bold text-sm text-slate-900">
              {target === 'ITEM' ? 'Přidat vlastnost položky' : 'Přidat vlastnost události'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Zavřít"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body - Scrollable */}
        <form onSubmit={handleSave} className="flex flex-col grow min-h-0">
          <div className="p-4 overflow-y-auto space-y-3.5 grow">
            {error && (
              <div className="flex items-center gap-2 p-2.5 text-xs text-red-700 bg-red-50 rounded-xl border border-red-200">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                <span>{error}</span>
              </div>
            )}

            {/* Field Name */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">
                Název vlastnosti <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                autoFocus
                required
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (error) setError(null);
                }}
                placeholder={target === 'ITEM' ? 'např. Výkon motoru, VIN, Barva...' : 'např. Stav tachometru, Cena...'}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-slate-900 font-medium"
              />
            </div>

            {/* Data Type */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">
                Datový typ
              </label>
              <select
                value={dataType}
                onChange={(e) => setDataType(e.target.value as FieldDataType)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none bg-white font-medium text-slate-800"
              >
                {CREATABLE_FIELD_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {FIELD_DATA_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Reminder: Single line by default, expandable inline */}
            {dataType === 'date' && (
              <div className="space-y-1">
                {!isReminderExpanded ? (
                  <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-xs">🔔</span>
                      <span className="font-medium text-slate-700 truncate">
                        Upozornění:{' '}
                        {reminderEnabled
                          ? `zapnuto, ${reminderDaysBefore} dní předem`
                          : 'vypnuto'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsReminderExpanded(true)}
                      className="text-indigo-600 hover:text-indigo-800 font-semibold px-2 py-0.5 rounded hover:bg-indigo-50 transition-colors shrink-0 ml-2 cursor-pointer"
                    >
                      Změnit
                    </button>
                  </div>
                ) : (
                  <div className="p-3 bg-slate-50 border border-indigo-200 rounded-xl space-y-2.5 animate-in fade-in duration-100">
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={reminderEnabled}
                          onChange={(e) => setReminderEnabled(e.target.checked)}
                          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
                        />
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                          <Bell className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Upozorňovat na termín</span>
                        </div>
                      </label>

                      <button
                        type="button"
                        onClick={() => setIsReminderExpanded(false)}
                        className="text-xs text-slate-500 hover:text-slate-800 font-medium px-1.5 py-0.5 rounded hover:bg-slate-200/60 transition-colors cursor-pointer"
                      >
                        Hotovo
                      </button>
                    </div>

                    {reminderEnabled && (
                      <div className="pl-6 space-y-1.5">
                        <label className="block text-[11px] font-semibold text-slate-700">
                          Upozornit předem (dní)
                        </label>
                        <div className="flex items-center gap-2 flex-wrap">
                          <select
                            value={isCustomPreset ? 'custom' : String(reminderDaysBefore)}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val !== 'custom') {
                                setReminderDaysBefore(parseInt(val, 10));
                              }
                            }}
                            className="px-2.5 py-1 text-xs rounded-lg border border-slate-300 bg-white font-medium text-slate-800 outline-none focus:border-indigo-500"
                          >
                            <option value="7">7 dní</option>
                            <option value="14">14 dní</option>
                            <option value="30">30 dní (výchozí)</option>
                            <option value="60">60 dní</option>
                            <option value="90">90 dní</option>
                            <option value="custom">Vlastní počet...</option>
                          </select>

                          {isCustomPreset && (
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                min={1}
                                max={365}
                                value={reminderDaysBefore}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value, 10);
                                  if (!isNaN(val)) {
                                    setReminderDaysBefore(Math.max(1, Math.min(365, val)));
                                  }
                                }}
                                className="w-16 px-2 py-1 text-xs rounded-lg border border-slate-300 bg-white font-semibold text-slate-900 outline-none focus:border-indigo-500"
                              />
                              <span className="text-[11px] text-slate-500">dní</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Single Select: Options Chip Editor */}
            {dataType === 'single_select' && (
              <div className="space-y-2 p-3 bg-indigo-50/50 rounded-xl border border-indigo-100">
                <label className="block text-xs font-semibold text-slate-700">
                  Možnosti výběru <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={optionInput}
                    onChange={(e) => setOptionInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddOptionChip();
                      }
                    }}
                    placeholder="Napište možnost a stiskněte Enter..."
                    className="grow px-3 py-1.5 text-xs rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none bg-white text-slate-900"
                  />
                  <button
                    type="button"
                    onClick={handleAddOptionChip}
                    disabled={!optionInput.trim()}
                    className="px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-100 hover:bg-indigo-200 disabled:opacity-50 rounded-xl transition-colors shrink-0 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 inline mr-1" />
                    Přidat
                  </button>
                </div>

                {options.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {options.map((opt, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-white text-indigo-800 border border-indigo-200 shadow-2xs"
                      >
                        <span>{opt}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveOptionChip(idx)}
                          className="p-0.5 text-slate-400 hover:text-red-500 rounded-full transition-colors cursor-pointer"
                          title="Odebrat možnost"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500 italic">
                    Zatím jste nepřidali žádné možnosti. Zadejte text a stiskněte Enter.
                  </p>
                )}
              </div>
            )}

            {/* EVENT properties: "Použít pro" choice */}
            {target === 'EVENT' && (
              <div className="space-y-1.5 pt-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Použít pro
                </label>
                <div className="space-y-1.5 pl-1">
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="eventScopeChoice"
                      value="all"
                      checked={eventScope === 'all'}
                      onChange={() => setEventScope('all')}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Všechny typy událostí</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="eventScopeChoice"
                      value="current"
                      checked={eventScope === 'current'}
                      onChange={() => setEventScope('current')}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>
                      Jen pro typ <strong>„{currentEventType || 'Servis'}“</strong>
                    </span>
                  </label>
                </div>
              </div>
            )}

            {/* Scope Helper note */}
            <div className="text-[11px] text-slate-500 leading-relaxed bg-slate-50 p-2 rounded-xl border border-slate-100">
              💡 Platí pro všechny {target === 'ITEM' ? `položky v sekci „${collectionName}“` : `události v sekci „${collectionName}“`}.
            </div>

            {/* Collapsed "Další volby" row for Povinná hodnota and Unit */}
            <div className="pt-1 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
                className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors py-1 cursor-pointer"
              >
                <ChevronDown
                  className={`w-3.5 h-3.5 text-slate-400 transition-transform ${
                    isAdvancedOpen ? 'rotate-180' : ''
                  }`}
                />
                <span>Další volby</span>
              </button>

              {isAdvancedOpen && (
                <div className="pt-2 pl-4 space-y-2.5 animate-in fade-in duration-100">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isRequired}
                      onChange={(e) => setIsRequired(e.target.checked)}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
                    />
                    <span className="text-xs font-medium text-slate-700">
                      Povinná hodnota
                    </span>
                  </label>

                  {dataType === 'number' && (
                    <div className="space-y-1">
                      <label className="block text-xs font-medium text-slate-600">
                        Jednotka (např. km, l, kg, Kč)
                      </label>
                      <input
                        type="text"
                        value={unit}
                        onChange={(e) => setUnit(e.target.value)}
                        placeholder="km, l, kg..."
                        className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-300 focus:border-indigo-500 outline-none"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Footer - Always visible without scrolling */}
          <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-slate-100 bg-slate-50 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
            >
              Zrušit
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Ukládám...' : 'Uložit vlastnost'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
