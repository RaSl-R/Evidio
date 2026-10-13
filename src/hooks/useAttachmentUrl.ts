import { useEffect, useState } from 'react';

/**
 * Hook to lazily create and automatically revoke an object URL for a given Blob.
 * Prevents memory leaks.
 */
export function useAttachmentUrl(blob?: Blob | null): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!blob) {
      setUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(blob);
    setUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [blob]);

  return url;
}

/**
 * Hook to manage object URLs for a collection of items/attachments.
 */
export function useMultipleAttachmentUrls(
  attachments: Array<{ id: string; blob?: Blob | null }>
): Record<string, string> {
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    const createdUrls: Record<string, string> = {};

    for (const att of attachments) {
      if (att.blob) {
        createdUrls[att.id] = URL.createObjectURL(att.blob);
      }
    }

    setUrls(createdUrls);

    return () => {
      for (const url of Object.values(createdUrls)) {
        URL.revokeObjectURL(url);
      }
    };
  }, [attachments]);

  return urls;
}
