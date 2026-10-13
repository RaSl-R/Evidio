/**
 * Utilities for attachments (photos & PDF documents)
 * Conforms to Evidio DATA_MODEL.md & Iteration 3d spec
 */

import { Attachment } from '../types';
import { formatBytes } from './storage';

export const MAX_PDF_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_DOCUMENTS_PER_TARGET = 20;

export function isPhotoAttachment(a: Attachment | { mime_type?: string }): boolean {
  return Boolean(a.mime_type && a.mime_type.startsWith('image/'));
}

export function isPdfAttachment(a: Attachment | { mime_type?: string }): boolean {
  return a.mime_type === 'application/pdf';
}

export function getAttachmentKind(a: Attachment | { mime_type?: string }): 'photo' | 'document' | 'other' {
  if (isPhotoAttachment(a)) return 'photo';
  if (isPdfAttachment(a)) return 'document';
  return 'other';
}

/**
 * Validates that a file is a valid PDF document:
 * 1. Size <= 10 MB
 * 2. MIME type application/pdf (or .pdf extension)
 * 3. File content starts with '%PDF-' magic bytes
 */
export async function validatePdfFile(file: File): Promise<{ isValid: boolean; error?: string }> {
  if (file.size > MAX_PDF_SIZE_BYTES) {
    return {
      isValid: false,
      error: `Soubor „${file.name}“ přesahuje maximální povolenou velikost 10 MB (${formatBytes(file.size)}).`,
    };
  }

  // Check MIME type if provided by browser
  if (file.type && file.type !== 'application/pdf') {
    return {
      isValid: false,
      error: `Soubor „${file.name}“ nemá požadovaný typ application/pdf (zjištěno: ${file.type}).`,
    };
  }

  // Ensure file is at least 5 bytes
  if (file.size < 5) {
    return {
      isValid: false,
      error: `Soubor „${file.name}“ je poškozený nebo příliš malý na formát PDF.`,
    };
  }

  try {
    const slice = file.slice(0, 5);
    const buffer = await slice.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const header = String.fromCharCode(...bytes);

    if (header !== '%PDF-') {
      return {
        isValid: false,
        error: `Soubor „${file.name}“ není platným PDF dokumentem (nezačíná hlavičkou %PDF-).`,
      };
    }
  } catch (err: any) {
    return {
      isValid: false,
      error: `Soubor „${file.name}“ se nepodařilo přečíst: ${err?.message || 'Neznámá chyba'}.`,
    };
  }

  return { isValid: true };
}

/**
 * Opens a PDF document in a new tab via Object URL and revokes after a delay
 */
export function openPdfDocument(blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke after a delay (60s) so browser has time to render it in new tab
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 60000);
}

/**
 * Triggers browser download for a PDF document
 */
export function downloadPdfDocument(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 5000);
}
