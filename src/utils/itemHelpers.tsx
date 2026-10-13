import React from 'react';
import { FieldDefinition, ItemEvent } from '../types';

/**
 * Formats a field value for compact display in cards and list rows.
 */
export function formatCompactFieldValue(
  field: FieldDefinition,
  val: any
): React.ReactNode {
  if (val === undefined || val === null || val === '') return null;

  if (field.data_type === 'single_select') {
    const option = field.config?.options?.find((o) => o.id === val);
    return (
      <span
        className="inline-flex items-center px-1.5 py-0.2 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-800 truncate"
        style={
          option?.color
            ? { backgroundColor: `${option.color}15`, color: option.color }
            : undefined
        }
      >
        {option ? option.label : String(val)}
      </span>
    );
  }

  if (field.data_type === 'boolean') {
    return (
      <span
        className={`inline-flex items-center px-1.5 py-0.2 rounded-md text-[11px] font-semibold ${
          val ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
        }`}
      >
        {val ? 'Ano' : 'Ne'}
      </span>
    );
  }

  if (field.data_type === 'number') {
    const formatted =
      typeof val === 'number'
        ? new Intl.NumberFormat('cs-CZ').format(val)
        : String(val);
    return (
      <span className="font-semibold text-slate-900">
        {formatted}
        {field.unit ? ` ${field.unit}` : ''}
      </span>
    );
  }

  if (field.data_type === 'date') {
    try {
      const parts = String(val).split('-');
      if (parts.length === 3) {
        return `${parseInt(parts[2], 10)}. ${parseInt(parts[1], 10)}. ${parts[0]}`;
      }
    } catch {
      // fallback
    }
    return String(val);
  }

  return String(val);
}

/**
 * Formats a date string (YYYY-MM-DD) into Czech calendar format "D. M. YYYY".
 */
export function formatDateLabel(dateStr: string): string {
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parseInt(parts[2], 10)}. ${parseInt(parts[1], 10)}. ${parts[0]}`;
    }
  } catch {
    // fallback
  }
  return dateStr;
}

/**
 * Formats event count with correct Czech declension.
 */
export function getEventCountText(count: number): string {
  if (count === 1) return '1 událost';
  if (count >= 2 && count <= 4) return `${count} události`;
  return `${count} událostí`;
}

/**
 * Formats remaining fields count label with Czech grammar.
 */
export function getRemainingFieldsText(count: number): string {
  if (count === 1) return '+1 další pole';
  if (count >= 2 && count <= 4) return `+${count} další pole`;
  return `+${count} dalších polí`;
}

/**
 * Sorts events chronologically descending (newest first).
 */
export function sortEventsDesc(events: ItemEvent[]): ItemEvent[] {
  return [...events].sort((a, b) => {
    if (a.event_date !== b.event_date) {
      return b.event_date.localeCompare(a.event_date);
    }
    const timeA = a.event_time || '';
    const timeB = b.event_time || '';
    if (timeA !== timeB) {
      if (!timeA) return 1;
      if (!timeB) return -1;
      return timeB.localeCompare(timeA);
    }
    return b.created_at.localeCompare(a.created_at);
  });
}
