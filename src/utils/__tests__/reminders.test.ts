import { describe, it, expect } from 'vitest';
import {
  computeReminders,
  computeEventReminders,
  formatEventReminderLabel,
  formatRelativeDays,
  selectItemReminderChips,
  getReminderFocusTarget,
  compareRemindersByUrgency,
  ReminderItem,
  selectDeadlineBarReminders,
  getDeadlineBarColorLevel,
  formatDeadlineBarSegment,
  getDeadlineBarDismissKey,
} from '../reminders';
import { sanitizeConfigForTypeChange } from '../fieldTypes';
import { prepareImportCopy, prepareImportRestore } from '../import';
import { buildEvidioPackage } from '../export';
import { FieldDefinition, Item, ItemEvent, EvidioPackage, CollectionGroup, Collection } from '../../types';

describe('Deadline Reminders Unit Tests', () => {
  const dummyColId = '11111111-1111-4111-8111-111111111111';
  const dummyItemId = '22222222-2222-4222-8222-222222222222';
  const dummyFieldId = '33333333-3333-4333-8333-333333333333';

  const baseItemFieldDef: FieldDefinition = {
    id: dummyFieldId,
    collection_id: dummyColId,
    target: 'ITEM',
    key: 'stk_date',
    name: 'Platnost STK',
    data_type: 'date',
    unit: null,
    event_types: null,
    is_required: false,
    is_archived: false,
    display_order: 1,
    config: {
      reminder: {
        enabled: true,
        days_before: 30,
      },
    },
    validation_rules: {},
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };

  const baseItem: Item = {
    id: dummyItemId,
    collection_id: dummyColId,
    item_type_id: null,
    name: 'Škoda Octavia',
    tag_ids: [],
    data: {
      [dummyFieldId]: '2026-05-15',
    },
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };

  describe('1. Month and Year Boundaries', () => {
    it('calculates daysLeft correctly across year boundaries (Dec 31 to Jan 1)', () => {
      const fieldDef: FieldDefinition = {
        ...baseItemFieldDef,
        config: { reminder: { enabled: true, days_before: 10 } },
      };
      const item: Item = {
        ...baseItem,
        data: { [dummyFieldId]: '2026-01-05' },
      };

      const reminders = computeReminders([fieldDef], [item], [], '2025-12-30');
      expect(reminders).toHaveLength(1);
      expect(reminders[0].daysLeft).toBe(6);
      expect(reminders[0].status).toBe('soon');
    });

    it('calculates daysLeft correctly across month boundaries (Jan 31 to Feb 1)', () => {
      const fieldDef = { ...baseItemFieldDef };
      const item: Item = {
        ...baseItem,
        data: { [dummyFieldId]: '2026-02-02' },
      };

      const reminders = computeReminders([fieldDef], [item], [], '2026-01-30');
      expect(reminders).toHaveLength(1);
      expect(reminders[0].daysLeft).toBe(3);
      expect(reminders[0].status).toBe('soon');
    });
  });

  describe('2. Leap Day Handling', () => {
    it('calculates daysLeft accurately across leap day (Feb 28 to Feb 29 to Mar 1 in leap year 2024)', () => {
      const fieldDef = { ...baseItemFieldDef };
      const item: Item = {
        ...baseItem,
        data: { [dummyFieldId]: '2024-03-01' },
      };

      // Today is Feb 28, 2024 (leap year)
      const reminders = computeReminders([fieldDef], [item], [], '2024-02-28');
      expect(reminders).toHaveLength(1);
      expect(reminders[0].daysLeft).toBe(2); // Feb 28 -> Feb 29 (1), Feb 29 -> Mar 01 (2)
    });

    it('calculates daysLeft accurately in non-leap year (2025)', () => {
      const fieldDef = { ...baseItemFieldDef };
      const item: Item = {
        ...baseItem,
        data: { [dummyFieldId]: '2025-03-01' },
      };

      // Today is Feb 28, 2025 (non-leap year)
      const reminders = computeReminders([fieldDef], [item], [], '2025-02-28');
      expect(reminders).toHaveLength(1);
      expect(reminders[0].daysLeft).toBe(1); // Feb 28 -> Mar 01
    });
  });

  describe('3. Daylight Saving Change Days in Czechia', () => {
    it('is immune to spring DST change day in Czechia (e.g. 2026-03-29)', () => {
      const fieldDef = { ...baseItemFieldDef };
      const item: Item = {
        ...baseItem,
        data: { [dummyFieldId]: '2026-03-31' },
      };

      // Spring DST shift happens on March 29, 2026 in Czechia
      const reminders = computeReminders([fieldDef], [item], [], '2026-03-28');
      expect(reminders).toHaveLength(1);
      expect(reminders[0].daysLeft).toBe(3);
    });

    it('is immune to autumn DST change day in Czechia (e.g. 2026-10-25)', () => {
      const fieldDef = { ...baseItemFieldDef };
      const item: Item = {
        ...baseItem,
        data: { [dummyFieldId]: '2026-10-27' },
      };

      // Autumn DST shift happens on October 25, 2026 in Czechia
      const reminders = computeReminders([fieldDef], [item], [], '2026-10-24');
      expect(reminders).toHaveLength(1);
      expect(reminders[0].daysLeft).toBe(3);
    });
  });

  describe('4. Boundaries & Status Mapping', () => {
    it('assigns status "overdue" when daysLeft < 0', () => {
      const item = { ...baseItem, data: { [dummyFieldId]: '2026-05-10' } };
      const reminders = computeReminders([baseItemFieldDef], [item], [], '2026-05-15');
      expect(reminders[0].daysLeft).toBe(-5);
      expect(reminders[0].status).toBe('overdue');
    });

    it('assigns status "today" when daysLeft === 0', () => {
      const item = { ...baseItem, data: { [dummyFieldId]: '2026-05-15' } };
      const reminders = computeReminders([baseItemFieldDef], [item], [], '2026-05-15');
      expect(reminders[0].daysLeft).toBe(0);
      expect(reminders[0].status).toBe('today');
    });

    it('assigns status "soon" at upper boundary daysLeft == days_before', () => {
      const fieldDef: FieldDefinition = {
        ...baseItemFieldDef,
        config: { reminder: { enabled: true, days_before: 30 } },
      };
      const item = { ...baseItem, data: { [dummyFieldId]: '2026-06-14' } };
      const reminders = computeReminders([fieldDef], [item], [], '2026-05-15');
      expect(reminders[0].daysLeft).toBe(30);
      expect(reminders[0].status).toBe('soon');
    });

    it('assigns status "later" when daysLeft > days_before', () => {
      const fieldDef: FieldDefinition = {
        ...baseItemFieldDef,
        config: { reminder: { enabled: true, days_before: 30 } },
      };
      const item = { ...baseItem, data: { [dummyFieldId]: '2026-06-16' } };
      const reminders = computeReminders([fieldDef], [item], [], '2026-05-15');
      expect(reminders[0].daysLeft).toBe(32);
      expect(reminders[0].status).toBe('later');
    });
  });

  describe('5. Latest Event Rule', () => {
    const eventFieldDef: FieldDefinition = {
      id: 'event-field-1',
      collection_id: dummyColId,
      target: 'EVENT',
      key: 'next_service',
      name: 'Příští servis do',
      data_type: 'date',
      unit: null,
      event_types: ['Servis'],
      is_required: false,
      is_archived: false,
      display_order: 1,
      config: {
        reminder: {
          enabled: true,
          days_before: 14,
        },
      },
      validation_rules: {},
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    };

    it('picks ONLY the value from the most recent event (event_date desc, event_time desc, created_at desc)', () => {
      const item: Item = { ...baseItem };

      const events: ItemEvent[] = [
        {
          id: 'e1',
          item_id: dummyItemId,
          event_type: 'Servis',
          title: 'Starší servis',
          event_date: '2026-01-10',
          event_time: '10:00',
          data: { 'event-field-1': '2026-06-01' },
          created_at: '2026-01-10T10:00:00Z',
          updated_at: '2026-01-10T10:00:00Z',
        },
        {
          id: 'e2',
          item_id: dummyItemId,
          event_type: 'Servis',
          title: 'Novější servis',
          event_date: '2026-03-15',
          event_time: '14:00',
          data: { 'event-field-1': '2026-09-01' },
          created_at: '2026-03-15T14:00:00Z',
          updated_at: '2026-03-15T14:00:00Z',
        },
        {
          id: 'e3',
          item_id: dummyItemId,
          event_type: 'Servis',
          title: 'Servis ve stejný den ale dřív',
          event_date: '2026-03-15',
          event_time: '08:00',
          data: { 'event-field-1': '2026-08-01' },
          created_at: '2026-03-15T08:00:00Z',
          updated_at: '2026-03-15T08:00:00Z',
        },
      ];

      const reminders = computeReminders([eventFieldDef], [item], events, '2026-08-20');
      expect(reminders).toHaveLength(1);
      expect(reminders[0].dueDate).toBe('2026-09-01');
      expect(reminders[0].targetKind).toBe('EVENT');
    });

    it('ignores events that have empty value for that field when determining latest event', () => {
      const item: Item = { ...baseItem };

      const events: ItemEvent[] = [
        {
          id: 'e1',
          item_id: dummyItemId,
          event_type: 'Servis',
          title: 'Servis s datem',
          event_date: '2026-01-10',
          event_time: null,
          data: { 'event-field-1': '2026-07-01' },
          created_at: '2026-01-10T10:00:00Z',
          updated_at: '2026-01-10T10:00:00Z',
        },
        {
          id: 'e2',
          item_id: dummyItemId,
          event_type: 'Servis',
          title: 'Novější servis bez příštího data',
          event_date: '2026-04-01',
          event_time: null,
          data: { 'event-field-1': '' },
          created_at: '2026-04-01T10:00:00Z',
          updated_at: '2026-04-01T10:00:00Z',
        },
      ];

      const reminders = computeReminders([eventFieldDef], [item], events, '2026-06-25');
      expect(reminders).toHaveLength(1);
      expect(reminders[0].dueDate).toBe('2026-07-01');
    });
  });

  describe('6. Date String with Time Part', () => {
    it('uses the first 10 characters when date string contains ISO time part', () => {
      const item: Item = {
        ...baseItem,
        data: { [dummyFieldId]: '2026-05-20T14:30:00.000Z' },
      };

      const reminders = computeReminders([baseItemFieldDef], [item], [], '2026-05-15');
      expect(reminders).toHaveLength(1);
      expect(reminders[0].dueDate).toBe('2026-05-20');
      expect(reminders[0].daysLeft).toBe(5);
    });
  });

  describe('7. Archived Fields & Missing Config', () => {
    it('ignores archived fields', () => {
      const archivedField: FieldDefinition = {
        ...baseItemFieldDef,
        is_archived: true,
      };

      const reminders = computeReminders([archivedField], [baseItem], [], '2026-05-15');
      expect(reminders).toHaveLength(0);
    });

    it('ignores fields where reminder is disabled or missing', () => {
      const disabledField: FieldDefinition = {
        ...baseItemFieldDef,
        config: { reminder: { enabled: false, days_before: 30 } },
      };
      const noConfigField: FieldDefinition = {
        ...baseItemFieldDef,
        config: {},
      };

      expect(computeReminders([disabledField], [baseItem], [], '2026-05-15')).toHaveLength(0);
      expect(computeReminders([noConfigField], [baseItem], [], '2026-05-15')).toHaveLength(0);
    });
  });

  describe('8. Empty Stored Values', () => {
    it('produces no reminder when stored value is null, undefined, or whitespace', () => {
      const itemNull = { ...baseItem, data: { [dummyFieldId]: null } };
      const itemUndefined = { ...baseItem, data: {} };
      const itemEmpty = { ...baseItem, data: { [dummyFieldId]: '   ' } };

      expect(computeReminders([baseItemFieldDef], [itemNull], [], '2026-05-15')).toHaveLength(0);
      expect(computeReminders([baseItemFieldDef], [itemUndefined], [], '2026-05-15')).toHaveLength(0);
      expect(computeReminders([baseItemFieldDef], [itemEmpty], [], '2026-05-15')).toHaveLength(0);
    });
  });

  describe('9. Czech Relative Days Formatting', () => {
    it('formats exact Czech strings for daysLeft values', () => {
      expect(formatRelativeDays(0)).toBe('dnes');
      expect(formatRelativeDays(1)).toBe('zítra');
      expect(formatRelativeDays(2)).toBe('za 2 dny');
      expect(formatRelativeDays(3)).toBe('za 3 dny');
      expect(formatRelativeDays(4)).toBe('za 4 dny');
      expect(formatRelativeDays(5)).toBe('za 5 dní');
      expect(formatRelativeDays(10)).toBe('za 10 dní');

      expect(formatRelativeDays(-1)).toBe('včera');
      expect(formatRelativeDays(-2)).toBe('před 2 dny');
      expect(formatRelativeDays(-3)).toBe('před 3 dny');
      expect(formatRelativeDays(-4)).toBe('před 4 dny');
      expect(formatRelativeDays(-5)).toBe('před 5 dny');
      expect(formatRelativeDays(-7)).toBe('před 7 dny');
    });
  });

  describe('10. Export / Import Round Trip Survival', () => {
    const group: CollectionGroup = {
      id: 'group-1',
      name: 'Vozidla',
      display_order: 0,
      is_default: false,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    };

    const collection: Collection = {
      id: dummyColId,
      group_id: group.id,
      name: 'Auta',
      description: '',
      icon: 'car',
      display_order: 0,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    };

    const reminderFieldDef: FieldDefinition = {
      ...baseItemFieldDef,
      config: {
        reminder: {
          enabled: true,
          days_before: 14,
        },
      },
    };

    const pkg: EvidioPackage = {
      format: 'evidio_package',
      version: 1,
      exported_at: '2026-01-01T00:00:00Z',
      collection_groups: [group],
      collections: [collection],
      item_types: [],
      field_definitions: [reminderFieldDef],
      tags: [],
      items: [baseItem],
      events: [],
      attachments: [],
    };

    it('survives Mode A import as copy (reminder config preserved)', () => {
      const prepared = prepareImportCopy(pkg, [], [], group.id);
      expect(prepared.fieldDefsToPut).toHaveLength(1);
      const importedField = prepared.fieldDefsToPut[0];
      expect(importedField.config.reminder).toEqual({
        enabled: true,
        days_before: 14,
      });
    });

    it('removes config.reminder when sanitizeConfigForTypeChange is called with a non-date data_type', () => {
      const dateConfig = {
        reminder: { enabled: true, days_before: 30 },
        options: [{ id: 'opt1', label: 'Opt' }],
      };

      const sanitizedText = sanitizeConfigForTypeChange(dateConfig, 'text');
      expect(sanitizedText.reminder).toBeUndefined();
      expect(sanitizedText.options).toBeUndefined();

      const sanitizedDate = sanitizeConfigForTypeChange(dateConfig, 'date');
      expect(sanitizedDate.reminder).toEqual({ enabled: true, days_before: 30 });
    });

    it('preserves config.reminder when constructing package structure for export', () => {
      expect(pkg.field_definitions).toHaveLength(1);
      expect(pkg.field_definitions[0].config.reminder).toEqual({
        enabled: true,
        days_before: 14,
      });
    });

    it('survives Mode B restore from backup (reminder config preserved)', () => {
      const prepared = prepareImportRestore(pkg, {
        groups: [],
        collections: [],
        itemTypes: [],
        fieldDefs: [],
        tags: [],
        items: [],
        events: [],
        attachments: [],
        defaultGroupId: group.id,
      });

      expect(prepared.fieldDefsToPut).toHaveLength(1);
      const restoredField = prepared.fieldDefsToPut[0];
      expect(restoredField.config.reminder).toEqual({
        enabled: true,
        days_before: 14,
      });
    });
  });

  describe('11. Event Types Filtering & Case/Diacritics Insensitivity', () => {
    const eventFieldDefWithFilter: FieldDefinition = {
      id: 'field-event-filter',
      collection_id: dummyColId,
      target: 'EVENT',
      key: 'stk_check',
      name: 'Příští STK',
      data_type: 'date',
      unit: null,
      event_types: ['STK / Kontrola'],
      is_required: false,
      is_archived: false,
      display_order: 1,
      config: {
        reminder: {
          enabled: true,
          days_before: 30,
        },
      },
      validation_rules: {},
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    };

    it('ignores hidden values on an event of non-matching event_type', () => {
      const item: Item = { ...baseItem };
      const events: ItemEvent[] = [
        {
          id: 'ev-non-matching',
          item_id: dummyItemId,
          event_type: 'Servis', // Non-matching event_type
          title: 'Servisní prohlídka',
          event_date: '2026-01-10',
          event_time: null,
          data: { 'field-event-filter': '2026-05-20' }, // Contains a value but event_type doesn't match
          created_at: '2026-01-10T00:00:00Z',
          updated_at: '2026-01-10T00:00:00Z',
        },
      ];

      const reminders = computeReminders([eventFieldDefWithFilter], [item], events, '2026-05-01');
      expect(reminders).toHaveLength(0);
    });

    it('matches event_types case- and diacritics-insensitively (e.g., "stk / kontrola" matches "STK / Kontrola")', () => {
      const item: Item = { ...baseItem };
      const events: ItemEvent[] = [
        {
          id: 'ev-matching-insensitive',
          item_id: dummyItemId,
          event_type: 'stk / kontrola', // Different casing/diacritics
          title: 'Prohlídka STK',
          event_date: '2026-01-10',
          event_time: null,
          data: { 'field-event-filter': '2026-05-20' },
          created_at: '2026-01-10T00:00:00Z',
          updated_at: '2026-01-10T00:00:00Z',
        },
      ];

      const reminders = computeReminders([eventFieldDefWithFilter], [item], events, '2026-05-01');
      expect(reminders).toHaveLength(1);
      expect(reminders[0].dueDate).toBe('2026-05-20');
    });
  });

  describe('12. Impossible Calendar Date Validation', () => {
    it('rejects impossible calendar dates like 2026-02-31', () => {
      const fieldDef = { ...baseItemFieldDef };
      const item: Item = {
        ...baseItem,
        data: { [dummyFieldId]: '2026-02-31' },
      };

      const reminders = computeReminders([fieldDef], [item], [], '2026-02-01');
      expect(reminders).toHaveLength(0);
    });
  });

  describe('13. Event Reminders', () => {
    const testItem: Item = {
      id: dummyItemId,
      collection_id: dummyColId,
      item_type_id: null,
      name: 'Škoda Octavia',
      tag_ids: [],
      data: {},
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    };

    it('event in 2 days with time produces reminder with correct daysLeft, status soon, and label with time', () => {
      const event: ItemEvent = {
        id: 'event-2-days',
        item_id: dummyItemId,
        event_type: 'Servis',
        title: 'Výměna motorového oleje',
        event_date: '2026-04-12',
        event_time: '14:30',
        reminder: { enabled: true, days_before: 30 },
        data: {},
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      };

      const reminders = computeEventReminders([event], [testItem], '2026-04-10');
      expect(reminders).toHaveLength(1);
      expect(reminders[0].daysLeft).toBe(2);
      expect(reminders[0].status).toBe('soon');
      expect(reminders[0].fieldName).toBe('Servis: Výměna motorového oleje (14:30)');
      expect(reminders[0].dueDate).toBe('2026-04-12');
      expect(reminders[0].targetKind).toBe('EVENT');
      expect(reminders[0].fieldId).toBe('event-2-days');
      expect(reminders[0].eventId).toBe('event-2-days');
    });

    it('today event produces reminder with daysLeft 0 and status today', () => {
      const event: ItemEvent = {
        id: 'event-today',
        item_id: dummyItemId,
        event_type: 'STK',
        title: 'Pravidelná technická kontrola',
        event_date: '2026-04-10',
        event_time: null,
        data: {},
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      };

      const reminders = computeEventReminders([event], [testItem], '2026-04-10');
      expect(reminders).toHaveLength(1);
      expect(reminders[0].daysLeft).toBe(0);
      expect(reminders[0].status).toBe('today');
      expect(reminders[0].fieldName).toBe('STK: Pravidelná technická kontrola');
    });

    it('yesterday event is strictly excluded (past events never produce reminders)', () => {
      const event: ItemEvent = {
        id: 'event-yesterday',
        item_id: dummyItemId,
        event_type: 'Kontrola',
        title: 'Včerejší úkon',
        event_date: '2026-04-09',
        event_time: '08:00',
        reminder: { enabled: true, days_before: 30 },
        data: {},
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      };

      const reminders = computeEventReminders([event], [testItem], '2026-04-10');
      expect(reminders).toHaveLength(0);
    });

    it('handles boundary days_before and +1 correctly', () => {
      const eventBoundary: ItemEvent = {
        id: 'event-boundary',
        item_id: dummyItemId,
        event_type: 'Servis',
        title: 'Servis přesně v limitu',
        event_date: '2026-04-20', // exactly 10 days
        event_time: null,
        reminder: { enabled: true, days_before: 10 },
        data: {},
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      };

      const eventPlusOne: ItemEvent = {
        id: 'event-plus-one',
        item_id: dummyItemId,
        event_type: 'Servis',
        title: 'Servis jeden den nad limit',
        event_date: '2026-04-21', // 11 days (10 + 1)
        event_time: null,
        reminder: { enabled: true, days_before: 10 },
        data: {},
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      };

      const reminders = computeEventReminders([eventBoundary, eventPlusOne], [testItem], '2026-04-10');
      expect(reminders).toHaveLength(2);

      const rBoundary = reminders.find((r) => r.fieldId === 'event-boundary')!;
      expect(rBoundary.daysLeft).toBe(10);
      expect(rBoundary.status).toBe('soon');

      const rPlusOne = reminders.find((r) => r.fieldId === 'event-plus-one')!;
      expect(rPlusOne.daysLeft).toBe(11);
      expect(rPlusOne.status).toBe('later');
    });

    it('disabled event (enabled = false) produces no reminder', () => {
      const event: ItemEvent = {
        id: 'event-disabled',
        item_id: dummyItemId,
        event_type: 'Přezutí',
        title: 'Přezutí pneumatik',
        event_date: '2026-04-15',
        event_time: null,
        reminder: { enabled: false, days_before: 30 },
        data: {},
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      };

      const reminders = computeEventReminders([event], [testItem], '2026-04-10');
      expect(reminders).toHaveLength(0);
    });

    it('event without reminder property defaults to enabled with 30 days', () => {
      // Event at exactly 30 days
      const eventAt30: ItemEvent = {
        id: 'event-default-30',
        item_id: dummyItemId,
        event_type: 'Revize',
        title: 'Roční revize',
        event_date: '2026-05-10', // 30 days from 2026-04-10
        event_time: null,
        data: {},
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      };

      // Event at 31 days
      const eventAt31: ItemEvent = {
        id: 'event-default-31',
        item_id: dummyItemId,
        event_type: 'Revize',
        title: 'Roční revize vzdálená',
        event_date: '2026-05-11', // 31 days from 2026-04-10
        event_time: null,
        data: {},
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      };

      const reminders = computeEventReminders([eventAt30, eventAt31], [testItem], '2026-04-10');
      expect(reminders).toHaveLength(2);

      const r30 = reminders.find((r) => r.fieldId === 'event-default-30')!;
      expect(r30.daysLeft).toBe(30);
      expect(r30.status).toBe('soon');

      const r31 = reminders.find((r) => r.fieldId === 'event-default-31')!;
      expect(r31.daysLeft).toBe(31);
      expect(r31.status).toBe('later');
    });

    it('computes daysLeft accurately across month and year boundaries', () => {
      // Year boundary: Dec 30, 2025 -> Jan 02, 2026
      const eventYear: ItemEvent = {
        id: 'event-year-boundary',
        item_id: dummyItemId,
        event_type: 'Plán',
        title: 'Novoroční úkon',
        event_date: '2026-01-02',
        event_time: null,
        data: {},
        created_at: '2025-12-01T00:00:00Z',
        updated_at: '2025-12-01T00:00:00Z',
      };

      const remindersYear = computeEventReminders([eventYear], [testItem], '2025-12-30');
      expect(remindersYear).toHaveLength(1);
      expect(remindersYear[0].daysLeft).toBe(3);
      expect(remindersYear[0].status).toBe('soon');

      // Month boundary: Jan 30, 2026 -> Feb 02, 2026
      const eventMonth: ItemEvent = {
        id: 'event-month-boundary',
        item_id: dummyItemId,
        event_type: 'Plán',
        title: 'Únorový úkon',
        event_date: '2026-02-02',
        event_time: null,
        data: {},
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      };

      const remindersMonth = computeEventReminders([eventMonth], [testItem], '2026-01-30');
      expect(remindersMonth).toHaveLength(1);
      expect(remindersMonth[0].daysLeft).toBe(3);
      expect(remindersMonth[0].status).toBe('soon');
    });

    it('computes daysLeft accurately across Czech daylight-saving change days', () => {
      // Spring DST: Sunday 2026-03-29 (clock jumps 2:00 -> 3:00, 23h day)
      // From 2026-03-28 to 2026-03-30 must be exactly 2 calendar days
      const springEvent: ItemEvent = {
        id: 'event-dst-spring',
        item_id: dummyItemId,
        event_type: 'Jaro',
        title: 'Jarní servis',
        event_date: '2026-03-30',
        event_time: '10:00',
        data: {},
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      };

      const springReminders = computeEventReminders([springEvent], [testItem], '2026-03-28');
      expect(springReminders).toHaveLength(1);
      expect(springReminders[0].daysLeft).toBe(2);
      expect(springReminders[0].status).toBe('soon');

      // Autumn DST: Sunday 2026-10-25 (clock jumps 3:00 -> 2:00, 25h day)
      // From 2026-10-24 to 2026-10-26 must be exactly 2 calendar days
      const autumnEvent: ItemEvent = {
        id: 'event-dst-autumn',
        item_id: dummyItemId,
        event_type: 'Podzim',
        title: 'Podzimní servis',
        event_date: '2026-10-26',
        event_time: null,
        data: {},
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      };

      const autumnReminders = computeEventReminders([autumnEvent], [testItem], '2026-10-24');
      expect(autumnReminders).toHaveLength(1);
      expect(autumnReminders[0].daysLeft).toBe(2);
      expect(autumnReminders[0].status).toBe('soon');
    });

    it('merges seamlessly with field reminders in computeReminders', () => {
      const fieldDef = { ...baseItemFieldDef }; // due 2026-05-15, days_before: 30
      const itemWithField: Item = {
        ...testItem,
        data: { [dummyFieldId]: '2026-05-15' },
      };

      const event: ItemEvent = {
        id: 'event-merged',
        item_id: dummyItemId,
        event_type: 'Servis',
        title: 'Výměna oleje',
        event_date: '2026-05-01',
        event_time: '09:00',
        data: {},
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      };

      const all = computeReminders([fieldDef], [itemWithField], [event], '2026-04-20');
      expect(all).toHaveLength(2);

      const fieldR = all.find((r) => r.fieldId === dummyFieldId)!;
      expect(fieldR.targetKind).toBe('ITEM');
      expect(fieldR.daysLeft).toBe(25);

      const eventR = all.find((r) => r.fieldId === 'event-merged')!;
      expect(eventR.targetKind).toBe('EVENT');
      expect(eventR.daysLeft).toBe(11);
      expect(eventR.fieldName).toBe('Servis: Výměna oleje (09:00)');
      expect(eventR.dueTime).toBe('09:00');
    });

    it('EVENT-level date field reminder includes eventId and dueTime from the latest event', () => {
      const eventFieldDef: FieldDefinition = {
        id: 'field-qfa-date',
        collection_id: dummyColId,
        target: 'EVENT',
        key: 'field_qfa_date',
        name: 'Příští revize',
        data_type: 'date',
        unit: null,
        event_types: ['Revize'],
        is_required: false,
        is_archived: false,
        display_order: 1,
        config: { reminder: { enabled: true, days_before: 30 } },
        validation_rules: {},
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      };

      const eventOld: ItemEvent = {
        id: 'event-qfa-old',
        item_id: dummyItemId,
        event_type: 'Revize',
        title: 'Stará revize',
        event_date: '2026-01-10',
        event_time: '08:00',
        data: { 'field-qfa-date': '2026-04-15' },
        created_at: '2026-01-10T00:00:00Z',
        updated_at: '2026-01-10T00:00:00Z',
      };

      const eventNew: ItemEvent = {
        id: 'event-qfa-new',
        item_id: dummyItemId,
        event_type: 'Revize',
        title: 'Nová revize',
        event_date: '2026-03-01',
        event_time: '13:45',
        data: { 'field-qfa-date': '2026-05-20' },
        created_at: '2026-03-01T00:00:00Z',
        updated_at: '2026-03-01T00:00:00Z',
      };

      const reminders = computeReminders([eventFieldDef], [testItem], [eventOld, eventNew], '2026-05-01');
      expect(reminders).toHaveLength(1);
      expect(reminders[0].fieldId).toBe('field-qfa-date');
      expect(reminders[0].targetKind).toBe('EVENT');
      expect(reminders[0].eventId).toBe('event-qfa-new');
      expect(reminders[0].dueTime).toBe('13:45');
      expect(reminders[0].dueDate).toBe('2026-05-20');

      const focus = getReminderFocusTarget(reminders[0]);
      expect(focus).toEqual({
        section: 'events',
        eventId: 'event-qfa-new',
      });
    });
  });

  describe('14. Reminder Chips Selection & Focus Helpers', () => {
    const makeReminder = (overrides: Partial<ReminderItem>): ReminderItem => ({
      itemId: dummyItemId,
      collectionId: dummyColId,
      fieldId: 'f1',
      fieldName: 'Test reminder',
      targetKind: 'ITEM',
      dueDate: '2026-10-20',
      dueTime: null,
      daysLeft: 3,
      status: 'soon',
      ...overrides,
    });

    it('returns empty result when 0 reminders provided', () => {
      const res = selectItemReminderChips([]);
      expect(res.visibleReminders).toEqual([]);
      expect(res.hiddenCount).toBe(0);
      expect(res.nextHiddenReminder).toBeNull();
      expect(res.totalUrgentCount).toBe(0);
    });

    it('returns 1 visible chip and 0 hidden when 1 urgent reminder provided', () => {
      const r1 = makeReminder({ fieldName: 'R1', daysLeft: 2 });
      const res = selectItemReminderChips([r1]);
      expect(res.visibleReminders).toHaveLength(1);
      expect(res.visibleReminders[0].fieldName).toBe('R1');
      expect(res.hiddenCount).toBe(0);
      expect(res.nextHiddenReminder).toBeNull();
      expect(res.totalUrgentCount).toBe(1);
    });

    it('returns 2 visible chips and 0 hidden when 2 urgent reminders provided (normal mode)', () => {
      const r1 = makeReminder({ fieldName: 'R1', daysLeft: 1 });
      const r2 = makeReminder({ fieldName: 'R2', daysLeft: 4 });
      const res = selectItemReminderChips([r2, r1], 2);
      expect(res.visibleReminders).toHaveLength(2);
      expect(res.visibleReminders[0].fieldName).toBe('R1');
      expect(res.visibleReminders[1].fieldName).toBe('R2');
      expect(res.hiddenCount).toBe(0);
      expect(res.nextHiddenReminder).toBeNull();
      expect(res.totalUrgentCount).toBe(2);
    });

    it('returns 1 visible chip and 1 hidden (+1) with nextHiddenReminder when 2 urgent reminders provided in narrow mode (maxVisible = 1)', () => {
      const r1 = makeReminder({ fieldName: 'R1', daysLeft: 1 });
      const r2 = makeReminder({ fieldName: 'R2', daysLeft: 4 });
      const res = selectItemReminderChips([r2, r1], 1);
      expect(res.visibleReminders).toHaveLength(1);
      expect(res.visibleReminders[0].fieldName).toBe('R1');
      expect(res.hiddenCount).toBe(1);
      expect(res.nextHiddenReminder?.fieldName).toBe('R2');
      expect(res.totalUrgentCount).toBe(2);
    });

    it('shows 2 visible chips, counts remaining, and provides nextHiddenReminder when 3+ reminders provided', () => {
      const r1 = makeReminder({ fieldName: 'R1', daysLeft: 0, status: 'today' });
      const r2 = makeReminder({ fieldName: 'R2', daysLeft: 2, status: 'soon' });
      const r3 = makeReminder({ fieldName: 'R3', daysLeft: 5, status: 'soon', targetKind: 'EVENT', eventId: 'ev-3' });
      const r4 = makeReminder({ fieldName: 'R4', daysLeft: 8, status: 'soon' });

      const res = selectItemReminderChips([r4, r2, r1, r3], 2);
      expect(res.visibleReminders).toHaveLength(2);
      expect(res.visibleReminders[0].fieldName).toBe('R1');
      expect(res.visibleReminders[1].fieldName).toBe('R2');
      expect(res.hiddenCount).toBe(2);
      expect(res.nextHiddenReminder?.fieldName).toBe('R3');
      expect(res.totalUrgentCount).toBe(4);

      // Focus target of the most urgent hidden reminder
      expect(res.nextHiddenReminder).not.toBeNull();
      const focus = getReminderFocusTarget(res.nextHiddenReminder!);
      expect(focus).toEqual({
        section: 'events',
        eventId: 'ev-3',
      });
    });

    it('narrow mode (maxVisible = 1) selects 1 visible chip and counts all others as hidden', () => {
      const r1 = makeReminder({ fieldName: 'R1', daysLeft: 1 });
      const r2 = makeReminder({ fieldName: 'R2', daysLeft: 3 });
      const r3 = makeReminder({ fieldName: 'R3', daysLeft: 6 });

      const res = selectItemReminderChips([r1, r2, r3], 1);
      expect(res.visibleReminders).toHaveLength(1);
      expect(res.visibleReminders[0].fieldName).toBe('R1');
      expect(res.hiddenCount).toBe(2);
      expect(res.nextHiddenReminder?.fieldName).toBe('R2');
      expect(res.totalUrgentCount).toBe(3);
    });

    it('strictly excludes reminders with status "later"', () => {
      const urgent = makeReminder({ fieldName: 'Urgent', daysLeft: 5, status: 'soon' });
      const later = makeReminder({ fieldName: 'Later', daysLeft: 45, status: 'later' });

      const res = selectItemReminderChips([later, urgent], 2);
      expect(res.visibleReminders).toHaveLength(1);
      expect(res.visibleReminders[0].fieldName).toBe('Urgent');
      expect(res.hiddenCount).toBe(0);
      expect(res.totalUrgentCount).toBe(1);
    });

    it('sorts overdue first (daysLeft ascending)', () => {
      const overdue = makeReminder({ fieldName: 'Overdue', daysLeft: -3, status: 'overdue' });
      const today = makeReminder({ fieldName: 'Today', daysLeft: 0, status: 'today' });
      const soon = makeReminder({ fieldName: 'Soon', daysLeft: 2, status: 'soon' });

      const res = selectItemReminderChips([soon, today, overdue], 3);
      expect(res.visibleReminders.map((r) => r.fieldName)).toEqual(['Overdue', 'Today', 'Soon']);
    });

    it('tie-breaks identical daysLeft by time (timed before untimed, earlier before later)', () => {
      const morning = makeReminder({ fieldName: 'Morning', daysLeft: 2, dueTime: '08:30' });
      const afternoon = makeReminder({ fieldName: 'Afternoon', daysLeft: 2, dueTime: '14:00' });
      const untimed = makeReminder({ fieldName: 'Untimed', daysLeft: 2, dueTime: null });

      const res = selectItemReminderChips([untimed, afternoon, morning], 3);
      expect(res.visibleReminders.map((r) => r.fieldName)).toEqual(['Morning', 'Afternoon', 'Untimed']);
    });

    it('tie-breaks identical daysLeft and time by label in Czech locale', () => {
      const b = makeReminder({ fieldName: 'B', daysLeft: 2, dueTime: '10:00' });
      const a = makeReminder({ fieldName: 'A', daysLeft: 2, dueTime: '10:00' });
      const c = makeReminder({ fieldName: 'C', daysLeft: 2, dueTime: '10:00' });

      const res = selectItemReminderChips([c, b, a], 3);
      expect(res.visibleReminders.map((r) => r.fieldName)).toEqual(['A', 'B', 'C']);
    });

    it('getReminderFocusTarget handles ITEM and EVENT kinds correctly', () => {
      const itemReminder = makeReminder({ targetKind: 'ITEM', fieldId: 'field-item-123' });
      expect(getReminderFocusTarget(itemReminder)).toEqual({
        section: 'properties',
        fieldId: 'field-item-123',
      });

      const eventReminder = makeReminder({ targetKind: 'EVENT', fieldId: 'event-uuid-456', eventId: 'event-uuid-456' });
      expect(getReminderFocusTarget(eventReminder)).toEqual({
        section: 'events',
        eventId: 'event-uuid-456',
      });
    });
  });

  describe('Deadline Bar Pure Helpers', () => {
    const makeReminder = (overrides: Partial<ReminderItem> = {}): ReminderItem => ({
      itemId: 'item-1',
      collectionId: 'col-1',
      fieldId: 'f1',
      fieldName: 'Test reminder',
      targetKind: 'ITEM',
      dueDate: '2026-10-20',
      dueTime: null,
      daysLeft: 3,
      status: 'soon',
      ...overrides,
    });

    describe('selectDeadlineBarReminders', () => {
      it('returns empty result when 0 reminders are provided', () => {
        const res = selectDeadlineBarReminders([]);
        expect(res.shownReminders).toEqual([]);
        expect(res.totalUrgentCount).toBe(0);
        expect(res.remainingCount).toBe(0);
      });

      it('returns 1 shown reminder and remaining count 0 when 1 urgent reminder is provided', () => {
        const r1 = makeReminder({ fieldName: 'R1', daysLeft: 2 });
        const res = selectDeadlineBarReminders([r1]);
        expect(res.shownReminders).toHaveLength(1);
        expect(res.shownReminders[0].fieldName).toBe('R1');
        expect(res.totalUrgentCount).toBe(1);
        expect(res.remainingCount).toBe(0);
      });

      it('returns 2 shown reminders and remaining count 0 when 2 urgent reminders are provided', () => {
        const r1 = makeReminder({ fieldName: 'R1', daysLeft: 1 });
        const r2 = makeReminder({ fieldName: 'R2', daysLeft: 4 });
        const res = selectDeadlineBarReminders([r2, r1]);
        expect(res.shownReminders).toHaveLength(2);
        expect(res.shownReminders[0].fieldName).toBe('R1');
        expect(res.shownReminders[1].fieldName).toBe('R2');
        expect(res.totalUrgentCount).toBe(2);
        expect(res.remainingCount).toBe(0);
      });

      it('returns 2 nearest reminders and calculates remaining count when 5 reminders are provided (3+ reminders)', () => {
        const r1 = makeReminder({ fieldName: 'R1', daysLeft: -1, status: 'overdue' });
        const r2 = makeReminder({ fieldName: 'R2', daysLeft: 0, status: 'today' });
        const r3 = makeReminder({ fieldName: 'R3', daysLeft: 3, status: 'soon' });
        const r4 = makeReminder({ fieldName: 'R4', daysLeft: 6, status: 'soon' });
        const r5 = makeReminder({ fieldName: 'R5', daysLeft: 10, status: 'soon' });

        const res = selectDeadlineBarReminders([r5, r3, r1, r4, r2]);
        expect(res.shownReminders).toHaveLength(2);
        expect(res.shownReminders[0].fieldName).toBe('R1');
        expect(res.shownReminders[1].fieldName).toBe('R2');
        expect(res.totalUrgentCount).toBe(5);
        expect(res.remainingCount).toBe(3); // 5 - 2 = 3
      });

      it('filters out dismissed keys and lets the next nearest reminder take its place', () => {
        const todayStr = '2026-10-17';
        const r1 = makeReminder({ itemId: 'item-1', fieldId: 'f1', fieldName: 'R1', daysLeft: -1, status: 'overdue' });
        const r2 = makeReminder({ itemId: 'item-1', fieldId: 'f2', fieldName: 'R2', daysLeft: 0, status: 'today' });
        const r3 = makeReminder({ itemId: 'item-2', fieldId: 'f3', fieldName: 'R3', daysLeft: 2, status: 'soon' });

        const dismissKey1 = getDeadlineBarDismissKey(r1, todayStr);
        const dismissedKeys = new Set([dismissKey1]);

        const res = selectDeadlineBarReminders([r1, r2, r3], dismissedKeys, 2, todayStr);
        expect(res.shownReminders).toHaveLength(2);
        expect(res.shownReminders[0].fieldName).toBe('R2');
        expect(res.shownReminders[1].fieldName).toBe('R3');
        expect(res.totalUrgentCount).toBe(2);
        expect(res.remainingCount).toBe(0);
      });

      it('strictly excludes reminders with status "later"', () => {
        const urgent = makeReminder({ fieldName: 'Urgent', daysLeft: 5, status: 'soon' });
        const later = makeReminder({ fieldName: 'Later', daysLeft: 45, status: 'later' });

        const res = selectDeadlineBarReminders([later, urgent]);
        expect(res.shownReminders).toHaveLength(1);
        expect(res.shownReminders[0].fieldName).toBe('Urgent');
        expect(res.totalUrgentCount).toBe(1);
        expect(res.remainingCount).toBe(0);
      });
    });

    describe('getDeadlineBarColorLevel at daysLeft 0, 1, 6, 7, 30 and overdue', () => {
      it('returns red for overdue reminder (daysLeft < 0)', () => {
        const rOverdue = makeReminder({ daysLeft: -2, status: 'overdue' });
        expect(getDeadlineBarColorLevel(rOverdue)).toBe('red');
        expect(getDeadlineBarColorLevel(-2, 'overdue')).toBe('red');
      });

      it('returns red for daysLeft 0 (today)', () => {
        const rToday = makeReminder({ daysLeft: 0, status: 'today' });
        expect(getDeadlineBarColorLevel(rToday)).toBe('red');
        expect(getDeadlineBarColorLevel(0)).toBe('red');
      });

      it('returns orange for daysLeft 1 (< 7)', () => {
        const r1 = makeReminder({ daysLeft: 1, status: 'soon' });
        expect(getDeadlineBarColorLevel(r1)).toBe('orange');
        expect(getDeadlineBarColorLevel(1)).toBe('orange');
      });

      it('returns orange for daysLeft 6 (< 7)', () => {
        const r6 = makeReminder({ daysLeft: 6, status: 'soon' });
        expect(getDeadlineBarColorLevel(r6)).toBe('orange');
        expect(getDeadlineBarColorLevel(6)).toBe('orange');
      });

      it('returns yellow for daysLeft 7 (>= 7)', () => {
        const r7 = makeReminder({ daysLeft: 7, status: 'soon' });
        expect(getDeadlineBarColorLevel(r7)).toBe('yellow');
        expect(getDeadlineBarColorLevel(7)).toBe('yellow');
      });

      it('returns yellow for daysLeft 30 (>= 7)', () => {
        const r30 = makeReminder({ daysLeft: 30, status: 'soon' });
        expect(getDeadlineBarColorLevel(r30)).toBe('yellow');
        expect(getDeadlineBarColorLevel(30)).toBe('yellow');
      });
    });

    describe('getDeadlineBarDismissKey uniqueness', () => {
      it('generates unique dismissal key from todayStr, reminder ID, and due date', () => {
        const r1 = makeReminder({ itemId: 'item-a', fieldId: 'field-1', dueDate: '2026-10-20' });
        const key1 = getDeadlineBarDismissKey(r1, '2026-10-17');
        expect(key1).toBe('2026-10-17_item-a:field-1_2026-10-20');
      });

      it('guarantees uniqueness for two reminders of the same item', () => {
        const r1 = makeReminder({ itemId: 'item-same', fieldId: 'f1', dueDate: '2026-10-20' });
        const r2 = makeReminder({ itemId: 'item-same', fieldId: 'f2', dueDate: '2026-10-25' });
        const r3 = makeReminder({ itemId: 'item-same', targetKind: 'EVENT', eventId: 'e1', dueDate: '2026-10-20' });

        const key1 = getDeadlineBarDismissKey(r1, '2026-10-17');
        const key2 = getDeadlineBarDismissKey(r2, '2026-10-17');
        const key3 = getDeadlineBarDismissKey(r3, '2026-10-17');

        expect(key1).not.toBe(key2);
        expect(key1).not.toBe(key3);
        expect(key2).not.toBe(key3);
      });

      it('produces different key for a different date', () => {
        const r1 = makeReminder({ itemId: 'item-a', fieldId: 'field-1', dueDate: '2026-10-20' });
        const keyToday = getDeadlineBarDismissKey(r1, '2026-10-17');
        const keyTomorrow = getDeadlineBarDismissKey(r1, '2026-10-18');
        expect(keyToday).not.toBe(keyTomorrow);
      });
    });

    describe('formatDeadlineBarSegment', () => {
      it('formats segment as "<label> — <item name>: <relative text> (<date, cs-CZ>)"', () => {
        const r = makeReminder({
          fieldName: 'Servis T1',
          daysLeft: 4,
          dueDate: '2026-10-17',
        });
        const seg = formatDeadlineBarSegment(r, 'Škoda Octavia Combi');
        expect(seg.labelPart).toBe('Servis T1 — Škoda Octavia Combi:');
        expect(seg.relativePart).toBe('za 4 dny (17. 10.)');
        expect(seg.fullText).toBe('Servis T1 — Škoda Octavia Combi: za 4 dny (17. 10.)');
      });

      it('formats segment without item name if not provided', () => {
        const r = makeReminder({
          fieldName: 'Záruka',
          daysLeft: 0,
          dueDate: '2026-10-17',
        });
        const seg = formatDeadlineBarSegment(r);
        expect(seg.labelPart).toBe('Záruka:');
        expect(seg.relativePart).toBe('dnes (17. 10.)');
        expect(seg.fullText).toBe('Záruka: dnes (17. 10.)');
      });
    });
  });
});

