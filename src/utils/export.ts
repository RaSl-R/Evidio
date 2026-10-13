/**
 * Export utility for Evidio
 * Conforms to DATA_MODEL.md section 6 & 9 (evidio_package v1)
 */

import { db } from '../db';
import {
  EvidioPackage,
  Collection,
  CollectionGroup,
  ItemType,
  FieldDefinition,
  Tag,
  Item,
  ItemEvent,
  Attachment,
} from '../types';

export const BACKUP_DATE_KEY = 'evidio_last_full_backup';

export function saveLastBackupDate(isoDate = new Date().toISOString()): void {
  try {
    localStorage.setItem(BACKUP_DATE_KEY, isoDate);
  } catch {
    // Ignore localStorage write failures
  }
}

export function getLastBackupDate(): string | null {
  try {
    return localStorage.getItem(BACKUP_DATE_KEY);
  } catch {
    return null;
  }
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export interface BuildPackageOptions {
  collectionId?: string;
  excludePhotos?: boolean;
}

/**
 * Calculates total attachments size in bytes for a given collection or the whole database.
 */
export async function getAttachmentsTotalSizeBytes(collectionId?: string): Promise<number> {
  if (collectionId) {
    const items = await db.items.where('collection_id').equals(collectionId).toArray();
    const itemIds = items.map((i) => i.id);
    if (itemIds.length === 0) return 0;
    const attachments = await db.attachments.where('item_id').anyOf(itemIds).toArray();
    return attachments.reduce((sum, a) => sum + (a.size_bytes || 0), 0);
  } else {
    const attachments = await db.attachments.toArray();
    return attachments.reduce((sum, a) => sum + (a.size_bytes || 0), 0);
  }
}

/**
 * Shared pure package builder used for both single-section and full exports.
 * If collectionId is omitted, exports ALL collections, groups, and entities.
 */
export async function buildEvidioPackage(
  collectionIdOrOptions?: string | BuildPackageOptions
): Promise<EvidioPackage> {
  let collectionId: string | undefined;
  let excludePhotos = false;

  if (typeof collectionIdOrOptions === 'string') {
    collectionId = collectionIdOrOptions;
  } else if (collectionIdOrOptions && typeof collectionIdOrOptions === 'object') {
    collectionId = collectionIdOrOptions.collectionId;
    excludePhotos = Boolean(collectionIdOrOptions.excludePhotos);
  }

  let collections: Collection[] = [];
  let itemTypes: ItemType[] = [];
  let fieldDefs: FieldDefinition[] = [];
  let tags: Tag[] = [];
  let items: Item[] = [];
  let events: ItemEvent[] = [];
  let attachments: Attachment[] = [];
  let collectionGroups: CollectionGroup[] = [];

  if (collectionId) {
    const col = await db.collections.get(collectionId);
    if (!col) {
      throw new Error(`Sekce s ID ${collectionId} nebyla nalezena`);
    }
    collections = [col];

    [itemTypes, fieldDefs, tags, items] = await Promise.all([
      db.item_types.where('collection_id').equals(collectionId).toArray(),
      db.field_definitions.where('collection_id').equals(collectionId).toArray(),
      db.tags.where('collection_id').equals(collectionId).toArray(),
      db.items.where('collection_id').equals(collectionId).toArray(),
    ]);

    const itemIds = items.map((i) => i.id);
    if (itemIds.length > 0) {
      events = await db.events.where('item_id').anyOf(itemIds).toArray();
      if (!excludePhotos) {
        attachments = await db.attachments.where('item_id').anyOf(itemIds).toArray();
      }
    }

    if (col.group_id) {
      const grp = await db.collection_groups.get(col.group_id);
      if (grp) {
        collectionGroups = [grp];
      }
    }
  } else {
    // Export ALL
    const [allCols, allGroups, allTypes, allDefs, allTags, allItems, allEvents, allAtts] =
      await Promise.all([
        db.collections.toArray(),
        db.collection_groups.toArray(),
        db.item_types.toArray(),
        db.field_definitions.toArray(),
        db.tags.toArray(),
        db.items.toArray(),
        db.events.toArray(),
        excludePhotos ? Promise.resolve([] as Attachment[]) : db.attachments.toArray(),
      ]);

    collections = allCols;
    collectionGroups = allGroups;
    itemTypes = allTypes;
    fieldDefs = allDefs;
    tags = allTags;
    items = allItems;
    events = allEvents;
    attachments = allAtts;
  }

  // Serialize binary Blobs to Base64
  const serializedAttachments: Attachment[] = await Promise.all(
    attachments.map(async (att) => {
      let dataBase64 = att.data_base64 || '';
      if (att.blob && !dataBase64) {
        dataBase64 = await blobToBase64(att.blob);
      }
      return {
        id: att.id,
        item_id: att.item_id,
        event_id: att.event_id,
        file_name: att.file_name,
        mime_type: att.mime_type,
        size_bytes: att.size_bytes,
        sort_order: typeof att.sort_order === 'number' ? att.sort_order : 0,
        data_base64: dataBase64,
        created_at: att.created_at,
        updated_at: att.updated_at,
      };
    })
  );

  return {
    format: 'evidio_package',
    version: 1,
    exported_at: new Date().toISOString(),
    collection_groups: collectionGroups,
    collections,
    item_types: itemTypes,
    field_definitions: fieldDefs,
    tags,
    items,
    events,
    attachments: serializedAttachments,
  };
}

export function triggerDownload(pkg: EvidioPackage, filename: string): void {
  const jsonString = JSON.stringify(pkg, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Exports a single section to JSON
 */
export async function exportCollectionPackage(
  collectionId: string,
  options?: { excludePhotos?: boolean }
): Promise<void> {
  const pkg = await buildEvidioPackage({ collectionId, excludePhotos: options?.excludePhotos });
  const col = pkg.collections[0];
  const safeName = (col?.name || 'sekce')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_-]/g, '_');

  const dateStr = new Date().toISOString().slice(0, 10);
  const suffix = options?.excludePhotos ? '_bez_fotek' : '';
  const filename = `evidio_${safeName}${suffix}_${dateStr}.json`;
  triggerDownload(pkg, filename);
}

/**
 * Full backup export ("Exportovat vše")
 * File name: evidio_zaloha_YYYY-MM-DD.json
 */
export async function exportAllPackage(options?: { excludePhotos?: boolean }): Promise<void> {
  const pkg = await buildEvidioPackage({ excludePhotos: options?.excludePhotos });
  const dateStr = new Date().toISOString().slice(0, 10);
  const suffix = options?.excludePhotos ? '_bez_fotek' : '';
  const filename = `evidio_zaloha${suffix}_${dateStr}.json`;

  triggerDownload(pkg, filename);
  saveLastBackupDate();
}
