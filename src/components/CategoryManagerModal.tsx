import React, { useState } from 'react';
import { CollectionGroup, Collection } from '../types';
import { db, deleteCollectionGroupAndReassign, reorderCollectionGroups, ensureDefaultCollectionGroup } from '../db';
import {
  X,
  Folders,
  Plus,
  ArrowUp,
  ArrowDown,
  Trash2,
  Check,
  Edit2,
  AlertTriangle,
  FolderPlus,
} from 'lucide-react';

interface CategoryManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  groups: CollectionGroup[];
  collections: Collection[];
  activeGroupId: string | null;
  onSelectGroup: (groupId: string) => void;
  onMoveCollection?: (collectionId: string, targetGroupId: string) => Promise<void>;
}

export const CategoryManagerModal: React.FC<CategoryManagerModalProps> = ({
  isOpen,
  onClose,
  groups,
  collections,
  activeGroupId,
  onSelectGroup,
  onMoveCollection,
}) => {
  const [newGroupName, setNewGroupName] = useState('');
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [movingColId, setMovingColId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [groupToDelete, setGroupToDelete] = useState<{
    group: CollectionGroup;
    sectionsCount: number;
    defaultGroupName: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const defaultGroup = groups.find((g) => g.is_default);

  const handleMoveSection = async (sec: Collection, targetGroupId: string) => {
    if (!targetGroupId || targetGroupId === sec.group_id) return;
    try {
      setError(null);
      setMovingColId(sec.id);
      if (onMoveCollection) {
        await onMoveCollection(sec.id, targetGroupId);
      } else {
        const now = new Date().toISOString();
        await db.transaction('rw', db.collections, async () => {
          await db.collections.update(sec.id, {
            group_id: targetGroupId,
            updated_at: now,
          });
        });
        onSelectGroup(targetGroupId);
      }
      const targetGroup = groups.find((g) => g.id === targetGroupId);
      const msg = `Sekce ${sec.name} byla přesunuta do ${targetGroup ? targetGroup.name : 'vybrané kategorie'}`;
      setSuccessMessage(msg);
      setTimeout(() => setSuccessMessage(null), 3500);
    } catch (err: any) {
      setError(err?.message || 'Chyba při přesouvání sekce');
    } finally {
      setMovingColId(null);
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newGroupName.trim();
    if (!trimmed) {
      setError('Zadejte název kategorie');
      return;
    }

    try {
      setError(null);
      const now = new Date().toISOString();
      const newGroup: CollectionGroup = {
        id: crypto.randomUUID(),
        name: trimmed,
        display_order: groups.length,
        is_default: false,
        created_at: now,
        updated_at: now,
      };

      await db.collection_groups.add(newGroup);
      setNewGroupName('');
      onSelectGroup(newGroup.id);
    } catch (err: any) {
      setError(err?.message || 'Chyba při vytváření kategorie');
    }
  };

  const handleStartRename = (group: CollectionGroup) => {
    setEditingGroupId(group.id);
    setEditingName(group.name);
  };

  const handleSaveRename = async (groupId: string) => {
    const trimmed = editingName.trim();
    if (!trimmed) {
      setEditingGroupId(null);
      return;
    }

    try {
      await db.collection_groups.update(groupId, {
        name: trimmed,
        updated_at: new Date().toISOString(),
      });
      setEditingGroupId(null);
    } catch (err: any) {
      setError(err?.message || 'Chyba při přejmenování');
    }
  };

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= groups.length) return;

    const newOrder = [...groups];
    const [moved] = newOrder.splice(index, 1);
    newOrder.splice(targetIndex, 0, moved);

    await reorderCollectionGroups(newOrder.map((g) => g.id));
  };

  const handleInitiateDelete = (group: CollectionGroup) => {
    if (group.is_default) return;
    const count = collections.filter((c) => c.group_id === group.id).length;
    setGroupToDelete({
      group,
      sectionsCount: count,
      defaultGroupName: defaultGroup ? defaultGroup.name : 'Ostatní',
    });
  };

  const handleConfirmDelete = async () => {
    if (!groupToDelete) return;
    try {
      await deleteCollectionGroupAndReassign(groupToDelete.group.id);
      if (activeGroupId === groupToDelete.group.id && defaultGroup) {
        onSelectGroup(defaultGroup.id);
      }
      setGroupToDelete(null);
    } catch (err: any) {
      setError(err?.message || 'Chyba při mazání kategorie');
    }
  };

  return (
    <>
      {/* Main Category Manager Modal - z-50 */}
      <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                <Folders className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-slate-900">Správa kategorií</h3>
                <p className="text-xs text-slate-500">
                  Uspořádejte sekce do přehledných skupin
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-5 overflow-y-auto grow">
            {error && (
              <div className="p-3 text-xs text-red-700 bg-red-50 rounded-xl border border-red-200">
                {error}
              </div>
            )}

            {successMessage && (
              <div className="p-3 text-xs font-semibold text-emerald-800 bg-emerald-50 rounded-xl border border-emerald-200 transition-all animate-in fade-in">
                {successMessage}
              </div>
            )}

            {/* Create new category */}
            <form onSubmit={handleCreateGroup} className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                Nová kategorie
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Např. Doprava, RC modely, Domácnost..."
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  className="grow px-3.5 py-2 text-xs rounded-xl border border-slate-300 focus:border-indigo-500 outline-none bg-white"
                />
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl cursor-pointer transition-colors shrink-0"
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                  <span>Přidat</span>
                </button>
              </div>
            </form>

            {/* List of categories */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                  Existující kategorie ({groups.length})
                </span>
                <span className="text-[11px] text-slate-400">
                  Pořadí upravíte šipkami
                </span>
              </div>

              <div className="space-y-3">
                {groups.map((group, idx) => {
                  const groupSections = collections.filter(
                    (c) => c.group_id === group.id
                  );
                  const isEditing = editingGroupId === group.id;
                  const otherGroups = groups.filter((g) => g.id !== group.id);

                  return (
                    <div
                      key={group.id}
                      className="p-3 bg-slate-50 hover:bg-slate-100/60 rounded-xl border border-slate-200 transition-colors space-y-2.5"
                    >
                      {/* Category Header: Name, default badge, count, reorder, rename, delete */}
                      <div className="flex items-center justify-between gap-3">
                        <div className="grow min-w-0 flex items-center gap-2">
                          {isEditing ? (
                            <div className="flex items-center gap-2 grow">
                              <input
                                type="text"
                                value={editingName}
                                onChange={(e) => setEditingName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleSaveRename(group.id);
                                  } else if (e.key === 'Escape') {
                                    setEditingGroupId(null);
                                  }
                                }}
                                autoFocus
                                className="grow px-2 py-1 text-xs font-bold text-slate-900 rounded-lg border border-indigo-400 bg-white outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => handleSaveRename(group.id)}
                                className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-lg cursor-pointer"
                                title="Uložit"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingGroupId(null)}
                                className="p-1 text-slate-400 hover:bg-slate-200 rounded-lg cursor-pointer"
                                title="Zrušit"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 truncate">
                              <span className="font-bold text-sm text-slate-800 truncate">
                                {group.name}
                              </span>
                              {group.is_default && (
                                <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 font-bold shrink-0">
                                  výchozí
                                </span>
                              )}
                              <span className="text-[11px] text-slate-400 font-medium shrink-0">
                                ({groupSections.length} {groupSections.length === 1 ? 'sekce' : groupSections.length >= 2 && groupSections.length <= 4 ? 'sekce' : 'sekcí'})
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        {!isEditing && (
                          <div className="flex items-center gap-1 shrink-0">
                            {/* Reorder Up */}
                            <button
                              type="button"
                              onClick={() => handleMove(idx, 'up')}
                              disabled={idx === 0}
                              className={`p-1.5 rounded-lg transition-colors ${
                                idx === 0
                                  ? 'text-slate-300 cursor-not-allowed'
                                  : 'text-slate-500 hover:text-slate-900 hover:bg-white cursor-pointer'
                              }`}
                              title="Posunout nahoru"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>

                            {/* Reorder Down */}
                            <button
                              type="button"
                              onClick={() => handleMove(idx, 'down')}
                              disabled={idx === groups.length - 1}
                              className={`p-1.5 rounded-lg transition-colors ${
                                idx === groups.length - 1
                                  ? 'text-slate-300 cursor-not-allowed'
                                  : 'text-slate-500 hover:text-slate-900 hover:bg-white cursor-pointer'
                              }`}
                              title="Posunout dolů"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>

                            {/* Rename */}
                            <button
                              type="button"
                              onClick={() => handleStartRename(group)}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-lg transition-colors cursor-pointer"
                              title="Přejmenovat kategorii"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            {/* Delete (disabled for default) */}
                            {group.is_default ? (
                              <div
                                className="p-1.5 text-slate-300 cursor-not-allowed"
                                title="Výchozí kategorii nelze smazat"
                              >
                                <Trash2 className="w-3.5 h-3.5 opacity-40" />
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleInitiateDelete(group)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                title="Smazat kategorii (sekce budou přesunuty do výchozí)"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Under each category list its sections; each section row has a "Přesunout do…" select with the other categories. */}
                      <div className="pt-2 border-t border-slate-200/70 space-y-1.5">
                        {groupSections.length === 0 ? (
                          <div className="text-[11px] text-slate-400 italic px-1 py-0.5">
                            Žádné sekce v této kategorii
                          </div>
                        ) : (
                          groupSections.map((sec) => (
                            <div
                              key={sec.id}
                              className="flex items-center justify-between gap-2 px-2.5 py-1.5 bg-white rounded-lg border border-slate-200/80 text-xs hover:border-slate-300 transition-colors"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                                <span
                                  className="font-semibold text-slate-800 truncate"
                                  title={sec.name}
                                >
                                  {sec.name}
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                {otherGroups.length > 0 ? (
                                  <select
                                    value=""
                                    disabled={movingColId === sec.id}
                                    onChange={(e) => {
                                      const targetId = e.target.value;
                                      if (targetId) {
                                        handleMoveSection(sec, targetId);
                                      }
                                    }}
                                    className="text-[11px] font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 focus:bg-white border border-slate-200 rounded-lg px-2 py-1 outline-none focus:border-indigo-400 cursor-pointer transition-colors"
                                    title={`Přesunout sekci „${sec.name}“ do jiné kategorie`}
                                    aria-label={`Přesunout sekci ${sec.name} do jiné kategorie`}
                                  >
                                    <option value="" disabled>
                                      Přesunout do…
                                    </option>
                                    {otherGroups.map((og) => (
                                      <option key={og.id} value={og.id}>
                                        {og.name}
                                      </option>
                                    ))}
                                  </select>
                                ) : (
                                  <span className="text-[10px] text-slate-400 italic">
                                    Jediná kategorie
                                  </span>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end px-6 py-4 border-t border-slate-100 bg-slate-50 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
            >
              Zavřít
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Sub-Modal for Deleting Category - z-60 (Renders above parent dialog) */}
      {groupToDelete && (
        <div className="fixed inset-0 z-60 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-3 text-amber-600">
              <div className="p-2.5 rounded-xl bg-amber-50">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-base text-slate-900">
                  Smazat kategorii „{groupToDelete.group.name}“?
                </h4>
                <p className="text-xs text-slate-500">
                  Kategorie bude odstraněna, sekce zůstanou zachovány.
                </p>
              </div>
            </div>

            <div className="text-xs text-slate-600 bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
              <p>
                Tato kategorie obsahuje <strong>{groupToDelete.sectionsCount}</strong>{' '}
                {groupToDelete.sectionsCount === 1
                  ? 'sekci'
                  : groupToDelete.sectionsCount >= 2 && groupToDelete.sectionsCount <= 4
                  ? 'sekce'
                  : 'sekcí'}.
              </p>
              <p>
                Všechny sekce budou v jedné transakci automaticky přesunuty do výchozí kategorie{' '}
                <strong>„{groupToDelete.defaultGroupName}“</strong>. Žádné sekce ani data nebudou smazány.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setGroupToDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Zrušit
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors cursor-pointer"
              >
                Smazat a přesunout sekce
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
