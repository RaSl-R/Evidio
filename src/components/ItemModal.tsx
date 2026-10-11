import React, { useState, useEffect } from 'react';
import { Item, FieldDefinition, FieldDataType, SelectOption } from '../types';
import { db } from '../db';
import { FIELD_DATA_TYPE_LABELS, CREATABLE_FIELD_TYPES } from '../utils/fieldTypes';
import {
  X,
  PackagePlus,
  Save,
  Plus,
  Sliders,
  Type,
  FileText,
  Hash,
  Calendar,
  ToggleLeft,
  ListFilter,
  Check,
} from 'lucide-react';

interface ItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  collectionId: string;
  collectionName: string;
  fieldDefinitions: FieldDefinition[];
  itemToEdit?: Item | null;
}

export const ItemModal: React.FC<ItemModalProps> = ({
  isOpen,
  onClose,
  collectionId,
  collectionName,
  fieldDefinitions,
  itemToEdit,
}) => {
  const [name, setName] = useState('');
  const [dataValues, setDataValues] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sub-dialog state: Adding new field directly from item form
  const [isAddingField, setIsAddingField] = useState(false);
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldType, setNewFieldType] = useState<FieldDataType>('text');
  const [newFieldUnit, setNewFieldUnit] = useState('');
  const [newFieldRequired, setNewFieldRequired] = useState(false);
  const [newSelectOptionInput, setNewSelectOptionInput] = useState('');
  const [newSelectOptions, setNewSelectOptions] = useState<string[]>([]);
  const [newFieldError, setNewFieldError] = useState<string | null>(null);

  // Filter only active item-level fields
  const activeFields = fieldDefinitions.filter(
    (f) => f.target === 'ITEM' && !f.is_archived
  );

  useEffect(() => {
    if (itemToEdit) {
      setName(itemToEdit.name);
      setDataValues({ ...(itemToEdit.data || {}) });
    } else {
      setName('');
      const initial: Record<string, any> = {};
      for (const f of activeFields) {
        if (f.data_type === 'boolean') {
          initial[f.id] = false;
        }
      }
      setDataValues(initial);
    }
    setErrors({});
    setIsAddingField(false);
  }, [itemToEdit, isOpen]);

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

  // Option chip management for single_select
  const handleAddOptionChip = () => {
    const trimmed = newSelectOptionInput.trim();
    if (trimmed && !newSelectOptions.includes(trimmed)) {
      setNewSelectOptions([...newSelectOptions, trimmed]);
      setNewSelectOptionInput('');
    }
  };

  const handleOptionKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddOptionChip();
    }
  };

  const handleRemoveOptionChip = (indexToRemove: number) => {
    setNewSelectOptions(newSelectOptions.filter((_, idx) => idx !== indexToRemove));
  };

  // Create new field definition from item form
  const handleSaveNewField = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFieldName.trim()) {
      setNewFieldError('Zadejte název vlastnosti');
      return;
    }

    if (newFieldType === 'single_select' && newSelectOptions.length === 0) {
      // Check if user typed something in input without pressing Enter
      if (newSelectOptionInput.trim()) {
        newSelectOptions.push(newSelectOptionInput.trim());
      } else {
        setNewFieldError('Přidejte alespoň jednu možnost výběru');
        return;
      }
    }

    try {
      const now = new Date().toISOString();
      const fieldId = crypto.randomUUID();
      const key = newFieldName
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9_]/g, '_')
        .slice(0, 32);

      let config: { options?: SelectOption[] } = {};
      if (newFieldType === 'single_select') {
        config = {
          options: newSelectOptions.map((label) => ({
            id: crypto.randomUUID(),
            label,
          })),
        };
      }

      const newField: FieldDefinition = {
        id: fieldId,
        collection_id: collectionId,
        target: 'ITEM',
        key: key || 'field_' + Date.now(),
        name: newFieldName.trim(),
        data_type: newFieldType,
        unit: newFieldType === 'number' && newFieldUnit.trim() ? newFieldUnit.trim() : null,
        event_types: [],
        is_required: newFieldRequired,
        is_archived: false,
        display_order: fieldDefinitions.length + 1,
        config,
        validation_rules: {},
        created_at: now,
        updated_at: now,
      };

      await db.field_definitions.add(newField);

      // Reset sub-form
      setNewFieldName('');
      setNewFieldType('text');
      setNewFieldUnit('');
      setNewFieldRequired(false);
      setNewSelectOptions([]);
      setNewSelectOptionInput('');
      setNewFieldError(null);
      setIsAddingField(false);
    } catch (err: any) {
      setNewFieldError(err?.message || 'Chyba při vytváření vlastnosti');
    }
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!name.trim()) {
      errs.name = 'Zadejte prosím název položky';
    }

    for (const field of activeFields) {
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

      const cleanedData: Record<string, any> = {};
      for (const field of activeFields) {
        const val = dataValues[field.id];
        if (val !== undefined && val !== null && val !== '') {
          if (field.data_type === 'number') {
            const num = Number(val);
            if (!isNaN(num)) {
              cleanedData[field.id] = num;
            }
          } else {
            cleanedData[field.id] = val;
          }
        }
      }

      if (itemToEdit) {
        await db.items.update(itemToEdit.id, {
          name: name.trim(),
          data: {
            ...itemToEdit.data,
            ...cleanedData,
          },
          updated_at: now,
        });
      } else {
        const newItem: Item = {
          id: crypto.randomUUID(),
          collection_id: collectionId,
          item_type_id: null,
          name: name.trim(),
          tag_ids: [],
          data: cleanedData,
          created_at: now,
          updated_at: now,
        };
        await db.items.add(newItem);
      }

      onClose();
    } catch (err: any) {
      setErrors({ global: err?.message || 'Uložení položky selhalo' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-60 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <PackagePlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-lg text-slate-900">
                {itemToEdit ? 'Upravit položku' : 'Nová položka'}
              </h3>
              <p className="text-xs text-slate-500">
                Sekce: <strong className="text-slate-700">{collectionName}</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-col grow overflow-hidden">
          <div className="p-6 overflow-y-auto space-y-5 grow">
            {errors.global && (
              <div className="p-3 text-sm text-red-700 bg-red-50 rounded-xl border border-red-200">
                {errors.global}
              </div>
            )}

            {/* Primary Item Name */}
            <div>
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wide mb-1.5">
                Název položky <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                autoFocus
                placeholder="Např. Škoda Octavia Combi, Extra 330SC..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={`w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none transition-all ${
                  errors.name
                    ? 'border-red-400 bg-red-50/30 focus:ring-2 focus:ring-red-100'
                    : 'border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100'
                }`}
              />
              {errors.name && (
                <p className="mt-1 text-xs text-red-600">{errors.name}</p>
              )}
            </div>

            {/* Dynamic Custom Fields Section */}
            <div className="pt-3 border-t border-slate-100 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Vlastnosti položky ({activeFields.length})
                </span>

                {/* Clearly visible trigger to add a property from this item form */}
                {!isAddingField && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingField(true);
                      setNewFieldError(null);
                    }}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>+ Přidat vlastnost (např. Palivo)</span>
                  </button>
                )}
              </div>

              {/* Compact Inline Property Definition Dialog */}
              {isAddingField && (
                <div className="p-4 bg-indigo-50/70 border border-indigo-200/80 rounded-2xl space-y-3.5 animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sliders className="w-4 h-4 text-indigo-600" />
                      <h4 className="text-xs font-bold text-indigo-950 uppercase tracking-wider">
                        Definovat novou vlastnost
                      </h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsAddingField(false)}
                      className="p-1 text-slate-400 hover:text-slate-600 rounded-md"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {newFieldError && (
                    <div className="p-2 text-xs text-red-700 bg-red-100/70 rounded-lg">
                      {newFieldError}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Název vlastnosti <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        autoFocus
                        placeholder="Např. Palivo, Barva, Převodovka..."
                        value={newFieldName}
                        onChange={(e) => setNewFieldName(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:border-indigo-500 outline-none bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Typ dat <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={newFieldType}
                        onChange={(e) =>
                          setNewFieldType(e.target.value as FieldDataType)
                        }
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:border-indigo-500 outline-none bg-white"
                      >
                        {CREATABLE_FIELD_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {FIELD_DATA_TYPE_LABELS[t]}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Number Unit */}
                  {newFieldType === 'number' && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Jednotka (volitelně)
                      </label>
                      <input
                        type="text"
                        placeholder="Např. km, l/100km, cm, kg, kW, Kč..."
                        value={newFieldUnit}
                        onChange={(e) => setNewFieldUnit(e.target.value)}
                        className="w-full sm:w-1/2 px-3 py-2 text-xs rounded-xl border border-slate-300 focus:border-indigo-500 outline-none bg-white"
                      />
                    </div>
                  )}

                  {/* Inline Option Chip Editor for single_select */}
                  {newFieldType === 'single_select' && (
                    <div className="space-y-2 pt-1">
                      <label className="block text-xs font-semibold text-slate-700">
                        Možnosti výběru (zadejte možnost a stiskněte Enter)
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Např. Benzín, Nafta, LPG, Elektro..."
                          value={newSelectOptionInput}
                          onChange={(e) => setNewSelectOptionInput(e.target.value)}
                          onKeyDown={handleOptionKeyDown}
                          className="grow px-3 py-2 text-xs rounded-xl border border-slate-300 focus:border-indigo-500 outline-none bg-white"
                        />
                        <button
                          type="button"
                          onClick={handleAddOptionChip}
                          className="px-3 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shrink-0"
                        >
                          Přidat
                        </button>
                      </div>

                      {/* Removable chips */}
                      {newSelectOptions.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {newSelectOptions.map((opt, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-indigo-200 text-xs font-medium text-slate-800 shadow-2xs"
                            >
                              <span>{opt}</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveOptionChip(idx)}
                                className="text-slate-400 hover:text-red-500 rounded-full"
                                title="Odebrat možnost"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Helper Text */}
                  <div className="p-2.5 bg-white/80 rounded-xl border border-indigo-100 text-[11px] text-slate-600 leading-relaxed">
                    💡 <strong>Upozornění:</strong> Vlastnost se přidá všem položkám v sekci{' '}
                    <strong>{collectionName}</strong>.
                  </div>

                  {/* Sub-form Actions */}
                  <div className="flex items-center justify-between pt-1">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newFieldRequired}
                        onChange={(e) => setNewFieldRequired(e.target.checked)}
                        className="rounded border-slate-300 text-indigo-600"
                      />
                      <span className="text-xs text-slate-700">
                        Povinná hodnota
                      </span>
                    </label>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsAddingField(false)}
                        className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200/60 rounded-xl"
                      >
                        Zrušit
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveNewField}
                        className="px-3.5 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs"
                      >
                        Uložit vlastnost
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Render dynamic field inputs */}
              {activeFields.map((field) => {
                const val = dataValues[field.id] ?? '';
                const fieldError = errors[field.id];

                return (
                  <div key={field.id} className="space-y-1">
                    <label className="flex items-center justify-between text-xs font-medium text-slate-700">
                      <span>
                        {field.name}
                        {field.is_required && (
                          <span className="text-red-500 ml-1">*</span>
                        )}
                      </span>
                      {field.unit && (
                        <span className="text-[11px] text-slate-500 font-semibold bg-slate-100 px-1.5 py-0.5 rounded">
                          {field.unit}
                        </span>
                      )}
                    </label>

                    {/* Text */}
                    {field.data_type === 'text' && (
                      <input
                        type="text"
                        value={val}
                        onChange={(e) =>
                          handleFieldChange(field.id, e.target.value)
                        }
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-sm"
                      />
                    )}

                    {/* Long text */}
                    {field.data_type === 'long_text' && (
                      <textarea
                        rows={3}
                        value={val}
                        onChange={(e) =>
                          handleFieldChange(field.id, e.target.value)
                        }
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-sm resize-none"
                      />
                    )}

                    {/* Number */}
                    {field.data_type === 'number' && (
                      <div className="relative">
                        <input
                          type="number"
                          step="any"
                          value={val}
                          onChange={(e) =>
                            handleFieldChange(field.id, e.target.value)
                          }
                          className="w-full px-3.5 py-2 pr-12 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-sm"
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
                        onChange={(e) =>
                          handleFieldChange(field.id, e.target.value)
                        }
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-sm"
                      />
                    )}

                    {/* Boolean */}
                    {field.data_type === 'boolean' && (
                      <div className="pt-1">
                        <label className="inline-flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={Boolean(val)}
                            onChange={(e) =>
                              handleFieldChange(field.id, e.target.checked)
                            }
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
                        onChange={(e) =>
                          handleFieldChange(field.id, e.target.value)
                        }
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
              })}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200/50 rounded-xl transition-colors"
            >
              Zrušit
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md shadow-indigo-100 transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {isSubmitting ? 'Ukládám...' : itemToEdit ? 'Uložit změny' : 'Vytvořit položku'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
