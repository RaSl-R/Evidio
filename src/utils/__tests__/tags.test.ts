import { describe, it, expect } from 'vitest';
import {
  TAG_PALETTE,
  findMatchingTag,
  isTagNameTaken,
  getTagColorOption,
} from '../tagColors';
import { itemMatchesSearch, normalizeSearchText } from '../search';
import { prepareImportCopy, prepareImportRestore } from '../import';
import { Tag, Item, FieldDefinition, EvidioPackage } from '../../types';

describe('Iteration 3b: Tags (štítky) on items', () => {
  const collectionId = '11111111-1111-4111-8111-111111111111';

  const mockTags: Tag[] = [
    {
      id: 'tag-1',
      collection_id: collectionId,
      name: 'V záruce',
      color: '#10b981',
      created_at: '2026-10-12T00:00:00.000Z',
      updated_at: '2026-10-12T00:00:00.000Z',
    },
    {
      id: 'tag-2',
      collection_id: collectionId,
      name: 'Důležité',
      color: '#f43f5e',
      created_at: '2026-10-12T00:00:00.000Z',
      updated_at: '2026-10-12T00:00:00.000Z',
    },
    {
      id: 'tag-3',
      collection_id: collectionId,
      name: 'VIP Klient',
      color: '#8b5cf6',
      created_at: '2026-10-12T00:00:00.000Z',
      updated_at: '2026-10-12T00:00:00.000Z',
    },
  ];

  it('1. provides a fixed palette of 8 distinct preset colors', () => {
    expect(TAG_PALETTE).toHaveLength(8);
    const hexes = TAG_PALETTE.map((p) => p.hex.toLowerCase());
    const uniqueHexes = new Set(hexes);
    expect(uniqueHexes.size).toBe(8);

    // Verify lookup helper
    const option = getTagColorOption('#10b981');
    expect(option).toBeDefined();
    expect(option?.name).toBe('Zelená');

    const notFound = getTagColorOption('#000000');
    expect(notFound).toBeUndefined();
  });

  it('2. enforces unique tag names within a section (case and diacritics insensitive)', () => {
    // "V záruce" exists
    expect(isTagNameTaken(mockTags, 'v zaruce')).toBe(true);
    expect(isTagNameTaken(mockTags, 'V ZÁRUCE')).toBe(true);
    expect(isTagNameTaken(mockTags, '  v  záruce  ')).toBe(false); // different word spacing

    // "Důležité" exists
    expect(isTagNameTaken(mockTags, 'DULEZITE')).toBe(true);
    expect(isTagNameTaken(mockTags, 'dulezite')).toBe(true);
    expect(isTagNameTaken(mockTags, 'Důležité')).toBe(true);

    // "Nové" does not exist
    expect(isTagNameTaken(mockTags, 'Nové')).toBe(false);

    // findMatchingTag returns the existing tag
    const match = findMatchingTag(mockTags, 'vip klient');
    expect(match?.id).toBe('tag-3');

    // when editing tag-3, excluding tag-3 allows keeping its same name
    expect(isTagNameTaken(mockTags, 'VIP Klient', 'tag-3')).toBe(false);
    // but renaming tag-3 to "Důležité" is prevented
    expect(isTagNameTaken(mockTags, 'Důležité', 'tag-3')).toBe(true);
  });

  it('3. search matches tag names with diacritics insensitivity', () => {
    const itemWithTags: Item = {
      id: 'item-1',
      collection_id: collectionId,
      item_type_id: null,
      name: 'Vysavač Dyson',
      tag_ids: ['tag-1', 'tag-2'],
      data: {},
      created_at: '2026-10-12T00:00:00.000Z',
      updated_at: '2026-10-12T00:00:00.000Z',
    };

    const emptyFields: FieldDefinition[] = [];

    // Match by item name
    expect(itemMatchesSearch(itemWithTags, emptyFields, 'dyson', [], mockTags)).toBe(true);

    // Match by tag name "V záruce" using normalized query "zaruce"
    expect(itemMatchesSearch(itemWithTags, emptyFields, 'zaruce', [], mockTags)).toBe(true);

    // Match by tag name "Důležité" using normalized query "dulezite"
    expect(itemMatchesSearch(itemWithTags, emptyFields, 'dulezite', [], mockTags)).toBe(true);

    // Non-assigned tag "VIP" should NOT match this item
    expect(itemMatchesSearch(itemWithTags, emptyFields, 'vip', [], mockTags)).toBe(false);

    // Combined query matching item name AND tag name
    expect(itemMatchesSearch(itemWithTags, emptyFields, 'dyson zaruce', [], mockTags)).toBe(true);
  });

  it('4. multiple selected filter tags require item to have ALL of them (AND logic)', () => {
    const itemBothTags: Item = {
      id: 'item-1',
      collection_id: collectionId,
      item_type_id: null,
      name: 'Položka A',
      tag_ids: ['tag-1', 'tag-2'],
      data: {},
      created_at: '2026-10-12T00:00:00.000Z',
      updated_at: '2026-10-12T00:00:00.000Z',
    };

    const itemOnlyTag1: Item = {
      id: 'item-2',
      collection_id: collectionId,
      item_type_id: null,
      name: 'Položka B',
      tag_ids: ['tag-1'],
      data: {},
      created_at: '2026-10-12T00:00:00.000Z',
      updated_at: '2026-10-12T00:00:00.000Z',
    };

    const itemNoTags: Item = {
      id: 'item-3',
      collection_id: collectionId,
      item_type_id: null,
      name: 'Položka C',
      tag_ids: [],
      data: {},
      created_at: '2026-10-12T00:00:00.000Z',
      updated_at: '2026-10-12T00:00:00.000Z',
    };

    const items = [itemBothTags, itemOnlyTag1, itemNoTags];

    // Filter by ['tag-1'] -> items with tag-1 (itemBothTags, itemOnlyTag1)
    const filter1 = ['tag-1'];
    const result1 = items.filter((it) => filter1.every((t) => it.tag_ids?.includes(t)));
    expect(result1.map((i) => i.id)).toEqual(['item-1', 'item-2']);

    // Filter by ['tag-1', 'tag-2'] (AND logic) -> only itemBothTags matches
    const filterBoth = ['tag-1', 'tag-2'];
    const resultBoth = items.filter((it) => filterBoth.every((t) => it.tag_ids?.includes(t)));
    expect(resultBoth.map((i) => i.id)).toEqual(['item-1']);

    // Filter by ['tag-3'] -> none
    const filter3 = ['tag-3'];
    const result3 = items.filter((it) => filter3.every((t) => it.tag_ids?.includes(t)));
    expect(result3).toHaveLength(0);
  });

  it('5. export/import round trip preserves tags and re-maps item.tag_ids in Mode A', () => {
    const pkg: EvidioPackage = {
      format: 'evidio_package',
      version: 1,
      exported_at: '2026-10-12T10:00:00.000Z',
      collections: [
        {
          id: collectionId,
          group_id: 'group-1',
          name: 'Nástroje',
          description: '',
          icon: 'wrench',
          display_order: 0,
          created_at: '2026-10-12T10:00:00.000Z',
          updated_at: '2026-10-12T10:00:00.000Z',
        },
      ],
      item_types: [],
      field_definitions: [],
      tags: [
        {
          id: 'orig-tag-1',
          collection_id: collectionId,
          name: 'Akumulátorové',
          color: '#10b981',
          created_at: '2026-10-12T10:00:00.000Z',
          updated_at: '2026-10-12T10:00:00.000Z',
        },
      ],
      items: [
        {
          id: 'orig-item-1',
          collection_id: collectionId,
          item_type_id: null,
          name: 'Aku vrtačka Makita',
          tag_ids: ['orig-tag-1'],
          data: {},
          created_at: '2026-10-12T10:00:00.000Z',
          updated_at: '2026-10-12T10:00:00.000Z',
        },
      ],
      events: [],
      attachments: [],
    };

    // Mode A: copy import creates new UUIDs and updates references
    const planA = prepareImportCopy(pkg, [], [], 'default-group-id');
    expect(planA.tagsToPut).toHaveLength(1);
    expect(planA.tagsToPut[0].name).toBe('Akumulátorové');
    const newTagId = planA.tagsToPut[0].id;
    expect(newTagId).not.toBe('orig-tag-1');

    expect(planA.itemsToPut).toHaveLength(1);
    expect(planA.itemsToPut[0].tag_ids).toEqual([newTagId]);

    // Mode B: restore upsert preserves original UUIDs
    const planB = prepareImportRestore(pkg, {
      groups: [],
      collections: [],
      itemTypes: [],
      fieldDefs: [],
      tags: [],
      items: [],
      events: [],
      attachments: [],
      defaultGroupId: 'default-group-id',
    });
    expect(planB.tagsToPut).toHaveLength(1);
    expect(planB.tagsToPut[0].id).toBe('orig-tag-1');
    expect(planB.itemsToPut).toHaveLength(1);
    expect(planB.itemsToPut[0].tag_ids).toEqual(['orig-tag-1']);
  });
});
