import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Item, FieldDefinition, FieldDataType, SelectOption, Attachment, Tag } from '../types';
import { db } from '../db';
import { FIELD_DATA_TYPE_LABELS, CREATABLE_FIELD_TYPES } from '../utils/fieldTypes';
import { processImageFile } from '../utils/image';
import { TAG_PALETTE, findMatchingTag, getTagColorOption } from '../utils/tagColors';
import { ItemPhotoThumbnail } from './ItemPhotoThumbnail';
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
  Image as ImageIcon,
  Upload,
  Loader2,
  AlertCircle,
  Tags,
} from 'lucide-react';

interface StagedPhoto {
  id: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  blob: Blob;
  isExisting: boolean;
}

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

  // Photos state (max 10 photos per item)
  const [stagedPhotos, setStagedPhotos] = useState<StagedPhoto[]>([]);
  const [deletedPhotoIds, setDeletedPhotoIds] = useState<string[]>([]);
  const [isProcessingPhotos, setIsProcessingPhotos] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  // Tags state
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

  // Live query for all tags in this collection
  const collectionTags = useLiveQuery<Tag[]>(
    () =>
      collectionId
        ? db.tags.where('collection_id').equals(collectionId).toArray()
        : Promise.resolve([] as Tag[]),
    [collectionId]
  ) || [];

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
    let isCancelled = false;

    if (itemToEdit) {
      setName(itemToEdit.name);
      setDataValues({ ...(itemToEdit.data || {}) });
      setSelectedTagIds(itemToEdit.tag_ids ? [...itemToEdit.tag_ids] : []);

      // Load existing attachments for this item (photos only)
      db.attachments
        .where('item_id')
        .equals(itemToEdit.id)
        .filter((a) => !a.event_id && (a.mime_type?.startsWith('image/') ?? false))
        .toArray()
        .then((atts) => {
          if (isCancelled) return;
          atts.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
          setStagedPhotos(
            atts.map((a) => ({
              id: a.id,
              file_name: a.file_name,
              mime_type: a.mime_type,
              size_bytes: a.size_bytes,
              blob: a.blob!,
              isExisting: true,
            }))
          );
        });
    } else {
      setName('');
      setSelectedTagIds([]);
      const initial: Record<string, any> = {};
      for (const f of activeFields) {
        if (f.data_type === 'boolean') {
          initial[f.id] = false;
        }
      }
      setDataValues(initial);
      setStagedPhotos([]);
    }
    setTagInput('');
    setDeletedPhotoIds([]);
    setPhotoError(null);
    setErrors({});
    setIsAddingField(false);

    return () => {
      isCancelled = true;
    };
  }, [itemToEdit, isOpen]);

  const handleAddTag = async (rawName: string) => {
    const trimmed = rawName.trim();
    if (!trimmed) return;

    // Check if tag with this name already exists in this collection (case/diacritics-insensitive)
    const existing = findMatchingTag(collectionTags, trimmed);
    if (existing) {
      if (!selectedTagIds.includes(existing.id)) {
        setSelectedTagIds((prev) => [...prev, existing.id]);
      }
      setTagInput('');
      return;
    }

    // Otherwise create inline with next palette color
    try {
      const now = new Date().toISOString();
      const newTagId = crypto.randomUUID();
      const color = TAG_PALETTE[collectionTags.length % TAG_PALETTE.length].hex;
      const newTag: Tag = {
        id: newTagId,
        collection_id: collectionId,
        name: trimmed,
        color,
        created_at: now,
        updated_at: now,
      };

      await db.tags.add(newTag);
      setSelectedTagIds((prev) => [...prev, newTagId]);
      setTagInput('');
    } catch (err: any) {
      alert('Chyba při vytváření štítku: ' + (err?.message || 'Neznámá chyba'));
    }
  };

  const handleRemoveTag = (tagId: string) => {
    setSelectedTagIds((prev) => prev.filter((id) => id !== tagId));
  };

  const handlePhotoFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remainingSlots = 10 - stagedPhotos.length;
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
    const added: StagedPhoto[] = [];

    for (const file of filesToProcess) {
      try {
        const processed = await processImageFile(file);
        added.push({
          id: crypto.randomUUID(),
          file_name: processed.file_name,
          mime_type: processed.mime_type,
          size_bytes: processed.size_bytes,
          blob: processed.blob,
          isExisting: false,
        });
      } catch (err: any) {
        setPhotoError(err?.message || `Soubor „${file.name}“ se nepodařilo zpracovat.`);
      }
    }

    if (added.length > 0) {
      setStagedPhotos((prev) => [...prev, ...added]);
    }

    setIsProcessingPhotos(false);
    e.target.value = '';
  };

  const handleSetMainPhoto = (idx: number) => {
    setStagedPhotos((prev) => {
      const next = [...prev];
      const [item] = next.splice(idx, 1);
      next.unshift(item);
      return next;
    });
  };

  const handleDeletePhoto = (photo: StagedPhoto, idx: number) => {
    if (window.confirm('Opravdu chcete smazat tuto fotografii?')) {
      if (photo.isExisting) {
        setDeletedPhotoIds((prev) => [...prev, photo.id]);
      }
      setStagedPhotos((prev) => prev.filter((_, i) => i !== idx));
    }
  };

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

      const targetItemId = itemToEdit ? itemToEdit.id : crypto.randomUUID();

      await db.transaction('rw', [db.items, db.attachments], async () => {
        // Delete removed attachments if any
        if (deletedPhotoIds.length > 0) {
          await db.attachments.bulkDelete(deletedPhotoIds);
        }

        // Put staged photos with sort_order
        for (let i = 0; i < stagedPhotos.length; i++) {
          const photo = stagedPhotos[i];
          const att: Attachment = {
            id: photo.id,
            item_id: targetItemId,
            event_id: null,
            file_name: photo.file_name,
            mime_type: photo.mime_type,
            size_bytes: photo.size_bytes,
            sort_order: i,
            blob: photo.blob,
            created_at: now,
            updated_at: now,
          };
          await db.attachments.put(att);
        }

        if (itemToEdit) {
          await db.items.update(itemToEdit.id, {
            name: name.trim(),
            tag_ids: selectedTagIds,
            data: {
              ...itemToEdit.data,
              ...cleanedData,
            },
            updated_at: now,
          });
        } else {
          const newItem: Item = {
            id: targetItemId,
            collection_id: collectionId,
            item_type_id: null,
            name: name.trim(),
            tag_ids: selectedTagIds,
            data: cleanedData,
            created_at: now,
            updated_at: now,
          };
          await db.items.add(newItem);
        }
      });

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

            {/* Štítky (Tags) */}
            <div className="space-y-2">
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-800 uppercase tracking-wide">
                <Tags className="w-3.5 h-3.5 text-slate-500" />
                <span>Štítky</span>
              </label>

              {/* Selected tag chips */}
              {selectedTagIds.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-1">
                  {selectedTagIds.map((tid) => {
                    const tag = collectionTags.find((t) => t.id === tid);
                    if (!tag) return null;
                    const opt = getTagColorOption(tag.color);
                    return (
                      <span
                        key={tag.id}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                          opt
                            ? `${opt.bgClass} ${opt.textClass} ${opt.borderClass}`
                            : ''
                        }`}
                        style={
                          !opt
                            ? {
                                backgroundColor: `${tag.color}15`,
                                color: tag.color,
                                borderColor: `${tag.color}40`,
                              }
                            : undefined
                        }
                      >
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: tag.color }}
                        />
                        <span>{tag.name}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(tag.id)}
                          className="p-0.5 rounded-full hover:bg-black/10 transition-colors cursor-pointer ml-0.5"
                          title={`Odebrat štítek ${tag.name}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}

              {/* Tag Input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Přidat štítek (napište a stiskněte Enter)..."
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTag(tagInput);
                    }
                  }}
                  className="grow px-3.5 py-2 text-xs rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-slate-900 transition-all"
                />
                <button
                  type="button"
                  onClick={() => handleAddTag(tagInput)}
                  disabled={!tagInput.trim()}
                  className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200/80 disabled:opacity-50 rounded-xl transition-colors cursor-pointer shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Přidat</span>
                </button>
              </div>

              {/* Suggestion chips of unselected existing tags in this collection */}
              {collectionTags.filter((t) => !selectedTagIds.includes(t.id)).length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                  <span className="text-[11px] text-slate-400">Dostupné:</span>
                  {collectionTags
                    .filter((t) => !selectedTagIds.includes(t.id))
                    .map((t) => {
                      const opt = getTagColorOption(t.color);
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setSelectedTagIds((prev) => [...prev, t.id])}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border border-dashed hover:border-solid transition-all cursor-pointer ${
                            opt
                              ? `${opt.bgClass} ${opt.textClass} ${opt.borderClass}`
                              : 'bg-slate-50 text-slate-600 border-slate-300'
                          }`}
                          title={`Přidat štítek ${t.name}`}
                        >
                          <Plus className="w-2.5 h-2.5" />
                          <span>{t.name}</span>
                        </button>
                      );
                    })}
                </div>
              )}
            </div>

            {/* Photos Section */}
            <div className="pt-3 border-t border-slate-100 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4 text-slate-500" />
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Fotografie ({stagedPhotos.length} / 10)
                  </span>
                </div>

                {stagedPhotos.length < 10 && (
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors cursor-pointer">
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

              {stagedPhotos.length > 0 ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                  {stagedPhotos.map((photo, idx) => (
                    <ItemPhotoThumbnail
                      key={photo.id}
                      id={photo.id}
                      fileName={photo.file_name}
                      blob={photo.blob}
                      sizeBytes={photo.size_bytes}
                      isMain={idx === 0}
                      onSetMain={idx > 0 ? () => handleSetMainPhoto(idx) : undefined}
                      onDelete={() => handleDeletePhoto(photo, idx)}
                    />
                  ))}
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center p-5 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50 hover:bg-slate-50 transition-colors cursor-pointer text-slate-400 hover:text-slate-600">
                  <ImageIcon className="w-8 h-8 stroke-[1.5] mb-1.5 text-slate-300" />
                  <span className="text-xs font-semibold text-slate-600">
                    Klikněte pro nahrání fotografií
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
