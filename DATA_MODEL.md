# Evidio — Data Architecture Specification (DATA_MODEL.md)
**Format Identifier:** `evidio_package`  
**Schema Version:** `1`  
**Storage Target:** IndexedDB (via Dexie.js) & Portable SQL (PostgreSQL/SQLite)  
**Schema Pattern:** Schema-Defined Document Hybrid (JSON Data Map with Relational Integrity)

---

## 1. Scope Boundaries for v1

To ensure strict engineering focus and prevent implementing agents or developers from overbuilding, the boundaries of v1 are explicitly defined:

### In Scope for v1
* **Collections**: Full management (create, edit, reorder, delete with cascade & backup prompt).
* **Custom Fields**: Dynamic schema registry (`FieldDefinition`) attached to collections. Supports `text`, `long_text`, `number` (with unit), `date`, `boolean`, `single_select`, `multi_select`, `url`.
* **Flat Collection Structure**: All fields in a collection are shared by all items in that collection (no ItemType management in the v1 UI, though the schema retains nullable `item_type_id = NULL` for forward compatibility).
* **Items**: Core entity records, custom field data map (`data`), tag assignments.
* **Events**: Item timeline entries with `event_type` (simple string/select), `title`, `event_date` (`YYYY-MM-DD`), optional `event_time` (`HH:mm`), and custom event fields filtered by optional `event_types`.
* **Tags**: Colored labels scoped to collections and assigned to items. MultiEntry indexed for instant filtering.
* **Attachments / Photos**: Uploading, client-side downscaling (max 1600 px long edge), previewing, and storing as binary Blobs in IndexedDB.
* **Search**: Instant, client-side, diacritics-insensitive in-memory token index across items, tags, and events.
* **Export / Import**: Standalone JSON package v1 containing complete data and Base64-encoded attachments, supporting copy import, restore upsert, and atomic transaction validation.

### Explicitly Out of Scope for v1
* **User Accounts & Authentication**: No login, multi-user permissions, or profile UI (architecture provides `user_id` hooks only).
* **Backend Server & Cloud Sync**: Zero backend API, zero live multi-device synchronization (CouchDB/CRDT/Firebase/WebSockets).
* **ItemType Management UI**: No specialized sub-type builders or type-switching wizards in the UI.
* **Automated Reminders & Notifications**: No STK expiry push notifications, calendar integrations, or email alerts.
* **Event-Type Management UI**: No dedicated entity or screen for managing event types; event types are simple strings or collection-defined presets.
* **Analytics & Statistics Dashboards**: No charts, financial reporting, or mileage forecasting.

---

## 2. Entities & Relations

