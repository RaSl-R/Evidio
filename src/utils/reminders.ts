import { FieldDefinition, Item, ItemEvent } from '../types';
import { normalizeSearchText } from './search';

export type ReminderStatus = 'overdue' | 'today' | 'soon' | 'later';

export interface ReminderItem {
  itemId: string;
  collectionId: string;
  fieldId: string;
  fieldName: string;
  targetKind: 'ITEM' | 'EVENT';
  dueDate: string; // YYYY-MM-DD
  daysLeft: number;
  status: ReminderStatus;
}

/**
 * Parses YYYY-MM-DD string into UTC timestamp at 00:00:00.
 */
function parseDateToUtc(dateStr: string): number | null {
  if (!dateStr || dateStr.length < 10) return null;
  const isoDate = dateStr.substring(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return null;

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);

  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const utcMs = Date.UTC(year, month - 1, day);
  const d = new Date(utcMs);

  // Validate that the constructed Date object matches the input components
  if (
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() !== month - 1 ||
    d.getUTCDate() !== day
  ) {
    return null;
  }

  return utcMs;
}

/**
 * Formats relative days string in Czech.
 */
export function formatRelativeDays(daysLeft: number): string {
  if (daysLeft === 0) return 'dnes';
  if (daysLeft === 1) return 'zítra';
  if (daysLeft === -1) return 'včera';

  const absDays = Math.abs(daysLeft);
  if (daysLeft > 0) {
    if (absDays >= 2 && absDays <= 4) {
      return `za ${absDays} dny`;
    }
    return `za ${absDays} dní`;
  } else {
    if (absDays >= 2 && absDays <= 4) {
      return `před ${absDays} dny`;
    }
    return `před ${absDays} dny`;
  }
}

/**
 * Computes deadline reminders for date fields with active reminder config.
 * Pure function: never reads clock, uses provided todayStr (YYYY-MM-DD).
 */
export function computeReminders(
  fieldDefs: FieldDefinition[],
  items: Item[],
  events: ItemEvent[],
  todayStr: string
): ReminderItem[] {
  const todayUtc = parseDateToUtc(todayStr);
  if (todayUtc === null) return [];

  // Filter relevant date field definitions
  const activeDateFieldDefs = fieldDefs.filter(
    (f) =>
      f.data_type === 'date' &&
      !f.is_archived &&
      f.config?.reminder?.enabled === true
  );

  if (activeDateFieldDefs.length === 0) return [];

  const reminders: ReminderItem[] = [];

  // Index items by ID for quick lookup and grouping
  const itemsById = new Map<string, Item>();
  for (const item of items) {
    itemsById.set(item.id, item);
  }

  // Index events by item_id
  const eventsByItemId = new Map<string, ItemEvent[]>();
  for (const event of events) {
    const list = eventsByItemId.get(event.item_id);
    if (list) {
      list.push(event);
    } else {
      eventsByItemId.set(event.item_id, [event]);
    }
  }

  for (const field of activeDateFieldDefs) {
    const daysBefore = field.config.reminder?.days_before ?? 0;

    if (field.target === 'ITEM') {
      // ITEM level date fields
      for (const item of items) {
        if (item.collection_id !== field.collection_id) continue;

        const rawVal = item.data?.[field.id];
        if (rawVal === undefined || rawVal === null || String(rawVal).trim() === '') {
          continue;
        }

        const dueDateStr = String(rawVal).trim().substring(0, 10);
        const dueUtc = parseDateToUtc(dueDateStr);
        if (dueUtc === null) continue;

        const daysLeft = Math.round((dueUtc - todayUtc) / 86400000);

        let status: ReminderStatus = 'later';
        if (daysLeft < 0) {
          status = 'overdue';
        } else if (daysLeft === 0) {
          status = 'today';
        } else if (daysLeft >= 1 && daysLeft <= daysBefore) {
          status = 'soon';
        }

        reminders.push({
          itemId: item.id,
          collectionId: item.collection_id,
          fieldId: field.id,
          fieldName: field.name,
          targetKind: 'ITEM',
          dueDate: dueDateStr,
          daysLeft,
          status,
        });
      }
    } else if (field.target === 'EVENT') {
      // EVENT level date fields
      for (const item of items) {
        if (item.collection_id !== field.collection_id) continue;

        const itemEvents = eventsByItemId.get(item.id) || [];

        // Find events to which this field applies and that have a non-empty value
        const matchingEvents = itemEvents.filter((e) => {
          // Check if field applies to this event's event_type
          if (field.event_types && field.event_types.length > 0) {
            const normEventType = normalizeSearchText(e.event_type || '');
            const applies = field.event_types.some(
              (t) => normalizeSearchText(t) === normEventType
            );
            if (!applies) return false;
          }

          const rawVal = e.data?.[field.id];
          return rawVal !== undefined && rawVal !== null && String(rawVal).trim() !== '';
        });

        if (matchingEvents.length === 0) continue;

        // Pick ONLY the most recent event by (event_date desc, event_time desc, created_at desc)
        matchingEvents.sort((a, b) => {
          if (a.event_date !== b.event_date) {
            return b.event_date.localeCompare(a.event_date);
          }
          const timeA = a.event_time || '';
          const timeB = b.event_time || '';
          if (timeA !== timeB) {
            return timeB.localeCompare(timeA);
          }
          return b.created_at.localeCompare(a.created_at);
        });

        const latestEvent = matchingEvents[0];
        const rawVal = latestEvent.data[field.id];
        const dueDateStr = String(rawVal).trim().substring(0, 10);
        const dueUtc = parseDateToUtc(dueDateStr);
        if (dueUtc === null) continue;

        const daysLeft = Math.round((dueUtc - todayUtc) / 86400000);

        let status: ReminderStatus = 'later';
        if (daysLeft < 0) {
          status = 'overdue';
        } else if (daysLeft === 0) {
          status = 'today';
        } else if (daysLeft >= 1 && daysLeft <= daysBefore) {
          status = 'soon';
        }

        reminders.push({
          itemId: item.id,
          collectionId: item.collection_id,
          fieldId: field.id,
          fieldName: field.name,
          targetKind: 'EVENT',
          dueDate: dueDateStr,
          daysLeft,
          status,
        });
      }
    }
  }

  return reminders;
}
