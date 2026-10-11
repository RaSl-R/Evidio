/**
 * Evidio - Universal Personal Inventory
 * Iteration 2a Implementation conforming to DATA_MODEL.md
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, seedDemoCollectionIfEmpty, seedDemoEventFieldsIfMissing } from './db';
import { migrateSelectLabelsToIdsIfAny } from './utils/migration';
import { Collection, Item, FieldDefinition, ItemEvent } from './types';
import { itemMatchesSearch } from './utils/search';
import { exportCollectionPackage } from './utils/export';

// Components
import { Navbar } from './components/Navbar';
import { CollectionModal } from './components/CollectionModal';
import { DeleteCollectionModal } from './components/DeleteCollectionModal';
import { FieldManagerModal } from './components/FieldManagerModal';
import { ItemModal } from './components/ItemModal';
import { ItemDetailModal } from './components/ItemDetailModal';
import { EventModal } from './components/EventModal';
import { ItemCard } from './components/ItemCard';
import { EmptyState } from './components/EmptyState';

import {
  Search,
  Plus,
  Sliders,
  Download,
  X,
  Edit2,
  Trash2,
} from 'lucide-react';

export default function App() {
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [isCollectionModalOpen, setIsCollectionModalOpen] = useState(false);
  const [collectionToEdit, setCollectionToEdit] = useState<Collection | null>(null);

  const [isDeleteCollectionOpen, setIsDeleteCollectionOpen] = useState(false);
  const [isFieldManagerOpen, setIsFieldManagerOpen] = useState(false);

  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<Item | null>(null);

  // Detail & Timeline modal state: track item ID to always get fresh item data
  const [selectedDetailItemId, setSelectedDetailItemId] = useState<string | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Event modal state
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [eventItemTarget, setEventItemTarget] = useState<Item | null>(null);
  const [eventToEdit, setEventToEdit] = useState<ItemEvent | null>(null);

  const [itemToDelete, setItemToDelete] = useState<Item | null>(null);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  // 1. Reactive Dexie queries
  const collections = useLiveQuery(() => db.collections.orderBy('display_order').toArray());

  // 2. Initialize and seed demo collection and demo events if brand new / missing
  useEffect(() => {
    async function init() {
      const defaultId = await seedDemoCollectionIfEmpty();
      await seedDemoEventFieldsIfMissing();
      await migrateSelectLabelsToIdsIfAny();
      if (defaultId && !activeCollectionId) {
        setActiveCollectionId(defaultId);
      }
    }
    init();
  }, []);

  // Sync activeCollectionId when collections load
  useEffect(() => {
    if (collections && collections.length > 0) {
      if (!activeCollectionId || !collections.find((c) => c.id === activeCollectionId)) {
        setActiveCollectionId(collections[0].id);
      }
    } else if (collections && collections.length === 0) {
      setActiveCollectionId(null);
    }
  }, [collections, activeCollectionId]);

  const activeCollection = useMemo(() => {
    if (!collections || !activeCollectionId) return null;
    return collections.find((c) => c.id === activeCollectionId) || null;
  }, [collections, activeCollectionId]);

  // 3. Reactive queries for active collection
  const fieldDefinitions = useLiveQuery<FieldDefinition[]>(
    () =>
      activeCollectionId
        ? db.field_definitions
            .where('collection_id')
            .equals(activeCollectionId)
            .sortBy('display_order')
        : Promise.resolve([] as FieldDefinition[]),
    [activeCollectionId]
  );

  const items = useLiveQuery<Item[]>(
    () =>
      activeCollectionId
        ? db.items
            .where('collection_id')
            .equals(activeCollectionId)
            .reverse()
            .sortBy('updated_at')
        : Promise.resolve([] as Item[]),
    [activeCollectionId]
  );

  // Always keep currentDetailItem reactively synced with live items query
  const currentDetailItem = useMemo(() => {
    if (!selectedDetailItemId || !items) return null;
    return items.find((i) => i.id === selectedDetailItemId) || null;
  }, [selectedDetailItemId, items]);

  // If the item currently viewed in detail was deleted or ceases to exist, close detail
  useEffect(() => {
    if (isDetailModalOpen && selectedDetailItemId && items && items.length > 0) {
      const exists = items.some((i) => i.id === selectedDetailItemId);
      if (!exists) {
        setIsDetailModalOpen(false);
        setSelectedDetailItemId(null);
      }
    }
  }, [items, isDetailModalOpen, selectedDetailItemId]);

  // Reactive query for all events in this collection for search matching and type suggestions
  const collectionEvents = useLiveQuery<ItemEvent[]>(async () => {
    if (!items || items.length === 0) return [];
    const itemIds = items.map((i) => i.id);
    return await db.events.where('item_id').anyOf(itemIds).toArray();
  }, [items]);

  // Map item_id -> ItemEvent[]
  const eventsByItem = useMemo(() => {
    const map = new Map<string, ItemEvent[]>();
    if (collectionEvents) {
      for (const ev of collectionEvents) {
        const list = map.get(ev.item_id) || [];
        list.push(ev);
        map.set(ev.item_id, list);
      }
    }
    return map;
  }, [collectionEvents]);

  // Unique event types used in this collection
  const existingEventTypes = useMemo(() => {
    if (!collectionEvents) return [];
    return Array.from(new Set(collectionEvents.map((e) => e.event_type))).filter(Boolean);
  }, [collectionEvents]);

  // 4. Search filtering (Diacritics-insensitive, token-based, including events)
  const filteredItems = useMemo(() => {
    if (!items) return [];
    if (!searchQuery.trim()) return items;

    return items.filter((item) =>
      itemMatchesSearch(
        item,
        fieldDefinitions || [],
        searchQuery,
        eventsByItem.get(item.id) || []
      )
    );
  }, [items, fieldDefinitions, searchQuery, eventsByItem]);

  // Handlers
  const handleSaveCollection = async (data: {
    name: string;
    description: string;
    icon: string;
  }) => {
    const now = new Date().toISOString();
    if (collectionToEdit) {
      await db.collections.update(collectionToEdit.id, {
        name: data.name,
        description: data.description,
        icon: data.icon,
        updated_at: now,
      });
    } else {
      const newId = crypto.randomUUID();
      const count = await db.collections.count();
      const newCol: Collection = {
        id: newId,
        name: data.name,
        description: data.description,
        icon: data.icon,
        display_order: count,
        created_at: now,
        updated_at: now,
      };
      await db.collections.add(newCol);
      setActiveCollectionId(newId);
    }
    setCollectionToEdit(null);
  };

  const handleExport = async () => {
    if (!activeCollection) return;
    try {
      await exportCollectionPackage(activeCollection.id);
      setExportNotice(`Sekce „${activeCollection.name}“ byla úspěšně exportována.`);
      setTimeout(() => setExportNotice(null), 4000);
    } catch (err: any) {
      alert('Chyba při exportu: ' + (err?.message || 'Neznámá chyba'));
    }
  };

  // Deleting an item and all its child events and attachments in ONE atomic Dexie transaction
  const handleDeleteItem = async () => {
    if (!itemToDelete) return;
    try {
      await db.transaction('rw', [db.items, db.events, db.attachments], async () => {
        await db.events.where('item_id').equals(itemToDelete.id).delete();
        await db.attachments.where('item_id').equals(itemToDelete.id).delete();
        await db.items.delete(itemToDelete.id);
      });

      if (selectedDetailItemId === itemToDelete.id) {
        setIsDetailModalOpen(false);
        setSelectedDetailItemId(null);
      }
      setItemToDelete(null);
    } catch (err: any) {
      alert('Chyba při mazání položky: ' + (err?.message || 'Neznámá chyba'));
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/60 text-slate-900 flex flex-col font-sans">
      {/* Top Navbar with prominent section switcher */}
      <Navbar
        collections={collections || []}
        activeCollection={activeCollection}
        onSelectCollection={(c) => {
          setActiveCollectionId(c.id);
          setSearchQuery('');
          setIsDetailModalOpen(false);
          setSelectedDetailItemId(null);
        }}
        onOpenCreateCollection={() => {
          setCollectionToEdit(null);
          setIsCollectionModalOpen(true);
        }}
      />

      {/* Export Notice Banner */}
      {exportNotice && (
        <div className="bg-emerald-600 text-white text-xs font-semibold px-4 py-2 text-center transition-all animate-in fade-in">
          {exportNotice}
        </div>
      )}

      {/* Main Content Area */}
      <main className="grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-7">
        {!activeCollection ? (
          <EmptyState
            type="no-collections"
            onAction={() => {
              setCollectionToEdit(null);
              setIsCollectionModalOpen(true);
            }}
            actionLabel="Vytvořit první sekci"
          />
        ) : (
          <div className="space-y-6">
            {/* Section Header Bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-xs">
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                    {activeCollection.name}
                  </h1>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700">
                    {items ? `${items.length} položek` : '...'}
                  </span>
                </div>
                {activeCollection.description && (
                  <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl leading-relaxed">
                    {activeCollection.description}
                  </p>
                )}
              </div>

              {/* Action Buttons Toolbar */}
              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                <button
                  type="button"
                  onClick={() => setIsFieldManagerOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200/80 rounded-xl transition-colors cursor-pointer"
                  title="Správa vlastních polí této sekce"
                >
                  <Sliders className="w-4 h-4 text-slate-500" />
                  <span>Vlastní pole</span>
                  <span className="text-[11px] font-bold bg-white px-1.5 py-0.2 rounded-md text-slate-600 border border-slate-200">
                    {fieldDefinitions ? fieldDefinitions.filter((f) => !f.is_archived).length : 0}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleExport}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200/80 rounded-xl transition-colors cursor-pointer"
                  title="Exportovat sekci do JSON"
                >
                  <Download className="w-4 h-4 text-slate-500" />
                  <span className="hidden sm:inline">Export</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCollectionToEdit(activeCollection);
                    setIsCollectionModalOpen(true);
                  }}
                  className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                  title="Přejmenovat sekci"
                  aria-label="Přejmenovat sekci"
                >
                  <Edit2 className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => setIsDeleteCollectionOpen(true)}
                  className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                  title="Smazat sekci"
                  aria-label="Smazat sekci"
                >
                  <Trash2 className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setItemToEdit(null);
                    setIsItemModalOpen(true);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md shadow-indigo-100 transition-all hover:scale-[1.01] cursor-pointer ml-1"
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                  <span>Přidat položku</span>
                </button>
              </div>
            </div>

            {/* Search and Filter Controls */}
            {items && items.length > 0 && (
              <div className="flex items-center gap-3">
                <div className="relative grow max-w-md">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Hledat položky či události (např. 'skoda', 'servis', 'olej')..."
                    className="w-full pl-9 pr-9 py-2 rounded-xl border border-slate-200 bg-white text-xs outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 text-slate-900 transition-all"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="p-1 rounded-md text-slate-400 hover:text-slate-600 absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer"
                      title="Vymazat hledání"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {searchQuery && (
                  <span className="text-xs text-slate-500 hidden sm:inline">
                    Nalezeno: <strong>{filteredItems.length}</strong> z {items.length}
                  </span>
                )}
              </div>
            )}

            {/* Items Grid / Empty State */}
            {items && items.length === 0 ? (
              <EmptyState
                type="no-items"
                onAction={() => {
                  setItemToEdit(null);
                  setIsItemModalOpen(true);
                }}
                actionLabel="Vytvořit první položku"
              />
            ) : filteredItems.length === 0 ? (
              <EmptyState
                type="no-search"
                searchQuery={searchQuery}
                onAction={() => setSearchQuery('')}
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredItems.map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    fields={fieldDefinitions || []}
                    events={eventsByItem.get(item.id) || []}
                    onOpenDetail={(it) => {
                      setSelectedDetailItemId(it.id);
                      setIsDetailModalOpen(true);
                    }}
                    onEdit={(it) => {
                      setItemToEdit(it);
                      setIsItemModalOpen(true);
                    }}
                    onDelete={(it) => setItemToDelete(it)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Layer 1: Base Modals (z-50) */}
      <CollectionModal
        isOpen={isCollectionModalOpen}
        onClose={() => {
          setIsCollectionModalOpen(false);
          setCollectionToEdit(null);
        }}
        collectionToEdit={collectionToEdit}
        onSave={handleSaveCollection}
      />

      <DeleteCollectionModal
        isOpen={isDeleteCollectionOpen}
        onClose={() => setIsDeleteCollectionOpen(false)}
        collection={activeCollection}
        onDeleted={() => {
          setActiveCollectionId(null);
          setIsDetailModalOpen(false);
          setSelectedDetailItemId(null);
        }}
      />

      <FieldManagerModal
        isOpen={isFieldManagerOpen}
        onClose={() => setIsFieldManagerOpen(false)}
        collectionId={activeCollection?.id || ''}
        collectionName={activeCollection?.name || ''}
        fieldDefinitions={fieldDefinitions || []}
      />

      {/* Layer 2: Item Detail Modal with Event Timeline (z-50) */}
      <ItemDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedDetailItemId(null);
        }}
        item={currentDetailItem}
        fields={fieldDefinitions || []}
        onEditItem={(it) => {
          setItemToEdit(it);
          setIsItemModalOpen(true);
        }}
        onDeleteItem={(it) => setItemToDelete(it)}
        onOpenCreateEvent={(it) => {
          setEventItemTarget(it);
          setEventToEdit(null);
          setIsEventModalOpen(true);
        }}
        onOpenEditEvent={(ev) => {
          setEventItemTarget(currentDetailItem);
          setEventToEdit(ev);
          setIsEventModalOpen(true);
        }}
      />

      {/* Layer 3: Secondary Action Modals (z-60, rendered after ItemDetailModal so they appear on top) */}
      <ItemModal
        isOpen={isItemModalOpen}
        onClose={() => {
          setIsItemModalOpen(false);
          setItemToEdit(null);
        }}
        collectionId={activeCollection?.id || ''}
        collectionName={activeCollection?.name || ''}
        fieldDefinitions={fieldDefinitions || []}
        itemToEdit={itemToEdit}
      />

      <EventModal
        isOpen={isEventModalOpen}
        onClose={() => {
          setIsEventModalOpen(false);
          setEventToEdit(null);
          setEventItemTarget(null);
        }}
        itemId={eventItemTarget?.id || ''}
        itemName={eventItemTarget?.name || ''}
        collectionId={activeCollection?.id || ''}
        collectionName={activeCollection?.name || ''}
        fieldDefinitions={fieldDefinitions || []}
        existingEventTypes={existingEventTypes}
        eventToEdit={eventToEdit}
      />

      {/* Layer 4: High-Priority Confirmation Dialogs (z-70, on top of all modals) */}
      {itemToDelete && (
        <div className="fixed inset-0 z-70 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
            <h4 className="font-bold text-base text-slate-900">
              Smazat položku?
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Opravdu chcete smazat položku{' '}
              <strong className="text-slate-900">„{itemToDelete.name}“</strong>{' '}
              včetně všech jejích zaznamenaných událostí v historii? Tuto akci nelze vrátit zpět.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                className="px-3.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Zrušit
              </button>
              <button
                type="button"
                onClick={handleDeleteItem}
                className="px-4 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-xs cursor-pointer"
              >
                Smazat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