```
┌────────────────────────────────────────────────────────┐
│ [User] (Future Extension: Multi-tenancy / Auth)        │
└───────────────────────────┬────────────────────────────┘
                            │ 1:N
┌───────────────────────────▼────────────────────────────┐
│ Collection                                             │
│ - id: UUIDv4                                           │
│ - name: VARCHAR(255)                                   │
│ - description: TEXT                                    │
│ - icon: VARCHAR(64)                                    │
│ - display_order: INT                                   │
│ - created_at: ISO8601 TIMESTAMPTZ                      │
│ - updated_at: ISO8601 TIMESTAMPTZ                      │
└──────┬────────────────────┬──────────────────────┬─────┘
       │ 1:N (optional)     │ 1:N                  │ 1:N
┌──────▼───────────┐  ┌─────▼──────────┐     ┌─────▼──────────┐
│ ItemType         │  │FieldDefinition │     │ Tag            │
│ - id: UUID       │  │ - id: UUID     │     │ - id: UUID     │
│ - coll_id: UUID  │  │ - coll_id: UUID│     │ - coll_id: UUID│
│ - name: VARCHAR  │  │ - target       │     │ - name, color  │
│ - created_at     │  │ - name, key    │     │ - created_at   │
│ - updated_at     │  │ - data_type    │     │ - updated_at   │
└──────┬───────────┘  │ - unit         │     └─────┬──────────┘
       │              │ - event_types[]│           │
       │ (0..1:N)     │ - is_required  │           │ M:N (*tag_ids)
       │              │ - is_archived  │           │
┌──────▼──────────────┴ - config, rules│           │
│ Item                │ - updated_at   │           │
│ - id: UUIDv4        └────────────────┘           │
│ - collection_id: UUIDv4                          │
│ - item_type_id: UUIDv4 | NULL                    │
│ - name: VARCHAR(255)                             │
│ - tag_ids: UUIDv4[] ◄────────────────────────────┘
│ - data: JSON map { [field_id: UUIDv4]: any }
│ - created_at: ISO8601 TIMESTAMPTZ
│ - updated_at: ISO8601 TIMESTAMPTZ
└──────────────┬───────────────────────────────────┐
               │ 1:N                               │ 1:N
┌──────────────▼───────────────────┐        ┌──────▼───────────────────┐
│ Event                            │        │ Attachment               │
│ - id: UUIDv4                     │◄───┐   │ - id: UUIDv4             │
│ - item_id: UUIDv4                │    │   │ - item_id: UUIDv4        │
│ - event_type: VARCHAR(64)        │    │1:N│ - event_id: UUIDv4 | NULL│
│ - title: VARCHAR(255)            │    └───┤ - file_name: VARCHAR     │
│ - event_date: DATE (YYYY-MM-DD)  │        │ - mime_type: VARCHAR     │
│ - event_time: VARCHAR(8) | NULL  │        │ - size_bytes: BIGINT     │
│ - data: JSON map                 │        │ - blob (IDB) / b64 (exp) │
│ - created_at: ISO8601 TIMESTAMPTZ│        │ - created_at: TIMESTAMPTZ│
│ - updated_at: ISO8601 TIMESTAMPTZ│        │ - updated_at: TIMESTAMPTZ│
└──────────────────────────────────┘        └──────────────────────────┘
```

### Entity Specifications

1. **`Collection`**
   * Primary root catalog container.
   * `id`: Standard RFC 4122 UUIDv4 string.
   * Attributes: `name`, `description`, `icon`, `display_order`, `created_at`, `updated_at`.

2. **`ItemType`** (Schema Ready, Hidden in v1 UI)
   * Represents item categories within a collection (e.g. *Osobní automobil*, *Přívěs*).
   * In v1, all items set `item_type_id = null`. In v2, collections can introduce multiple types without changing table structure or migrating existing records.

3. **`FieldDefinition`**
   * Custom field schema registry.
   * `target`: `'ITEM'` (field belongs to the item) or `'EVENT'` (field belongs to an event).
   * **`event_types` (`string[]` | `null`)**:
     * Applicable **only** when `target = 'EVENT'`.
     * `[]` or `null`: The field applies universally to **all** events in the collection.
     * `["Servis"]` or `["Servis", "STK"]`: The field is displayed and validated **only** when an event matches one of the specified event type strings.
   * `data_type`: String enum (`'text'`, `'long_text'`, `'number'`, `'date'`, `'boolean'`, `'single_select'`, `'multi_select'`, `'url'`).
   * `unit`: Optional presentation string (e.g. `"km"`, `"cm"`, `"g"`, `"Kč"`).
   * `config`: JSON object storing type-specific configuration (e.g. select options: `options: [{ id: UUID, label: string, color?: string, is_deleted?: boolean }]`).
   * `validation_rules`: JSON object (`min`, `max`, `step`, `max_length`, `regex`).
   * `is_required`: Boolean.
   * `is_archived`: Boolean (soft deletion).
   * `display_order`: Integer sorting index.
   * `created_at`, `updated_at`: ISO 8601 timestamps.

4. **`Item`**
   * Primary entity.
   * `id`: UUIDv4.
   * `collection_id`: UUIDv4 foreign key.
   * `item_type_id`: UUIDv4 nullable foreign key (always `null` in v1).
   * `name`: Primary human-readable identifier (e.g. *"Škoda Octavia Combi"*).
   * `tag_ids`: Array of UUIDv4 strings. Indexed as a multiEntry index for instant filtering.
   * `data`: JSON key-value map where keys are `FieldDefinition.id` UUIDs: `{ [field_id]: value }`.
   * `created_at`, `updated_at`: ISO 8601 timestamps.

