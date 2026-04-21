const SA_KEY = "fb-importer:serviceAccount";

import type { FieldSchema } from "@/lib/firebase";

export type ServiceAccount = {
  project_id: string;
  private_key: string;
  client_email: string;
  [k: string]: unknown;
};

export function saveServiceAccount(sa: ServiceAccount) {
  try {
    localStorage.setItem(SA_KEY, JSON.stringify(sa));
  } catch {}
}

export function loadServiceAccount(): ServiceAccount | null {
  try {
    const raw = localStorage.getItem(SA_KEY);
    return raw ? (JSON.parse(raw) as ServiceAccount) : null;
  } catch {
    return null;
  }
}

export function clearServiceAccount() {
  try {
    localStorage.removeItem(SA_KEY);
  } catch {}
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || `${path} failed`);
  return json as T;
}

export async function listCollectionsAdmin(sa: ServiceAccount): Promise<string[]> {
  const data = await post<{ collections: string[] }>("/api/admin/list-collections", { serviceAccount: sa });
  return data.collections;
}

export async function inferSchemaAdmin(
  sa: ServiceAccount,
  collection: string,
): Promise<{ docCount: number; fields: FieldSchema[] }> {
  const data = await post<{ docCount: number; fields: Array<{ name: string; types: string[] }> }>(
    "/api/admin/infer-schema",
    { serviceAccount: sa, collection },
  );
  return {
    docCount: data.docCount,
    fields: data.fields.map((f) => ({
      name: f.name,
      type: (f.types[0] ?? "unknown") as FieldSchema["type"],
      seenIn: data.docCount,
    })),
  };
}

export async function resolveRefAdmin(
  sa: ServiceAccount,
  targetCollection: string,
  matchField: string,
  matchValue: unknown,
): Promise<string | null> {
  const data = await post<{ path: string | null }>("/api/admin/resolve-ref", {
    serviceAccount: sa,
    targetCollection,
    matchField,
    matchValue,
  });
  return data.path;
}

export type AdminDocOp = {
  docId?: string;
  data: Record<string, unknown>;
  mode: "create" | "merge";
};

export async function writeBatchAdmin(
  sa: ServiceAccount,
  collection: string,
  ops: AdminDocOp[],
): Promise<Array<{ path: string; ok: boolean; error?: string }>> {
  const data = await post<{ results: Array<{ path: string; ok: boolean; error?: string }> }>(
    "/api/admin/write-batch",
    { serviceAccount: sa, collection, ops },
  );
  return data.results;
}

export async function deleteBatchAdmin(
  sa: ServiceAccount,
  paths: string[],
): Promise<Array<{ path: string; ok: boolean; error?: string }>> {
  const data = await post<{ results: Array<{ path: string; ok: boolean; error?: string }> }>(
    "/api/admin/delete-batch",
    { serviceAccount: sa, paths },
  );
  return data.results;
}

export async function setBatchAdmin(
  sa: ServiceAccount,
  ops: Array<{ path: string; data: Record<string, unknown> }>,
): Promise<Array<{ path: string; ok: boolean; error?: string }>> {
  const data = await post<{ results: Array<{ path: string; ok: boolean; error?: string }> }>(
    "/api/admin/set-batch",
    { serviceAccount: sa, ops },
  );
  return data.results;
}