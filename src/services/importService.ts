import { supabase } from "@/integrations/supabase/client";
import type { FirestoreType, ArrayElementType } from "@/lib/coerce";

export type MappingSource =
  | { kind: "column"; column: string }
  | { kind: "fixed"; value: string }
  | { kind: "autoIncrement"; start: number; step: number }
  | { kind: "skip" };

export type ImportMapping = {
  targetField?: string;
  firestoreType?: FirestoreType;
  arrayElementType?: ArrayElementType;
  source?: MappingSource;
  kind?: "leaf" | "map";
  id?: string;
  name?: string;
  children?: ImportMapping[];
};

export type ImportMode = "create" | "merge";

export type ImportErrorEntry = {
  rowIndex: number;
  field?: string;
  message: string;
};

export type ImportedDocRecord = {
  import_id: string;
  doc_id: string;
  action: "created" | "updated";
  pre_existing_snapshot: Record<string, unknown> | null;
  row_index: number;
};

export type FailedRowRecord = {
  rowIndex: number;
  field?: string;
  message: string;
  rawRow?: Record<string, unknown>;
};

export function computeFileSignature(columns: string[], rowCount: number): string {
  const header = columns.join("\u0001");
  let h = 0;
  for (let i = 0; i < header.length; i++) h = ((h << 5) - h + header.charCodeAt(i)) | 0;
  return `${rowCount}:${columns.length}:${(h >>> 0).toString(36)}`;
}

export async function createImportRecord(input: {
  projectId: string;
  collectionName: string;
  mode: ImportMode;
  totalRows: number;
  mappings: unknown;
  fileSignature?: string;
}): Promise<string> {
  const payload = {
    project_id: input.projectId,
    collection_name: input.collectionName,
    mode: input.mode,
    total_rows: input.totalRows,
    mappings: input.mappings,
    status: "running",
    file_signature: input.fileSignature ?? null,
  };
  const { data, error } = await supabase
    .from("imports")
    .insert(payload as never)
    .select("id")
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function updateImportProgress(
  importId: string,
  lastProcessedRow: number,
  successCount: number,
  errorCount: number,
  failedRows?: FailedRowRecord[],
): Promise<void> {
  const update: Record<string, unknown> = {
    last_processed_row: lastProcessedRow,
    success_count: successCount,
    error_count: errorCount,
  };
  if (failedRows) update.failed_rows = failedRows;
  await supabase.from("imports").update(update as never).eq("id", importId);
}

export async function pauseImport(
  importId: string,
  reason: string,
  lastProcessedRow: number,
  successCount: number,
  errorCount: number,
  failedRows: FailedRowRecord[],
): Promise<void> {
  await supabase
    .from("imports")
    .update({
      status: "paused",
      last_processed_row: lastProcessedRow,
      success_count: successCount,
      error_count: errorCount,
      failed_rows: failedRows,
      error_log: [{ rowIndex: -1, message: `Paused: ${reason}` }],
    } as never)
    .eq("id", importId);
}

export async function markImportResuming(importId: string): Promise<void> {
  await supabase
    .from("imports")
    .update({ status: "running" } as never)
    .eq("id", importId);
}

export async function getImportRecord(importId: string) {
  const { data, error } = await supabase
    .from("imports")
    .select("*")
    .eq("id", importId)
    .single();
  if (error) throw error;
  return data;
}

export async function logImportedDocs(rows: ImportedDocRecord[]): Promise<void> {
  if (!rows.length) return;
  const { error } = await supabase.from("imported_docs").insert(rows as never);
  if (error) throw error;
}

export async function finalizeImport(
  importId: string,
  payload: { successCount: number; errorCount: number; errorLog: ImportErrorEntry[]; status: "completed" | "failed" },
) {
  const update = {
    status: payload.status,
    success_count: payload.successCount,
    error_count: payload.errorCount,
    error_log: payload.errorLog,
    completed_at: new Date().toISOString(),
  };
  await supabase
    .from("imports")
    .update(update as never)
    .eq("id", importId);
}

export async function fetchImports() {
  const { data, error } = await supabase
    .from("imports")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return data ?? [];
}

export async function fetchImportedDocs(importId: string) {
  const { data, error } = await supabase
    .from("imported_docs")
    .select("*")
    .eq("import_id", importId);
  if (error) throw error;
  return data ?? [];
}

export async function markImportReverted(importId: string) {
  await supabase
    .from("imports")
    .update({ status: "reverted", reverted_at: new Date().toISOString() } as never)
    .eq("id", importId);
}

export async function markImportReverting(importId: string) {
  await supabase.from("imports").update({ status: "reverting" } as never).eq("id", importId);
}