5. **`Event`**
   * Ledger entry attached to an `Item`.
   * `id`: UUIDv4.
   * `item_id`: UUIDv4 foreign key.
   * `event_type`: Simple string identifier (e.g. `"Servis"`, `"STK"`, `"Havárie"`, `"Zálet"`).
   * `title`: Short descriptive title (e.g. *"Výměna motorového oleje"*).
   * `event_date`: Strict ISO calendar date string (`YYYY-MM-DD`). No timezone offset.
   * `event_time`: Optional time string (`HH:mm`, 24-hour format) or `null`.
   * `data`: JSON key-value map `{ [field_id]: value }` for field definitions matching `target = 'EVENT'`.
   * `created_at`, `updated_at`: ISO 8601 timestamps.

6. **`Tag`**
   * Categorization labels scoped per collection.
   * `id`: UUIDv4.
   * `collection_id`: UUIDv4 foreign key.
   * `name`: Display label (e.g. `"Denní provoz"`).
   * `color`: Hex color string (e.g. `"#10b981"`).
   * `created_at`, `updated_at`: ISO 8601 timestamps.

7. **`Attachment`**
   * Photos and documents attached to an `Item` or an `Event`.
   * `id`: UUIDv4.
   * `item_id`: UUIDv4 foreign key.
   * `event_id`: Nullable UUIDv4 foreign key (`null` when attached directly to the Item).
   * `file_name`: Original file name with extension.
   * `mime_type`: Standard MIME type (e.g. `"image/jpeg"`, `"image/webp"`, `"application/pdf"`).
   * `size_bytes`: File size in bytes.
   * `blob`: Binary `Blob` stored directly in IndexedDB.
   * `created_at`, `updated_at`: ISO 8601 timestamps.

---

## 3. Field Data Types & Validation Rules

| Type | Stored Value Type | Unit | Validation Rules (`validation_rules`) | Example Use Case |
| :--- | :--- | :--- | :--- | :--- |
| **`text`** | `string` | No | `min_length`, `max_length`, `regex` | SPZ, VIN, výrobní číslo |
| **`long_text`** | `string` | No | `max_length` | Poznámky, popis úprav |
| **`number`** | `number` | **Yes** | `min`, `max`, `step`, `allow_negative` | Rozpětí `152 cm`, Tachometr `184500 km`, Cena servisu `4200 Kč` |
| **`date`** | `string` (`YYYY-MM-DD`) | No | `min_date`, `max_date` | Datum pořízení, platnost STK |
| **`boolean`** | `boolean` (`true`/`false`)| No | None | V záruce, havarováno |
| **`single_select`** | `string` (`option_id`) | No | `options: [{ id, label, color, is_deleted }]` | Typ paliva, typ motoru |
| **`multi_select`** | `string[]` (`option_id[]`) | No | `min_items`, `max_items`, `options: [...]` | Výbava, servisní úkony |
| **`url`** | `string` | No | `allowed_protocols: ["http", "https"]` | Odkaz na manuál, inzerát |

*Note on Currency & Money:* Money is stored as a standard `number` with the currency set in `unit` (`"Kč"`, `"EUR"`, `"USD"`). This allows clean mathematical summation (`SUM`) without currency conversion bloat in v1.

---

## 4. Lifecycle Rules & Schema Evolution

### 4.1 Renaming a Field
* Every field is referenced strictly by its immutable `FieldDefinition.id` (UUIDv4).
* Renaming updates `FieldDefinition.name` and bumps `updated_at`.
* **Zero data migration**: No item or event records are touched.

### 4.2 Changing a Field's Type
* Compatible coercions (`text` ➔ `long_text`, `number` ➔ `text`) execute cleanly.
* For incompatible transitions, the existing raw value is retained in `data[field_id]` and displayed with a type-mismatch warning in the editor until the user explicitly corrects it.

### 4.3 Deleting a Select Option
1. **Never corrupt historical data**: Existing items or events with `data[field_id] == option_id` keep their value intact.
2. **Soft Deprecation**: In `FieldDefinition.config.options`, the option receives `is_deleted: true`.
3. **Form Behavior**: Deprecated options are hidden from the dropdown picker on new entries.
4. **Display Behavior**: Existing items display the option with an archived badge (e.g. *"Střídavý motor (Archivováno)"*).

