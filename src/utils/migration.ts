/**
 * Data migration utilities for Evidio
 * Conforms to DATA_MODEL.md
 */

import { db } from '../db';

/**
 * Idempotently scans items and events to ensure all single_select field values
 * are stored strictly as option IDs, remapping any raw label strings to their IDs.
 */
export async function migrateSelectLabelsToIdsIfAny(): Promise<number> {
  const selectFields = await db.field_definitions
    .filter((f) => f.data_type === 'single_select' && !!f.config?.options)
    .toArray();

  if (selectFields.length === 0) return 0;

  let migratedCount = 0;

  await db.transaction('rw', [db.items, db.events], async () => {
    // 1. Check and migrate items
    const items = await db.items.toArray();
    for (const item of items) {
      let modified = false;
      const updatedData = { ...item.data };

      for (const field of selectFields) {
        if (field.target !== 'ITEM') continue;
        const val = updatedData[field.id];
        if (typeof val === 'string' && val.trim()) {
          // Check if val matches an option label instead of an option id
          const matchingOptionByLabel = field.config.options?.find(
            (o) => o.label.trim().toLowerCase() === val.trim().toLowerCase()
          );
          const matchingOptionById = field.config.options?.find((o) => o.id === val);

          if (matchingOptionByLabel && !matchingOptionById) {
            updatedData[field.id] = matchingOptionByLabel.id;
            modified = true;
            migratedCount++;
          }
        }
      }

      if (modified) {
        await db.items.update(item.id, { data: updatedData });
      }
    }

    // 2. Check and migrate events
    const events = await db.events.toArray();
    for (const event of events) {
      let modified = false;
      const updatedData = { ...event.data };

      for (const field of selectFields) {
        if (field.target !== 'EVENT') continue;
        const val = updatedData[field.id];
        if (typeof val === 'string' && val.trim()) {
          const matchingOptionByLabel = field.config.options?.find(
            (o) => o.label.trim().toLowerCase() === val.trim().toLowerCase()
          );
          const matchingOptionById = field.config.options?.find((o) => o.id === val);

          if (matchingOptionByLabel && !matchingOptionById) {
            updatedData[field.id] = matchingOptionByLabel.id;
            modified = true;
            migratedCount++;
          }
        }
      }

      if (modified) {
        await db.events.update(event.id, { data: updatedData });
      }
    }
  });

  return migratedCount;
}
