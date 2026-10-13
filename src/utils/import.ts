/**
 * Pure import module for Evidio
 * Conforms to DATA_MODEL.md sections 6.1-6.5
 */

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
  FieldDataType,
} from '../types';

export const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUUID(id: unknown): boolean {
  return typeof id === 'string' && UUID_REGEX.test(id);
}

export function inferDataType(value: unknown): FieldDataType {
  if (typeof value === 'number') {
    return 'number';
  }
  if (typeof value === 'boolean') {
    return 'boolean';
  }
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return 'date';
    }
  }
  return 'text';
}

export function base64ToBlob(
  base64Data: string,
  mimeType = 'application/octet-stream'
): Blob {
  let cleanBase64 = base64Data;
  let detectedMime = mimeType;

  if (base64Data.startsWith('data:')) {
    const parts = base64Data.split(',');
    const match = parts[0].match(/:(.*?);/);
    if (match && match[1]) {
      detectedMime = match[1];
    }
    cleanBase64 = parts[1] || '';
  }

  try {
    const binaryString = atob(cleanBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return new Blob([bytes], { type: detectedMime });
  } catch {
    return new Blob([], { type: detectedMime });
  }
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  parsedPackage?: EvidioPackage;
}

/**
 * Validates the raw JSON input according to DATA_MODEL.md rules.
 * Stops on errors and returns a readable list of problems.
 */
export function validateEvidioPackage(data: any): ValidationResult {
  const errors: string[] = [];

  if (!data || typeof data !== 'object') {
    return { isValid: false, errors: ['Soubor neobsahuje platná JSON data.'] };
  }

  // 1. Format check
  if (data.format !== 'evidio_package') {
    errors.push("Neplatný formát souboru (očekáváno 'evidio_package').");
    return { isValid: false, errors };
  }

  // 2. Version check
  if (typeof data.version !== 'number') {
    errors.push('Neplatná nebo chybějící verze balíčku.');
    return { isValid: false, errors };
  }

  if (data.version > 1) {
    errors.push('Soubor je z novější verze Evidia, aktualizujte aplikaci.');
    return { isValid: false, errors };
  }

  // 3. Fallback for missing arrays (older packages treat missing arrays as empty)
  const collectionGroups: CollectionGroup[] = Array.isArray(data.collection_groups)
    ? data.collection_groups
    : [];
  const collections: Collection[] = Array.isArray(data.collections)
    ? data.collections
    : [];
  const itemTypes: ItemType[] = Array.isArray(data.item_types) ? data.item_types : [];
  const fieldDefs: FieldDefinition[] = Array.isArray(data.field_definitions)
    ? data.field_definitions
    : [];
  const tags: Tag[] = Array.isArray(data.tags) ? data.tags : [];
  const items: Item[] = Array.isArray(data.items) ? data.items : [];
  const events: ItemEvent[] = Array.isArray(data.events) ? data.events : [];
  const attachments: Attachment[] = Array.isArray(data.attachments)
    ? data.attachments
    : [];

  // 4. Validate UUID format
  for (const g of collectionGroups) {
    if (!isValidUUID(g.id)) errors.push(`Kategorie "${g.name || g.id}" má neplatné UUID: ${g.id}`);
  }
  for (const c of collections) {
    if (!isValidUUID(c.id)) errors.push(`Sekce "${c.name || c.id}" má neplatné UUID: ${c.id}`);
  }
  for (const it of itemTypes) {
    if (!isValidUUID(it.id)) errors.push(`Typ položky má neplatné UUID: ${it.id}`);
  }
  for (const fd of fieldDefs) {
    if (!isValidUUID(fd.id)) errors.push(`Definice vlastnosti "${fd.name || fd.id}" má neplatné UUID: ${fd.id}`);
  }
  for (const t of tags) {
    if (!isValidUUID(t.id)) errors.push(`Štítek "${t.name || t.id}" má neplatné UUID: ${t.id}`);
  }
  for (const item of items) {
    if (!isValidUUID(item.id)) errors.push(`Položka "${item.name || item.id}" má neplatné UUID: ${item.id}`);
  }
  for (const ev of events) {
    if (!isValidUUID(ev.id)) errors.push(`Událost "${ev.title || ev.id}" má neplatné UUID: ${ev.id}`);
  }
  for (const att of attachments) {
    if (!isValidUUID(att.id)) errors.push(`Příloha "${att.file_name || att.id}" má neplatné UUID: ${att.id}`);
  }

  // 5. Reference integrity validation
  const groupIds = new Set(collectionGroups.map((g) => g.id));
  const collectionIds = new Set(collections.map((c) => c.id));
  const itemIds = new Set(items.map((i) => i.id));
  const eventIds = new Set(events.map((e) => e.id));
  const tagIds = new Set(tags.map((t) => t.id));

  // Collections -> Groups (only if groups are specified in the package)
  if (collectionGroups.length > 0) {
    for (const c of collections) {
      if (c.group_id && !groupIds.has(c.group_id)) {
        errors.push(`Sekce "${c.name || c.id}" odkazuje na neexistující kategorii (${c.group_id}).`);
      }
    }
  }

  // Item types -> Collection
  for (const it of itemTypes) {
    if (it.collection_id && !collectionIds.has(it.collection_id)) {
      errors.push(`Typ položky "${it.name || it.id}" odkazuje na neexistující sekci (${it.collection_id}).`);
    }
  }

  // Field definitions -> Collection
  for (const fd of fieldDefs) {
    if (fd.collection_id && !collectionIds.has(fd.collection_id)) {
      errors.push(`Definice vlastnosti "${fd.name || fd.id}" odkazuje na neexistující sekci (${fd.collection_id}).`);
    }
  }

  // Tags -> Collection
  for (const t of tags) {
    if (t.collection_id && !collectionIds.has(t.collection_id)) {
      errors.push(`Štítek "${t.name || t.id}" odkazuje na neexistující sekci (${t.collection_id}).`);
    }
  }

  // Items -> Collection & Tag IDs
  for (const item of items) {
    if (!collectionIds.has(item.collection_id)) {
      errors.push(`Položka "${item.name || item.id}" odkazuje na neexistující sekci (${item.collection_id}).`);
    }
    if (Array.isArray(item.tag_ids)) {
      for (const tid of item.tag_ids) {
        if (!tagIds.has(tid)) {
          errors.push(`Položka "${item.name || item.id}" odkazuje na neexistující štítek (${tid}).`);
        }
      }
    }
  }

  // Events -> Item
  for (const ev of events) {
    if (!itemIds.has(ev.item_id)) {
      errors.push(`Událost "${ev.title || ev.id}" odkazuje na neexistující položku (${ev.item_id}).`);
    }
  }

  // Attachments -> Item / Event
  for (const att of attachments) {
    if (!itemIds.has(att.item_id)) {
      errors.push(`Příloha "${att.file_name || att.id}" odkazuje na neexistující položku (${att.item_id}).`);
    }
    if (att.event_id && !eventIds.has(att.event_id)) {
      errors.push(`Příloha "${att.file_name || att.id}" odkazuje na neexistující událost (${att.event_id}).`);
    }
  }

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  const parsedPackage: EvidioPackage = {
    format: 'evidio_package',
    version: 1,
    exported_at: data.exported_at || new Date().toISOString(),
    collection_groups: collectionGroups,
    collections,
    item_types: itemTypes,
    field_definitions: fieldDefs,
    tags,
    items,
    events,
    attachments,
  };

  return { isValid: true, errors: [], parsedPackage };
}

export interface ImportPreviewInfo {
  sectionsCount: number;
  categoriesCount: number;
  fieldsCount: number;
  itemsCount: number;
  eventsCount: number;
  tagsCount: number;
  attachmentsCount: number;
  totalSizeMB: number;
}

export function getImportPreview(
  pkg: EvidioPackage,
  rawFileSizeInBytes?: number
): ImportPreviewInfo {
  let sizeBytes = rawFileSizeInBytes || 0;
  if (!sizeBytes) {
    try {
      sizeBytes = new Blob([JSON.stringify(pkg)]).size;
    } catch {
      sizeBytes = 0;
    }
  }

  return {
    sectionsCount: pkg.collections.length,
    categoriesCount: pkg.collection_groups?.length || 0,
    fieldsCount: pkg.field_definitions.length,
    itemsCount: pkg.items.length,
    eventsCount: pkg.events.length,
    tagsCount: pkg.tags.length,
    attachmentsCount: pkg.attachments.length,
    totalSizeMB: Math.round((sizeBytes / (1024 * 1024)) * 100) / 100,
  };
}

export interface PreparedImportData {
  groupsToPut: CollectionGroup[];
  collectionsToPut: Collection[];
  itemTypesToPut: ItemType[];
  fieldDefsToPut: FieldDefinition[];
  tagsToPut: Tag[];
  itemsToPut: Item[];
  eventsToPut: ItemEvent[];
  attachmentsToPut: Attachment[];
  primaryCollectionId: string | null;
}

/**
 * MODE A: "Importovat jako kopii"
 * - New UUIDv4 for all entities
 * - Remaps all foreign keys, tag_ids, item.data and event.data keys
 * - If section name collision, appends " (kopie)"
 * - Unknown field IDs recovered as "Obnovené pole (xxxxxx)" with config.group = "imported"
 * - Converts base64 attachments to Blobs
 */
export function prepareImportCopy(
  pkg: EvidioPackage,
  existingCollections: Collection[],
  existingGroups: CollectionGroup[],
  defaultGroupId: string
): PreparedImportData {
  const now = new Date().toISOString();
  const idMap = new Map<string, string>();

  // 1. Group mapping
  // Map package default group to local default group
  const groupsToPut: CollectionGroup[] = [];
  const groupMap = new Map<string, string>();

  const pkgGroups = pkg.collection_groups || [];
  for (const g of pkgGroups) {
    if (g.is_default) {
      groupMap.set(g.id, defaultGroupId);
    } else {
      // Find matching local group by name (case-insensitive)
      const existingMatch = existingGroups.find(
        (eg) => eg.name.trim().toLowerCase() === g.name.trim().toLowerCase()
      );
      if (existingMatch) {
        groupMap.set(g.id, existingMatch.id);
      } else {
        const newGroupId = crypto.randomUUID();
        groupMap.set(g.id, newGroupId);
        groupsToPut.push({
          ...g,
          id: newGroupId,
          is_default: false,
          created_at: now,
          updated_at: now,
        });
      }
    }
  }

  // 2. Collections remapping
  const existingNamesLower = new Set(
    existingCollections.map((c) => c.name.trim().toLowerCase())
  );
  const collectionsToPut: Collection[] = [];

  for (const col of pkg.collections) {
    const newColId = crypto.randomUUID();
    idMap.set(col.id, newColId);

    let assignedGroupId = defaultGroupId;
    if (col.group_id && groupMap.has(col.group_id)) {
      assignedGroupId = groupMap.get(col.group_id)!;
    }

    let colName = col.name;
    if (existingNamesLower.has(colName.trim().toLowerCase())) {
      colName = `${colName} (kopie)`;
    }

    collectionsToPut.push({
      ...col,
      id: newColId,
      group_id: assignedGroupId,
      name: colName,
      created_at: now,
      updated_at: now,
    });
  }

  // 3. Item types remapping
  const itemTypesToPut: ItemType[] = [];
  for (const it of pkg.item_types) {
    const newTypeId = crypto.randomUUID();
    idMap.set(it.id, newTypeId);
    const remappedColId = idMap.get(it.collection_id) || it.collection_id;

    itemTypesToPut.push({
      ...it,
      id: newTypeId,
      collection_id: remappedColId,
      created_at: now,
      updated_at: now,
    });
  }

  // 4. Tags remapping
  const tagsToPut: Tag[] = [];
  for (const t of pkg.tags) {
    const newTagId = crypto.randomUUID();
    idMap.set(t.id, newTagId);
    const remappedColId = idMap.get(t.collection_id) || t.collection_id;

    tagsToPut.push({
      ...t,
      id: newTagId,
      collection_id: remappedColId,
      created_at: now,
      updated_at: now,
    });
  }

  // 5. Field definitions remapping
  const fieldDefsToPut: FieldDefinition[] = [];
  const knownFieldIds = new Set(pkg.field_definitions.map((f) => f.id));

  for (const fd of pkg.field_definitions) {
    const newFieldId = crypto.randomUUID();
    idMap.set(fd.id, newFieldId);
    const remappedColId = idMap.get(fd.collection_id) || fd.collection_id;

    fieldDefsToPut.push({
      ...fd,
      id: newFieldId,
      collection_id: remappedColId,
      // Select option IDs stay unchanged within config
      config: fd.config ? { ...fd.config } : {},
      created_at: now,
      updated_at: now,
    });
  }

  // 6. Unknown field recovery helper
  const syntheticFieldsMap = new Map<string, FieldDefinition>();

  const getOrCreateSyntheticField = (
    oldFieldId: string,
    target: 'ITEM' | 'EVENT',
    oldColId: string,
    sampleValue: unknown
  ): string => {
    if (idMap.has(oldFieldId)) {
      return idMap.get(oldFieldId)!;
    }

    const newFieldId = crypto.randomUUID();
    idMap.set(oldFieldId, newFieldId);

    const remappedColId = idMap.get(oldColId) || oldColId;
    const inferredType = inferDataType(sampleValue);
    const prefix = oldFieldId.slice(0, 6);

    const syntheticField: FieldDefinition = {
      id: newFieldId,
      collection_id: remappedColId,
      target,
      key: `imported_${oldFieldId.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 16)}`,
      name: `Obnovené pole (${prefix})`,
      data_type: inferredType,
      unit: null,
      event_types: target === 'EVENT' ? [] : null,
      is_required: false,
      is_archived: false,
      display_order: 999,
      config: { group: 'imported' },
      validation_rules: {},
      created_at: now,
      updated_at: now,
    };

    syntheticFieldsMap.set(oldFieldId, syntheticField);
    fieldDefsToPut.push(syntheticField);
    return newFieldId;
  };

  // 7. Items remapping & unknown fields in item.data
  const itemsToPut: Item[] = [];
  for (const item of pkg.items) {
    const newItemId = crypto.randomUUID();
    idMap.set(item.id, newItemId);
    const remappedColId = idMap.get(item.collection_id) || item.collection_id;
    const remappedTypeId = item.item_type_id ? idMap.get(item.item_type_id) || null : null;
    const remappedTagIds = (item.tag_ids || []).map((tid) => idMap.get(tid) || tid);

    const newData: Record<string, any> = {};
    if (item.data && typeof item.data === 'object') {
      for (const [fId, val] of Object.entries(item.data)) {
        if (knownFieldIds.has(fId)) {
          const mappedFId = idMap.get(fId)!;
          newData[mappedFId] = val;
        } else {
          // Unknown field ID
          const synthFId = getOrCreateSyntheticField(fId, 'ITEM', item.collection_id, val);
          newData[synthFId] = val;
        }
      }
    }

    itemsToPut.push({
      ...item,
      id: newItemId,
      collection_id: remappedColId,
      item_type_id: remappedTypeId,
      tag_ids: remappedTagIds,
      data: newData,
      created_at: now,
      updated_at: now,
    });
  }

  // 8. Events remapping & unknown fields in event.data
  const eventsToPut: ItemEvent[] = [];
  for (const ev of pkg.events) {
    const newEventId = crypto.randomUUID();
    idMap.set(ev.id, newEventId);
    const remappedItemId = idMap.get(ev.item_id) || ev.item_id;

    // Find original collection ID for this item for recovery
    const origItem = pkg.items.find((i) => i.id === ev.item_id);
    const origColId = origItem?.collection_id || pkg.collections[0]?.id || '';

    const newData: Record<string, any> = {};
    if (ev.data && typeof ev.data === 'object') {
      for (const [fId, val] of Object.entries(ev.data)) {
        if (knownFieldIds.has(fId)) {
          const mappedFId = idMap.get(fId)!;
          newData[mappedFId] = val;
        } else {
          const synthFId = getOrCreateSyntheticField(fId, 'EVENT', origColId, val);
          newData[synthFId] = val;
        }
      }
    }

    eventsToPut.push({
      ...ev,
      id: newEventId,
      item_id: remappedItemId,
      data: newData,
      created_at: now,
      updated_at: now,
    });
  }

  // 9. Attachments remapping & base64 -> Blob conversion
  const attachmentsToPut: Attachment[] = [];
  for (const att of pkg.attachments) {
    const newAttId = crypto.randomUUID();
    idMap.set(att.id, newAttId);
    const remappedItemId = idMap.get(att.item_id) || att.item_id;
    const remappedEventId = att.event_id ? idMap.get(att.event_id) || null : null;

    let blob = att.blob;
    if (!blob && att.data_base64) {
      blob = base64ToBlob(att.data_base64, att.mime_type);
    }

    attachmentsToPut.push({
      ...att,
      id: newAttId,
      item_id: remappedItemId,
      event_id: remappedEventId,
      sort_order: typeof att.sort_order === 'number' ? att.sort_order : 0,
      blob,
      created_at: now,
      updated_at: now,
    });
  }

  const primaryCollectionId = collectionsToPut[0]?.id || null;

  return {
    groupsToPut,
    collectionsToPut,
    itemTypesToPut,
    fieldDefsToPut,
    tagsToPut,
    itemsToPut,
    eventsToPut,
    attachmentsToPut,
    primaryCollectionId,
  };
}

export interface ExistingDbSnapshot {
  groups: CollectionGroup[];
  collections: Collection[];
  itemTypes: ItemType[];
  fieldDefs: FieldDefinition[];
  tags: Tag[];
  items: Item[];
  events: ItemEvent[];
  attachments: Attachment[];
  defaultGroupId: string;
}

/**
 * MODE B: "Obnovit ze zálohy" (Upsert with Last-Write-Wins)
 * - Keep original UUIDs
 * - Upsert: record with newer updated_at wins
 * - Missing local records are NEVER deleted
 * - Unknown field IDs recovered as FieldDefinition with config.group = "imported"
 * - Converts base64 attachments to Blobs
 */
export function prepareImportRestore(
  pkg: EvidioPackage,
  existing: ExistingDbSnapshot
): PreparedImportData {
  const groupsToPut: CollectionGroup[] = [];
  const collectionsToPut: Collection[] = [];
  const itemTypesToPut: ItemType[] = [];
  const fieldDefsToPut: FieldDefinition[] = [];
  const tagsToPut: Tag[] = [];
  const itemsToPut: Item[] = [];
  const eventsToPut: ItemEvent[] = [];
  const attachmentsToPut: Attachment[] = [];

  const existingGroupMap = new Map(existing.groups.map((g) => [g.id, g]));
  const existingColMap = new Map(existing.collections.map((c) => [c.id, c]));
  const existingTypeMap = new Map(existing.itemTypes.map((it) => [it.id, it]));
  const existingFieldMap = new Map(existing.fieldDefs.map((f) => [f.id, f]));
  const existingTagMap = new Map(existing.tags.map((t) => [t.id, t]));
  const existingItemMap = new Map(existing.items.map((i) => [i.id, i]));
  const existingEventMap = new Map(existing.events.map((e) => [e.id, e]));
  const existingAttMap = new Map(existing.attachments.map((a) => [a.id, a]));

  const shouldOverwrite = (importedDateStr: string, existingDateStr: string): boolean => {
    const impTime = new Date(importedDateStr).getTime();
    const extTime = new Date(existingDateStr).getTime();
    return isNaN(extTime) || impTime > extTime;
  };

  // 1. Groups
  const pkgGroups = pkg.collection_groups || [];
  for (const g of pkgGroups) {
    if (g.is_default) {
      // Map to default local group
      continue;
    }
    const ext = existingGroupMap.get(g.id);
    if (!ext) {
      // Check if group exists by name (case-insensitive)
      const nameMatch = existing.groups.find(
        (eg) => eg.name.trim().toLowerCase() === g.name.trim().toLowerCase()
      );
      if (!nameMatch) {
        groupsToPut.push(g);
      }
    } else if (shouldOverwrite(g.updated_at, ext.updated_at)) {
      groupsToPut.push(g);
    }
  }

  // 2. Collections
  for (const c of pkg.collections) {
    const ext = existingColMap.get(c.id);
    const colToSave = {
      ...c,
      group_id: c.group_id || existing.defaultGroupId,
    };
    if (!ext || shouldOverwrite(c.updated_at, ext.updated_at)) {
      collectionsToPut.push(colToSave);
    }
  }

  // 3. Item types
  for (const it of pkg.item_types) {
    const ext = existingTypeMap.get(it.id);
    if (!ext || shouldOverwrite(it.updated_at, ext.updated_at)) {
      itemTypesToPut.push(it);
    }
  }

  // 4. Field definitions
  const allKnownFieldIds = new Set([
    ...pkg.field_definitions.map((f) => f.id),
    ...existing.fieldDefs.map((f) => f.id),
  ]);

  for (const fd of pkg.field_definitions) {
    const ext = existingFieldMap.get(fd.id);
    if (!ext || shouldOverwrite(fd.updated_at, ext.updated_at)) {
      fieldDefsToPut.push(fd);
    }
  }

  // Helper for unknown fields in Mode B
  const syntheticFieldsMap = new Map<string, FieldDefinition>();
  const now = new Date().toISOString();

  const ensureSyntheticField = (
    fieldId: string,
    target: 'ITEM' | 'EVENT',
    colId: string,
    sampleVal: unknown
  ) => {
    if (allKnownFieldIds.has(fieldId) || syntheticFieldsMap.has(fieldId)) {
      return;
    }
    const inferredType = inferDataType(sampleVal);
    const prefix = fieldId.slice(0, 6);
    const synth: FieldDefinition = {
      id: fieldId,
      collection_id: colId,
      target,
      key: `imported_${fieldId.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 16)}`,
      name: `Obnovené pole (${prefix})`,
      data_type: inferredType,
      unit: null,
      event_types: target === 'EVENT' ? [] : null,
      is_required: false,
      is_archived: false,
      display_order: 999,
      config: { group: 'imported' },
      validation_rules: {},
      created_at: now,
      updated_at: now,
    };
    syntheticFieldsMap.set(fieldId, synth);
    fieldDefsToPut.push(synth);
    allKnownFieldIds.add(fieldId);
  };

  // 5. Tags
  for (const t of pkg.tags) {
    const ext = existingTagMap.get(t.id);
    if (!ext || shouldOverwrite(t.updated_at, ext.updated_at)) {
      tagsToPut.push(t);
    }
  }

  // 6. Items & unknown fields
  for (const item of pkg.items) {
    if (item.data && typeof item.data === 'object') {
      for (const [fId, val] of Object.entries(item.data)) {
        ensureSyntheticField(fId, 'ITEM', item.collection_id, val);
      }
    }

    const ext = existingItemMap.get(item.id);
    if (!ext || shouldOverwrite(item.updated_at, ext.updated_at)) {
      itemsToPut.push(item);
    }
  }

  // 7. Events & unknown fields
  for (const ev of pkg.events) {
    const itemOfEvent =
      pkg.items.find((i) => i.id === ev.item_id) ||
      existingItemMap.get(ev.item_id);
    const colId = itemOfEvent?.collection_id || pkg.collections[0]?.id || '';

    if (ev.data && typeof ev.data === 'object') {
      for (const [fId, val] of Object.entries(ev.data)) {
        ensureSyntheticField(fId, 'EVENT', colId, val);
      }
    }

    const ext = existingEventMap.get(ev.id);
    if (!ext || shouldOverwrite(ev.updated_at, ext.updated_at)) {
      eventsToPut.push(ev);
    }
  }

  // 8. Attachments & base64 -> Blob conversion
  for (const att of pkg.attachments) {
    const ext = existingAttMap.get(att.id);
    if (!ext || shouldOverwrite(att.updated_at, ext.updated_at)) {
      let blob = att.blob;
      if (!blob && att.data_base64) {
        blob = base64ToBlob(att.data_base64, att.mime_type);
      }
      attachmentsToPut.push({
        ...att,
        sort_order: typeof att.sort_order === 'number' ? att.sort_order : (ext?.sort_order ?? 0),
        blob,
      });
    }
  }

  const primaryCollectionId = pkg.collections[0]?.id || null;

  return {
    groupsToPut,
    collectionsToPut,
    itemTypesToPut,
    fieldDefsToPut,
    tagsToPut,
    itemsToPut,
    eventsToPut,
    attachmentsToPut,
    primaryCollectionId,
  };
}