### 4.4 Field Deletion (Archiving vs Purging)
* **Default (Archiving)**: `FieldDefinition.is_archived = true`. Hidden from forms and default table views; historical data is preserved.
* **Hard Purge**: Requires explicit user confirmation. Removes the `FieldDefinition` and cleans up the key from all `item.data` and `event.data` records.

### 4.5 Collection Deletion (Cascade & Safety Backup)
Deleting a collection is a critical, destructive action:
1. **Cascade Scope**: Deleting a collection cascades to purge:
   * All its `items`
   * All child `events` of those items
   * All `attachments` (and their binary blobs)
   * All collection `tags`
   * All collection `field_definitions`
   * All `item_types`
2. **Mandatory Confirmation Dialog**:
   * Displays the exact impact count:
     > *"Opravdu chcete smazat kolekci „Auta“? Akce nenávratně odstraní 5 položek, 12 událostí a 8 příloh."*
3. **One-Click Backup Offer**:
   * The confirmation modal prominently provides a primary button: **„Stáhnout zálohu před smazáním (JSON)“**.
   * Only after download or explicit checkbox acknowledgment (*„Rozumím, smazat bez zálohy“*) is the destructive button enabled.

### 4.6 Search: In-Memory Diacritics-Insensitive Token Index
* All strings pass through Unicode normalization:
  ```ts
  export function normalizeSearchText(text: string): string {
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }
  ```
* An in-memory inverted index tokenizes item names, tag names, event titles, and field values.
* Matches are computed using normalized token intersections, ensuring queries like `"skoda"`, `"stk"`, or `"olej"` instantly match `"Škoda"`, `"Platnost STK do"`, and `"Výměna oleje"`.

---

## 5. Storage Mapping

### 5.1 IndexedDB Schema (Dexie.js Specification)

The local browser database uses **Dexie.js** for robust transaction management, multiEntry indexing, and migration chains:

* **Database Name**: `evidio_db`
* **Version**: `1`

#### Dexie Stores Definition:
```ts
import Dexie, { type Table } from 'dexie';

export class EvidioDatabase extends Dexie {
  collections!: Table<Collection, string>;
  item_types!: Table<ItemType, string>;
  field_definitions!: Table<FieldDefinition, string>;
  items!: Table<Item, string>;
  events!: Table<Event, string>;
  tags!: Table<Tag, string>;
  attachments!: Table<Attachment, string>;

  constructor() {
    super('evidio_db');
    this.version(1).stores({
      collections: 'id, display_order, created_at, updated_at',
      item_types: 'id, collection_id',
      field_definitions: 'id, collection_id, [collection_id+target], updated_at',
      items: 'id, collection_id, item_type_id, *tag_ids, updated_at',
      events: 'id, item_id, [item_id+event_date], event_date, updated_at',
      tags: 'id, collection_id, name',
      attachments: 'id, item_id, event_id, updated_at'
    });
  }
}
```

*Notation Key*:
* `*tag_ids`: **multiEntry index** in Dexie/IndexedDB. Allows querying `db.items.where('tag_ids').equals(tagId)` directly with binary search speed.
* `[collection_id+target]`, `[item_id+event_date]`: **Compound indexes** for optimized sub-entity retrieval.

---

### 5.2 SQL Database Mapping (PostgreSQL DDL)

Exact 1:1 mapping with identical column names, types, and constraints:

