/**
 * Dexie.js database instance and initialization
 * Conforms to DATA_MODEL.md section 5.1
 */

import Dexie, { type Table } from 'dexie';
import {
  Collection,
  ItemType,
  FieldDefinition,
  Item,
  ItemEvent,
  Tag,
  Attachment,
} from '../types';

export class EvidioDatabase extends Dexie {
  collections!: Table<Collection, string>;
  item_types!: Table<ItemType, string>;
  field_definitions!: Table<FieldDefinition, string>;
  items!: Table<Item, string>;
  events!: Table<ItemEvent, string>;
  tags!: Table<Tag, string>;
  attachments!: Table<Attachment, string>;

  constructor() {
    super('evidio_db');

    // Schema version 1 matching DATA_MODEL.md
    this.version(1).stores({
      collections: 'id, display_order, created_at, updated_at',
      item_types: 'id, collection_id',
      field_definitions: 'id, collection_id, [collection_id+target], updated_at',
      items: 'id, collection_id, item_type_id, *tag_ids, updated_at',
      events: 'id, item_id, [item_id+event_date], event_date, updated_at',
      tags: 'id, collection_id, name',
      attachments: 'id, item_id, event_id, updated_at',
    });
  }
}

export const db = new EvidioDatabase();

/**
 * Counts related records for safe deletion confirmation
 */
export async function getCollectionStats(collectionId: string) {
  const [items, fields, tags] = await Promise.all([
    db.items.where('collection_id').equals(collectionId).toArray(),
    db.field_definitions.where('collection_id').equals(collectionId).count(),
    db.tags.where('collection_id').equals(collectionId).count(),
  ]);

  const itemIds = items.map((i) => i.id);
  let eventCount = 0;
  let attachmentCount = 0;

  if (itemIds.length > 0) {
    [eventCount, attachmentCount] = await Promise.all([
      db.events.where('item_id').anyOf(itemIds).count(),
      db.attachments.where('item_id').anyOf(itemIds).count(),
    ]);
  }

  return {
    itemCount: items.length,
    fieldCount: fields,
    tagCount: tags,
    eventCount,
    attachmentCount,
  };
}

/**
 * Cascade deletes an entire collection and all child records in ONE atomic Dexie transaction
 */
export async function deleteCollectionCascade(collectionId: string): Promise<void> {
  await db.transaction(
    'rw',
    [
      db.collections,
      db.item_types,
      db.field_definitions,
      db.items,
      db.events,
      db.tags,
      db.attachments,
    ],
    async () => {
      const items = await db.items.where('collection_id').equals(collectionId).toArray();
      const itemIds = items.map((i) => i.id);

      if (itemIds.length > 0) {
        await db.events.where('item_id').anyOf(itemIds).delete();
        await db.attachments.where('item_id').anyOf(itemIds).delete();
      }

      await db.items.where('collection_id').equals(collectionId).delete();
      await db.field_definitions.where('collection_id').equals(collectionId).delete();
      await db.tags.where('collection_id').equals(collectionId).delete();
      await db.item_types.where('collection_id').equals(collectionId).delete();
      await db.collections.delete(collectionId);
    }
  );
}

/**
 * Preloads the demo collection "Auta" if the database is brand new.
 */
