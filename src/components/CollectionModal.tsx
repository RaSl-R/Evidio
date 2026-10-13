import React, { useState, useEffect } from 'react';
import { Collection, CollectionGroup } from '../types';
import { db } from '../db';
import { X, Layers, Folders, Plus, Check } from 'lucide-react';

interface CollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  collectionToEdit?: Collection | null;
  groups: CollectionGroup[];
  defaultGroupId: string;
  onSave: (data: {
    name: string;
    description: string;
    icon: string;
    group_id: string;
  }) => Promise<void>;
}

export const CollectionModal: React.FC<CollectionModalProps> = ({
  isOpen,
  onClose,
  collectionToEdit,
  groups,
  defaultGroupId,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [groupId, setGroupId] = useState(defaultGroupId);

  // Sub-modal state for creating a new category inline
  const [isNewCategoryOpen, setIsNewCategoryOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryError, setNewCategoryError] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (collectionToEdit) {
      setName(collectionToEdit.name);
      setDescription(collectionToEdit.description || '');
      setGroupId(collectionToEdit.group_id || defaultGroupId);
    } else {
      setName('');
      setDescription('');
      setGroupId(defaultGroupId);
    }
    setError(null);
    setIsNewCategoryOpen(false);
  }, [collectionToEdit, defaultGroupId, isOpen]);

  if (!isOpen) return null;

  const handleCategorySelectChange = (val: string) => {
    if (val === '__NEW__') {
      setIsNewCategoryOpen(true);
      setNewCategoryName('');
      setNewCategoryError(null);
    } else {
      setGroupId(val);
    }
  };

  const handleCreateCategoryInline = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCategoryName.trim();
    if (!trimmed) {
      setNewCategoryError('Zadejte název kategorie');
      return;
    }

    try {
      const now = new Date().toISOString();
      const newCat: CollectionGroup = {
        id: crypto.randomUUID(),
        name: trimmed,
        display_order: groups.length,
        is_default: false,
        created_at: now,
        updated_at: now,
      };

      await db.collection_groups.add(newCat);
      setGroupId(newCat.id);
      setIsNewCategoryOpen(false);
      setNewCategoryName('');
    } catch (err: any) {
      setNewCategoryError(err?.message || 'Chyba při vytváření kategorie');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Zadejte prosím název sekce');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onSave({
        name: name.trim(),
        description: description.trim(),
        icon: 'layers',
        group_id: groupId || defaultGroupId,
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Uložení sekce selhalo');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
                <Layers className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-lg text-slate-900">
                {collectionToEdit ? 'Upravit sekci' : 'Nová sekce'}
              </h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {error && (
              <div className="p-3 text-sm text-red-700 bg-red-50 rounded-xl border border-red-200">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Název sekce <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Např. Auta, RC modely, Hodinky, Knihy..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-slate-900 text-sm transition-all"
              />
            </div>

            {/* Category Select */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-slate-700">
                  Kategorie <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setIsNewCategoryOpen(true)}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>Nová kategorie</span>
                </button>
              </div>
              <select
                value={groupId}
                onChange={(e) => handleCategorySelectChange(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-slate-900 text-sm transition-all bg-white"
              >
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                    {g.is_default ? ' (výchozí)' : ''}
                  </option>
                ))}
                <option value="__NEW__">+ Nová kategorie…</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Popis sekce (volitelně)
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Krátký popis toho, co v této sekci evidujete..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-slate-900 text-sm transition-all resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Zrušit
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md shadow-indigo-100 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting
                  ? 'Ukládám...'
                  : collectionToEdit
                  ? 'Uložit změny'
                  : 'Vytvořit sekci'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Inline Sub-Modal for "+ Nová kategorie…" - z-60 (Renders above CollectionModal) */}
      {isNewCategoryOpen && (
        <div className="fixed inset-0 z-60 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-indigo-600">
                <Folders className="w-5 h-5" />
                <h4 className="font-bold text-base text-slate-900">
                  Nová kategorie
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setIsNewCategoryOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {newCategoryError && (
              <div className="p-2.5 text-xs text-red-700 bg-red-50 rounded-xl border border-red-200">
                {newCategoryError}
              </div>
            )}

            <form onSubmit={handleCreateCategoryInline} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Název kategorie <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  autoFocus
                  required
                  placeholder="Např. Doprava, RC modely..."
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 focus:border-indigo-500 outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewCategoryOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Zrušit
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl cursor-pointer"
                >
                  Vytvořit a vybrat
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
