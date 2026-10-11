/**
 * Export utility for Evidio
 * Conforms to DATA_MODEL.md section 6 & 9 (evidio_package v1)
 */

import { db } from '../db';
import { EvidioPackage } from '../types';

export async function exportCollectionPackage(collectionId: string): Promise<void> {
  const collection = await db.collections.get(collectionId);
  if (!collection) {
    throw new Error('Kolekce nebyla nalezena');
  }

  const [itemTypes, fieldDefs, tags, items] = await Promise.all([
    db.item_types.where('collection_id').equals(collectionId).toArray(),
    db.field_definitions.where('collection_id').equals(collectionId).toArray(),
    db.tags.where('collection_id').equals(collectionId).toArray(),
    db.items.where('collection_id').equals(collectionId).toArray(),
  ]);

  const itemIds = items.map((i) => i.id);
  let events: any[] = [];
  let attachments: any[] = [];

  if (itemIds.length > 0) {
    [events, attachments] = await Promise.all([
      db.events.where('item_id').anyOf(itemIds).toArray(),
      db.attachments.where('item_id').anyOf(itemIds).toArray(),
    ]);
  }

  // Convert binary Blobs to Base64 if any attachments exist
  const serializedAttachments = await Promise.all(
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
        data_base64: dataBase64,
        created_at: att.created_at,
        updated_at: att.updated_at,
      };
    })
  );

  const pkg: EvidioPackage = {
    format: 'evidio_package',
    version: 1,
    exported_at: new Date().toISOString(),
    collections: [collection],
    item_types: itemTypes,
    field_definitions: fieldDefs,
    tags: tags,
    items: items,
    events: events,
    attachments: serializedAttachments,
  };

  const jsonString = JSON.stringify(pkg, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const safeName = collection.name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_-]/g, '_');

  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `evidio_${safeName}_${dateStr}.json`;

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Strip Data-URL prefix to store raw base64 if needed or keep full string
      resolve(result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