```sql
-- Collections
CREATE TABLE collections (
    id UUID PRIMARY KEY,
    user_id UUID, -- Reserved for future auth/multi-tenant support
    name VARCHAR(255) NOT NULL,
    description TEXT,
    icon VARCHAR(64),
    display_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Item types (nullable on items for v1 flat structure, ready for v2)
CREATE TABLE item_types (
    id UUID PRIMARY KEY,
    collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_item_types_collection ON item_types(collection_id);

-- Dynamic field registry
CREATE TABLE field_definitions (
    id UUID PRIMARY KEY,
    collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    target VARCHAR(10) NOT NULL CHECK (target IN ('ITEM', 'EVENT')),
    key VARCHAR(64) NOT NULL,
    name VARCHAR(255) NOT NULL,
    data_type VARCHAR(32) NOT NULL,
    unit VARCHAR(32),
    event_types TEXT[] DEFAULT '{}', -- Only relevant if target = 'EVENT'
    is_required BOOLEAN NOT NULL DEFAULT FALSE,
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    display_order INT NOT NULL DEFAULT 0,
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    validation_rules JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_field_definitions_coll_target ON field_definitions(collection_id, target);

-- Tags
CREATE TABLE tags (
    id UUID PRIMARY KEY,
    collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    name VARCHAR(64) NOT NULL,
    color VARCHAR(32) NOT NULL DEFAULT '#6366f1',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_tags_collection ON tags(collection_id);

-- Items
CREATE TABLE items (
    id UUID PRIMARY KEY,
    collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    item_type_id UUID REFERENCES item_types(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    tag_ids UUID[] NOT NULL DEFAULT '{}',
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_items_collection ON items(collection_id);
CREATE INDEX idx_items_item_type ON items(item_type_id);
CREATE INDEX idx_items_tag_ids_gin ON items USING GIN(tag_ids);
CREATE INDEX idx_items_data_gin ON items USING GIN(data);

-- Events
CREATE TABLE events (
    id UUID PRIMARY KEY,
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    event_type VARCHAR(64) NOT NULL,
    title VARCHAR(255) NOT NULL,
    event_date DATE NOT NULL,
    event_time VARCHAR(8), -- Optional 'HH:mm'
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_events_item_date ON events(item_id, event_date DESC);
CREATE INDEX idx_events_data_gin ON events USING GIN(data);

-- Attachments
CREATE TABLE attachments (
    id UUID PRIMARY KEY,
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(128) NOT NULL,
    size_bytes BIGINT NOT NULL,
    storage_path TEXT, -- In SQL server: path/URL; or data_base64 TEXT
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_attachments_item ON attachments(item_id);
CREATE INDEX idx_attachments_event ON attachments(event_id);
```

---

## 6. Export / Import Rules & Versioning

### 6.1 Package Format & Version Identifier
* Uniform format identifier: `"format": "evidio_package"`
* Integer version: `"version": 1`
* **Version Detection & Future Migrations**:
  * Upon import, the parser inspects `package.format` and `package.version`.
  * If `format !== "evidio_package"`: import is rejected immediately (*"Neplatný formát souboru"*).
  * If `version > 1` (future version): the app blocks the import with an informative alert:
    > *"Tento soubor byl vytvořen v novější verzi aplikace Evidio (verze {v}). Aktualizujte prosím aplikaci."*
  * If `version < CURRENT_VERSION` (in future releases): sequential upgrade migration transformers `migrateV1toV2(pkg)` are executed in-memory before database persistence.

### 6.2 Pre-Import Validation & Preview
Before writing anything to IndexedDB, the importer executes strict non-destructive validation:
1. **Structural Validation**: Ensures all mandatory arrays exist and contain valid UUIDv4 keys.
2. **Import Preview Modal**: Summarizes package content before applying:
   * Kolekce: `N`
   * Položky: `N`
   * Události: `N`
   * Štítky: `N`
   * Přílohy: `N` (celková velikost: `X MB`)
3. **Mode Selection**: The user selects one of two import modes:
   * **Režim A: Importovat jako kopii**
   * **Režim B: Obnovit ze zálohy / Synchronizovat**

### 6.3 Import Modes

#### Mode A: Import as Copy (Duplication)
* Generates **brand new UUIDv4s** for every imported entity.
* Builds an in-memory ID remapping table:
  `map: Map<OldUUID, NewUUID>`.
* Remaps all foreign keys:
  * `collection.id` ➔ `new_collection_id`
  * `field_definition.id` ➔ `new_field_id`
  * `item.id` ➔ `new_item_id`, `item.collection_id` ➔ remapped, `item.tag_ids` ➔ remapped
  * Keys in `item.data` `{ [old_field_id]: val }` ➔ remapped to `{ [new_field_id]: val }`
  * `event.id` ➔ `new_event_id`, `event.item_id` ➔ remapped, keys in `event.data` ➔ remapped
  * `attachment.id` ➔ `new_attachment_id`, `attachment.item_id` ➔ remapped, `attachment.event_id` ➔ remapped
