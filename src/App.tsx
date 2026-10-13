/**
 * Evidio - Universal Personal Inventory
 * Iteration 2a Implementation conforming to DATA_MODEL.md
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, seedDemoCollectionIfEmpty, seedDemoEventFieldsIfMissing, DEFAULT_GROUP_ID } from './db';
import { migrateSelectLabelsToIdsIfAny } from './utils/migration';
import { Collection, CollectionGroup, Item, FieldDefinition, ItemEvent, Attachment, Tag } from './types';
import { itemMatchesSearch } from './utils/search';
import { exportCollectionPackage, exportAllPackage, getLastBackupDate, getAttachmentsTotalSizeBytes } from './utils/export';
import { getTagColorOption } from './utils/tagColors';

// Components
import { Navbar } from './components/Navbar';
import { CollectionModal } from './components/CollectionModal';
import { CategoryManagerModal } from './components/CategoryManagerModal';
import { DeleteCollectionModal } from './components/DeleteCollectionModal';
import { FieldManagerModal } from './components/FieldManagerModal';
import { TagManagerModal } from './components/TagManagerModal';
import { ItemModal } from './components/ItemModal';
import { ItemDetailModal } from './components/ItemDetailModal';
import { EventModal } from './components/EventModal';
import { ImportModal } from './components/ImportModal';
import { StorageInfoModal } from './components/StorageInfoModal';
import { ExportWarningModal } from './components/ExportWarningModal';
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
  HardDrive,
  MoreHorizontal,
  Tags,
  Check,
} from 'lucide-react';

export default function App() {
  const [activeGroupId, setActiveGroupId] = useState<string | null>(() => {
    try {
      return localStorage.getItem('evidio_active_group_id') || null;
    } catch {
      return null;
    }
  });

  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(() => {
    try {
      return localStorage.getItem('evidio_active_collection_id') || null;
    } catch {
      return null;
    }
  });

  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
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

  // Tag filter & Tag manager
  const [selectedFilterTagIds, setSelectedFilterTagIds] = useState<string[]>([]);
  const [isTagManagerOpen, setIsTagManagerOpen] = useState(false);

  // Import modal & backup status
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [lastBackupDate, setLastBackupDate] = useState<string | null>(() => getLastBackupDate());

  // Storage info modal & Export warning
  const [isStorageModalOpen, setIsStorageModalOpen] = useState(false);
  const [isSectionMenuOpen, setIsSectionMenuOpen] = useState(false);
  const sectionMenuRef = useRef<HTMLDivElement>(null);

  // Click outside to close section header menu
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (sectionMenuRef.current && !sectionMenuRef.current.contains(e.target as Node)) {
        setIsSectionMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsSectionMenuOpen(false);
      }
    };
    if (isSectionMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isSectionMenuOpen]);

  const [exportWarning, setExportWarning] = useState<{
    isOpen: boolean;
    totalPhotoBytes: number;
    isFullBackup: boolean;
    collectionId?: string;
  } | null>(null);

  // 1. Reactive Dexie queries
  const collectionGroups = useLiveQuery(() => db.collection_groups.orderBy('display_order').toArray());
  const collections = useLiveQuery(() => db.collections.orderBy('display_order').toArray());
  const allAttachments = useLiveQuery(() => db.attachments.toArray());

  // Map each item to its main photo (lowest sort_order, where event_id is null)
  const mainPhotoByItem = useMemo(() => {
    const map = new Map<string, Attachment>();
    if (!allAttachments) return map;
    const byItem = new Map<string, Attachment[]>();
    for (const a of allAttachments) {
      if (!a.event_id && a.mime_type?.startsWith('image/')) {
        const list = byItem.get(a.item_id) || [];
        list.push(a);
        byItem.set(a.item_id, list);
      }
    }
    for (const [itemId, list] of byItem.entries()) {
      list.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
      if (list.length > 0) {
        map.set(itemId, list[0]);
      }
    }
    return map;
  }, [allAttachments]);

  // 2. Initialize and seed demo collection and demo events if brand new / missing
  useEffect(() => {
    async function init() {
      // Call navigator.storage.persist() once at startup
      if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
        navigator.storage.persist().catch(() => {});
      }

      const defaultId = await seedDemoCollectionIfEmpty();
      await seedDemoEventFieldsIfMissing();
      await migrateSelectLabelsToIdsIfAny();
      if (defaultId && !activeCollectionId) {
        setActiveCollectionId(defaultId);
        try {
          localStorage.setItem('evidio_active_collection_id', defaultId);
        } catch {}
      }
    }
    init();
  }, []);

  const defaultGroup = useMemo(() => {
    if (!collectionGroups) return null;
    return collectionGroups.find((g) => g.is_default) || null;
  }, [collectionGroups]);

  // Visible groups rule:
  // "A group is visible unless it is the default group AND has no sections."
  const visibleGroups = useMemo(() => {
    if (!collectionGroups || !collections) return [];
    return collectionGroups.filter((g) => {
      const sectionCount = collections.filter((c) => c.group_id === g.id).length;
      return !(g.is_default && sectionCount === 0);
    });
  }, [collectionGroups, collections]);

  // Sync activeGroupId when visibleGroups change
  useEffect(() => {
    if (visibleGroups.length > 0) {
      if (!activeGroupId || !visibleGroups.some((g) => g.id === activeGroupId)) {
        const nextGid = visibleGroups[0].id;
        setActiveGroupId(nextGid);
        try {
          localStorage.setItem('evidio_active_group_id', nextGid);
        } catch {}
      }
    } else if (defaultGroup && !activeGroupId) {
      setActiveGroupId(defaultGroup.id);
      try {
        localStorage.setItem('evidio_active_group_id', defaultGroup.id);
      } catch {}
    }
  }, [visibleGroups, activeGroupId, defaultGroup]);

  // Collections displayed in section tabs:
  // "If only ONE group is visible, the UI looks exactly like now (no category row)."
  // "With 2+ visible groups: ... section tabs show only sections of the selected category."
  const tabCollections = useMemo(() => {
    if (!collections) return [];
    if (visibleGroups.length <= 1) {
      return collections;
    }
    return collections.filter((c) => c.group_id === activeGroupId);
  }, [collections, visibleGroups, activeGroupId]);

  // Sync activeCollectionId with tabCollections
  useEffect(() => {
    if (tabCollections.length > 0) {
      if (!activeCollectionId || !tabCollections.some((c) => c.id === activeCollectionId)) {
        const nextId = tabCollections[0].id;
        setActiveCollectionId(nextId);
        try {
          localStorage.setItem('evidio_active_collection_id', nextId);
        } catch {}
      }
    } else if (tabCollections.length === 0) {
      setActiveCollectionId(null);
    }
  }, [tabCollections, activeCollectionId]);

  const activeCollection = useMemo(() => {
    if (!collections || !activeCollectionId) return null;
    return collections.find((c) => c.id === activeCollectionId) || null;
  }, [collections, activeCollectionId]);

  const handleSelectGroup = (gid: string) => {
    setActiveGroupId(gid);
    try {
      localStorage.setItem('evidio_active_group_id', gid);
    } catch {}

    if (collections) {
      const groupSections = collections.filter((c) => c.group_id === gid);
      if (groupSections.length > 0) {
        if (!groupSections.some((c) => c.id === activeCollectionId)) {
          const nextColId = groupSections[0].id;
          setActiveCollectionId(nextColId);
          try {
            localStorage.setItem('evidio_active_collection_id', nextColId);
          } catch {}
        }
      } else {
        setActiveCollectionId(null);
      }
    }
  };

  const handleSelectCollection = (col: Collection) => {
    setActiveCollectionId(col.id);
    try {
      localStorage.setItem('evidio_active_collection_id', col.id);
    } catch {}
    setSearchQuery('');
    setSelectedFilterTagIds([]);
    setIsDetailModalOpen(false);
    setSelectedDetailItemId(null);
  };

  // Reset selected tag filters when active collection changes
  useEffect(() => {
    setSelectedFilterTagIds([]);
  }, [activeCollectionId]);

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

  const collectionTags = useLiveQuery<Tag[]>(
    () =>
      activeCollectionId
        ? db.tags.where('collection_id').equals(activeCollectionId).toArray()
        : Promise.resolve([] as Tag[]),
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

  // Map item_id -> Attachment[] (all photos and documents for search)
  const attachmentsByItem = useMemo(() => {
    const map = new Map<string, Attachment[]>();
    if (allAttachments) {
      for (const att of allAttachments) {
        const list = map.get(att.item_id) || [];
        list.push(att);
        map.set(att.item_id, list);
      }
    }
    return map;
  }, [allAttachments]);

  // Unique event types used in this collection
  const existingEventTypes = useMemo(() => {
    if (!collectionEvents) return [];
    return Array.from(new Set(collectionEvents.map((e) => e.event_type))).filter(Boolean);
  }, [collectionEvents]);

  // 4. Search and Tag filtering (Diacritics-insensitive, token-based, including events, tags, and document names)
  const filteredItems = useMemo(() => {
    if (!items) return [];

    return items.filter((item) => {
      // Tag filter: item must have ALL selected tags (AND logic)
      if (selectedFilterTagIds.length > 0) {
        const itemTagIds = item.tag_ids || [];
        const hasAllTags = selectedFilterTagIds.every((tid) => itemTagIds.includes(tid));
        if (!hasAllTags) return false;
      }

      // Search query filter
      if (!searchQuery.trim()) return true;

      return itemMatchesSearch(
        item,
        fieldDefinitions || [],
        searchQuery,
        eventsByItem.get(item.id) || [],
        collectionTags || [],
        attachmentsByItem.get(item.id) || []
      );
    });
  }, [items, fieldDefinitions, searchQuery, eventsByItem, selectedFilterTagIds, collectionTags, attachmentsByItem]);

  // Handlers
  const handleMoveCollection = async (collectionId: string, targetGroupId: string) => {
    const col = collections?.find((c) => c.id === collectionId);
    const targetGroup = collectionGroups?.find((g) => g.id === targetGroupId);
    if (!col || !targetGroup) return;

    const now = new Date().toISOString();
    await db.transaction('rw', db.collections, async () => {
      await db.collections.update(collectionId, {
        group_id: targetGroupId,
        updated_at: now,
      });
    });

    handleSelectGroup(targetGroupId);
    setActiveCollectionId(collectionId);
    try {
      localStorage.setItem('evidio_active_collection_id', collectionId);
    } catch {}

    const msg = `Sekce ${col.name} byla přesunuta do ${targetGroup.name}`;
    setExportNotice(msg);
    setTimeout(() => setExportNotice(null), 4000);
  };

  const handleSaveCollection = async (data: {
    name: string;
    description: string;
    icon: string;
    group_id: string;
  }) => {
    const now = new Date().toISOString();
    if (collectionToEdit) {
      const isMoved = collectionToEdit.group_id !== data.group_id;
      const targetGroup = collectionGroups?.find((g) => g.id === data.group_id);

      await db.transaction('rw', db.collections, async () => {
        await db.collections.update(collectionToEdit.id, {
          name: data.name,
          description: data.description,
          icon: data.icon,
          group_id: data.group_id,
          updated_at: now,
        });
      });

      if (isMoved) {
        handleSelectGroup(data.group_id);
        setActiveCollectionId(collectionToEdit.id);
        try {
          localStorage.setItem('evidio_active_collection_id', collectionToEdit.id);
        } catch {}
        if (targetGroup) {
          const msg = `Sekce ${data.name} byla přesunuta do ${targetGroup.name}`;
          setExportNotice(msg);
          setTimeout(() => setExportNotice(null), 4000);
        }
      }
    } else {
      const newId = crypto.randomUUID();
      const count = await db.collections.count();
      const newCol: Collection = {
        id: newId,
        group_id: data.group_id,
        name: data.name,
        description: data.description,
        icon: data.icon,
        display_order: count,
        created_at: now,
        updated_at: now,
      };
      await db.collections.add(newCol);
      handleSelectGroup(data.group_id);
      handleSelectCollection(newCol);
    }
    setCollectionToEdit(null);
  };

  const doExportCollection = async (collectionId: string, excludePhotos: boolean) => {
    if (!activeCollection) return;
    try {
      await exportCollectionPackage(collectionId, { excludePhotos });
      setExportNotice(
        `Sekce „${activeCollection.name}“ byla úspěšně exportována${excludePhotos ? ' (bez fotek)' : ''}.`
      );
      setTimeout(() => setExportNotice(null), 4000);
    } catch (err: any) {
      alert('Chyba při exportu: ' + (err?.message || 'Neznámá chyba'));
    }
  };

  const doExportAll = async (excludePhotos: boolean) => {
    try {
      await exportAllPackage({ excludePhotos });
      setLastBackupDate(new Date().toISOString());
      setExportNotice(
        `Kompletní záloha evidio_zaloha_... byla úspěšně stažena${excludePhotos ? ' (bez fotek)' : ''}.`
      );
      setTimeout(() => setExportNotice(null), 4000);
    } catch (err: any) {
      alert('Chyba při zálohování: ' + (err?.message || 'Neznámá chyba'));
    }
  };

  const handleExport = async () => {
    if (!activeCollection) return;
    try {
      const photoBytes = await getAttachmentsTotalSizeBytes(activeCollection.id);
      if (photoBytes > 25 * 1024 * 1024) {
        setExportWarning({
          isOpen: true,
          totalPhotoBytes: photoBytes,
          isFullBackup: false,
          collectionId: activeCollection.id,
        });
        return;
      }
      await doExportCollection(activeCollection.id, false);
    } catch (err: any) {
      alert('Chyba při zjišťování velikosti: ' + (err?.message || 'Neznámá chyba'));
    }
  };

  const handleExportAll = async () => {
    try {
      const photoBytes = await getAttachmentsTotalSizeBytes();
      if (photoBytes > 25 * 1024 * 1024) {
        setExportWarning({
          isOpen: true,
          totalPhotoBytes: photoBytes,
          isFullBackup: true,
        });
        return;
      }
      await doExportAll(false);
    } catch (err: any) {
      alert('Chyba při zjišťování velikosti: ' + (err?.message || 'Neznámá chyba'));
    }
  };

  const handleImportSuccess = (primaryCollectionId: string | null) => {
    if (primaryCollectionId) {
      setActiveCollectionId(primaryCollectionId);
      try {
        localStorage.setItem('evidio_active_collection_id', primaryCollectionId);
      } catch {}
    }
    setExportNotice('Import byl úspěšně dokončen.');
    setTimeout(() => setExportNotice(null), 4000);
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
      {/* Top Navbar with prominent section switcher and category tabs */}
      <Navbar
        visibleGroups={visibleGroups}
        activeGroupId={activeGroupId}
        onSelectGroup={handleSelectGroup}
        filteredCollections={tabCollections}
        activeCollection={activeCollection}
        onSelectCollection={handleSelectCollection}
        onOpenCreateCollection={() => {
          setCollectionToEdit(null);
          setIsCollectionModalOpen(true);
        }}
        onOpenCategoryManager={() => setIsCategoryManagerOpen(true)}
        onOpenImport={() => setIsImportModalOpen(true)}
        onExportAll={handleExportAll}
        lastBackupDate={lastBackupDate}
      />

      {/* Export Notice Banner */}
      {exportNotice && (
        <div className="bg-emerald-600 text-white text-xs font-semibold px-4 py-2 text-center transition-all animate-in fade-in">
          {exportNotice}
        </div>
      )}

      {/* Main Content Area */}
      <main className="grow max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-7">
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
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3.5 sm:gap-4 bg-white p-3.5 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs">
              <div>
                <div className="flex items-center gap-2.5 sm:gap-3">
                  <h1 className="text-xl sm:text-3xl font-extrabold tracking-tight text-slate-900 truncate">
                    {activeCollection.name}
                  </h1>
                  <span className="text-xs font-bold px-2.5 py-0.5 sm:py-1 rounded-full bg-indigo-50 text-indigo-700 shrink-0">
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
              <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar flex-nowrap py-0.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setItemToEdit(null);
                    setIsItemModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md shadow-indigo-100 transition-all hover:scale-[1.01] cursor-pointer shrink-0 whitespace-nowrap"
                  title="Přidat novou položku do této sekce"
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                  <span>Přidat položku</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsFieldManagerOpen(true)}
                  className="inline-flex items-center gap-1.5 px-2.5 sm:px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200/80 rounded-xl transition-colors cursor-pointer shrink-0 whitespace-nowrap"
                  title="Správa vlastních polí této sekce"
                >
                  <Sliders className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-500" />
                  <span>Vlastní pole</span>
                  <span className="text-[10px] sm:text-[11px] font-bold bg-white px-1.5 py-0.2 rounded-md text-slate-600 border border-slate-200">
                    {fieldDefinitions ? fieldDefinitions.filter((f) => !f.is_archived).length : 0}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleExport}
                  className="inline-flex items-center gap-1.5 px-2.5 sm:px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200/80 rounded-xl transition-colors cursor-pointer shrink-0 whitespace-nowrap"
                  title="Exportovat tuto sekci do JSON"
                >
                  <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-500" />
                  <span>Export sekce</span>
                </button>

                {/* ⋯ Menu */}
                <div className="relative shrink-0" ref={sectionMenuRef}>
                  <button
                    type="button"
                    onClick={() => setIsSectionMenuOpen((prev) => !prev)}
                    className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer shrink-0"
                    title="Další akce sekce"
                    aria-label="Další akce sekce"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </button>

                      {isSectionMenuOpen && (
                    <div className="absolute right-0 top-full mt-1.5 w-44 bg-white rounded-2xl shadow-xl border border-slate-200/80 p-1.5 z-40 animate-in fade-in zoom-in-95 duration-100">
                      <button
                        type="button"
                        onClick={() => {
                          setIsSectionMenuOpen(false);
                          setIsStorageModalOpen(true);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        <HardDrive className="w-4 h-4 text-slate-500 shrink-0" />
                        <span>Úložiště</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setIsSectionMenuOpen(false);
                          setIsTagManagerOpen(true);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        <Tags className="w-4 h-4 text-slate-500 shrink-0" />
                        <span>Správa štítků</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setIsSectionMenuOpen(false);
                          setCollectionToEdit(activeCollection);
                          setIsCollectionModalOpen(true);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        <Edit2 className="w-4 h-4 text-slate-500 shrink-0" />
                        <span>Upravit sekci</span>
                      </button>

                      <div className="h-px bg-slate-100 my-1" />

                      <button
                        type="button"
                        onClick={() => {
                          setIsSectionMenuOpen(false);
                          setIsDeleteCollectionOpen(true);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4 text-red-500 shrink-0" />
                        <span>Smazat sekci</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Search and Filter Controls */}
            {items && items.length > 0 && (
              <div className="space-y-3">
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

                  {(searchQuery || selectedFilterTagIds.length > 0) && (
                    <span className="text-xs text-slate-500 hidden sm:inline">
                      Nalezeno: <strong>{filteredItems.length}</strong> z {items.length}
                    </span>
                  )}
                </div>

                {/* Tag Filter Row */}
                {collectionTags && collectionTags.length > 0 && (
                  <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap pt-0.5">
                    <span className="text-xs font-semibold text-slate-500 flex items-center gap-1 shrink-0 mr-1">
                      <Tags className="w-3.5 h-3.5 text-slate-400" />
                      <span>Filtrovat:</span>
                    </span>

                    {collectionTags.map((tag) => {
                      const isSelected = selectedFilterTagIds.includes(tag.id);
                      const opt = getTagColorOption(tag.color);
                      return (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() =>
                            setSelectedFilterTagIds((prev) =>
                              prev.includes(tag.id)
                                ? prev.filter((id) => id !== tag.id)
                                : [...prev, tag.id]
                            )
                          }
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                            isSelected
                              ? 'ring-2 ring-indigo-500 ring-offset-1 shadow-xs font-bold'
                              : 'opacity-70 hover:opacity-100 hover:shadow-2xs'
                          } ${
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
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </button>
                      );
                    })}

                    {selectedFilterTagIds.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedFilterTagIds([])}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer ml-1"
                        title="Zrušit filtr štítků"
                      >
                        <X className="w-3 h-3 stroke-[2.5]" />
                        <span>Zrušit filtr</span>
                      </button>
                    )}
                  </div>
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
                searchQuery={searchQuery ? searchQuery : 'zvolené štítky'}
                onAction={() => {
                  setSearchQuery('');
                  setSelectedFilterTagIds([]);
                }}
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredItems.map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    fields={fieldDefinitions || []}
                    events={eventsByItem.get(item.id) || []}
                    mainPhoto={mainPhotoByItem.get(item.id)}
                    tags={collectionTags || []}
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
      <CategoryManagerModal
        isOpen={isCategoryManagerOpen}
        onClose={() => setIsCategoryManagerOpen(false)}
        groups={collectionGroups || []}
        collections={collections || []}
        activeGroupId={activeGroupId}
        onSelectGroup={handleSelectGroup}
        onMoveCollection={handleMoveCollection}
      />

      <TagManagerModal
        isOpen={isTagManagerOpen}
        onClose={() => setIsTagManagerOpen(false)}
        collectionId={activeCollection?.id || ''}
        collectionName={activeCollection?.name || ''}
        tags={collectionTags || []}
        items={items || []}
      />

      <CollectionModal
        isOpen={isCollectionModalOpen}
        onClose={() => {
          setIsCollectionModalOpen(false);
          setCollectionToEdit(null);
        }}
        collectionToEdit={collectionToEdit}
        groups={collectionGroups || []}
        defaultGroupId={activeGroupId || defaultGroup?.id || DEFAULT_GROUP_ID}
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
        tags={collectionTags || []}
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
      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportSuccess={handleImportSuccess}
      />

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

      {/* Storage Information Modal */}
      {isStorageModalOpen && (
        <StorageInfoModal
          collectionId={activeCollection?.id}
          collectionName={activeCollection?.name}
          onClose={() => setIsStorageModalOpen(false)}
        />
      )}

      {/* Export Photos Warning Modal */}
      {exportWarning && exportWarning.isOpen && (
        <ExportWarningModal
          totalPhotoBytes={exportWarning.totalPhotoBytes}
          isFullBackup={exportWarning.isFullBackup}
          onConfirm={(excludePhotos) => {
            const warningState = exportWarning;
            setExportWarning(null);
            if (warningState.isFullBackup) {
              doExportAll(excludePhotos);
            } else if (warningState.collectionId) {
              doExportCollection(warningState.collectionId, excludePhotos);
            }
          }}
          onCancel={() => setExportWarning(null)}
        />
      )}

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
