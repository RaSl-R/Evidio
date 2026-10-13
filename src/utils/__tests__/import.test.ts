import { describe, it, expect } from 'vitest';
import {
  validateEvidioPackage,
  prepareImportCopy,
  prepareImportRestore,
  inferDataType,
  base64ToBlob,
} from '../import';
import { EvidioPackage, Collection, CollectionGroup, Item } from '../../types';

describe('Evidio Import Module', () => {
  const dummyGroupId = '11111111-1111-4111-8111-111111111111';
  const dummyColId = '22222222-2222-4222-8222-222222222222';
  const dummyFieldId = '33333333-3333-4333-8333-333333333333';
  const dummyTagId = '44444444-4444-4444-8444-444444444444';
  const dummyItemId = '55555555-5555-4555-8555-555555555555';
  const dummyEventId = '66666666-6666-4666-8666-666666666666';

  const validSamplePackage: EvidioPackage = {
    format: 'evidio_package',
    version: 1,
    exported_at: '2026-10-11T12:00:00.000Z',
    collection_groups: [
      {
        id: dummyGroupId,
        name: 'Vozidla',
        display_order: 0,
        is_default: false,
        created_at: '2026-10-11T10:00:00.000Z',
        updated_at: '2026-10-11T10:00:00.000Z',
      },
    ],
    collections: [
      {
        id: dummyColId,
        group_id: dummyGroupId,
        name: 'Auta',
        description: 'Všechna rodinná vozidla',
        icon: 'car',
        display_order: 0,
        created_at: '2026-10-11T10:00:00.000Z',
        updated_at: '2026-10-11T10:00:00.000Z',
      },
    ],
    item_types: [],
    field_definitions: [
      {
        id: dummyFieldId,
        collection_id: dummyColId,
        target: 'ITEM',
        key: 'brand',
        name: 'Značka',
        data_type: 'single_select',
        unit: null,
        event_types: null,
        config: {
          options: [{ id: 'opt_1', label: 'Škoda' }],
        },
        validation_rules: {},
        is_required: false,
        is_archived: false,
        display_order: 1,
        created_at: '2026-10-11T10:00:00.000Z',
        updated_at: '2026-10-11T10:00:00.000Z',
      },
    ],
    tags: [
      {
        id: dummyTagId,
        collection_id: dummyColId,
        name: 'Osobní',
        color: '#6366f1',
        created_at: '2026-10-11T10:00:00.000Z',
        updated_at: '2026-10-11T10:00:00.000Z',
      },
    ],
    items: [
      {
        id: dummyItemId,
        collection_id: dummyColId,
        item_type_id: null,
        name: 'Octavia',
        tag_ids: [dummyTagId],
        data: {
          [dummyFieldId]: 'opt_1',
        },
        created_at: '2026-10-11T10:00:00.000Z',
        updated_at: '2026-10-11T10:00:00.000Z',
      },
    ],
    events: [
      {
        id: dummyEventId,
        item_id: dummyItemId,
        event_type: 'Servis',
        title: 'Výměna oleje',
        event_date: '2026-10-10',
        event_time: null,
        data: {},
        created_at: '2026-10-11T10:00:00.000Z',
        updated_at: '2026-10-11T10:00:00.000Z',
      },
    ],
    attachments: [],
  };

  describe('1. Package Validation', () => {
    it('accepts a fully valid evidio_package v1', () => {
      const res = validateEvidioPackage(validSamplePackage);
      expect(res.isValid).toBe(true);
      expect(res.errors).toHaveLength(0);
      expect(res.parsedPackage).toBeDefined();
    });

    it('rejects invalid format identifier', () => {
      const invalid = { ...validSamplePackage, format: 'invalid_format' };
      const res = validateEvidioPackage(invalid);
      expect(res.isValid).toBe(false);
      expect(res.errors[0]).toContain("Neplatný formát souboru (očekáváno 'evidio_package').");
    });

    it('blocks packages with version > 1 with the exact required Czech message', () => {
      const futurePkg = { ...validSamplePackage, version: 2 };
      const res = validateEvidioPackage(futurePkg);
      expect(res.isValid).toBe(false);
      expect(res.errors).toContain('Soubor je z novější verze Evidia, aktualizujte aplikaci.');
    });

    it('treats missing arrays as empty for backward compatibility', () => {
      const minimalPkg = {
        format: 'evidio_package',
        version: 1,
        collections: [validSamplePackage.collections[0]],
      };
      const res = validateEvidioPackage(minimalPkg);
      expect(res.isValid).toBe(true);
      expect(res.parsedPackage?.items).toEqual([]);
      expect(res.parsedPackage?.events).toEqual([]);
      expect(res.parsedPackage?.field_definitions).toEqual([]);
    });

    it('detects invalid UUID format', () => {
      const badIdPkg = {
        ...validSamplePackage,
        items: [
          {
            ...validSamplePackage.items[0],
            id: 'not-a-valid-uuid',
          },
        ],
      };
      const res = validateEvidioPackage(badIdPkg);
      expect(res.isValid).toBe(false);
      expect(res.errors.some((e) => e.includes('neplatné UUID'))).toBe(true);
    });

    it('detects broken reference integrity (item -> collection)', () => {
      const brokenItemPkg = {
        ...validSamplePackage,
        items: [
          {
            ...validSamplePackage.items[0],
            collection_id: '99999999-9999-4999-8999-999999999999',
          },
        ],
      };
      const res = validateEvidioPackage(brokenItemPkg);
      expect(res.isValid).toBe(false);
      expect(res.errors.some((e) => e.includes('odkazuje na neexistující sekci'))).toBe(true);
    });

    it('detects broken reference integrity (event -> item)', () => {
      const brokenEventPkg = {
        ...validSamplePackage,
        events: [
          {
            ...validSamplePackage.events[0],
            item_id: '99999999-9999-4999-8999-999999999999',
          },
        ],
      };
      const res = validateEvidioPackage(brokenEventPkg);
      expect(res.isValid).toBe(false);
      expect(res.errors.some((e) => e.includes('odkazuje na neexistující položku'))).toBe(true);
    });

    it('does NOT reject unknown keys in item.data / event.data', () => {
      const pkgWithExtraData = {
        ...validSamplePackage,
        items: [
          {
            ...validSamplePackage.items[0],
            data: {
              [dummyFieldId]: 'opt_1',
              'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa': 'Unknown value',
            },
          },
        ],
      };
      const res = validateEvidioPackage(pkgWithExtraData);
      expect(res.isValid).toBe(true);
    });
  });

  describe('2. Mode A: Import as copy (Remapping)', () => {
    it('generates new UUIDs and remaps all foreign keys and item.data keys', () => {
      const existingCollections: Collection[] = [];
      const existingGroups: CollectionGroup[] = [];
      const defaultGroupId = '00000000-0000-4000-8000-000000000001';

      const prepared = prepareImportCopy(
        validSamplePackage,
        existingCollections,
        existingGroups,
        defaultGroupId
      );

      // Check new collection ID
      const newCol = prepared.collectionsToPut[0];
      expect(newCol.id).not.toBe(dummyColId);

      // Check new field ID
      const newField = prepared.fieldDefsToPut[0];
      expect(newField.id).not.toBe(dummyFieldId);
      expect(newField.collection_id).toBe(newCol.id);
      // Option ID inside config remains unchanged
      expect(newField.config?.options?.[0]?.id).toBe('opt_1');

      // Check new tag ID
      const newTag = prepared.tagsToPut[0];
      expect(newTag.id).not.toBe(dummyTagId);
      expect(newTag.collection_id).toBe(newCol.id);

      // Check new item ID & remapped foreign keys
      const newItem = prepared.itemsToPut[0];
      expect(newItem.id).not.toBe(dummyItemId);
      expect(newItem.collection_id).toBe(newCol.id);
      expect(newItem.tag_ids).toEqual([newTag.id]);

      // Check item.data key is remapped to newField.id
      expect(newItem.data[newField.id]).toBe('opt_1');
      expect(newItem.data[dummyFieldId]).toBeUndefined();

      // Check event remapping
      const newEvent = prepared.eventsToPut[0];
      expect(newEvent.id).not.toBe(dummyEventId);
      expect(newEvent.item_id).toBe(newItem.id);
    });

    it('renames section to "<name> (kopie)" if section name already exists', () => {
      const existingCollections: Collection[] = [
        {
          id: '12345678-1234-4234-8234-123456789012',
          group_id: dummyGroupId,
          name: 'Auta',
          description: '',
          icon: '',
          display_order: 0,
          created_at: '2026-10-01T00:00:00.000Z',
          updated_at: '2026-10-01T00:00:00.000Z',
        },
      ];

      const prepared = prepareImportCopy(
        validSamplePackage,
        existingCollections,
        [],
        dummyGroupId
      );

      expect(prepared.collectionsToPut[0].name).toBe('Auta (kopie)');
    });
  });

  describe('3. Mode B: Restore from backup (Last-Write-Wins)', () => {
    it('overwrites local record when imported record has newer updated_at', () => {
      const existingItem: Item = {
        id: dummyItemId,
        collection_id: dummyColId,
        item_type_id: null,
        name: 'Octavia Stará',
        tag_ids: [],
        data: {},
        created_at: '2026-10-01T10:00:00.000Z',
        updated_at: '2026-10-01T10:00:00.000Z',
      };

      const importedItem: Item = {
        ...existingItem,
        name: 'Octavia Novější',
        updated_at: '2026-10-11T10:00:00.000Z',
      };

      const pkgWithNewerItem: EvidioPackage = {
        ...validSamplePackage,
        items: [importedItem],
      };

      const prepared = prepareImportRestore(pkgWithNewerItem, {
        groups: [],
        collections: validSamplePackage.collections,
        itemTypes: [],
        fieldDefs: validSamplePackage.field_definitions,
        tags: [],
        items: [existingItem],
        events: [],
        attachments: [],
        defaultGroupId: dummyGroupId,
      });

      expect(prepared.itemsToPut).toHaveLength(1);
      expect(prepared.itemsToPut[0].name).toBe('Octavia Novější');
    });

    it('keeps local record when local record has newer updated_at (LWW skips imported)', () => {
      const localNewerItem: Item = {
        id: dummyItemId,
        collection_id: dummyColId,
        item_type_id: null,
        name: 'Octavia Nejnovější Lokální',
        tag_ids: [],
        data: {},
        created_at: '2026-10-01T10:00:00.000Z',
        updated_at: '2026-10-15T10:00:00.000Z',
      };

      const importedOlderItem: Item = {
        ...localNewerItem,
        name: 'Octavia Starší v Záloze',
        updated_at: '2026-10-10T10:00:00.000Z',
      };

      const pkgWithOlderItem: EvidioPackage = {
        ...validSamplePackage,
        items: [importedOlderItem],
      };

      const prepared = prepareImportRestore(pkgWithOlderItem, {
        groups: [],
        collections: validSamplePackage.collections,
        itemTypes: [],
        fieldDefs: validSamplePackage.field_definitions,
        tags: [],
        items: [localNewerItem],
        events: [],
        attachments: [],
        defaultGroupId: dummyGroupId,
      });

      expect(prepared.itemsToPut).toHaveLength(0);
    });
  });

  describe('4. Unknown-field recovery', () => {
    it('synthesizes FieldDefinition with config.group = "imported" for unknown field IDs in item.data', () => {
      const unknownFieldId = '98765432-1234-4234-8234-1234567890ab';
      const pkgWithUnknownField: EvidioPackage = {
        ...validSamplePackage,
        items: [
          {
            ...validSamplePackage.items[0],
            data: {
              [dummyFieldId]: 'opt_1',
              [unknownFieldId]: 185000, // Number value
            },
          },
        ],
      };

      const prepared = prepareImportCopy(
        pkgWithUnknownField,
        [],
        [],
        dummyGroupId
      );

      // A synthetic field definition should have been created
      const recoveredField = prepared.fieldDefsToPut.find(
        (f) => f.config?.group === 'imported'
      );

      expect(recoveredField).toBeDefined();
      expect(recoveredField?.name).toBe('Obnovené pole (987654)');
      expect(recoveredField?.data_type).toBe('number');
      expect(recoveredField?.target).toBe('ITEM');

      // The recovered field's ID should be in item.data
      const newItem = prepared.itemsToPut[0];
      expect(newItem.data[recoveredField!.id]).toBe(185000);
    });

    it('correctly infers data types: number, date, boolean, text', () => {
      expect(inferDataType(12345)).toBe('number');
      expect(inferDataType(true)).toBe('boolean');
      expect(inferDataType('2026-10-11')).toBe('date');
      expect(inferDataType('Jakýkoliv text')).toBe('text');
    });

    it('converts base64 string to Blob correctly', () => {
      const sampleBase64 = 'data:text/plain;base64,SGVsbG8gRXZpZGlv';
      const blob = base64ToBlob(sampleBase64, 'text/plain');
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('text/plain');
      expect(blob.size).toBe(12); // "Hello Evidio".length
    });
  });
});