* Prevents any collision with existing user data.

#### Mode B: Restore from Backup (Upsert with LWW)
* Preserves original UUIDs.
* Executes an upsert (insert or update).
* **Conflict Resolution**: **Newer `updated_at` wins** (Last-Write-Wins). If an item with the same UUID exists locally but the imported record has a newer `updated_at`, the local record is updated; otherwise, local state is preserved.

### 6.4 Handling Unknown Field IDs
If an imported item or event contains field IDs in its `data` map that are missing from `field_definitions`:
* **Zero Data Loss Rule**: Never drop unknown values.
* **Auto-Reconstruction**: The importer generates a synthetic `FieldDefinition`:
  * `id`: Unknown field UUID
  * `collection_id`: Target collection UUID
  * `target`: `'ITEM'` or `'EVENT'`
  * `name`: `"Obnovené pole (" + id.substring(0, 6) + ")"`
  * `data_type`: Inferred from the value (`'number'`, `'date'`, `'boolean'`, or fallback to `'text'`)
  * `is_archived`: `false`
  * Placed into an "Importovaná pole" section so the user can easily review, rename, or adapt it.

### 6.5 Atomic Transaction Write
The entire write operation is wrapped in a single **Dexie atomic transaction**:
```ts
await db.transaction('rw', [
  db.collections,
  db.field_definitions,
  db.item_types,
  db.tags,
  db.items,
  db.events,
  db.attachments
], async () => {
  // Bulk write all prepared records
  await db.collections.bulkPut(preparedCollections);
  await db.field_definitions.bulkPut(preparedFieldDefs);
  await db.tags.bulkPut(preparedTags);
  await db.items.bulkPut(preparedItems);
  await db.events.bulkPut(preparedEvents);
  await db.attachments.bulkPut(preparedAttachments);
});
```
If any error occurs during parsing or binary blob conversion, the transaction rolls back completely—leaving local data 100% clean and uncorrupted.

---

## 7. Image Resizing & Export Package Limits

1. **Client-Side Photo Downscaling on Upload**:
   * All uploaded photos are downscaled via `<canvas>` before saving into IndexedDB.
   * **Constraint**: Max **1600 px** on the longest edge (aspect ratio preserved).
   * **Encoding**: JPEG or WebP at 82% quality.
   * Reduces modern 12 MB camera files down to ~250–450 KB.
2. **Export Package Size Safeguard**:
   * Binary Blobs are exported as Base64 strings (`data_base64`).
   * **Warning Threshold (25 MB)**: UI prompts:
     > *"Exportovaný soubor obsahuje velké množství fotografií a přesahuje 25 MB. Export může trvat několik sekund."*
   * **Hard Threshold (100 MB)**: Prompts user to choose:
     1. Export data only (without photo attachments).
     2. Export a specific individual collection.

---

## 8. Consistency Verification & Audit Table

| Entity / Property | SQL DDL | IndexedDB Store (Dexie) | Export Package (`version: 1`) | JSON Example | Audit Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Format ID & Version**| N/A | Schema Version `1` | `"format": "evidio_package", "version": 1` | `"format": "evidio_package", "version": 1` | Verified & Unified |
| **All Primary IDs** | `UUID` | `id` (UUIDv4 string) | `id` (UUIDv4 string) | Standard RFC 4122 UUIDv4 | Verified |
| **Field Values Map** | `data JSONB` | `data: {}` | `data: {}` | `"data": { "uuid": val }` | Consistent |
| **Item Subtype Key** | `item_type_id UUID` | `item_type_id` | `item_type_id` | `"item_type_id": null` | Consistent |
| **Event Date Format**| `DATE` | `event_date` | `event_date` | `"event_date": "2025-08-14"`| Consistent |
| **Event Time Format**| `VARCHAR(8)` | `event_time` | `event_time` | `"event_time": "08:30"` / `null` | Consistent |
| **Event Types Filter**| `event_types TEXT[]`| `event_types: []` | `event_types: []` | `"event_types": ["Servis"]`| Consistent |
| **Timestamps** | `created_at, updated_at` | `created_at, updated_at` | `created_at, updated_at` | ISO 8601 Strings | Consistent on all 7 entities |
| **Tag Associations** | `tag_ids UUID[]` | `*tag_ids` (multiEntry) | `tag_ids: []` | `"tag_ids": ["uuid", ...]` | Consistent |
| **Attachment Link** | `event_id UUID` | `event_id` | `event_id` | `"event_id": null` or UUID | Consistent |
| **Binary Storage** | `storage_path TEXT` | `blob: Blob` | `data_base64: string` | Base64 string payload | Consistent |

