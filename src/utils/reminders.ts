import { FieldDefinition, Item, ItemEvent, ItemDetailFocus } from '../types';
import { normalizeSearchText } from './search';

export type ReminderStatus = 'overdue' | 'today' | 'soon' | 'later';

export interface ReminderItem {
  itemId: string;
  collectionId: string;
  fieldId: string;
  fieldName: string;
  targetKind: 'ITEM' | 'EVENT';
  dueDate: string; // YYYY-MM-DD
  dueTime?: string | null; // HH:mm or null
  daysLeft: number;
  status: ReminderStatus;
  eventId?: string;
}

export interface ReminderChipsResult {
  visibleReminders: ReminderItem[];
  hiddenCount: number;
  nextHiddenReminder: ReminderItem | null;
  totalUrgentCount: number;
}

/**
 * Deterministically compares two reminders by urgency:
 * 1. daysLeft ascending (overdue first)
 * 2. tie-break by time (earlier time first; timed before untimed)
 * 3. tie-break by fieldName (Czech locale)
 */
export function compareRemindersByUrgency(a: ReminderItem, b: ReminderItem): number {
  if (a.daysLeft !== b.daysLeft) {
    return a.daysLeft - b.daysLeft;
  }

  const timeA = a.dueTime || '';
  const timeB = b.dueTime || '';
  if (timeA !== timeB) {
    if (timeA && !timeB) return -1;
    if (!timeA && timeB) return 1;
    return timeA.localeCompare(timeB);
  }

  return a.fieldName.localeCompare(b.fieldName, 'cs');
}

/**
 * Pure helper to select visible reminder chips for an item card/row:
 * - Filters to status: overdue, today, soon (strictly excludes "later")
 * - Sorts by daysLeft asc, tie-break by time, then by label
 * - Slices up to maxVisible (default 2, narrow mode 1)
 * - Returns visible chips, hidden count, and next hidden reminder (for +N focus target)
 */
export function selectItemReminderChips(
  reminders: ReminderItem[],
  maxVisible: number = 2
): ReminderChipsResult {
  const urgent = reminders.filter(
    (r) => r.status === 'overdue' || r.status === 'today' || r.status === 'soon'
  );

  urgent.sort(compareRemindersByUrgency);

  const visibleReminders = urgent.slice(0, maxVisible);
  const hiddenReminders = urgent.slice(maxVisible);
  const hiddenCount = hiddenReminders.length;
  const nextHiddenReminder = hiddenReminders[0] || null;

  return {
    visibleReminders,
    hiddenCount,
    nextHiddenReminder,
    totalUrgentCount: urgent.length,
  };
}

/**
 * Determines target section and IDs for ItemDetailModal focus from a reminder item.
 */
export function getReminderFocusTarget(reminder: ReminderItem): ItemDetailFocus {
  if (reminder.targetKind === 'EVENT') {
    return {
      section: 'events',
      eventId: reminder.eventId,
    };
  } else {
    return {
      section: 'properties',
      fieldId: reminder.fieldId,
    };
  }
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
 * Formats event reminder label: "<event_type>: <title>" with event_time when present.
 */
export function formatEventReminderLabel(
  eventType: string,
  title: string,
  eventTime?: string | null
): string {
  const timeStr = eventTime?.trim();
  const base = `${eventType}: ${title}`;
  return timeStr ? `${base} (${timeStr})` : base;
}

/**
 * Computes event deadline reminders for events whose event_date is today or later.
 * Pure function: never reads clock, uses provided todayStr (YYYY-MM-DD).
 */
export function computeEventReminders(
  events: ItemEvent[],
  items: Item[],
  todayStr: string
): ReminderItem[] {
  const todayUtc = parseDateToUtc(todayStr);
  if (todayUtc === null) return [];

  const itemsById = new Map<string, Item>();
  for (const item of items) {
    itemsById.set(item.id, item);
  }

  const reminders: ReminderItem[] = [];

  for (const event of events) {
    // Missing means DEFAULT: enabled: true, 30 days
    const reminderConfig = event.reminder ?? { enabled: true, days_before: 30 };
    if (!reminderConfig.enabled) {
      continue;
    }

    const dueUtc = parseDateToUtc(event.event_date);
    if (dueUtc === null) continue;

    // UTC day difference as in reminders.ts, no local Date math
    const daysLeft = Math.round((dueUtc - todayUtc) / 86400000);

    // Events in the past never produce a reminder
    if (daysLeft < 0) {
      continue;
    }

    const daysBefore = reminderConfig.days_before ?? 30;

    // status: 0 -> "today", 1..days_before -> "soon", greater -> "later"
    let status: ReminderStatus = 'later';
    if (daysLeft === 0) {
      status = 'today';
    } else if (daysLeft >= 1 && daysLeft <= daysBefore) {
      status = 'soon';
    } else {
      status = 'later';
    }

    const item = itemsById.get(event.item_id);
    if (!item) continue;

    const fieldName = formatEventReminderLabel(
      event.event_type,
      event.title,
      event.event_time
    );

    reminders.push({
      itemId: item.id,
      collectionId: item.collection_id,
      fieldId: event.id,
      fieldName,
      targetKind: 'EVENT',
      dueDate: event.event_date,
      dueTime: event.event_time ?? null,
      daysLeft,
      status,
      eventId: event.id,
    });
  }

  return reminders;
}

/**
 * Computes deadline reminders for date fields with active reminder config.
 * Pure function: never reads clock, uses provided todayStr (YYYY-MM-DD).
 */
export function computeFieldReminders(
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
          dueTime: null,
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
          dueTime: latestEvent.event_time ?? null,
          daysLeft,
          status,
          eventId: latestEvent.id,
        });
      }
    }
  }

  return reminders;
}

