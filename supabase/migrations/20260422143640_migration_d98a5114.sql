ALTER TABLE imports ADD COLUMN IF NOT EXISTS last_processed_row INTEGER NOT NULL DEFAULT 0;
ALTER TABLE imports ADD COLUMN IF NOT EXISTS file_signature TEXT;
ALTER TABLE imports ADD COLUMN IF NOT EXISTS failed_rows JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE imports DROP CONSTRAINT IF EXISTS imports_status_check;
ALTER TABLE imports ADD CONSTRAINT imports_status_check CHECK (status IN ('running', 'completed', 'failed', 'paused', 'reverted', 'reverting'));