---

## 9. Complete Consolidated JSON Example

Package conforming to `format: "evidio_package"`, `version: 1`:

```json
{
  "format": "evidio_package",
  "version": 1,
  "exported_at": "2026-10-11T13:10:00Z",
  "collections": [
    {
      "id": "3bb68132-7204-4c40-9742-5ca1bfe746a8",
      "name": "Auta",
      "description": "Evidence rodinných a firemních vozidel, servisní kniha a STK",
      "icon": "car",
      "display_order": 0,
      "created_at": "2025-01-10T08:00:00Z",
      "updated_at": "2026-09-02T16:00:00Z"
    }
  ],
  "item_types": [],
  "tags": [
    {
      "id": "7dcfa092-28c0-449a-bd9b-c0667a78377b",
      "collection_id": "3bb68132-7204-4c40-9742-5ca1bfe746a8",
      "name": "Denní provoz",
      "color": "#10b981",
      "created_at": "2025-01-10T08:05:00Z",
      "updated_at": "2025-01-10T08:05:00Z"
    },
    {
      "id": "9b122c83-5c21-4f32-84e1-229dd1068840",
      "collection_id": "3bb68132-7204-4c40-9742-5ca1bfe746a8",
      "name": "Firemní odpočet",
      "color": "#3b82f6",
      "created_at": "2025-01-10T08:05:00Z",
      "updated_at": "2025-01-10T08:05:00Z"
    }
  ],
  "field_definitions": [
    {
      "id": "b3e9444f-f3c5-4309-844c-26d97c385a06",
      "collection_id": "3bb68132-7204-4c40-9742-5ca1bfe746a8",
      "target": "ITEM",
      "key": "license_plate",
      "name": "SPZ",
      "data_type": "text",
      "unit": null,
      "event_types": [],
      "is_required": true,
      "is_archived": false,
      "display_order": 1,
      "config": {},
      "validation_rules": {
        "max_length": 10
      },
      "created_at": "2025-01-10T08:10:00Z",
      "updated_at": "2025-01-10T08:10:00Z"
    },
    {
      "id": "2d1f7360-3162-4b21-9969-90de25ca31a4",
      "collection_id": "3bb68132-7204-4c40-9742-5ca1bfe746a8",
      "target": "ITEM",
      "key": "odometer_km",
      "name": "Stav tachometru",
      "data_type": "number",
      "unit": "km",
      "event_types": [],
      "is_required": true,
      "is_archived": false,
      "display_order": 2,
      "config": {},
      "validation_rules": {
        "min": 0,
        "step": 1
      },
      "created_at": "2025-01-10T08:10:00Z",
      "updated_at": "2025-01-10T08:10:00Z"
    },
    {
      "id": "ef28c460-e4b7-4402-9993-9c882a890789",
      "collection_id": "3bb68132-7204-4c40-9742-5ca1bfe746a8",
      "target": "ITEM",
      "key": "inspection_date",
      "name": "Platnost STK do",
      "data_type": "date",
      "unit": null,
      "event_types": [],
      "is_required": false,
      "is_archived": false,
      "display_order": 3,
      "config": {},
      "validation_rules": {},
      "created_at": "2025-01-10T08:10:00Z",
      "updated_at": "2025-01-10T08:10:00Z"
    },
    {
      "id": "8c35d971-118e-42b7-a3cf-7db4bc0c1965",
      "collection_id": "3bb68132-7204-4c40-9742-5ca1bfe746a8",
      "target": "EVENT",
      "key": "cost_czk",
      "name": "Cena servisu",
      "data_type": "number",
      "unit": "Kč",
      "event_types": [
        "Servis"
      ],
      "is_required": false,
      "is_archived": false,
      "display_order": 1,
      "config": {},
      "validation_rules": {
        "min": 0
      },
      "created_at": "2025-01-10T08:15:00Z",
      "updated_at": "2025-01-10T08:15:00Z"
    },
    {
      "id": "416ce595-6d60-4927-a06d-e4c6001d2d0b",
      "collection_id": "3bb68132-7204-4c40-9742-5ca1bfe746a8",
      "target": "EVENT",
      "key": "mileage_at_event",
      "name": "Kilometry při servisu",
      "data_type": "number",
      "unit": "km",
      "event_types": [
        "Servis"
      ],
      "is_required": false,
      "is_archived": false,
      "display_order": 2,
      "config": {},
      "validation_rules": {
        "min": 0
      },
      "created_at": "2025-01-10T08:15:00Z",
      "updated_at": "2025-01-10T08:15:00Z"
    }
  ],
  "items": [
    {
      "id": "97e68260-84cf-4ca6-a18d-6a56763ea17b",
      "collection_id": "3bb68132-7204-4c40-9742-5ca1bfe746a8",
      "item_type_id": null,
      "name": "Škoda Octavia Combi 2.0 TDI",
      "tag_ids": [
        "7dcfa092-28c0-449a-bd9b-c0667a78377b",
        "9b122c83-5c21-4f32-84e1-229dd1068840"
      ],
      "data": {
        "b3e9444f-f3c5-4309-844c-26d97c385a06": "5AH 1234",
        "2d1f7360-3162-4b21-9969-90de25ca31a4": 184500,
        "ef28c460-e4b7-4402-9993-9c882a890789": "2027-05-31"
      },
      "created_at": "2025-01-10T09:00:00Z",
      "updated_at": "2026-09-02T14:30:00Z"
    }
  ],
  "events": [
    {
      "id": "5faee1bb-7601-447a-ba92-b4c6e9cba35e",
      "item_id": "97e68260-84cf-4ca6-a18d-6a56763ea17b",
      "event_type": "Servis",
      "title": "Pravidelná servisní prohlídka (olej, filtry)",
      "event_date": "2025-08-14",
      "event_time": "08:30",
      "data": {
        "8c35d971-118e-42b7-a3cf-7db4bc0c1965": 4200,
        "416ce595-6d60-4927-a06d-e4c6001d2d0b": 165000
      },
      "created_at": "2025-08-14T09:00:00Z",
      "updated_at": "2025-08-14T09:00:00Z"
    },
    {
      "id": "90ba9198-d8f8-48b8-b4b6-455b80f4f9f7",
      "item_id": "97e68260-84cf-4ca6-a18d-6a56763ea17b",
      "event_type": "Servis",
      "title": "Výměna předních brzdových destiček a kotoučů",
      "event_date": "2026-09-02",
      "event_time": null,
      "data": {
        "8c35d971-118e-42b7-a3cf-7db4bc0c1965": 8900,
        "416ce595-6d60-4927-a06d-e4c6001d2d0b": 184000
      },
      "created_at": "2026-09-02T14:00:00Z",
      "updated_at": "2026-09-02T14:00:00Z"
    }
  ],
  "attachments": [
    {
      "id": "e6f43272-97fa-48ef-beec-19fbb1389868",
      "item_id": "97e68260-84cf-4ca6-a18d-6a56763ea17b",
      "event_id": "90ba9198-d8f8-48b8-b4b6-455b80f4f9f7",
      "file_name": "faktura_brzdy_autoservis.pdf",
      "mime_type": "application/pdf",
      "size_bytes": 184512,
      "data_base64": "JVBERi0xLjQKJ...",
      "created_at": "2026-09-02T14:05:00Z",
      "updated_at": "2026-09-02T14:05:00Z"
    }
  ]
}
```
