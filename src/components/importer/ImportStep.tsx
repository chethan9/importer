import { useEffect, useRef, useState } from "react";
import {
  collection as fsCollection,
  doc as fsDoc,
  getDoc,
  writeBatch,
  Firestore,
} from "firebase/firestore";
import {
  PlayCircle,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Download,
  ArrowLeft,
  RotateCcw,
  History,
  FileSpreadsheet,
  Gauge,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useFirebase } from "@/contexts/FirebaseContext";
import type { ParsedFile } from "./UploadStep";
import type { MappingConfig } from "./MappingStep";
import { buildRowData, collectRefQueryLookups, resolveRefQueries, parseManualRefPath } from "@/lib/mappingTree";
import { coerceValue, toAdminJSON } from "@/lib/coerce";
import {
  createImportRecord,
  logImportedDocs,
  finalizeImport,
  type ImportErrorEntry,
  type ImportedDocRecord,
} from "@/services/importService";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { downloadImportReportCSV, type ExportResultRow } from "@/lib/exportResults";
import { writeBatchAdmin } from "@/services/adminFirestoreService";

type Props = {
  file: ParsedFile;
  collectionName: string;
  config: MappingConfig;
  onBack: () => void;
  onReset: () => void;
  onOpenHistory: () => void;
};

type Phase = "idle" | "running" | "done" | "failed";

const BATCH_SIZE = 400;

type LiveResult = { rowIndex: number; docId: string; docPath: string };

