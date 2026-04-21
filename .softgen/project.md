# Firebase Data Importer

## Vision
A developer utility that removes the pain of bulk-importing CSV/Excel data into Firebase Firestore. Target: indie devs, admins, and small teams who today resort to hand-written scripts or clunky consoles. Flow: paste Firebase config → auto-fetch collections & field schema → drop a CSV/Excel file → visually map source columns to Firestore fields → click Start Import, watch live progress. Every import is logged as a transaction, so users can **revert** (delete or restore) any prior import with one click.

Firestore writes run client-side with the Firebase Web SDK — user's credentials never leave the browser. Import transaction metadata (which collection, which doc IDs, timestamps, counts) is stored in Supabase so history + revert survive page reloads.

**Packages to install at build time:** `firebase`, `papaparse`, `xlsx` (SheetJS).

## Design
Evocation: Linear's precision meets a modern dev power-tool (think Vercel dashboard + Raycast). Serious, fast, confident — not playful. Heavy use of shadcn primitives (Card, Tabs, Dialog, Progress, Table, Badge, Sheet, Toast) with refined spacing and subtle elevation.
Signature: warm off-white canvas, crisp typography, decisive coral-red action color, teal for success/import states, soft shadow lift on cards.

Tokens (HSL, map to shadcn in globals.css):
- `--background: 36 33% 97%` (warm off-white)
- `--foreground: 240 8% 11%` (near-black slate)
- `--primary: 10 78% 54%` (coral-red — primary CTAs)
- `--accent: 173 78% 32%` (deep teal — success, Start Import)
- `--muted: 36 18% 91%` (warm grey — secondary surfaces)
- `--card: 0 0% 100%` (pure white cards for lift)
- `--border: 36 14% 86%`
- `--destructive: 0 72% 50%`

Fonts (Google Fonts): headings **Sora** (600/700), body **Work Sans** (400/500/600), mono **JetBrains Mono** for Firestore paths & field names.

Style: generous whitespace, shadow-sm + ring-1 on cards, 8px radius, mono chips for field names, status pills, animated teal progress bars.

## Features
- Firebase connect form (JSON paste or individual fields) with validation, localStorage persistence
- Collection browser with sample-inferred field schema
- CSV (PapaParse) / XLSX (SheetJS) upload with preview
- Field-mapping UI with per-field type coercion + doc-ID strategy + create vs. merge mode
- Batched import runner (500/batch) with live progress and error log
- **Transaction log in Supabase**: every import saves collection, doc IDs written, mode, counts, timestamp
- **Revert / history page**: view past imports, one-click revert (deletes created docs, or restores pre-merge snapshots for upserts)