CREATE TABLE mapping_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_key text NOT NULL,
  name text NOT NULL,
  project_id text,
  collection_name text NOT NULL,
  mode text NOT NULL DEFAULT 'create',
  doc_id_strategy jsonb NOT NULL,
  mapping_tree jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mapping_presets_mode_check CHECK (mode IN ('create','merge'))
);

CREATE INDEX idx_mapping_presets_owner_collection ON mapping_presets(owner_key, collection_name);

ALTER TABLE mapping_presets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all_mapping_presets" ON mapping_presets FOR ALL USING (true) WITH CHECK (true);