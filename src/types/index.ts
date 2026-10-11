/**
 * Domain types for Evidio
 * Source of truth: /DATA_MODEL.md
 */

export type FieldDataType =
  | 'text'
  | 'long_text'
  | 'number'
  | 'date'
  | 'boolean'
  | 'single_select'
  | 'multi_select'
  | 'url';

export interface SelectOption {
  id: string; // UUIDv4
  label: string;
  color?: string;
  is_deleted?: boolean;
}

export interface FieldConfig {
  options?: SelectOption[];
}

export interface FieldValidationRules {
  min?: number;
  max?: number;
  step?: number;
  allow_negative?: boolean;
  max_length?: number;
  min_length?: number;
  regex?: string;
  min_date?: string;
  max_date?: string;
  min_items?: number;
  max_items?: number;
  allowed_protocols?: string[];
}

export interface Collection {
  id: string; // UUIDv4
  user_id?: string | null;
  name: string;
  description: string;
  icon: string;
  display_order: number;
  created_at: string; // ISO 8601
  updated_at: string; // ISO 8601
}

export interface ItemType {
  id: string; // UUIDv4
  collection_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface FieldDefinition {
  id: string; // UUIDv4
  collection_id: string;
  target: 'ITEM' | 'EVENT';
  key: string;
  name: string;
  data_type: FieldDataType;
  unit: string | null;
  event_types: string[] | null;
  is_required: boolean;
  is_archived: boolean;
  display_order: number;
  config: FieldConfig;
  validation_rules: FieldValidationRules;
  created_at: string;
  updated_at: string;
}

export interface Item {
  id: string; // UUIDv4
  collection_id: string;
  item_type_id: string | null;
  name: string;
  tag_ids: string[];
  data: Record<string, any>; // key is FieldDefinition.id
  created_at: string;
  updated_at: string;
}

/**
 * Named ItemEvent to avoid colliding with DOM global Event
 */
export interface ItemEvent {
  id: string; // UUIDv4
  item_id: string;
  event_type: string;
  title: string;
  event_date: string; // YYYY-MM-DD
  event_time: string | null; // HH:mm
  data: Record<string, any>; // key is FieldDefinition.id
  created_at: string;
  updated_at: string;
}

export interface Tag {
  id: string; // UUIDv4
  collection_id: string;
  name: string;
  color: string;
  created_at: string;
  updated_at: string;
}

export interface Attachment {
  id: string; // UUIDv4
  item_id: string;
  event_id: string | null;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  blob?: Blob;
  data_base64?: string;
  storage_path?: string;
  created_at: string;
  updated_at: string;
}

export interface EvidioPackage {
  format: 'evidio_package';
  version: 1;
  exported_at: string;
  collections: Collection[];
  item_types: ItemType[];
  field_definitions: FieldDefinition[];
  tags: Tag[];
  items: Item[];
  events: ItemEvent[];
  attachments: Attachment[];
}
