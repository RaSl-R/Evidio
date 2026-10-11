import React, { useState } from 'react';
import { FieldDefinition, FieldDataType, SelectOption } from '../types';
import { db } from '../db';
import { FieldEditModal } from './FieldEditModal';
import {
  FIELD_DATA_TYPE_LABELS,
  CREATABLE_FIELD_TYPES,
  getFieldTypeLabel,
} from '../utils/fieldTypes';
import {
  Sliders,
  Plus,
  Archive,
  RefreshCw,
  Edit2,
  X,
  Type,
  FileText,
  Hash,
  Calendar,
  ToggleLeft,
  ListFilter,
  Package,
  History,
} from 'lucide-react';

interface FieldManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  collectionId: string;
  collectionName: string;
  fieldDefinitions: FieldDefinition[];
}

export const FieldManagerModal: React.FC<FieldManagerModalProps> = ({
  isOpen,
  onClose,
  collectionId,
  collectionName,
  fieldDefinitions,
}) => {
  const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active');

  // New field state
  const [isAdding, setIsAdding] = useState(false);
  const [newTarget, setNewTarget] = useState<'ITEM' | 'EVENT'>('ITEM');
  const [newFieldName, setNewFieldName] = useState('');
  const [newDataType, setNewDataType] = useState<FieldDataType>('text');
  const [newUnit, setNewUnit] = useState('');
  const [newIsRequired, setNewIsRequired] = useState(false);
  const [newOptionChipInput, setNewOptionChipInput] = useState('');
  const [newOptionChips, setNewOptionChips] = useState<string[]>([]);
  // EVENT types scope
  const [newEventScope, setNewEventScope] = useState<'all' | 'specific'>('all');
  const [newEventTypeInput, setNewEventTypeInput] = useState('');
  const [newEventTypes, setNewEventTypes] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  // Field Edit Modal state
  const [fieldToEdit, setFieldToEdit] = useState<FieldDefinition | null>(null);

  if (!isOpen) return null;

  const activeFields = fieldDefinitions.filter((f) => !f.is_archived);
  const archivedFields = fieldDefinitions.filter((f) => f.is_archived);

  const activeItemFields = activeFields.filter((f) => f.target === 'ITEM');
  const activeEventFields = activeFields.filter((f) => f.target === 'EVENT');

  const archivedItemFields = archivedFields.filter((f) => f.target === 'ITEM');
  const archivedEventFields = archivedFields.filter((f) => f.target === 'EVENT');

  const handleToggleArchive = async (field: FieldDefinition) => {
    await db.field_definitions.update(field.id, {
      is_archived: !field.is_archived,
      updated_at: new Date().toISOString(),
    });
  };

  const handleAddOptionChip = () => {
    const trimmed = newOptionChipInput.trim();
    if (trimmed && !newOptionChips.includes(trimmed)) {
      setNewOptionChips([...newOptionChips, trimmed]);
      setNewOptionChipInput('');
    }
  };

  const handleAddEventTypeChip = () => {
    const trimmed = newEventTypeInput.trim();
    if (trimmed && !newEventTypes.includes(trimmed)) {
      setNewEventTypes([...newEventTypes, trimmed]);
      setNewEventTypeInput('');
    }
  };

  const handleAddField = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFieldName.trim()) {
      setFormError('Zadejte prosím název vlastnosti');
      return;
    }

    if (newDataType === 'single_select' && newOptionChips.length === 0) {
      if (newOptionChipInput.trim()) {
        newOptionChips.push(newOptionChipInput.trim());
      } else {
        setFormError('Přidejte alespoň jednu možnost výběru');
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
      if (newDataType === 'single_select') {
        config = {
          options: newOptionChips.map((label) => ({
            id: crypto.randomUUID(),
            label,
          })),
        };
      }

      const assignedEventTypes =
        newTarget === 'EVENT'
          ? newEventScope === 'all'
            ? []
            : newEventTypes
          : [];

      const newField: FieldDefinition = {
        id: fieldId,
        collection_id: collectionId,
        target: newTarget,
        key: key || 'field_' + Date.now(),
        name: newFieldName.trim(),
        data_type: newDataType,
        unit: newDataType === 'number' && newUnit.trim() ? newUnit.trim() : null,
        event_types: assignedEventTypes,
        is_required: newIsRequired,
        is_archived: false,
        display_order: fieldDefinitions.length + 1,
        config,
        validation_rules: {},
        created_at: now,
        updated_at: now,
      };

      await db.field_definitions.add(newField);

      // Reset form
      setNewFieldName('');
      setNewDataType('text');
      setNewUnit('');
      setNewIsRequired(false);
      setNewOptionChips([]);
      setNewOptionChipInput('');
      setNewEventScope('all');
      setNewEventTypes([]);
      setNewEventTypeInput('');
      setFormError(null);
      setIsAdding(false);
    } catch (err: any) {
      setFormError(err?.message || 'Chyba při vytváření vlastnosti');
    }
  };

  const getTypeIcon = (type: FieldDataType) => {
    switch (type) {
      case 'text':
        return <Type className="w-4 h-4 text-sky-500" />;
      case 'long_text':
        return <FileText className="w-4 h-4 text-blue-500" />;
      case 'number':
        return <Hash className="w-4 h-4 text-emerald-500" />;
      case 'date':
        return <Calendar className="w-4 h-4 text-amber-500" />;
      case 'boolean':
        return <ToggleLeft className="w-4 h-4 text-purple-500" />;
      case 'single_select':
        return <ListFilter className="w-4 h-4 text-pink-500" />;
      default:
        return <Sliders className="w-4 h-4 text-slate-400" />;
    }
  };

  const getTypeLabel = (type: FieldDataType) => {
    return getFieldTypeLabel(type);
  };

  const renderFieldList = (fields: FieldDefinition[]) => {
    if (fields.length === 0) {
      return (
        <div className="py-4 text-center text-slate-400 text-xs italic">
          Žádná pole v této skupině
        </div>
      );
    }

    return fields.map((field) => (
      <div
        key={field.id}
        className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-colors"
      >
        <div className="flex items-center gap-3 grow min-w-0 mr-2">
          <div className="p-2 rounded-lg bg-slate-50 border border-slate-100 shrink-0">
            {getTypeIcon(field.data_type)}
          </div>

          <div className="grow min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm text-slate-900 truncate">
                {field.name}
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                {getTypeLabel(field.data_type)}
                {field.unit ? ` (${field.unit})` : ''}
              </span>
              {field.is_required && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-600 font-medium">
                  Povinné
                </span>
              )}

              {/* EVENT target badges */}
              {field.target === 'EVENT' && (
                <span className="inline-flex items-center gap-1">
                  {!field.event_types || field.event_types.length === 0 ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                      Všechny typy
                    </span>
                  ) : (
                    field.event_types.map((type, i) => (
                      <span
                        key={i}
                        className="text-[10px] px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold"
                      >
                        {type}
                      </span>
                    ))
                  )}
                </span>
              )}
            </div>

            {/* Display select options snippet if available */}
            {field.data_type === 'single_select' &&
              field.config?.options &&
              field.config.options.length > 0 && (
                <div className="text-[11px] text-slate-500 truncate mt-0.5">
                  Možnosti:{' '}
                  {field.config.options
                    .filter((o) => !o.is_deleted)
                    .map((o) => o.label)
                    .join(', ')}
                </div>
              )}
          </div>
        </div>

        {/* Field actions */}
        <div className="flex items-center gap-1 shrink-0">
          {activeTab === 'active' ? (
            <>
              <button
                type="button"
                onClick={() => setFieldToEdit(field)}
                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                title="Upravit vlastnost (název, povinnost, volby, převod typu)"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => handleToggleArchive(field)}
                className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                title="Archivovat pole"
              >
                <Archive className="w-4 h-4" />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => handleToggleArchive(field)}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors cursor-pointer"
              title="Obnovit pole z archivu"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Obnovit
            </button>
          )}
        </div>
      </div>
    ));
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-lg text-slate-900">
                Správa vlastních polí
              </h3>
              <p className="text-xs text-slate-500">
                Sekce: <strong className="text-slate-700">{collectionName}</strong>
              </p>
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

        {/* Sub-header / Tabs */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-slate-100 shrink-0 bg-white">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('active')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === 'active'
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Aktivní pole ({activeFields.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('archived')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === 'archived'
                  ? 'bg-slate-100 text-slate-800'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Archivovaná pole ({archivedFields.length})
            </button>
          </div>

          {!isAdding && activeTab === 'active' && (
            <button
              type="button"
              onClick={() => setIsAdding(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              Přidat pole
            </button>
          )}
        </div>

        {/* Content area */}
        <div className="p-6 overflow-y-auto space-y-6 grow">
          {/* Add Field Form */}
          {isAdding && (
            <form
              onSubmit={handleAddField}
              className="p-5 bg-indigo-50/70 rounded-2xl border border-indigo-200/80 space-y-4 animate-in fade-in"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-indigo-950 uppercase tracking-wider">
                  Nové vlastní pole pro sekci {collectionName}
                </h4>
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="text-xs text-slate-500 hover:text-slate-700 cursor-pointer"
                >
                  Zrušit
                </button>
              </div>

              {formError && (
                <div className="p-2.5 text-xs text-red-700 bg-red-100/70 rounded-xl">
                  {formError}
                </div>
              )}

              {/* Target selection: ITEM vs EVENT */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                  Kam pole patří? <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 p-2.5 bg-white rounded-xl border border-slate-200 cursor-pointer grow">
                    <input
                      type="radio"
                      name="fieldTarget"
                      checked={newTarget === 'ITEM'}
                      onChange={() => setNewTarget('ITEM')}
                      className="text-indigo-600"
                    />
                    <div className="text-xs">
                      <strong className="block text-slate-900 font-bold">Vlastnost položky</strong>
                      <span className="text-slate-500 text-[11px]">Hodnota na kartě položky</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-2 p-2.5 bg-white rounded-xl border border-slate-200 cursor-pointer grow">
                    <input
                      type="radio"
                      name="fieldTarget"
                      checked={newTarget === 'EVENT'}
                      onChange={() => setNewTarget('EVENT')}
                      className="text-indigo-600"
                    />
                    <div className="text-xs">
                      <strong className="block text-slate-900 font-bold">Vlastnost události</strong>
                      <span className="text-slate-500 text-[11px]">Hodnota při záznamu v historii</span>
                    </div>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Název pole <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    placeholder="Např. Palivo, Cena servisu..."
                    value={newFieldName}
                    onChange={(e) => setNewFieldName(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:border-indigo-500 outline-none bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Datový typ <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={newDataType}
                    onChange={(e) =>
                      setNewDataType(e.target.value as FieldDataType)
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
              {newDataType === 'number' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Jednotka (volitelně)
                  </label>
                  <input
                    type="text"
                    placeholder="Např. km, Kč, kg, cm, kW, l/100km..."
                    value={newUnit}
                    onChange={(e) => setNewUnit(e.target.value)}
                    className="w-full sm:w-1/2 px-3 py-2 text-xs rounded-xl border border-slate-300 focus:border-indigo-500 outline-none bg-white"
                  />
                </div>
              )}

              {/* Chip option editor for single_select */}
              {newDataType === 'single_select' && (
                <div className="space-y-2 pt-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Možnosti výběru (zadejte možnost a stiskněte Enter)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Např. Benzín, Nafta, LPG..."
                      value={newOptionChipInput}
                      onChange={(e) => setNewOptionChipInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddOptionChip();
                        }
                      }}
                      className="grow px-3 py-2 text-xs rounded-xl border border-slate-300 focus:border-indigo-500 outline-none bg-white"
                    />
                    <button
                      type="button"
                      onClick={handleAddOptionChip}
                      className="px-3 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl cursor-pointer"
                    >
                      Přidat
                    </button>
                  </div>

                  {newOptionChips.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {newOptionChips.map((chip, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-indigo-200 text-xs font-medium text-slate-800 shadow-2xs"
                        >
                          <span>{chip}</span>
                          <button
                            type="button"
                            onClick={() => setNewOptionChips(newOptionChips.filter((_, i) => i !== idx))}
                            className="text-slate-400 hover:text-red-500 rounded-full cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* EVENT specific: event_types filter */}
              {newTarget === 'EVENT' && (
                <div className="p-3 bg-white rounded-xl border border-indigo-100 space-y-2.5 text-xs">
                  <label className="block font-bold text-slate-800">
                    Kdy se má vlastnost nabízet?
                  </label>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="eventScope"
                        checked={newEventScope === 'all'}
                        onChange={() => setNewEventScope('all')}
                        className="text-indigo-600"
                      />
                      <span>Všechny typy událostí</span>
                    </label>

                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="eventScope"
                        checked={newEventScope === 'specific'}
                        onChange={() => setNewEventScope('specific')}
                        className="text-indigo-600"
                      />
                      <span>Jen pro vybrané typy</span>
                    </label>
                  </div>

                  {newEventScope === 'specific' && (
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Zadejte typ (např. Servis, STK) a stiskněte Enter..."
                          value={newEventTypeInput}
                          onChange={(e) => setNewEventTypeInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddEventTypeChip();
                            }
                          }}
                          className="grow px-3 py-1.5 text-xs rounded-lg border border-slate-300 outline-none"
                        />
                        <button
                          type="button"
                          onClick={handleAddEventTypeChip}
                          className="px-3 py-1.5 text-xs font-bold bg-indigo-600 text-white rounded-lg cursor-pointer"
                        >
                          Přidat typ
                        </button>
                      </div>

                      {newEventTypes.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {newEventTypes.map((type, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 text-xs font-bold"
                            >
                              <span>{type}</span>
                              <button
                                type="button"
                                onClick={() => setNewEventTypes(newEventTypes.filter((_, i) => i !== idx))}
                                className="text-indigo-400 hover:text-red-500 cursor-pointer"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newIsRequired}
                    onChange={(e) => setNewIsRequired(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600"
                  />
                  <span className="text-xs text-slate-700">
                    Povinná hodnota při zadávání
                  </span>
                </label>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAdding(false)}
                    className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200/50 rounded-xl cursor-pointer"
                  >
                    Zrušit
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs cursor-pointer"
                  >
                    Uložit pole
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Group 1: Vlastnosti položky (target ITEM) */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 pb-1 border-b border-slate-100">
              <Package className="w-4 h-4 text-indigo-600" />
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Vlastnosti položky (
                {activeTab === 'active' ? activeItemFields.length : archivedItemFields.length}
                )
              </h4>
            </div>
            <div className="space-y-2">
              {renderFieldList(activeTab === 'active' ? activeItemFields : archivedItemFields)}
            </div>
          </div>

          {/* Group 2: Vlastnosti události (target EVENT) */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-2 pb-1 border-b border-slate-100">
              <History className="w-4 h-4 text-purple-600" />
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Vlastnosti události (
                {activeTab === 'active' ? activeEventFields.length : archivedEventFields.length}
                )
              </h4>
            </div>
            <div className="space-y-2">
              {renderFieldList(activeTab === 'active' ? activeEventFields : archivedEventFields)}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200/50 rounded-xl transition-colors cursor-pointer"
          >
            Zavřít
          </button>
        </div>
      </div>

      {/* Field Edit Modal (z-60) */}
      <FieldEditModal
        isOpen={!!fieldToEdit}
        onClose={() => setFieldToEdit(null)}
        field={fieldToEdit}
        collectionId={collectionId}
      />
    </div>
  );
};
