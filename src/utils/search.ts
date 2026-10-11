/**
 * Diacritics-insensitive search utilities for Evidio
 * Conforms to DATA_MODEL.md section 4.6
 */

import { Item, FieldDefinition, ItemEvent } from '../types';

/**
 * Normalizes text by removing Czech/international diacritics,
 * lowercasing, and trimming.
 * E.g. "Škoda Octavia (černá)" -> "skoda octavia (cerna)"
 */
export function normalizeSearchText(text: string | null | undefined): string {
  if (!text) return '';
  return String(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Checks whether haystack contains all query tokens (AND search)
 */
export function matchesQuery(haystack: string, query: string): boolean {
  const normQuery = normalizeSearchText(query);
  if (!normQuery) return true;

  const normHaystack = normalizeSearchText(haystack);
  const queryTokens = normQuery.split(/\s+/).filter(Boolean);

  return queryTokens.every((token) => normHaystack.includes(token));
}

/**
 * Checks if an item matches search query across:
 * - item name
 * - item data values (text, numbers, selected option labels)
 * - attached item events (event_type, title, AND event.data custom field values)
 */
export function itemMatchesSearch(
  item: Item,
  fields: FieldDefinition[],
  query: string,
  events: ItemEvent[] = []
): boolean {
  if (!query.trim()) return true;

  // Build searchable text corpus
  const corpusParts: string[] = [item.name];

  const fieldMap = new Map(fields.map((f) => [f.id, f]));

  // 1. Item custom fields
  for (const [fieldId, value] of Object.entries(item.data || {})) {
    if (value === null || value === undefined || value === '') continue;

    const field = fieldMap.get(fieldId);
    if (!field) continue;

    if (field.data_type === 'single_select') {
      const option = field.config?.options?.find((o) => o.id === value);
      if (option) {
        corpusParts.push(option.label);
      }
    } else if (field.data_type === 'boolean') {
      if (value === true) {
        corpusParts.push(field.name);
      }
    } else {
      corpusParts.push(String(value));
    }
  }

  // 2. Attached item events (titles, types, and custom event field values)
  for (const ev of events) {
    if (ev.title) corpusParts.push(ev.title);
    if (ev.event_type) corpusParts.push(ev.event_type);

    for (const [fieldId, val] of Object.entries(ev.data || {})) {
      if (val === null || val === undefined || val === '') continue;

      const field = fieldMap.get(fieldId);
      if (!field) continue;

      if (field.data_type === 'single_select') {
        const option = field.config?.options?.find((o) => o.id === val);
        if (option) {
          corpusParts.push(option.label);
        }
      } else if (field.data_type === 'boolean') {
        if (val === true) {
          corpusParts.push(field.name);
        }
      } else {
        corpusParts.push(String(val));
      }
    }
  }

  const fullCorpus = corpusParts.join(' ');
  return matchesQuery(fullCorpus, query);
}
