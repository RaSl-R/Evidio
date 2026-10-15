import { describe, it, expect } from 'vitest';
import { computeReminders, computeEventReminders, formatEventReminderLabel, formatRelativeDays } from '../reminders';
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
    });
  });
});