export async function seedDemoCollectionIfEmpty(): Promise<string | null> {
  const collectionCount = await db.collections.count();
  if (collectionCount > 0) {
    await seedDemoEventFieldsIfMissing();
    const first = await db.collections.orderBy('display_order').first();
    return first ? first.id : null;
  }

  const now = new Date().toISOString();
  const carCollectionId = crypto.randomUUID();

  // Create Field Definitions for ITEM
  const brandFieldId = crypto.randomUUID();
  const spzFieldId = crypto.randomUUID();
  const mileageFieldId = crypto.randomUUID();
  const stkFieldId = crypto.randomUUID();

  // Create Field Definitions for EVENT
  const costFieldId = crypto.randomUUID();
  const eventMileageFieldId = crypto.randomUUID();

  const brandOptions = [
    { id: crypto.randomUUID(), label: 'Škoda', color: '#16a34a' },
    { id: crypto.randomUUID(), label: 'Volkswagen', color: '#2563eb' },
    { id: crypto.randomUUID(), label: 'Toyota', color: '#dc2626' },
    { id: crypto.randomUUID(), label: 'Hyundai', color: '#0284c7' },
    { id: crypto.randomUUID(), label: 'BMW', color: '#4f46e5' },
    { id: crypto.randomUUID(), label: 'Audi', color: '#475569' },
    { id: crypto.randomUUID(), label: 'Jiná', color: '#9333ea' },
  ];

  const skodaOptId = brandOptions[0].id;
  const toyotaOptId = brandOptions[2].id;
  const vwOptId = brandOptions[1].id;

  const demoCollection: Collection = {
    id: carCollectionId,
    name: 'Auta',
    description: 'Evidence rodinných a firemních vozidel, servis a STK',
    icon: 'car',
    display_order: 0,
    created_at: now,
    updated_at: now,
  };

  const demoFields: FieldDefinition[] = [
    {
      id: brandFieldId,
      collection_id: carCollectionId,
      target: 'ITEM',
      key: 'brand',
      name: 'Značka',
      data_type: 'single_select',
      unit: null,
      event_types: [],
      is_required: true,
      is_archived: false,
      display_order: 1,
      config: { options: brandOptions },
      validation_rules: {},
      created_at: now,
      updated_at: now,
    },
    {
      id: spzFieldId,
      collection_id: carCollectionId,
      target: 'ITEM',
      key: 'license_plate',
      name: 'SPZ',
      data_type: 'text',
      unit: null,
      event_types: [],
      is_required: true,
      is_archived: false,
      display_order: 2,
      config: {},
      validation_rules: { max_length: 12 },
      created_at: now,
      updated_at: now,
    },
    {
      id: mileageFieldId,
      collection_id: carCollectionId,
      target: 'ITEM',
      key: 'odometer_km',
      name: 'Nájezd',
      data_type: 'number',
      unit: 'km',
      event_types: [],
      is_required: true,
      is_archived: false,
      display_order: 3,
      config: {},
      validation_rules: { min: 0, step: 1 },
      created_at: now,
      updated_at: now,
    },
    {
      id: stkFieldId,
      collection_id: carCollectionId,
      target: 'ITEM',
      key: 'inspection_date',
      name: 'Platnost STK do',
      data_type: 'date',
      unit: null,
      event_types: [],
      is_required: false,
      is_archived: false,
      display_order: 4,
      config: {},
      validation_rules: {},
      created_at: now,
      updated_at: now,
    },
    {
      id: costFieldId,
      collection_id: carCollectionId,
      target: 'EVENT',
      key: 'cost_czk',
      name: 'Cena servisu',
      data_type: 'number',
      unit: 'Kč',
      event_types: ['Servis'],
      is_required: false,
      is_archived: false,
      display_order: 5,
      config: {},
      validation_rules: { min: 0 },
      created_at: now,
      updated_at: now,
    },
    {
      id: eventMileageFieldId,
      collection_id: carCollectionId,
      target: 'EVENT',
      key: 'mileage_at_event',
      name: 'Kilometry při servisu',
      data_type: 'number',
      unit: 'km',
      event_types: ['Servis'],
      is_required: false,
      is_archived: false,
      display_order: 6,
      config: {},
      validation_rules: { min: 0 },
      created_at: now,
      updated_at: now,
    },
  ];

  const octaviaItemId = crypto.randomUUID();

  const demoItems: Item[] = [
    {
      id: octaviaItemId,
      collection_id: carCollectionId,
      item_type_id: null,
      name: 'Škoda Octavia Combi 2.0 TDI',
      tag_ids: [],
      data: {
        [brandFieldId]: skodaOptId,
        [spzFieldId]: '5AH 1234',
        [mileageFieldId]: 184500,
        [stkFieldId]: '2027-05-31',
      },
      created_at: now,
      updated_at: now,
    },
    {
      id: crypto.randomUUID(),
      collection_id: carCollectionId,
      item_type_id: null,
      name: 'Toyota Yaris Hybrid 1.5',
      tag_ids: [],
      data: {
        [brandFieldId]: toyotaOptId,
        [spzFieldId]: '2BN 9876',
        [mileageFieldId]: 42300,
        [stkFieldId]: '2028-02-15',
      },
      created_at: now,
      updated_at: now,
    },
    {
      id: crypto.randomUUID(),
      collection_id: carCollectionId,
      item_type_id: null,
      name: 'Volkswagen Golf VII Variant',
      tag_ids: [],
      data: {
        [brandFieldId]: vwOptId,
        [spzFieldId]: '8AU 4567',
        [mileageFieldId]: 128900,
        [stkFieldId]: '2026-11-30',
      },
      created_at: now,
      updated_at: now,
    },
  ];

  const demoEvents: ItemEvent[] = [
    {
      id: crypto.randomUUID(),
      item_id: octaviaItemId,
      event_type: 'Servis',
      title: 'Pravidelná servisní prohlídka (olej, filtry)',
      event_date: '2025-08-14',
      event_time: '08:30',
      data: {
        [costFieldId]: 4200,
        [eventMileageFieldId]: 165000,
      },
      created_at: '2025-08-14T09:00:00Z',
      updated_at: '2025-08-14T09:00:00Z',
    },
    {
      id: crypto.randomUUID(),
      item_id: octaviaItemId,
      event_type: 'Servis',
      title: 'Výměna předních brzdových destiček a kotoučů',
      event_date: '2026-09-02',
      event_time: null,
      data: {
        [costFieldId]: 8900,
        [eventMileageFieldId]: 184000,
      },
      created_at: '2026-09-02T14:00:00Z',
      updated_at: '2026-09-02T14:00:00Z',
    },
  ];

  await db.transaction(
    'rw',
    [db.collections, db.field_definitions, db.items, db.events],
    async () => {
      await db.collections.add(demoCollection);
      await db.field_definitions.bulkAdd(demoFields);
      await db.items.bulkAdd(demoItems);
      await db.events.bulkAdd(demoEvents);
    }
  );

  try {
    localStorage.setItem('evidio_demo_event_fields_seeded', 'true');
  } catch {
    // Ignore localStorage restrictions
  }

  return carCollectionId;
}