export function ImportStep({ file, collectionName, config, onBack, onReset, onOpenHistory }: Props) {
  const { db, config: fbConfig, authMode, serviceAccount } = useFirebase();
  const { toast } = useToast();
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [successCount, setSuccessCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [errors, setErrors] = useState<ImportErrorEntry[]>([]);
  const [successResults, setSuccessResults] = useState<LiveResult[]>([]);
  const [importId, setImportId] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [batchInfo, setBatchInfo] = useState<{ current: number; total: number } | null>(null);
  const [rowsPerSec, setRowsPerSec] = useState<number>(0);
  const [elapsedSec, setElapsedSec] = useState<number>(0);
  const [limitEnabled, setLimitEnabled] = useState(false);
  const [rowLimit, setRowLimit] = useState<number>(Math.min(10, file.rows.length));
  const cancelRef = useRef(false);

  const rowsToImport = limitEnabled
    ? file.rows.slice(0, Math.max(1, Math.min(rowLimit, file.rows.length)))
    : file.rows;

  useEffect(() => () => { cancelRef.current = true; }, []);

  useEffect(() => {
    if (phase !== "running" || !startedAt) return;
    const interval = setInterval(() => {
      const elapsed = (Date.now() - startedAt.getTime()) / 1000;
      setElapsedSec(Math.round(elapsed));
      if (elapsed > 0) setRowsPerSec(Math.round((successCount + errorCount) / elapsed));
    }, 500);
    return () => clearInterval(interval);
  }, [phase, startedAt, successCount, errorCount]);

  async function run() {
    if (authMode === "web" && (!db || !fbConfig)) {
      toast({ title: "Not connected", description: "Firebase web connection missing. Go back to Connect step.", variant: "destructive" });
      return;
    }
    if (authMode === "admin" && !serviceAccount) {
      toast({ title: "Not connected", description: "Service account missing. Go back to Connect step.", variant: "destructive" });
      return;
    }
    if (rowsToImport.length === 0) {
      toast({ title: "Nothing to import", description: "No rows selected.", variant: "destructive" });
      return;
    }

    setPhase("running");
    setProgress(0);
    setSuccessCount(0);
    setErrorCount(0);
    setErrors([]);
    setSuccessResults([]);
    setStatusMessage("Starting import…");
    setBatchInfo(null);
    setRowsPerSec(0);
    setElapsedSec(0);
    cancelRef.current = false;
    const now = new Date();
    setStartedAt(now);

    let newImportId: string;
    try {
      setStatusMessage("Logging import to history…");
      const projectIdForLog = fbConfig?.projectId ?? serviceAccount?.project_id ?? "unknown";
      newImportId = await createImportRecord({
        projectId: projectIdForLog,
        collectionName,
        mode: config.mode,
        totalRows: rowsToImport.length,
        mappings: config.tree,
      });
      setImportId(newImportId);
    } catch (err) {
      toast({
        title: "Could not start import",
        description: err instanceof Error ? err.message : "Supabase log failed",
        variant: "destructive",
      });
      setPhase("failed");
      setStatusMessage("");
      return;
    }

    let refCache: Map<string, unknown> | undefined;
    try {
      const lookups = collectRefQueryLookups(config.tree, rowsToImport);
      if (lookups.length > 0) {
        setStatusMessage(`Resolving ${lookups.length} reference lookup${lookups.length === 1 ? "" : "s"}…`);
        if (authMode === "admin" && serviceAccount) {
          const fetchRes = await fetch("/api/admin/resolve-refs-batch", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              serviceAccount,
              lookups: lookups.map((l) => ({ collection: l.collection, matchField: l.matchField, value: l.value })),
            }),
          });
          const j = await fetchRes.json();
          refCache = new Map();
          lookups.forEach((l) => refCache!.set(l.key, null));
          if (fetchRes.ok && j.paths) {
            Object.entries(j.paths as Record<string, string>).forEach(([k, v]) => refCache!.set(k, v));
          }
          setStatusMessage(`Resolved ${Object.keys(j.paths ?? {}).length} of ${lookups.length} references`);
        } else {
          refCache = (await resolveRefQueries(lookups, db!, (doneChunks, totalChunks) => {
            setStatusMessage(`Resolving references: ${doneChunks}/${totalChunks} query chunks`);
          })) as Map<string, unknown>;
        }
      }
    } catch (err) {
      console.warn("Ref resolution failed:", err);
    }

    const localErrors: ImportErrorEntry[] = [];
    let localSuccess = 0;
    const localResults: LiveResult[] = [];
    const totalBatches = Math.ceil(rowsToImport.length / BATCH_SIZE);

    for (let batchStart = 0; batchStart < rowsToImport.length; batchStart += BATCH_SIZE) {
      if (cancelRef.current) break;
      const batchIdx = Math.floor(batchStart / BATCH_SIZE) + 1;
      const slice = rowsToImport.slice(batchStart, batchStart + BATCH_SIZE);
      setBatchInfo({ current: batchIdx, total: totalBatches });
      setStatusMessage(`Writing batch ${batchIdx} of ${totalBatches} · ${slice.length} rows…`);

      const result = authMode === "admin" && serviceAccount
        ? await processBatchAdmin(serviceAccount, collectionName, slice, batchStart, config, localErrors, refCache)
        : await processBatch(db!, collectionName, slice, batchStart, config, localErrors, refCache as never);
      localSuccess += result.written.length;
      result.written.forEach((w) => {
        localResults.push({ rowIndex: w.rowIndex, docId: w.docId, docPath: `${collectionName}/${w.docId}` });
      });
      setSuccessCount(localSuccess);
      setErrorCount(localErrors.length);
      setErrors([...localErrors]);
      setSuccessResults([...localResults]);
      setProgress(Math.min(100, Math.round(((batchStart + slice.length) / rowsToImport.length) * 100)));

      if (result.written.length) {
        try {
          setStatusMessage(`Logging batch ${batchIdx} results…`);
          const rows: ImportedDocRecord[] = result.written.map((w) => ({
            import_id: newImportId,
            doc_id: w.docId,
            action: w.action,
            pre_existing_snapshot: w.preSnapshot,
            row_index: w.rowIndex,
          }));
          await logImportedDocs(rows);
        } catch (err) {
          console.warn("Failed to log batch to Supabase:", err);
        }
      }
    }

    const finalStatus: "completed" | "failed" = localErrors.length > 0 && localSuccess === 0 ? "failed" : "completed";
    setStatusMessage("Finalizing…");
    await finalizeImport(newImportId, {
      successCount: localSuccess,
      errorCount: localErrors.length,
      errorLog: localErrors,
      status: finalStatus,
    });

    setBatchInfo(null);
    setStatusMessage("");
    setPhase(finalStatus === "completed" ? "done" : "failed");
    toast({
      title: finalStatus === "completed" ? "Import complete" : "Import finished with errors",
      description: `${localSuccess} written · ${localErrors.length} failed`,
    });
  }

  function downloadErrors() {
    if (!errors.length) return;
    const csv = [
      "row,field,message",
      ...errors.map((e) => `${e.rowIndex},${e.field ?? ""},"${(e.message ?? "").replace(/"/g, '""')}"`),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `import-errors-${importId ?? "latest"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadReport() {
    const results: ExportResultRow[] = [];
    successResults.forEach((r) => {
      results.push({
        rowIndex: r.rowIndex,
        status: "success",
        docId: r.docId,
        docPath: r.docPath,
        errorMessage: "",
      });
    });
    errors.forEach((e) => {
      results.push({
        rowIndex: e.rowIndex,
        status: "error",
        docId: "",
        docPath: "",
        errorMessage: `${e.field ? e.field + ": " : ""}${e.message}`,
      });
    });
    downloadImportReportCSV({
      collection: collectionName,
      results,
      sourceHeaders: file.columns,
      sourceRows: rowsToImport,
      startedAt: startedAt ?? new Date(),
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-2xl font-semibold">Run import</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Writing <span className="font-medium text-foreground">{rowsToImport.length}</span>
          {limitEnabled && <span> of {file.rows.length}</span>} rows to{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{collectionName}</code> in batches of {BATCH_SIZE}.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Test run / row limit</CardTitle>
          <CardDescription>Import only the first N rows — useful for dry-runs before a bulk import</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch id="limit-toggle" checked={limitEnabled} onCheckedChange={setLimitEnabled} disabled={phase === "running"} />
              <Label htmlFor="limit-toggle" className="cursor-pointer text-sm">Limit rows</Label>
            </div>
            <div className={`flex items-center gap-2 ${limitEnabled ? "" : "opacity-40"}`}>
              <Label htmlFor="limit-input" className="text-xs text-muted-foreground">Import first</Label>
              <Input
                id="limit-input"
                type="number"
                min={1}
                max={file.rows.length}
                value={rowLimit}
                onChange={(e) => setRowLimit(Math.max(1, Math.min(file.rows.length, Number(e.target.value) || 1)))}
                className="h-8 w-24 font-mono text-xs"
                disabled={!limitEnabled || phase === "running"}
              />
              <span className="text-xs text-muted-foreground">of {file.rows.length} rows</span>
            </div>
            {limitEnabled && (
              <div className="flex gap-1">
                {[5, 10, 50, 100].filter((n) => n <= file.rows.length).map((n) => (
                  <Button
                    key={n}
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-[11px]"
                    onClick={() => setRowLimit(n)}
                    disabled={phase === "running"}
                  >
                    {n}
                  </Button>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span>Progress</span>
            <div className="flex items-center gap-1.5">
              {phase === "running" && batchInfo && (
                <Badge variant="secondary" className="font-mono text-[10px]">Batch {batchInfo.current}/{batchInfo.total}</Badge>
              )}
              {phase === "running" && rowsPerSec > 0 && (
                <Badge variant="secondary" className="font-mono text-[10px]">
                  <Gauge className="mr-1 h-3 w-3" /> {rowsPerSec} rows/s
                </Badge>
              )}
              <Badge variant="outline" className="font-mono text-[11px]">
                {phase === "idle" ? "Ready" : phase === "running" ? "Running…" : phase === "done" ? "Completed" : "Failed"}
              </Badge>
            </div>
          </CardTitle>
          <CardDescription>
            Mode: <span className="font-medium text-foreground">{config.mode === "merge" ? "Merge / upsert" : "Create new"}</span>
            {" · "}
            ID: <span className="font-medium text-foreground">
              {config.docIdStrategy.kind === "auto" ? "Auto-generated" : `Column "${config.docIdStrategy.column}"`}
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground font-mono">
              <span>{progress}% · {successCount + errorCount} of {rowsToImport.length} processed</span>
              {(phase === "running" || phase === "done" || phase === "failed") && elapsedSec > 0 && (
                <span>{elapsedSec}s elapsed</span>
              )}
            </div>
            <Progress value={progress} className="h-2" />
            {statusMessage && phase === "running" && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>{statusMessage}</span>
              </div>
            )}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-md border bg-card p-3">
              <div className="text-xs text-muted-foreground">Total</div>
              <div className="font-heading text-2xl font-semibold">{rowsToImport.length}</div>
            </div>
            <div className="rounded-md border bg-accent/5 p-3">
              <div className="text-xs text-muted-foreground">Succeeded</div>
              <div className="font-heading text-2xl font-semibold text-accent">{successCount}</div>
            </div>
            <div className="rounded-md border bg-destructive/5 p-3">
              <div className="text-xs text-muted-foreground">Failed</div>
              <div className="font-heading text-2xl font-semibold text-destructive">{errorCount}</div>
            </div>
          </div>

          {phase === "idle" && (
            <Button size="lg" variant="accent" onClick={run} className="w-full">
              <PlayCircle className="mr-2 h-5 w-5" /> Start import
            </Button>
          )}
          {phase === "running" && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> {statusMessage || "Writing to Firestore…"}
            </div>
          )}
          {phase === "done" && (
            <Alert className="border-accent/40 bg-accent/5">
              <CheckCircle2 className="h-4 w-4 text-accent" />
              <AlertDescription className="text-foreground">
                Import complete. {successCount} documents written to <code className="font-mono text-xs">{collectionName}</code>.
                {errorCount > 0 && ` ${errorCount} rows skipped.`}
              </AlertDescription>
            </Alert>
          )}
          {phase === "failed" && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Import finished with errors. {successCount} succeeded, {errorCount} failed.
              </AlertDescription>
            </Alert>
          )}

          {(phase === "done" || phase === "failed") && (successCount > 0 || errorCount > 0) && (
            <Button variant="outline" onClick={downloadReport} className="w-full">
              <FileSpreadsheet className="mr-2 h-4 w-4" /> Download report (.csv)
            </Button>
          )}
        </CardContent>
      </Card>

      {errors.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Error log</CardTitle>
                <CardDescription>{errors.length} rows failed</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={downloadErrors}>
                <Download className="mr-1.5 h-3.5 w-3.5" /> Download CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="max-h-64 overflow-auto rounded-md border">
              <Table>
                <TableHeader className="sticky top-0 bg-muted/50">
                  <TableRow>
                    <TableHead className="w-16">Row</TableHead>
                    <TableHead className="w-32">Field</TableHead>
                    <TableHead>Message</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {errors.slice(0, 100).map((e, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-xs">{e.rowIndex + 1}</TableCell>
                      <TableCell>
                        {e.field && <Badge variant="outline" className="font-mono text-[10px]">{e.field}</Badge>}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{e.message}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {errors.length > 100 && (
              <p className="mt-2 text-xs text-muted-foreground">Showing first 100 of {errors.length} — download CSV for all.</p>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap justify-between gap-2">
        <Button variant="ghost" onClick={onBack} disabled={phase === "running"}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onOpenHistory}>
            <History className="mr-2 h-4 w-4" /> View history
          </Button>
          {(phase === "done" || phase === "failed") && (
            <Button variant="accent" onClick={onReset}>
              <RotateCcw className="mr-2 h-4 w-4" /> Start new import
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

type WrittenDoc = {
  docId: string;
  action: "created" | "updated";
  preSnapshot: Record<string, unknown> | null;
  rowIndex: number;
};

async function processBatch(
  db: Firestore,
  collectionName: string,
  rows: Record<string, unknown>[],
  offset: number,
  config: MappingConfig,
  errors: ImportErrorEntry[],
  refCache: Parameters<typeof buildRowData>[4],
): Promise<{ written: WrittenDoc[] }> {
  const colRef = fsCollection(db, collectionName);
  const batch = writeBatch(db);
  const written: WrittenDoc[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowIndex = offset + i;
    const { data, errors: rowErrors } = buildRowData(config.tree, row, rowIndex, db, refCache);
    if (rowErrors.length > 0) {
      rowErrors.forEach((e) => errors.push({ rowIndex, field: e.field, message: e.message }));
      continue;
    }

    let docRef;
    let docId: string;
    if (config.docIdStrategy.kind === "column") {
      const raw = row[config.docIdStrategy.column];
      const idStr = raw === null || raw === undefined ? "" : String(raw).trim();
      if (!idStr) {
        errors.push({ rowIndex, message: `Missing doc ID in column "${config.docIdStrategy.column}"` });
        continue;
      }
      docId = idStr;
      docRef = fsDoc(db, collectionName, idStr);
    } else {
      docRef = fsDoc(colRef);
      docId = docRef.id;
    }

    let preSnapshot: Record<string, unknown> | null = null;
    let action: "created" | "updated" = "created";
    if (config.docIdStrategy.kind === "column") {
      try {
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          if (config.mode === "create") {
            errors.push({ rowIndex, message: `Document "${docId}" already exists (create mode)` });
            continue;
          }
          preSnapshot = snap.data() as Record<string, unknown>;
          action = "updated";
        }
      } catch (err) {
        errors.push({ rowIndex, message: err instanceof Error ? err.message : "Read failed" });
        continue;
      }
    }

    if (config.mode === "merge") {
      batch.set(docRef, data, { merge: true });
    } else {
      batch.set(docRef, data);
    }
    written.push({ docId, action, preSnapshot, rowIndex });
  }

  if (written.length > 0) {
    try {
      await batch.commit();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Batch commit failed";
      written.forEach((w) => errors.push({ rowIndex: w.rowIndex, message: `Firestore: ${msg}` }));
      return { written: [] };
    }
  }

  return { written };
}

async function processBatchAdmin(
  sa: import("@/services/adminFirestoreService").ServiceAccount,
  collectionName: string,
  rows: Record<string, unknown>[],
  offset: number,
  config: MappingConfig,
  errors: ImportErrorEntry[],
  refCache: Map<string, unknown> | undefined,
): Promise<{ written: WrittenDoc[] }> {
  const ops: Array<{ docId?: string; data: Record<string, unknown>; merge: boolean; rowIndex: number }> = [];
  const perOpMeta: Array<{ rowIndex: number; hasId: boolean }> = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowIndex = offset + i;
    const data: Record<string, unknown> = {};
    const rowErrs: { field: string; message: string }[] = [];

    // Build plain data object (no DocumentReference — serialize refs as __ref__ path strings for admin API)
    const walk = (nodes: typeof config.tree, target: Record<string, unknown>) => {
      for (const node of nodes) {
        const name = node.name.trim();
        if (!name) continue;
        if (node.kind === "map") {
          const child: Record<string, unknown> = {};
          walk(node.children, child);
          if (Object.keys(child).length > 0) target[name] = child;
          continue;
        }
        if (node.source.kind === "skip") continue;
        if (node.source.kind === "now") { target[name] = { __type: "serverTimestamp" }; continue; }
        if (node.source.kind === "refManual") {
          const src = node.source;
          const parsed = parseManualRefPath(row[src.column], src.baseCollection);
          if (parsed === null) {
            if (src.onMissing === "error") rowErrs.push({ field: name, message: `Empty value in column "${src.column}"` });
            continue;
          }
          if ("error" in parsed) {
            if (src.onMissing === "error") rowErrs.push({ field: name, message: parsed.error });
            continue;
          }
          target[name] = { __type: "ref", path: parsed.path };
          continue;
        }
        if (node.source.kind === "refQuery") {
          const src = node.source;
          const rawVal = src.matchSource.kind === "column" ? row[src.matchSource.column] : src.matchSource.value;
          const value = rawVal === null || rawVal === undefined ? "" : String(rawVal).trim();
          if (!value) { if (src.onMissing === "error") rowErrs.push({ field: name, message: "Empty match value" }); continue; }
          const path = refCache?.get(`${src.collection}\u0000${src.matchField}\u0000${value}`) as string | undefined;
          if (!path) { if (src.onMissing === "error") rowErrs.push({ field: name, message: `No doc in "${src.collection}" where ${src.matchField} == "${value}"` }); continue; }
          target[name] = { __type: "ref", path };
          continue;
        }

        let raw: unknown;
        if (node.source.kind === "column") raw = row[node.source.column];
        else if (node.source.kind === "fixed") raw = node.source.value;
        else if (node.source.kind === "autoIncrement") raw = node.source.start + rowIndex * node.source.step;
        else raw = undefined;

        if (node.firestoreType === "reference") {
          const str = raw === null || raw === undefined ? "" : String(raw).trim();
          if (!str) continue;
          const cleaned = str.replace(/^\/+|\/+$/g, "");
          if (cleaned.split("/").length < 2 || cleaned.split("/").length % 2 !== 0) {
            rowErrs.push({ field: name, message: `Reference "${str}" must be a path like collection/docId` });
            continue;
          }
          target[name] = { __type: "ref", path: cleaned };
          continue;
        }

        const res = coerceValue(raw, node.firestoreType, { arrayElementType: node.arrayElementType });
        if (res.ok === false) { rowErrs.push({ field: name, message: res.error }); continue; }
        if (res.value !== null || node.firestoreType === "null") target[name] = toAdminJSON(res.value);
      }
    };
    walk(config.tree, data);

    if (rowErrs.length > 0) { rowErrs.forEach((e) => errors.push({ rowIndex, field: e.field, message: e.message })); continue; }

    let docId: string | undefined;
    if (config.docIdStrategy.kind === "column") {
      const raw = row[config.docIdStrategy.column];
      const idStr = raw === null || raw === undefined ? "" : String(raw).trim();
      if (!idStr) { errors.push({ rowIndex, message: `Missing doc ID in column "${config.docIdStrategy.column}"` }); continue; }
      docId = idStr;
    }

    ops.push({ docId, data, merge: config.mode === "merge", rowIndex });
    perOpMeta.push({ rowIndex, hasId: !!docId });
  }

  if (ops.length === 0) return { written: [] };

  try {
    const res = await fetch("/api/admin/write-batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ serviceAccount: sa, collection: collectionName, ops, checkExisting: config.docIdStrategy.kind === "column" }),
    });
    const j = await res.json();
    if (!res.ok) throw new Error(j.error || "write-batch failed");
    const written: WrittenDoc[] = (j.results as Array<{ docId: string; action: "created" | "updated"; preSnapshot: Record<string, unknown> | null; rowIndex: number; error?: string }>).flatMap((r) => {
      if (r.error) { errors.push({ rowIndex: r.rowIndex, message: r.error }); return []; }
      return [{ docId: r.docId, action: r.action, preSnapshot: r.preSnapshot, rowIndex: r.rowIndex }];
    });
    return { written };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Admin batch failed";
    ops.forEach((o) => errors.push({ rowIndex: o.rowIndex, message: `Admin API: ${msg}` }));
    return { written: [] };
  }
}