import { db } from '../db';

export interface StorageStats {
  sectionPhotoBytes: number;
  sectionPhotoCount: number;
  sectionDocBytes: number;
  sectionDocCount: number;
  totalPhotoBytes: number;
  totalPhotoCount: number;
  totalDocBytes: number;
  totalDocCount: number;
  browserUsageBytes?: number;
  browserQuotaBytes?: number;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export async function getStorageStats(collectionId?: string): Promise<StorageStats> {
  let sectionPhotoBytes = 0;
  let sectionPhotoCount = 0;
  let sectionDocBytes = 0;
  let sectionDocCount = 0;

  if (collectionId) {
    const items = await db.items.where('collection_id').equals(collectionId).toArray();
    const itemIds = new Set(items.map((i) => i.id));
    const allAttachments = await db.attachments.toArray();
    for (const att of allAttachments) {
      if (itemIds.has(att.item_id)) {
        if (att.mime_type?.startsWith('image/')) {
          sectionPhotoBytes += att.size_bytes || 0;
          sectionPhotoCount++;
        } else {
          sectionDocBytes += att.size_bytes || 0;
          sectionDocCount++;
        }
      }
    }
  }

  const allAttachments = await db.attachments.toArray();
  let totalPhotoBytes = 0;
  let totalPhotoCount = 0;
  let totalDocBytes = 0;
  let totalDocCount = 0;

  for (const att of allAttachments) {
    if (att.mime_type?.startsWith('image/')) {
      totalPhotoBytes += att.size_bytes || 0;
      totalPhotoCount++;
    } else {
      totalDocBytes += att.size_bytes || 0;
      totalDocCount++;
    }
  }

  let browserUsageBytes: number | undefined;
  let browserQuotaBytes: number | undefined;

  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      browserUsageBytes = estimate.usage;
      browserQuotaBytes = estimate.quota;
    } catch {
      // Ignore if unsupported or restricted
    }
  }

  return {
    sectionPhotoBytes,
    sectionPhotoCount,
    sectionDocBytes,
    sectionDocCount,
    totalPhotoBytes,
    totalPhotoCount,
    totalDocBytes,
    totalDocCount,
    browserUsageBytes,
    browserQuotaBytes,
  };
}
