/**
 * Preset palette of 8 colors and helpers for tags (štítky)
 * Conforms to Evidio DATA_MODEL.md & Iteration 3b spec
 */

import { normalizeSearchText } from './search';
import { Tag } from '../types';

export interface TagColorOption {
  id: string;
  name: string;
  hex: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
}

export const TAG_PALETTE: TagColorOption[] = [
  {
    id: 'emerald',
    name: 'Zelená',
    hex: '#10b981',
    bgClass: 'bg-emerald-50',
    textClass: 'text-emerald-700',
    borderClass: 'border-emerald-200',
  },
  {
    id: 'blue',
    name: 'Modrá',
    hex: '#3b82f6',
    bgClass: 'bg-blue-50',
    textClass: 'text-blue-700',
    borderClass: 'border-blue-200',
  },
  {
    id: 'purple',
    name: 'Fialová',
    hex: '#8b5cf6',
    bgClass: 'bg-purple-50',
    textClass: 'text-purple-700',
    borderClass: 'border-purple-200',
  },
  {
    id: 'amber',
    name: 'Jantarová',
    hex: '#f59e0b',
    bgClass: 'bg-amber-50',
    textClass: 'text-amber-700',
    borderClass: 'border-amber-200',
  },
  {
    id: 'rose',
    name: 'Červená',
    hex: '#f43f5e',
    bgClass: 'bg-rose-50',
    textClass: 'text-rose-700',
    borderClass: 'border-rose-200',
  },
  {
    id: 'cyan',
    name: 'Tyrkysová',
    hex: '#06b6d4',
    bgClass: 'bg-cyan-50',
    textClass: 'text-cyan-700',
    borderClass: 'border-cyan-200',
  },
  {
    id: 'indigo',
    name: 'Indigová',
    hex: '#6366f1',
    bgClass: 'bg-indigo-50',
    textClass: 'text-indigo-700',
    borderClass: 'border-indigo-200',
  },
  {
    id: 'slate',
    name: 'Šedá',
    hex: '#64748b',
    bgClass: 'bg-slate-100',
    textClass: 'text-slate-700',
    borderClass: 'border-slate-300',
  },
];

export const DEFAULT_TAG_COLOR = TAG_PALETTE[0].hex;

export function findMatchingTag(tags: Tag[], name: string, excludeTagId?: string): Tag | undefined {
  const norm = normalizeSearchText(name);
  if (!norm) return undefined;
  return tags.find(
    (t) => (!excludeTagId || t.id !== excludeTagId) && normalizeSearchText(t.name) === norm
  );
}

export function isTagNameTaken(tags: Tag[], name: string, excludeTagId?: string): boolean {
  return findMatchingTag(tags, name, excludeTagId) !== undefined;
}

export function getTagColorOption(hex: string): TagColorOption | undefined {
  const lowerHex = hex?.toLowerCase();
  return TAG_PALETTE.find((p) => p.hex.toLowerCase() === lowerHex);
}
