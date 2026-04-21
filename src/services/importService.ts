import { supabase } from "@/integrations/supabase/client";
import type { FirestoreType, ArrayElementType } from "@/lib/coerce";

export type ImportMapping = {
  sourceColumn: string | null;
  targetField: string;
  firestoreType: FirestoreType;
  arrayElementType?: ArrayElementType;
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

export async function createImportRecord(input: {
  projectId: string;
  collectionName: string;
  mode: ImportMode;
  totalRows: number;
  mappings: ImportMapping[];
}): Promise<string> {
  const { data, error } = await supabase
    .from("imports")
    .insert({
      project_id: input.projectId,
      collection_name: input.collectionName,
      mode: input.mode,
      total_rows: input.totalRows,
      mappings: input.mappings as unknown as Record<string, unknown>,
      status: "running",
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function logImportedDocs(rows: ImportedDocRecord[]): Promise<void> {
  if (!rows.length) return;
  const { error } = await supabase.from("imported_docs").insert(rows);
  if (error) throw error;
}

export async function finalizeImport(
  importId: string,
  payload: { successCount: number; errorCount: number; errorLog: ImportErrorEntry[]; status: "completed" | "failed" },
) {
  await supabase
    .from("imports")
    .update({
      status: payload.status,
      success_count: payload.successCount,
      error_count: payload.errorCount,
      error_log: payload.errorLog as unknown as Record<string, unknown>,
      completed_at: new Date().toISOString(),
    })
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
    .update({ status: "reverted", reverted_at: new Date().toISOString() })
    .eq("id", importId);
}

export async function markImportReverting(importId: string) {
  await supabase.from("imports").update({ status: "reverting" }).eq("id", importId);
}