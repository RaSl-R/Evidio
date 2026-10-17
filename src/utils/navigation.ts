import { Item, Collection, CollectionGroup, ItemDetailFocus } from '../types';
import { ReminderItem, getReminderFocusTarget } from './reminders';

export interface ResolvedNavigationTarget {
  groupId: string | null;
  collectionId: string;
  itemId: string;
  focus: ItemDetailFocus | null;
}

/**
 * Resolves category, collection, item ID and detail focus target for navigating to an item.
 */
export function resolveNavigationTarget(
  item: Item,
  collections: Collection[],
  collectionGroups: CollectionGroup[],
  focus?: ItemDetailFocus | null
): ResolvedNavigationTarget | null {
  if (!item || !item.collection_id) return null;

  const collection = collections.find((c) => c.id === item.collection_id);
  if (!collection) return null;

  const group = collection.group_id
    ? collectionGroups.find((g) => g.id === collection.group_id) || null
    : null;

  return {
    groupId: group ? group.id : null,
    collectionId: collection.id,
    itemId: item.id,
    focus: focus || null,
  };
}

/**
 * Resolves category, collection, item ID and detail focus target for navigating from a reminder.
 */
export function resolveReminderNavigationTarget(
  reminder: ReminderItem,
  items: Item[],
  collections: Collection[],
  collectionGroups: CollectionGroup[]
): ResolvedNavigationTarget | null {
  if (!reminder || !reminder.itemId) return null;

  const item = items.find((i) => i.id === reminder.itemId);
  if (!item) return null;

  const focus = getReminderFocusTarget(reminder);
  return resolveNavigationTarget(item, collections, collectionGroups, focus);
}
