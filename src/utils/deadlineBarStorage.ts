import { ReminderItem, getDeadlineBarDismissKey } from './reminders';

export const DEADLINE_BAR_DISMISSED_KEYS_STORAGE = 'evidio_deadline_bar_dismissed_keys';

/**
 * Pure helper function taking an array of stored key strings and todayStr (YYYY-MM-DD).
 * Drops stored keys from earlier days (keys that do not start with `${todayStr}_`).
 * Old key formats that do not match the current day prefix are simply ignored.
 */
export function cleanupOldDeadlineBarKeys(
  storedKeys: string[],
  todayStr: string
): string[] {
  if (!Array.isArray(storedKeys) || !todayStr) return [];
  const prefix = `${todayStr}_`;
  return storedKeys.filter(
    (key) => typeof key === 'string' && key.startsWith(prefix)
  );
}

/**
 * Reads dismissed deadline bar keys for todayStr from localStorage.
 * Automatically cleans up and drops keys from previous days.
 */
export function getDismissedDeadlineBarKeys(todayStr: string): Set<string> {
  if (typeof window === 'undefined' || !window.localStorage) {
    return new Set();
  }
  try {
    const raw = window.localStorage.getItem(DEADLINE_BAR_DISMISSED_KEYS_STORAGE);
    if (!raw) return new Set();

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();

    const cleaned = cleanupOldDeadlineBarKeys(parsed, todayStr);

    if (cleaned.length !== parsed.length) {
      window.localStorage.setItem(
        DEADLINE_BAR_DISMISSED_KEYS_STORAGE,
        JSON.stringify(cleaned)
      );
    }

    return new Set(cleaned);
  } catch {
    return new Set();
  }
}

/**
 * Saves a dismissed reminder to localStorage for the given todayStr.
 * Returns the updated Set of dismissed keys for today.
 */
export function dismissDeadlineBarReminder(
  reminder: ReminderItem,
  todayStr: string
): Set<string> {
  const dismissKey = getDeadlineBarDismissKey(reminder, todayStr);
  const currentKeys = getDismissedDeadlineBarKeys(todayStr);
  currentKeys.add(dismissKey);

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(
        DEADLINE_BAR_DISMISSED_KEYS_STORAGE,
        JSON.stringify(Array.from(currentKeys))
      );
    } catch {}
  }

  return currentKeys;
}