/**
 * Computes all deadline reminders (both date fields and events).
 * Pure function: never reads clock, uses provided todayStr (YYYY-MM-DD).
 */
export function computeReminders(
  fieldDefs: FieldDefinition[],
  items: Item[],
  events: ItemEvent[],
  todayStr: string
): ReminderItem[] {
  const fieldReminders = computeFieldReminders(fieldDefs, items, events, todayStr);
  const eventReminders = computeEventReminders(events, items, todayStr);
  return [...fieldReminders, ...eventReminders];
}

export type DeadlineBarColorLevel = 'red' | 'orange' | 'yellow';

export interface DeadlineBarSelectionResult {
  shownReminders: ReminderItem[];
  totalUrgentCount: number;
  remainingCount: number;
}

/**
 * Pure helper to select nearest non-dismissed reminders across all sections for the main deadline bar.
 * - Filters strictly to status: 'overdue' | 'today' | 'soon'
 * - Excludes any reminder present in dismissedKeys
 * - Sorts deterministically with compareRemindersByUrgency
 * - Slices up to maxVisible items (default 2)
 * - Calculates remainingCount (total non-dismissed urgent - shown count, minimum 0)
 */
export function selectDeadlineBarReminders(
  reminders: ReminderItem[],
  dismissedKeys?: Set<string> | string[],
  maxVisible: number = 2,
  todayStr?: string
): DeadlineBarSelectionResult {
  const dismissedSet =
    dismissedKeys instanceof Set
      ? dismissedKeys
      : new Set(dismissedKeys || []);

  const urgent = reminders.filter((r) => {
    if (r.status !== 'overdue' && r.status !== 'today' && r.status !== 'soon') {
      return false;
    }

    if (dismissedSet.size === 0) {
      return true;
    }

    if (todayStr) {
      const key = getDeadlineBarDismissKey(r, todayStr);
      if (dismissedSet.has(key)) return false;
    } else {
      const reminderId = r.eventId
        ? `${r.itemId}:${r.eventId}`
        : `${r.itemId}:${r.fieldId}`;
      const keySuffix = `_${reminderId}_${r.dueDate}`;
      for (const k of dismissedSet) {
        if (k === keySuffix || k.endsWith(keySuffix)) {
          return false;
        }
      }
    }

    return true;
  });

  urgent.sort(compareRemindersByUrgency);

  const shownReminders = urgent.slice(0, maxVisible);
  const totalUrgentCount = urgent.length;
  const remainingCount = Math.max(0, totalUrgentCount - shownReminders.length);

  return {
    shownReminders,
    totalUrgentCount,
    remainingCount,
  };
}

/**
 * Determines color level ('red' | 'orange' | 'yellow') based on the most urgent shown reminder.
 * - overdue or today (daysLeft <= 0 or status in ['overdue', 'today']) -> 'red'
 * - daysLeft < 7 -> 'orange'
 * - otherwise (daysLeft >= 7) -> 'yellow'
 */
export function getDeadlineBarColorLevel(
  reminderOrDaysLeft: ReminderItem | number,
  status?: ReminderStatus
): DeadlineBarColorLevel {
  let daysLeft: number;
  let currentStatus: ReminderStatus | undefined = status;

  if (typeof reminderOrDaysLeft === 'number') {
    daysLeft = reminderOrDaysLeft;
    if (!currentStatus) {
      if (daysLeft < 0) currentStatus = 'overdue';
      else if (daysLeft === 0) currentStatus = 'today';
      else currentStatus = 'soon';
    }
  } else {
    daysLeft = reminderOrDaysLeft.daysLeft;
    currentStatus = reminderOrDaysLeft.status;
  }

  if (currentStatus === 'overdue' || currentStatus === 'today' || daysLeft <= 0) {
    return 'red';
  }

  if (daysLeft < 7) {
    return 'orange';
  }

  return 'yellow';
}

/**
 * Formats YYYY-MM-DD to Czech "D. M." (e.g. 2026-10-17 -> "17. 10.")
 */
export function formatDeadlineBarDate(dateStr: string): string {
  if (!dateStr || dateStr.length < 10) return '';
  const [, m, d] = dateStr.substring(0, 10).split('-');
  return `${parseInt(d, 10)}. ${parseInt(m, 10)}.`;
}

/**
 * Formats a deadline bar segment:
 * labelPart: "<label> — <item name>:" (truncates with ellipsis)
 * relativePart: "<relative text> (<date, cs-CZ>)" (nowrap, never truncated)
 * fullText: "<label> — <item name>: <relative text> (<date, cs-CZ>)"
 */
export function formatDeadlineBarSegment(
  reminder: ReminderItem,
  itemName?: string
): {
  labelPart: string;
  relativePart: string;
  fullText: string;
} {
  const label = reminder.fieldName;
  const name = itemName?.trim();
  const labelPart = name ? `${label} — ${name}:` : `${label}:`;
  const relText = formatRelativeDays(reminder.daysLeft);
  const dateFormatted = formatDeadlineBarDate(reminder.dueDate);
  const relativePart = `${relText} (${dateFormatted})`;
  const fullText = `${labelPart} ${relativePart}`;

  return { labelPart, relativePart, fullText };
}

/**
 * Generates a unique dismissal key for a specific reminder on todayStr.
 * Key format: `${todayStr}_${reminderId}_${dueDate}`.
 * Ensures uniqueness even for two reminders of the same item.
 */
export function getDeadlineBarDismissKey(
  reminder: ReminderItem,
  todayStr: string
): string {
  const reminderId = reminder.eventId
    ? `${reminder.itemId}:${reminder.eventId}`
    : `${reminder.itemId}:${reminder.fieldId}`;
  return `${todayStr}_${reminderId}_${reminder.dueDate}`;
}
