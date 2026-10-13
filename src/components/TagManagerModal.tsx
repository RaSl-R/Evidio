import React, { useState } from 'react';
import { Tag, Item } from '../types';
import { db } from '../db';
import {
  TAG_PALETTE,
  DEFAULT_TAG_COLOR,
  isTagNameTaken,
  getTagColorOption,
} from '../utils/tagColors';
import {
  X,
  Tags,
  Plus,
  Edit2,
  Trash2,
  Check,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';

interface TagManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  collectionId: string;
  collectionName: string;
  tags: Tag[];
  items: Item[];
}

export const TagManagerModal: React.FC<TagManagerModalProps> = ({
  isOpen,
  onClose,
  collectionId,
  collectionName,
  tags,
  items,
}) => {
  // New tag state
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(DEFAULT_TAG_COLOR);
  const [createError, setCreateError] = useState<string | null>(null);

  // Edit tag state
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [editTagName, setEditTagName] = useState('');
  const [editTagColor, setEditTagColor] = useState('');
  const [editError, setEditError] = useState<string | null>(null);

  // Delete tag confirmation state
  const [tagToDelete, setTagToDelete] = useState<Tag | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen) return null;

  // Items count using a specific tag
  const getAffectedItemsCount = (tagId: string) => {
    return items.filter((item) => item.tag_ids?.includes(tagId)).length;
  };

  const handleCreateTag = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newTagName.trim();
    if (!trimmed) {
      setCreateError('Zadejte název štítku.');
      return;
    }

    if (isTagNameTaken(tags, trimmed)) {
      setCreateError(`Štítek se jménem „${trimmed}“ již v této sekci existuje.`);
      return;
    }

    try {
      const now = new Date().toISOString();
      const newTag: Tag = {
        id: crypto.randomUUID(),
        collection_id: collectionId,
        name: trimmed,
        color: newTagColor,
        created_at: now,
        updated_at: now,
      };

      await db.tags.add(newTag);
      setNewTagName('');
      // Cycle to next color in palette
      const currentIndex = TAG_PALETTE.findIndex((p) => p.hex === newTagColor);
      const nextColor = TAG_PALETTE[(currentIndex + 1) % TAG_PALETTE.length].hex;
      setNewTagColor(nextColor);
      setCreateError(null);
    } catch (err: any) {
      setCreateError(err?.message || 'Chyba při vytváření štítku');
    }
  };

  const startEditingTag = (tag: Tag) => {
    setEditingTagId(tag.id);
    setEditTagName(tag.name);
    setEditTagColor(tag.color);
    setEditError(null);
  };

  const cancelEditing = () => {
    setEditingTagId(null);
    setEditTagName('');
    setEditTagColor('');
    setEditError(null);
  };

  const handleSaveEdit = async (tag: Tag) => {
    const trimmed = editTagName.trim();
    if (!trimmed) {
      setEditError('Název štítku nesmí být prázdný.');
      return;
    }

    if (isTagNameTaken(tags, trimmed, tag.id)) {
      setEditError(`Štítek se jménem „${trimmed}“ již v této sekci existuje.`);
      return;
    }

    try {
      const now = new Date().toISOString();
      await db.tags.update(tag.id, {
        name: trimmed,
        color: editTagColor,
        updated_at: now,
      });
      cancelEditing();
    } catch (err: any) {
      setEditError(err?.message || 'Chyba při úpravě štítku');
    }
  };

  const confirmDeleteTag = async () => {
    if (!tagToDelete) return;
    try {
      setIsDeleting(true);
      const now = new Date().toISOString();

      await db.transaction('rw', [db.tags, db.items], async () => {
        // Delete the tag itself
        await db.tags.delete(tagToDelete.id);

        // Find all items that contain this tag
        const affectedItems = await db.items
          .where('collection_id')
          .equals(collectionId)
          .filter((it) => it.tag_ids?.includes(tagToDelete.id))
          .toArray();

        for (const it of affectedItems) {
          const nextTagIds = (it.tag_ids || []).filter((id) => id !== tagToDelete.id);
          await db.items.update(it.id, {
            tag_ids: nextTagIds,
            updated_at: now,
          });
        }
      });

      setTagToDelete(null);
    } catch (err: any) {
      alert('Chyba při mazání štítku: ' + (err?.message || 'Neznámá chyba'));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-60 overflow-y-auto bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-50 text-indigo-600">
              <Tags className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Správa štítků</h2>
              <p className="text-xs text-slate-500">Sekce „{collectionName}“</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto grow">
          {/* Create New Tag */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-3">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Nový štítek
            </h3>

            <form onSubmit={handleCreateTag} className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTagName}
                  onChange={(e) => {
                    setNewTagName(e.target.value);
                    if (createError) setCreateError(null);
                  }}
                  placeholder="Název štítku (např. VIP, Důležité, V záruce)..."
                  className="grow px-3.5 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 text-slate-900"
                />
                <button
                  type="submit"
                  disabled={!newTagName.trim()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0"
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                  <span>Přidat</span>
                </button>
              </div>

              {/* 8 Preset Colors Palette */}
              <div className="flex items-center gap-2 pt-1 flex-wrap">
                <span className="text-[11px] font-medium text-slate-500 mr-1">Barva:</span>
                {TAG_PALETTE.map((color) => {
                  const isSelected = newTagColor.toLowerCase() === color.hex.toLowerCase();
                  return (
                    <button
                      key={color.id}
                      type="button"
                      onClick={() => setNewTagColor(color.hex)}
                      className={`w-6 h-6 rounded-full transition-all cursor-pointer flex items-center justify-center relative ${
                        isSelected ? 'ring-2 ring-offset-2 ring-indigo-500 scale-110' : 'hover:scale-105'
                      }`}
                      style={{ backgroundColor: color.hex }}
                      title={color.name}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                    </button>
                  );
                })}
              </div>

              {createError && (
                <p className="text-xs text-red-600 font-medium">{createError}</p>
              )}
            </form>
          </div>

          {/* Existing Tags List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Existující štítky ({tags.length})
              </h3>
            </div>

            {tags.length === 0 ? (
              <div className="text-center py-8 px-4 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                <Tags className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-medium text-slate-500">
                  V této sekci zatím nejsou žádné štítky.
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Vytvořte si štítek formulářem výše nebo přímo při úpravě položky.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {tags.map((tag) => {
                  const isEditing = editingTagId === tag.id;
                  const affectedCount = getAffectedItemsCount(tag.id);
                  const colorOption = getTagColorOption(tag.color);

                  if (isEditing) {
                    return (
                      <div
                        key={tag.id}
                        className="p-3 bg-indigo-50/50 rounded-2xl border border-indigo-200 space-y-3 animate-in fade-in"
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={editTagName}
                            onChange={(e) => {
                              setEditTagName(e.target.value);
                              if (editError) setEditError(null);
                            }}
                            className="grow px-3 py-1.5 text-xs rounded-xl border border-indigo-200 bg-white focus:outline-none focus:border-indigo-500 text-slate-900"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(tag)}
                            className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 text-xs font-bold transition-colors cursor-pointer"
                            title="Uložit změny"
                          >
                            <Check className="w-4 h-4 stroke-[2.5]" />
                          </button>
                          <button
                            type="button"
                            onClick={cancelEditing}
                            className="p-2 bg-slate-200 text-slate-600 rounded-xl hover:bg-slate-300 text-xs transition-colors cursor-pointer"
                            title="Zrušit úpravy"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        {/* 8 Preset Colors Palette for Editing */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[11px] font-medium text-slate-600 mr-1">Barva:</span>
                          {TAG_PALETTE.map((color) => {
                            const isSelected = editTagColor.toLowerCase() === color.hex.toLowerCase();
                            return (
                              <button
                                key={color.id}
                                type="button"
                                onClick={() => setEditTagColor(color.hex)}
                                className={`w-5 h-5 rounded-full transition-all cursor-pointer flex items-center justify-center ${
                                  isSelected ? 'ring-2 ring-offset-2 ring-indigo-500 scale-110' : 'hover:scale-105'
                                }`}
                                style={{ backgroundColor: color.hex }}
                                title={color.name}
                              >
                                {isSelected && <Check className="w-3 h-3 text-white stroke-[3]" />}
                              </button>
                            );
                          })}
                        </div>

                        {editError && (
                          <p className="text-xs text-red-600 font-medium">{editError}</p>
                        )}
                      </div>
                    );
                  }

                  return (
                    <div
                      key={tag.id}
                      className="flex items-center justify-between p-2.5 sm:p-3 rounded-2xl bg-white border border-slate-200/80 hover:border-slate-300 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className="w-3.5 h-3.5 rounded-full shrink-0"
                          style={{ backgroundColor: tag.color }}
                        />
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                            colorOption
                              ? `${colorOption.bgClass} ${colorOption.textClass} ${colorOption.borderClass}`
                              : ''
                          }`}
                          style={
                            !colorOption
                              ? {
                                  backgroundColor: `${tag.color}15`,
                                  color: tag.color,
                                  borderColor: `${tag.color}40`,
                                }
                              : undefined
                          }
                        >
                          {tag.name}
                        </span>
                        <span className="text-[11px] text-slate-400 shrink-0">
                          ({affectedCount} {affectedCount === 1 ? 'položka' : affectedCount >= 2 && affectedCount <= 4 ? 'položky' : 'položek'})
                        </span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => startEditingTag(tag)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                          title="Upravit štítek (přejmenovat, změnit barvu)"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setTagToDelete(tag)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="Smazat štítek"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/70 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors cursor-pointer"
          >
            Zavřít
          </button>
        </div>

        {/* Delete Confirmation Modal Layer */}
        {tagToDelete && (
          <div className="fixed inset-0 z-70 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-red-100 overflow-hidden p-6 space-y-4 animate-in fade-in zoom-in-95">
              <div className="flex items-center gap-3 text-red-600">
                <div className="p-2.5 rounded-xl bg-red-100">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-base text-slate-900">Smazat štítek</h3>
              </div>

              <div className="text-xs text-slate-600 space-y-2">
                <p>
                  Opravdu chcete smazat štítek <strong>„{tagToDelete.name}“</strong>?
                </p>
                <div className="p-3 bg-amber-50 text-amber-900 rounded-xl border border-amber-200/80">
                  Štítek bude v jedné transakci smazán a odebrán z{' '}
                  <strong>
                    {getAffectedItemsCount(tagToDelete.id)}{' '}
                    {getAffectedItemsCount(tagToDelete.id) === 1
                      ? 'položky'
                      : getAffectedItemsCount(tagToDelete.id) >= 2 &&
                        getAffectedItemsCount(tagToDelete.id) <= 4
                      ? 'položek'
                      : 'položek'}
                  </strong>
                  .
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setTagToDelete(null)}
                  disabled={isDeleting}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Zrušit
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteTag}
                  disabled={isDeleting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-xl transition-colors cursor-pointer shadow-xs"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{isDeleting ? 'Mazání...' : 'Smazat štítek'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
