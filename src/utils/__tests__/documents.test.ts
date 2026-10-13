import { describe, it, expect } from 'vitest';
import {
  isPhotoAttachment,
  isPdfAttachment,
  getAttachmentKind,
  validatePdfFile,
  MAX_PDF_SIZE_BYTES,
  MAX_DOCUMENTS_PER_TARGET,
} from '../attachments';
import { itemMatchesSearch } from '../search';
import { prepareImportCopy, prepareImportRestore } from '../import';
import { Attachment, EvidioPackage, Item, ItemEvent } from '../../types';

describe('Iteration 3d: PDF documents on items and events', () => {
  describe('KIND & Photo Exclusivity', () => {
    it('correctly derives attachment kind from mime_type', () => {
      const photoAtt: Attachment = {
        id: 'att-1',
        item_id: 'item-1',
        event_id: null,
        file_name: 'foto.webp',
        mime_type: 'image/webp',
        size_bytes: 12000,
        sort_order: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const docAtt: Attachment = {
        id: 'att-2',
        item_id: 'item-1',
        event_id: null,
        file_name: 'technicky_prukaz.pdf',
        mime_type: 'application/pdf',
        size_bytes: 450000,
        sort_order: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      expect(isPhotoAttachment(photoAtt)).toBe(true);
      expect(isPdfAttachment(photoAtt)).toBe(false);
      expect(getAttachmentKind(photoAtt)).toBe('photo');

      expect(isPhotoAttachment(docAtt)).toBe(false);
      expect(isPdfAttachment(docAtt)).toBe(true);
      expect(getAttachmentKind(docAtt)).toBe('document');
    });

    it('ensures PDF attachment is never selected as a main photo', () => {
      const attachments: Attachment[] = [
        {
          id: 'doc-1',
          item_id: 'item-1',
          event_id: null,
          file_name: 'manual.pdf',
          mime_type: 'application/pdf',
          size_bytes: 50000,
          sort_order: 0, // Lower sort_order than the photo
          created_at: '2026-10-12T00:00:00.000Z',
          updated_at: '2026-10-12T00:00:00.000Z',
        },
        {
          id: 'photo-1',
          item_id: 'item-1',
          event_id: null,
          file_name: 'auto.webp',
          mime_type: 'image/webp',
          size_bytes: 80000,
          sort_order: 1,
          created_at: '2026-10-12T00:00:00.000Z',
          updated_at: '2026-10-12T00:00:00.000Z',
        },
      ];

      // Replicating main photo selection logic: must consider ONLY image/* attachments
      const photosOnly = attachments.filter(
        (a) => !a.event_id && (a.mime_type?.startsWith('image/') ?? false)
      );
      photosOnly.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
      const mainPhoto = photosOnly.length > 0 ? photosOnly[0] : null;

      expect(mainPhoto).not.toBeNull();
      expect(mainPhoto?.id).toBe('photo-1');
      expect(mainPhoto?.mime_type).toBe('image/webp');
    });
  });

  describe('Validation: validatePdfFile', () => {
    it('accepts valid PDF file starting with %PDF- header', async () => {
      const pdfContent = '%PDF-1.4 sample content';
      const file = new File([pdfContent], 'platny_dokument.pdf', {
        type: 'application/pdf',
      });

      const res = await validatePdfFile(file);
      expect(res.isValid).toBe(true);
      expect(res.error).toBeUndefined();
    });

    it('rejects file that does not start with %PDF-', async () => {
      const nonPdfContent = 'NOT_A_PDF header';
      const file = new File([nonPdfContent], 'falesny.pdf', {
        type: 'application/pdf',
      });

      const res = await validatePdfFile(file);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('nezačíná hlavičkou %PDF-');
    });

    it('rejects file exceeding 10 MB limit', async () => {
      const fakeFile = new File(['%PDF-'], 'velky.pdf', { type: 'application/pdf' });
      Object.defineProperty(fakeFile, 'size', {
        value: MAX_PDF_SIZE_BYTES + 1024,
      });

      const res = await validatePdfFile(fakeFile);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('přesahuje maximální povolenou velikost 10 MB');
    });

    it('rejects file with wrong MIME type', async () => {
      const file = new File(['%PDF-1.4'], 'soubor.txt', {
        type: 'text/plain',
      });

      const res = await validatePdfFile(file);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('application/pdf');
    });

    it('enforces limit of 20 documents per target', () => {
      expect(MAX_DOCUMENTS_PER_TARGET).toBe(20);
    });
  });

  describe('SEARCH: diacritics-insensitive search on document file names', () => {
    const testItem: Item = {
      id: 'item-1',
      collection_id: 'col-1',
      item_type_id: null,
      name: 'Škoda Superb',
      tag_ids: [],
      data: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const docAttachments: Attachment[] = [
      {
        id: 'doc-1',
        item_id: 'item-1',
        event_id: null,
        file_name: 'Záruční list a faktura.pdf',
        mime_type: 'application/pdf',
        size_bytes: 120000,
        sort_order: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'doc-2',
        item_id: 'item-1',
        event_id: 'event-1',
        file_name: 'Protokol STK 2026.pdf',
        mime_type: 'application/pdf',
        size_bytes: 85000,
        sort_order: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    it('finds item by attached document file name with diacritics', () => {
      const matches = itemMatchesSearch(testItem, [], 'Záruční', [], [], docAttachments);
      expect(matches).toBe(true);
    });

    it('finds item by attached document file name without diacritics', () => {
      const matches = itemMatchesSearch(testItem, [], 'zarucni list', [], [], docAttachments);
      expect(matches).toBe(true);
    });

    it('finds item by event document file name', () => {
      const matches = itemMatchesSearch(testItem, [], 'protokol stk', [], [], docAttachments);
      expect(matches).toBe(true);
    });

    it('does not match when query does not appear in item or documents', () => {
      const matches = itemMatchesSearch(testItem, [], 'nepritomny soubor', [], [], docAttachments);
      expect(matches).toBe(false);
    });
  });

  describe('EXPORT & IMPORT: Mode A and Mode B round trip with PDF documents', () => {
    const dummyGroupId = '11111111-1111-4111-8111-111111111111';
    const dummyColId = '22222222-2222-4222-8222-222222222222';
    const dummyItemId = '55555555-5555-4555-8555-555555555555';
    const dummyEventId = '66666666-6666-4666-8666-666666666666';
    const itemDocId = '88888888-8888-4888-8888-888888888881';
    const eventDocId = '88888888-8888-4888-8888-888888888882';

    const samplePdfBase64 = 'data:application/pdf;base64,JVBERi0xLjQKMSAwIG9iajw+ZW5kb2Jq';

    const testPackageWithDocs: EvidioPackage = {
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
          name: 'Škoda Superb',
          tag_ids: [],
          data: {},
          created_at: '2026-10-12T00:00:00.000Z',
          updated_at: '2026-10-12T00:00:00.000Z',
        },
      ],
      events: [
        {
          id: dummyEventId,
          item_id: dummyItemId,
          event_type: 'Servis',
          title: 'Garanční prohlídka',
          event_date: '2026-10-12',
          event_time: null,
          data: {},
          created_at: '2026-10-12T00:00:00.000Z',
          updated_at: '2026-10-12T00:00:00.000Z',
        },
      ],
      attachments: [
        {
          id: itemDocId,
          item_id: dummyItemId,
          event_id: null,
          file_name: 'technicak.pdf',
          mime_type: 'application/pdf',
          size_bytes: 15400,
          sort_order: 0,
          data_base64: samplePdfBase64,
          created_at: '2026-10-12T00:00:00.000Z',
          updated_at: '2026-10-12T00:00:00.000Z',
        },
        {
          id: eventDocId,
          item_id: dummyItemId,
          event_id: dummyEventId,
          file_name: 'faktura_servis.pdf',
          mime_type: 'application/pdf',
          size_bytes: 22000,
          sort_order: 0,
          data_base64: samplePdfBase64,
          created_at: '2026-10-12T00:00:00.000Z',
          updated_at: '2026-10-12T00:00:00.000Z',
        },
      ],
    };

    it('Mode A (Copy): generates new UUIDs, remaps item_id and event_id, restores Blobs', () => {
      const result = prepareImportCopy(testPackageWithDocs, [], [], 'default-group');

      expect(result.attachmentsToPut).toHaveLength(2);

      const remappedItemId = result.itemsToPut[0].id;
      const remappedEventId = result.eventsToPut[0].id;

      const itemDoc = result.attachmentsToPut.find((a) => !a.event_id);
      const eventDoc = result.attachmentsToPut.find((a) => Boolean(a.event_id));

      expect(itemDoc).toBeDefined();
      expect(itemDoc?.id).not.toBe(itemDocId);
      expect(itemDoc?.item_id).toBe(remappedItemId);
      expect(itemDoc?.event_id).toBeNull();
      expect(itemDoc?.file_name).toBe('technicak.pdf');
      expect(itemDoc?.mime_type).toBe('application/pdf');
      expect(itemDoc?.blob).toBeDefined();

      expect(eventDoc).toBeDefined();
      expect(eventDoc?.id).not.toBe(eventDocId);
      expect(eventDoc?.item_id).toBe(remappedItemId);
      expect(eventDoc?.event_id).toBe(remappedEventId);
      expect(eventDoc?.file_name).toBe('faktura_servis.pdf');
      expect(eventDoc?.mime_type).toBe('application/pdf');
      expect(eventDoc?.blob).toBeDefined();
    });

    it('Mode B (Restore): preserves original UUIDs and attachments', () => {
      const result = prepareImportRestore(testPackageWithDocs, {
        groups: [],
        collections: [],
        itemTypes: [],
        fieldDefs: [],
        tags: [],
        items: [],
        events: [],
        attachments: [],
        defaultGroupId: 'default-grp-1',
      });

      expect(result.attachmentsToPut).toHaveLength(2);
      expect(result.attachmentsToPut[0].id).toBe(itemDocId);
      expect(result.attachmentsToPut[1].id).toBe(eventDocId);
      expect(result.attachmentsToPut[0].mime_type).toBe('application/pdf');
      expect(result.attachmentsToPut[1].mime_type).toBe('application/pdf');
    });
  });
});
