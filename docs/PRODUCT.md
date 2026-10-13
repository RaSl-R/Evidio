# Evidio — product brief and decisions

## Vision
Evidio is one place for everything a person wants to keep track of. The user
creates their own sections ("Auta", "RC modely", "Podtácky") and defines
their own fields, without knowing anything about databases or programming.
Origin: an idea from RC model planes (working name "Hangár"); the user
chose the name Evidio. Availability of the name, domain and trademark has
NOT been verified.

Promise: "Create your own inventory of anything — simple, clear, no coding."

## Target users
- Hobbyists and collectors (RC models, beer coasters, coins, books, tools).
- Households and equipment owners (warranties, serial numbers, documents).
- Vehicle owners (service history, inspection dates, costs).
- Individuals and small workshops that need simple equipment tracking,
  without a full warehouse system.

## Product principles
- Personal, configurable catalog — NOT a generic database editor, not
  warehouse management, not accounting.
- Simplicity of setup; sensible defaults; own structure when needed.
- The user owns the data: full export and restore, nothing locked in.
- Current state AND history of events (e.g. oil change: date, mileage, cost).

## Glossary
- Section (Collection): one inventory, e.g. "Auta". Has its own fields.
- Category (CollectionGroup): optional grouping of sections. A default
  category "Ostatní" always exists; the category row is hidden while only
  one visible category exists.
- Field (FieldDefinition): a user-defined property of items or events
  (text, long text, number with unit, date, boolean, single select; more
  types are in the model).
- Item: a thing being tracked. Event: a dated record in an item's history
  (event type is free text, e.g. "Servis"). Tag: cross-cutting label within
  a section. Attachment: photo (image/*) or PDF document.

## Decisions
- Platform: responsive web app, mobile first, PWA-ready; Android use through
  the browser/PWA. No native app for now.
- Data: local-first in the browser (IndexedDB via Dexie). No server, no
  accounts, no sync in v1. Data model is portable to PostgreSQL (JSONB).
- Storage layout: field definitions separate from values; values as a JSON
  map keyed by stable field id (DATA_MODEL.md).
- Events: included. Event-specific custom fields with an optional
  event_types filter (empty = all event types).
- Item types: modelled (nullable item_type_id) but no UI in v1.
- Export/import: JSON package `evidio_package` v1 including photos and
  documents as Base64; full backup ("Exportovat vše"); import as copy or
  restore.
- Photos: client-side resize (longest edge 1600 px, WebP 82%); max 10 per
  item. Documents: PDF only, max 10 MB, max 20 per item/event.
- Search: in-memory, diacritics-insensitive.
- Business model: undecided (personal project for now).

## Done so far
Sections, custom fields (editable: required, unit, select options, safe type
changes, archiving), items with search, JSON export, events with timeline and
event fields, categories of sections, full backup and import (copy/restore),
tags with filtering, photos, PDF documents, storage info.

## Next / candidates
- Compact item cards and an optional list view (in progress).
- Reminders for dates such as STK or expirations (high value for vehicles).
- Templates for new sections ("I want to track cars"), saved filters.
- PWA install and offline polish; QR codes; statistics; linking items.

## Open decisions (do NOT build before they are decided)
- Cloud / Neon: purpose undecided (backup only, multi-device access,
  sharing). If chosen it needs a backend API, authentication, and separate
  file storage for photos and PDFs; secrets must never be in the frontend or
  the repository.
- Accounts, sync, sharing between users, monetization.

## Acceptance scenarios
Three model sections must always work end to end (create section, define
fields, add item, add event, search, export, restore):
1. "RC modely": wingspan (cm), weight (g), propulsion (select).
2. "Podtácky": photo, brewery, year.
3. "Auta": plate, mileage, inspection date, service events with cost and
   mileage, invoice PDF.
