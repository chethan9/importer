import { supabase } from "@/integrations/supabase/client";
import type { FieldNode } from "@/lib/mappingTree";
import type { ImportMode } from "@/services/importService";

const OWNER_KEY_STORAGE = "fb-importer:ownerKey";

export type DocIdStrategyJson = { kind: "auto" } | { kind: "column"; column: string };

export type MappingPreset = {
  id: string;
  name: string;
  projectId: string | null;
  collectionName: string;
  mode: ImportMode;
  docIdStrategy: DocIdStrategyJson;
  mappingTree: FieldNode[];
  createdAt: string;
  updatedAt: string;
};

function getOwnerKey(): string {
  if (typeof window === "undefined") return "server";
  let key = localStorage.getItem(OWNER_KEY_STORAGE);
  if (!key) {
    key = `owner_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(OWNER_KEY_STORAGE, key);
  }
  return key;
}

export async function savePreset(input: {
  name: string;
  projectId: string | null;
  collectionName: string;
  mode: ImportMode;
  docIdStrategy: DocIdStrategyJson;
  mappingTree: FieldNode[];
}): Promise<MappingPreset> {
  const ownerKey = getOwnerKey();
  const { data, error } = await supabase
    .from("mapping_presets")
    .insert({
      owner_key: ownerKey,
      name: input.name,
      project_id: input.projectId,
      collection_name: input.collectionName,
      mode: input.mode,
      doc_id_strategy: input.docIdStrategy,
      mapping_tree: input.mappingTree,
    })
    .select()
    .single();
  if (error) throw error;
  return rowToPreset(data);
}

export async function updatePreset(id: string, patch: {
  name?: string;
  mode?: ImportMode;
  docIdStrategy?: DocIdStrategyJson;
  mappingTree?: FieldNode[];
}): Promise<MappingPreset> {
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.name !== undefined) updates.name = patch.name;
  if (patch.mode !== undefined) updates.mode = patch.mode;
  if (patch.docIdStrategy !== undefined) updates.doc_id_strategy = patch.docIdStrategy;
  if (patch.mappingTree !== undefined) updates.mapping_tree = patch.mappingTree;
  const { data, error } = await supabase
    .from("mapping_presets")
    .update(updates)
    .eq("id", id)
    .eq("owner_key", getOwnerKey())
    .select()
    .single();
  if (error) throw error;
  return rowToPreset(data);
}

export async function listPresets(collectionName?: string): Promise<MappingPreset[]> {
  const ownerKey = getOwnerKey();
  let q = supabase
    .from("mapping_presets")
    .select("*")
    .eq("owner_key", ownerKey)
    .order("updated_at", { ascending: false });
  if (collectionName) q = q.eq("collection_name", collectionName);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map(rowToPreset);
}

export async function deletePreset(id: string): Promise<void> {
  const { error } = await supabase
    .from("mapping_presets")
    .delete()
    .eq("id", id)
    .eq("owner_key", getOwnerKey());
  if (error) throw error;
}

function rowToPreset(row: Record<string, unknown>): MappingPreset {
  return {
    id: row.id as string,
    name: row.name as string,
    projectId: (row.project_id as string | null) ?? null,
    collectionName: row.collection_name as string,
    mode: row.mode as ImportMode,
    docIdStrategy: row.doc_id_strategy as DocIdStrategyJson,
    mappingTree: row.mapping_tree as FieldNode[],
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}