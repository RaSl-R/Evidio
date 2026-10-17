import { describe, it, expect, beforeEach } from 'vitest';
import {
  cleanupOldDeadlineBarKeys,
  getDismissedDeadlineBarKeys,
  dismissDeadlineBarReminder,
  DEADLINE_BAR_DISMISSED_KEYS_STORAGE,
} from '../deadlineBarStorage';
import { ReminderItem } from '../reminders';

const storageMap = new Map<string, string>();
const localStorageMock = {
  getItem: (key: string) => storageMap.get(key) ?? null,
  setItem: (key: string, value: string) => storageMap.set(key, value),
  removeItem: (key: string) => storageMap.delete(key),
  clear: () => storageMap.clear(),
};

if (typeof window === 'undefined') {
  (globalThis as any).window = {
    localStorage: localStorageMock,
  };
} else {
  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
    writable: true,
  });
}

describe('Deadline Bar Storage Unit Tests', () => {
  const todayStr = '2026-10-17';
  const yesterdayStr = '2026-10-16';

  const mockReminder: ReminderItem = {
    itemId: 'item-100',
    collectionId: 'col-1',
    fieldId: 'field-50',
    fieldName: 'STK Kontrola',
    targetKind: 'ITEM',
    dueDate: '2026-10-25',
    dueTime: null,
    daysLeft: 8,
    status: 'soon',
  };

  beforeEach(() => {
    storageMap.clear();
  });

  describe('cleanupOldDeadlineBarKeys', () => {
    it('keeps keys for todayStr and drops old-day keys', () => {
      const storedKeys = [
        `2026-10-17_item-1:f1_2026-10-20`,
        `2026-10-16_item-1:f1_2026-10-20`,
        `evidio_deadline_bar_dismissed_2026-10-17_old_format`,
        `2026-10-17_item-2:f2_2026-10-22`,
      ];

      const cleaned = cleanupOldDeadlineBarKeys(storedKeys, todayStr);
      expect(cleaned).toEqual([
        `2026-10-17_item-1:f1_2026-10-20`,
        `2026-10-17_item-2:f2_2026-10-22`,
      ]);
    });

    it('handles empty or non-array input gracefully', () => {
      expect(cleanupOldDeadlineBarKeys([], todayStr)).toEqual([]);
      expect(cleanupOldDeadlineBarKeys(null as any, todayStr)).toEqual([]);
    });
  });

  describe('getDismissedDeadlineBarKeys & dismissDeadlineBarReminder', () => {
    it('returns empty Set when localStorage has no record', () => {
      const keys = getDismissedDeadlineBarKeys(todayStr);
      expect(keys.size).toBe(0);
    });

    it('dismissDeadlineBarReminder adds key and saves to localStorage', () => {
      const updatedKeys = dismissDeadlineBarReminder(mockReminder, todayStr);
      expect(updatedKeys.size).toBe(1);

      const expectedKey = `${todayStr}_item-100:field-50_2026-10-25`;
      expect(updatedKeys.has(expectedKey)).toBe(true);

      const storedRaw = window.localStorage.getItem(DEADLINE_BAR_DISMISSED_KEYS_STORAGE);
      expect(storedRaw).not.toBeNull();
      expect(JSON.parse(storedRaw!)).toEqual([expectedKey]);
    });

    it('getDismissedDeadlineBarKeys cleans up old-day keys from localStorage on read', () => {
      const oldKey = `${yesterdayStr}_item-old:f1_2026-10-20`;
      const todayKey = `${todayStr}_item-100:field-50_2026-10-25`;

      window.localStorage.setItem(
        DEADLINE_BAR_DISMISSED_KEYS_STORAGE,
        JSON.stringify([oldKey, todayKey])
      );

      const keys = getDismissedDeadlineBarKeys(todayStr);
      expect(keys.size).toBe(1);
      expect(keys.has(todayKey)).toBe(true);
      expect(keys.has(oldKey)).toBe(false);

      // Verify old key was dropped from localStorage
      const storedRaw = window.localStorage.getItem(DEADLINE_BAR_DISMISSED_KEYS_STORAGE);
      expect(JSON.parse(storedRaw!)).toEqual([todayKey]);
    });
  });
});