/**
 * Idempotently adds the two demo EVENT fields ("Cena servisu", "Kilometry při servisu")
 * and populates them into the sample events.
 * Uses a localStorage flag ("evidio_demo_event_fields_seeded") so deleted demo data
 * is never re-seeded after reload.
 */
export async function seedDemoEventFieldsIfMissing(): Promise<void> {
  try {
    if (localStorage.getItem('evidio_demo_event_fields_seeded') === 'true') {
      return;
    }
  } catch {
    // continue
  }

  const carCollection = await db.collections.where('name').equals('Auta').first();
  if (!carCollection) return;

  const now = new Date().toISOString();

  // Check if EVENT fields already exist
  const existingFields = await db.field_definitions
    .where('collection_id')
    .equals(carCollection.id)
    .toArray();

  let costField = existingFields.find(
    (f) => f.target === 'EVENT' && (f.key === 'cost_czk' || f.name.includes('Cena'))
  );
  let mileageField = existingFields.find(
    (f) => f.target === 'EVENT' && (f.key === 'mileage_at_event' || f.name.includes('Kilometry'))
  );

  const fieldsToAdd: FieldDefinition[] = [];

  if (!costField) {
    costField = {
      id: crypto.randomUUID(),
      collection_id: carCollection.id,
      target: 'EVENT',
      key: 'cost_czk',
      name: 'Cena servisu',
      data_type: 'number',
      unit: 'Kč',
      event_types: ['Servis'],
      is_required: false,
      is_archived: false,
      display_order: existingFields.length + 1,
      config: {},
      validation_rules: { min: 0 },
      created_at: now,
      updated_at: now,
    };
    fieldsToAdd.push(costField);
  }

  if (!mileageField) {
    mileageField = {
      id: crypto.randomUUID(),
      collection_id: carCollection.id,
      target: 'EVENT',
      key: 'mileage_at_event',
      name: 'Kilometry při servisu',
      data_type: 'number',
      unit: 'km',
      event_types: ['Servis'],
      is_required: false,
      is_archived: false,
      display_order: existingFields.length + 2,
      config: {},
      validation_rules: { min: 0 },
      created_at: now,
      updated_at: now,
    };
    fieldsToAdd.push(mileageField);
  }

  if (fieldsToAdd.length > 0) {
    await db.field_definitions.bulkAdd(fieldsToAdd);
  }

  // Populate values in the two sample events if they have no custom field values
  const itemsInCar = await db.items.where('collection_id').equals(carCollection.id).toArray();
  const itemIds = itemsInCar.map((i) => i.id);

  if (itemIds.length > 0 && costField && mileageField) {
    const events = await db.events.where('item_id').anyOf(itemIds).toArray();
    for (const ev of events) {
      if (ev.title.includes('olej') || ev.title.includes('filtr')) {
        await db.events.update(ev.id, {
          data: {
            ...ev.data,
            [costField.id]: 4200,
            [mileageField.id]: 165000,
          },
        });
      } else if (ev.title.includes('brzd')) {
        await db.events.update(ev.id, {
          data: {
            ...ev.data,
            [costField.id]: 8900,
            [mileageField.id]: 184000,
          },
        });
      }
    }
  }

  try {
    localStorage.setItem('evidio_demo_event_fields_seeded', 'true');
  } catch {
    // ignore
  }
}
