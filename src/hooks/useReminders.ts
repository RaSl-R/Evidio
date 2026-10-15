import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { computeReminders, ReminderItem } from '../utils/reminders';
import { FieldDefinition, Item, ItemEvent } from '../types';

export interface UseRemindersResult {
  allReminders: ReminderItem[];
  urgentReminders: ReminderItem[];
  urgentCount: number;
  hasOverdueOrToday: boolean;
  hasSoon: boolean;
  remindersByItemId: Map<string, ReminderItem[]>;
  mostUrgentReminderByItemId: Map<string, ReminderItem>;
}

/**
 * Live Dexie query calculating reminders over only fields with an active reminder config.
 */
export function useReminders(todayStr: string): UseRemindersResult {
  const rawReminders = useLiveQuery<ReminderItem[]>(async () => {
    // 1. Query only date fields with active reminder
    const fieldsWithReminder = await db.field_definitions
      .filter(
        (f: FieldDefinition) =>
          !f.is_archived &&
          f.data_type === 'date' &&
          f.config?.reminder?.enabled === true
      )
      .toArray();

    // 2. Query upcoming events (today or later)
    const upcomingEvents = await db.events
      .where('event_date')
      .aboveOrEqual(todayStr)
      .toArray();

    if (fieldsWithReminder.length === 0 && upcomingEvents.length === 0) {
      return [];
    }

    // 3. Query items needed for fields and upcoming events
    const collectionIds = Array.from(
      new Set(fieldsWithReminder.map((f) => f.collection_id))
    );
    const itemsForFields =
      collectionIds.length > 0
        ? await db.items.where('collection_id').anyOf(collectionIds).toArray()
        : [];

    const upcomingItemIds = Array.from(
      new Set(upcomingEvents.map((e) => e.item_id))
    );
    const itemsForEvents =
      upcomingItemIds.length > 0
        ? await db.items.where('id').anyOf(upcomingItemIds).toArray()
        : [];

    const itemsMap = new Map<string, Item>();
    for (const item of itemsForFields) itemsMap.set(item.id, item);
    for (const item of itemsForEvents) itemsMap.set(item.id, item);
    const allItems = Array.from(itemsMap.values());

    // 4. Query events if any field is EVENT-level
    const hasEventField = fieldsWithReminder.some((f) => f.target === 'EVENT');
    let eventFieldEvents: ItemEvent[] = [];
    if (hasEventField && allItems.length > 0) {
      const itemIds = allItems.map((i) => i.id);
      eventFieldEvents = await db.events.where('item_id').anyOf(itemIds).toArray();
    }

    const eventsMap = new Map<string, ItemEvent>();
    for (const ev of eventFieldEvents) eventsMap.set(ev.id, ev);
    for (const ev of upcomingEvents) eventsMap.set(ev.id, ev);
    const allEvents = Array.from(eventsMap.values());

    return computeReminders(fieldsWithReminder, allItems, allEvents, todayStr);
  }, [todayStr]);

  const allReminders = useMemo(() => {
    if (!rawReminders) return [];
    // Sort all reminders by daysLeft ascending
    return [...rawReminders].sort((a, b) => a.daysLeft - b.daysLeft);
  }, [rawReminders]);

  const urgentReminders = useMemo(() => {
    return allReminders.filter(
      (r) => r.status === 'overdue' || r.status === 'today' || r.status === 'soon'
    );
  }, [allReminders]);

  const urgentCount = urgentReminders.length;
  const hasOverdueOrToday = urgentReminders.some(
    (r) => r.status === 'overdue' || r.status === 'today'
  );
  const hasSoon = urgentReminders.some((r) => r.status === 'soon');

  const { remindersByItemId, mostUrgentReminderByItemId } = useMemo(() => {
    const byItem = new Map<string, ReminderItem[]>();
    const mostUrgent = new Map<string, ReminderItem>();

    for (const r of allReminders) {
      const list = byItem.get(r.itemId);
      if (list) {
        list.push(r);
      } else {
        byItem.set(r.itemId, [r]);
      }
    }

    for (const [itemId, list] of byItem.entries()) {
      // list is already sorted by daysLeft ascending
      if (list.length > 0) {
        mostUrgent.set(itemId, list[0]);
      }
    }

    return { remindersByItemId: byItem, mostUrgentReminderByItemId: mostUrgent };
  }, [allReminders]);

  return {
    allReminders,
    urgentReminders,
    urgentCount,
    hasOverdueOrToday,
    hasSoon,
    remindersByItemId,
    mostUrgentReminderByItemId,
  };
}
