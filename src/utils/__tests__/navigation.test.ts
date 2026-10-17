import { describe, it, expect } from 'vitest';
import { CollectionGroup, Collection, Item } from '../../types';
import { ReminderItem } from '../reminders';
import {
  resolveNavigationTarget,
  resolveReminderNavigationTarget,
} from '../navigation';

describe('Navigation Helpers', () => {
  const groups: CollectionGroup[] = [
    { id: 'group-1', name: 'Auta', is_default: false, display_order: 0, created_at: '', updated_at: '' },
    { id: 'group-2', name: 'Elektronika', is_default: false, display_order: 1, created_at: '', updated_at: '' },
  ];

  const collections: Collection[] = [
    { id: 'col-1', group_id: 'group-1', name: 'Osobní auta', description: '', icon: 'car', display_order: 0, created_at: '', updated_at: '' },
    { id: 'col-2', group_id: 'group-2', name: 'Notebooky', description: '', icon: 'laptop', display_order: 0, created_at: '', updated_at: '' },
  ];

  const items: Item[] = [
    { id: 'item-1', collection_id: 'col-1', item_type_id: null, tag_ids: [], name: 'Škoda Octavia', data: {}, created_at: '', updated_at: '' },
    { id: 'item-2', collection_id: 'col-2', item_type_id: null, tag_ids: [], name: 'MacBook Pro', data: {}, created_at: '', updated_at: '' },
  ];

  describe('resolveNavigationTarget', () => {
    it('resolves correct group, collection, item and focus', () => {
      const res = resolveNavigationTarget(items[0], collections, groups, {
        section: 'properties',
        fieldId: 'field-stk',
      });

      expect(res).toEqual({
        groupId: 'group-1',
        collectionId: 'col-1',
        itemId: 'item-1',
        focus: {
          section: 'properties',
          fieldId: 'field-stk',
        },
      });
    });

    it('returns null if item collection does not exist', () => {
      const invalidItem: Item = { id: 'item-x', collection_id: 'non-existent', item_type_id: null, tag_ids: [], name: 'Unknown', data: {}, created_at: '', updated_at: '' };
      const res = resolveNavigationTarget(invalidItem, collections, groups);
      expect(res).toBeNull();
    });
  });

  describe('resolveReminderNavigationTarget', () => {
    it('resolves navigation target for property reminder in another section/group', () => {
      const reminder: ReminderItem = {
        itemId: 'item-2',
        collectionId: 'col-2',
        targetKind: 'ITEM',
        fieldId: 'warranty_date',
        fieldName: 'Záruka do',
        dueDate: '2026-06-01',
        daysLeft: 10,
        status: 'soon',
      };

      const res = resolveReminderNavigationTarget(reminder, items, collections, groups);

      expect(res).toEqual({
        groupId: 'group-2',
        collectionId: 'col-2',
        itemId: 'item-2',
        focus: {
          section: 'properties',
          fieldId: 'warranty_date',
        },
      });
    });

    it('resolves navigation target for event reminder', () => {
      const reminder: ReminderItem = {
        itemId: 'item-1',
        collectionId: 'col-1',
        targetKind: 'EVENT',
        eventId: 'event-stk-1',
        fieldId: 'stk_due',
        fieldName: 'Příští STK',
        dueDate: '2026-05-15',
        daysLeft: 5,
        status: 'soon',
      };

      const res = resolveReminderNavigationTarget(reminder, items, collections, groups);

      expect(res).toEqual({
        groupId: 'group-1',
        collectionId: 'col-1',
        itemId: 'item-1',
        focus: {
          section: 'events',
          eventId: 'event-stk-1',
        },
      });
    });

    it('returns null if reminder item does not exist', () => {
      const reminder: ReminderItem = {
        itemId: 'missing-item',
        collectionId: 'col-1',
        targetKind: 'ITEM',
        fieldId: 'f1',
        fieldName: 'F1',
        dueDate: '2026-01-01',
        daysLeft: 0,
        status: 'today',
      };

      const res = resolveReminderNavigationTarget(reminder, items, collections, groups);
      expect(res).toBeNull();
    });
  });
});
