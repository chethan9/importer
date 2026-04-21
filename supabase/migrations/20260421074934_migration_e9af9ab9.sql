CREATE TABLE IF NOT EXISTS public.imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL,
  collection_name TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('create','merge')),
  total_rows INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running','completed','failed','reverted','reverting')),
  mappings JSONB,
  error_log JSONB,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  reverted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.imported_docs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id UUID NOT NULL REFERENCES public.imports(id) ON DELETE CASCADE,
  doc_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('created','updated')),
  pre_existing_snapshot JSONB,
  row_index INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_imported_docs_import_id ON public.imported_docs(import_id);
CREATE INDEX IF NOT EXISTS idx_imports_started_at ON public.imports(started_at DESC);

ALTER TABLE public.imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.imported_docs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_all_imports" ON public.imports;
DROP POLICY IF EXISTS "anon_all_imported_docs" ON public.imported_docs;

CREATE POLICY "anon_all_imports" ON public.imports FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_imported_docs" ON public.imported_docs FOR ALL USING (true) WITH CHECK (true);