import * as XLSX from "xlsx";

export type ExportResultRow = {
  rowIndex: number;
  status: "success" | "error";
  docId: string;
  docPath: string;
  errorMessage: string;
  sourceRow?: Record<string, unknown>;
};

export type ExportReport = {
  collection: string;
  mode: string;
  startedAt: string | Date;
  totalRows: number;
  successCount: number;
  errorCount: number;
  results: ExportResultRow[];
  includeSourceColumns?: boolean;
};

export function downloadImportReport(report: ExportReport): void {
  const wb = XLSX.utils.book_new();
  const startedAt = typeof report.startedAt === "string" ? new Date(report.startedAt) : report.startedAt;

  const summaryRows = [
    ["Firebase Import Report"],
    [],
    ["Collection", report.collection],
    ["Mode", report.mode],
    ["Started at", startedAt.toLocaleString()],
    ["Total rows", report.totalRows],
    ["Succeeded", report.successCount],
    ["Failed", report.errorCount],
  ];
  const summary = XLSX.utils.aoa_to_sheet(summaryRows);
  summary["!cols"] = [{ wch: 16 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, summary, "Summary");

  const sourceKeys = new Set<string>();
  if (report.includeSourceColumns) {
    report.results.forEach((r) => r.sourceRow && Object.keys(r.sourceRow).forEach((k) => sourceKeys.add(k)));
  }
  const sourceCols = Array.from(sourceKeys);

  const resultsData = report.results.map((r) => {
    const base: Record<string, unknown> = {
      row_index: r.rowIndex + 1,
      status: r.status,
      doc_id: r.docId,
      doc_path: r.docPath,
      error_message: r.errorMessage,
    };
    sourceCols.forEach((k) => {
      const v = r.sourceRow?.[k];
      base[`source_${k}`] = v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
    });
    return base;
  });

  const results = XLSX.utils.json_to_sheet(resultsData.length ? resultsData : [{ row_index: "", status: "", doc_id: "", doc_path: "", error_message: "" }]);
  results["!cols"] = [{ wch: 10 }, { wch: 10 }, { wch: 28 }, { wch: 48 }, { wch: 60 }, ...sourceCols.map(() => ({ wch: 22 }))];
  XLSX.utils.book_append_sheet(wb, results, "Results");

  const stamp = startedAt.toISOString().slice(0, 19).replace(/[:]/g, "-");
  const safeCollection = report.collection.replace(/[^a-zA-Z0-9_-]/g, "_");
  const filename = `firebase-import_${safeCollection}_${stamp}.xlsx`;
  XLSX.writeFile(wb, filename);
}