export type ExportResultRow = {
  rowIndex: number;
  status: "success" | "error";
  docId: string;
  docPath: string;
  errorMessage: string;
};

export type ExportReportInput = {
  collection: string;
  results: ExportResultRow[];
  sourceHeaders?: string[];
  sourceRows?: Record<string, unknown>[];
  startedAt: string | Date;
};

function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = typeof value === "object" ? JSON.stringify(value) : String(value);
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

export function downloadImportReportCSV(input: ExportReportInput): void {
  const { collection, results, sourceHeaders = [], sourceRows = [], startedAt } = input;
  const headers = [
    "row_index",
    "collection",
    "doc_id",
    "doc_path",
    "status",
    "error_message",
    ...sourceHeaders,
  ];
  const lines: string[] = [headers.map(escapeCsv).join(",")];

  const sorted = [...results].sort((a, b) => a.rowIndex - b.rowIndex);
  for (const r of sorted) {
    const src = sourceRows[r.rowIndex] ?? {};
    const row = [
      r.rowIndex + 2, // +2: 1-based + account for header row in source file
      collection,
      r.docId,
      r.docPath,
      r.status,
      r.errorMessage,
      ...sourceHeaders.map((h) => src[h]),
    ];
    lines.push(row.map(escapeCsv).join(","));
  }

  const csv = "\uFEFF" + lines.join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const stamp = (typeof startedAt === "string" ? new Date(startedAt) : startedAt)
    .toISOString()
    .slice(0, 19)
    .replace(/[:]/g, "-");
  const safe = collection.replace(/[^a-zA-Z0-9_-]/g, "_");
  const a = document.createElement("a");
  a.href = url;
  a.download = `firebase-import_${safe}_${stamp}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}