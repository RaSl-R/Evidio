# AGENTS.md — Evidio

Rules for every AI agent working in this repository (AI Studio, Jules, others).
Read this file, docs/PRODUCT.md and docs/DATA_MODEL.md before changing code.

## Project
Evidio is a universal personal inventory web app: the user creates sections
(e.g. "Auta", "RC modely", "Podtácky"), defines their own fields, and tracks
items, their event history, tags, photos and PDF documents.
Stack: React + TypeScript, Dexie.js (IndexedDB), Vitest. Mobile-first,
PWA-ready. There is NO backend, NO accounts and NO sync. Do not add them
unless a task explicitly says so (cloud/Neon is an open decision).

## Source of truth
- docs/DATA_MODEL.md: entities, property names, ID format, Dexie schema,
  SQL mapping, export package format. Do not change them unless the task
  explicitly allows it. If a task changes the model, update DATA_MODEL.md
  (entities, Dexie, SQL, export, example, audit table) in the same change.
- docs/PRODUCT.md: scope, decisions and roadmap.

## Languages and naming
- UI text: Czech. Code, identifiers, comments, commit messages: English.
- Czech UI terms: section = "sekce" (code: Collection), category =
  "kategorie" (code: CollectionGroup), tag = "štítek" (Tag), field =
  "vlastnost" / "pole" (FieldDefinition).
- The event type in TypeScript is `ItemEvent` (the DOM already has `Event`).
- All user-facing names of field data types come from ONE shared label map.
  Never show raw identifiers such as `single_select` or `long_text` in the UI;
  they belong only in code and exported JSON.

## Data rules (must never be broken)
- All entity ids are UUIDv4 strings.
- Field definitions are stored separately from values. Values live in `data`
  maps keyed by the field's stable id: `data: { [field_id]: value }`.
  Renaming a field changes only its label and never touches item data.
- single_select values store the OPTION ID, never the label. Removing an
  option that is in use marks it `is_deleted` (shown as "(archivováno)");
  it is never mutated in records.
- Archived fields are hidden in forms but their stored values are kept and
  still shown (marked "archivováno") in detail views and timelines.
- Changing a field type is allowed only for the safe transitions defined in
  DATA_MODEL.md, with a preview, in one transaction.
- `event_date` is a plain YYYY-MM-DD string; `event_time` is HH:mm or null.
  Never use toISOString() or Date objects to store them (timezone bug).
- `item_type_id` stays null in v1 (no item types UI).
- Attachments: kind is derived from `mime_type` (image/* = photo,
  application/pdf = document). Photo logic (main photo, gallery, thumbnails,
  `sort_order`) considers ONLY images; a PDF must never become a photo.
  The main photo is the image with the lowest `sort_order`.
- Every change to a record bumps its `updated_at`.

## Transactions
- Any change touching several records (deleting an item/section/category/tag,
  changing a field type, import, moving a section) runs in ONE Dexie
  transaction.
- Do not await non-Dexie async work (file reading, image decoding, Base64
  conversion) inside a Dexie transaction; prepare everything first, then
  write.

## Export / import compatibility (nothing may break this)
- Package: `"format": "evidio_package"`, `"version": 1`. Additive optional
  changes keep version 1; the importer must still accept older packages
  (missing arrays = empty).
- Every new entity or property must be added to: export, import (mode A copy
  with id remapping, mode B restore with newer `updated_at` winning),
  DATA_MODEL.md, and a round-trip unit test.
- A change to the Dexie schema requires a version bump with an upgrade
  function that loses no data, and an explicit task that allows it.

## UI conventions
- Mobile first; everything must work at 380 px width without horizontal
  scrolling or wrapping buttons.
- Modal stacking: detail view z-50, dialogs opened from it z-60,
  confirmations z-70. A dialog always renders above the dialog that opened it.
- Destructive actions ask for confirmation and show counts of affected
  records.
- Create object URLs lazily and revoke them when no longer needed.
- localStorage only for UI state and flags (selected section/category, view
  mode, last backup date, one-time seed flags). Never for user data.

## Security and privacy
- Never commit secrets, API keys or connection strings.
- Treat imported files and uploaded files as untrusted: validate structure
  and ids; validate PDFs by MIME type AND the `%PDF-` header; display file
  names as plain text; never render user content as HTML.
- No network calls that send user data anywhere.

## Working style
- Do only what the task asks. No extra features, no refactors beyond the task,
  no new dependencies without a stated reason.
- Put pure logic (validation, import, remapping, search, matching) in
  separate modules without UI so it can be unit-tested; add Vitest tests for it.
- Before finishing: build, run all tests, then describe in the PR/summary what
  changed, which files, risks, and anything you could not verify.

## Lessons from earlier iterations
- React hooks are always called unconditionally at the top of a component,
  BEFORE any early return (a useMemo below `if (!open) return null` crashed
  the detail modal).
- `vite build` does not type-check: also run `npx tsc --noEmit` before
  finishing.
- Reminders: use the pure functions in src/utils/reminders.ts through the
  useReminders hook; never compute deadlines a second time elsewhere. Days
  between dates use Date.UTC differences on YYYY-MM-DD strings.
- Event reminders: ItemEvent.reminder is optional; missing means enabled,
  30 days. Past events never produce reminders.
- Dialog stacking: detail z-50, dialogs opened from it z-60, confirmations
  z-70, FieldEditModal opened from a form z-80.
- Always end with a list of EVERY changed file; never claim completion
  without it.