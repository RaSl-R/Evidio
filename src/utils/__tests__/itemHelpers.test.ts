import { describe, it, expect } from 'vitest';
import {
  formatDateLabel,
  getEventCountText,
  getRemainingFieldsText,
  sortEventsDesc,
  formatCompactFieldValue,
} from '../itemHelpers';
import { ItemEvent, FieldDefinition } from '../../types';

describe('itemHelpers unit tests', () => {
  it('formats date string YYYY-MM-DD to Czech format', () => {
    expect(formatDateLabel('2026-10-12')).toBe('12. 10. 2026');
    expect(formatDateLabel('2025-01-05')).toBe('5. 1. 2025');
    expect(formatDateLabel('invalid-date')).toBe('invalid-date');
  });

  it('formats event count with correct Czech declension', () => {
    expect(getEventCountText(1)).toBe('1 událost');
    expect(getEventCountText(2)).toBe('2 události');
    expect(getEventCountText(3)).toBe('3 události');
    expect(getEventCountText(4)).toBe('4 události');
    expect(getEventCountText(5)).toBe('5 událostí');
    expect(getEventCountText(12)).toBe('12 událostí');
  });

  it('formats remaining fields count with Czech text', () => {
    expect(getRemainingFieldsText(1)).toBe('+1 další pole');
    expect(getRemainingFieldsText(2)).toBe('+2 další pole');
    expect(getRemainingFieldsText(3)).toBe('+3 další pole');
    expect(getRemainingFieldsText(4)).toBe('+4 další pole');
    expect(getRemainingFieldsText(5)).toBe('+5 dalších polí');
  });

  it('sorts events chronologically descending', () => {
    const events: ItemEvent[] = [
      {
        id: '1',
        item_id: 'item-1',
        event_type: 'Servis',
        title: 'Stará událost',
        event_date: '2024-05-01',
        event_time: null,
        data: {},
        created_at: '2024-05-01T10:00:00Z',
        updated_at: '2024-05-01T10:00:00Z',
      },
      {
        id: '2',
        item_id: 'item-1',
        event_type: 'STK',
        title: 'Nová událost',
        event_date: '2026-10-12',
        event_time: '14:30',
        data: {},
        created_at: '2026-10-12T14:30:00Z',
        updated_at: '2026-10-12T14:30:00Z',
      },
      {
        id: '3',
        item_id: 'item-1',
        event_type: 'Kontrola',
        title: 'Ranní událost stejný den',
        event_date: '2026-10-12',
        event_time: '09:00',
        data: {},
        created_at: '2026-10-12T09:00:00Z',
        updated_at: '2026-10-12T09:00:00Z',
      },
    ];

    const sorted = sortEventsDesc(events);
    expect(sorted[0].id).toBe('2');
    expect(sorted[1].id).toBe('3');
    expect(sorted[2].id).toBe('1');
  });

  it('formats compact field values for number, date, text', () => {
    const numField: FieldDefinition = {
      id: 'f1',
      collection_id: 'col1',
      target: 'ITEM',
      key: 'najeto',
      name: 'Najeto',
      data_type: 'number',
      unit: 'km',
      event_types: null,
      is_required: false,
      display_order: 1,
      is_archived: false,
      config: {},
      validation_rules: {},
      created_at: '',
      updated_at: '',
    };
    expect(formatCompactFieldValue(numField, null)).toBeNull();
    expect(formatCompactFieldValue(numField, undefined)).toBeNull();
    expect(formatCompactFieldValue(numField, '')).toBeNull();

    const dateField: FieldDefinition = {
      id: 'f2',
      collection_id: 'col1',
      target: 'ITEM',
      key: 'datum_nakupu',
      name: 'Datum nákupu',
      data_type: 'date',
      unit: null,
      event_types: null,
      is_required: false,
      display_order: 2,
      is_archived: false,
      config: {},
      validation_rules: {},
      created_at: '',
      updated_at: '',
    };
    expect(formatCompactFieldValue(dateField, '2023-04-15')).toBe('15. 4. 2023');

    const textField: FieldDefinition = {
      id: 'f3',
      collection_id: 'col1',
      target: 'ITEM',
      key: 'model',
      name: 'Model',
      data_type: 'text',
      unit: null,
      event_types: null,
      is_required: false,
      display_order: 3,
      is_archived: false,
      config: {},
      validation_rules: {},
      created_at: '',
      updated_at: '',
    };
    expect(formatCompactFieldValue(textField, 'Superb')).toBe('Superb');
  });
});
