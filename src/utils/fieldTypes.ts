/**
 * Central definitions and labels for Field Data Types in Evidio
 * UI Language: Czech
 */

import { FieldDataType } from '../types';

export const FIELD_DATA_TYPE_LABELS: Record<FieldDataType, string> = {
  text: 'Text (jednoduchý)',
  long_text: 'Dlouhý text (poznámky)',
  number: 'Číslo',
  date: 'Datum',
  boolean: 'Ano / Ne (přepínač)',
  single_select: 'Jednoduchý výběr (volby)',
  multi_select: 'Vícenásobný výběr',
  url: 'Odkaz',
};

export const ALL_FIELD_DATA_TYPES: FieldDataType[] = [
  'text',
  'long_text',
  'number',
  'date',
  'boolean',
  'single_select',
  'multi_select',
  'url',
];

export const CREATABLE_FIELD_TYPES: FieldDataType[] = [
  'text',
  'long_text',
  'number',
  'date',
  'boolean',
  'single_select',
];

export const DISALLOWED_TYPE_TRANSITION_REASON =
  'Tento převod není bezpečný. Vytvořte nové pole a původní archivujte.';

/**
 * Returns user-facing Czech label for a given field data type
 */
export function getFieldTypeLabel(type: FieldDataType | string): string {
  if (type in FIELD_DATA_TYPE_LABELS) {
    return FIELD_DATA_TYPE_LABELS[type as FieldDataType];
  }
  return type;
}

/**
 * Checks whether a type transition is safe/allowed according to DATA_MODEL.md
 * Allowed transitions only:
 * - text <-> long_text
 * - text -> number
 * - number -> text / long_text
 * - single_select -> text / long_text
 * - date -> text
 */
export function isTypeTransitionAllowed(
  fromType: FieldDataType,
  toType: FieldDataType
): boolean {
  if (fromType === toType) return true;

  if (fromType === 'text') {
    return toType === 'long_text' || toType === 'number';
  }
  if (fromType === 'long_text') {
    return toType === 'text';
  }
  if (fromType === 'number') {
    return toType === 'text' || toType === 'long_text';
  }
  if (fromType === 'single_select') {
    return toType === 'text' || toType === 'long_text';
  }
  if (fromType === 'date') {
    return toType === 'text';
  }

  return false;
}

/**
 * Sanitizes field configuration when changing data_type.
 * Removes config.reminder when targetType is not 'date'.
 */
export function sanitizeConfigForTypeChange(
  config: Record<string, any>,
  targetType: FieldDataType
): Record<string, any> {
  const updated = { ...config };
  if (targetType !== 'single_select') {
    delete updated.options;
  }
  if (targetType !== 'date') {
    delete updated.reminder;
  }
  return updated;
}
