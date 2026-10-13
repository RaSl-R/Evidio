import { describe, it, expect } from 'vitest';
import { calculateScaledDimensions } from '../image';
import { prepareImportCopy, prepareImportRestore } from '../import';
import { EvidioPackage, Attachment } from '../../types';

describe('Iteration 3c: Photos, Sort Order & Scaling', () => {
  describe('calculateScaledDimensions', () => {
    it('scales down landscape images so longest edge is 1600px', () => {
      const result = calculateScaledDimensions(3200, 2400, 1600);
      expect(result.width).toBe(1600);
      expect(result.height).toBe(1200);
    });

    it('scales down portrait images so longest edge is 1600px', () => {
      const result = calculateScaledDimensions(2000, 4000, 1600);
      expect(result.height).toBe(1600);
      expect(result.width).toBe(800);
    });

    it('preserves dimensions when image is already smaller than 1600px', () => {
      const result = calculateScaledDimensions(1024, 768, 1600);
      expect(result.width).toBe(1024);
      expect(result.height).toBe(768);
    });

    it('handles exact 1600px edge without scaling', () => {
      const result = calculateScaledDimensions(1600, 1200, 1600);
      expect(result.width).toBe(1600);
      expect(result.height).toBe(1200);
    });
  });

  describe('Attachment sort_order and import roundtrip', () => {
    const dummyGroupId = '11111111-1111-4111-8111-111111111111';
    const dummyColId = '22222222-2222-4222-8222-222222222222';
    const dummyItemId = '55555555-5555-4555-8555-555555555555';
    const attId1 = '77777777-7777-4777-8777-777777777771';
    const attId2 = '77777777-7777-4777-8777-777777777772';

    const testPackageWithPhotos: EvidioPackage = {
      format: 'evidio_package',
      version: 1,
      exported_at: '2026-10-12T01:00:00.000Z',
      collection_groups: [
        {
          id: dummyGroupId,
          name: 'Vozidla',
          display_order: 0,
          is_default: false,
          created_at: '2026-10-12T00:00:00.000Z',
          updated_at: '2026-10-12T00:00:00.000Z',
        },
      ],
      collections: [
        {
          id: dummyColId,
          group_id: dummyGroupId,
          name: 'Auta',
          description: '',
          icon: 'car',
          display_order: 0,
          created_at: '2026-10-12T00:00:00.000Z',
          updated_at: '2026-10-12T00:00:00.000Z',
        },
      ],
      item_types: [],
      field_definitions: [],
      tags: [],
      items: [
        {
          id: dummyItemId,
          collection_id: dummyColId,
          item_type_id: null,
          name: 'Škoda Fabia',
          tag_ids: [],
          data: {},
          created_at: '2026-10-12T00:00:00.000Z',
          updated_at: '2026-10-12T00:00:00.000Z',
        },
      ],
      events: [],
      attachments: [
        {
          id: attId1,
          item_id: dummyItemId,
          event_id: null,
          file_name: 'hlavni_foto.webp',
          mime_type: 'image/webp',
          size_bytes: 120400,
          sort_order: 0,
          created_at: '2026-10-12T00:00:00.000Z',
          updated_at: '2026-10-12T00:00:00.000Z',
        },
        {
          id: attId2,
          item_id: dummyItemId,
          event_id: null,
          file_name: 'interier.webp',
          mime_type: 'image/webp',
          size_bytes: 98000,
          sort_order: 1,
          created_at: '2026-10-12T00:00:00.000Z',
          updated_at: '2026-10-12T00:00:00.000Z',
        },
      ],
    };

    it('preserves Attachment.sort_order and remaps foreign keys in Mode A (Copy)', () => {
      const result = prepareImportCopy(testPackageWithPhotos, [], [], 'default-grp-id');

      expect(result.attachmentsToPut).toHaveLength(2);

      // Verify IDs were remapped
      expect(result.attachmentsToPut[0].id).not.toBe(attId1);
      expect(result.attachmentsToPut[1].id).not.toBe(attId2);

      // Verify foreign key remapping to new item id
      const remappedItemId = result.itemsToPut[0].id;
      expect(result.attachmentsToPut[0].item_id).toBe(remappedItemId);
      expect(result.attachmentsToPut[1].item_id).toBe(remappedItemId);

      // Verify sort_order values are accurately preserved
      expect(result.attachmentsToPut[0].sort_order).toBe(0);
      expect(result.attachmentsToPut[1].sort_order).toBe(1);

      // Main photo is the one with sort_order 0
      const photos = [...result.attachmentsToPut].sort((a, b) => a.sort_order - b.sort_order);
      expect(photos[0].file_name).toBe('hlavni_foto.webp');
    });

    it('preserves Attachment.sort_order in Mode B (Restore / LWW)', () => {
      const result = prepareImportRestore(
        testPackageWithPhotos,
        {
          groups: [],
          collections: [],
          itemTypes: [],
          fieldDefs: [],
          tags: [],
          items: [],
          events: [],
          attachments: [],
          defaultGroupId: 'default-grp-1',
        }
      );

      expect(result.attachmentsToPut).toHaveLength(2);
      expect(result.attachmentsToPut[0].id).toBe(attId1);
      expect(result.attachmentsToPut[0].sort_order).toBe(0);
      expect(result.attachmentsToPut[1].id).toBe(attId2);
      expect(result.attachmentsToPut[1].sort_order).toBe(1);
    });

    it('applies LWW updated_at correctly for attachments in Mode B', () => {
      const existingAttachment: Attachment = {
        id: attId1,
        item_id: dummyItemId,
        event_id: null,
        file_name: 'stara_verze.webp',
        mime_type: 'image/webp',
        size_bytes: 1000,
        sort_order: 0,
        created_at: '2026-10-12T00:00:00.000Z',
        updated_at: '2026-10-12T05:00:00.000Z', // Local is newer
      };

      const result = prepareImportRestore(
        testPackageWithPhotos, // Package has updated_at 2026-10-12T00:00:00.000Z
        {
          groups: [],
          collections: [],
          itemTypes: [],
          fieldDefs: [],
          tags: [],
          items: [],
          events: [],
          attachments: [existingAttachment],
          defaultGroupId: 'default-grp-1',
        }
      );

      // attId1 should NOT be overwritten because local was newer; only attId2 should be imported
      expect(result.attachmentsToPut.some((a) => a.id === attId1)).toBe(false);
      expect(result.attachmentsToPut.some((a) => a.id === attId2)).toBe(true);
    });
  });
});
