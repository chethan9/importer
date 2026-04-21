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
import { coerceValue } from "@/lib/coerce";
import {
  createImportRecord,
  logImportedDocs,
  finalizeImport,
  type ImportErrorEntry,
  type ImportedDocRecord,
} from "@/services/importService";
import { useToast } from "@/hooks/use-toast";

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

export function ImportStep({ file, collectionName, config, onBack, onReset, onOpenHistory }: Props) {
  const { db, config: fbConfig } = useFirebase();
  const { toast } = useToast();
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [successCount, setSuccessCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [errors, setErrors] = useState<ImportErrorEntry[]>([]);
  const [importId, setImportId] = useState<string | null>(null);
  const cancelRef = useRef(false);

  useEffect(() => () => { cancelRef.current = true; }, []);

  async function run() {
    if (!db || !fbConfig) return;
    setPhase("running");
    setProgress(0);
    setSuccessCount(0);
    setErrorCount(0);
    setErrors([]);
    cancelRef.current = false;

    let newImportId: string;
    try {
      newImportId = await createImportRecord({
        projectId: fbConfig.projectId,
        collectionName,
        mode: config.mode,
        totalRows: file.rows.length,
        mappings: config.mappings,
      });
      setImportId(newImportId);
    } catch (err) {
      toast({
        title: "Could not start import",
        description: err instanceof Error ? err.message : "Supabase log failed",
        variant: "destructive",
      });
      setPhase("failed");
      return;
    }

    const localErrors: ImportErrorEntry[] = [];
    let localSuccess = 0;

    for (let batchStart = 0; batchStart < file.rows.length; batchStart += BATCH_SIZE) {
      if (cancelRef.current) break;
      const slice = file.rows.slice(batchStart, batchStart + BATCH_SIZE);
      const result = await processBatch(db, collectionName, slice, batchStart, config, localErrors);
      localSuccess += result.written.length;
      setSuccessCount(localSuccess);
      setErrorCount(localErrors.length);
      setErrors([...localErrors]);
      setProgress(Math.min(100, Math.round(((batchStart + slice.length) / file.rows.length) * 100)));

      if (result.written.length) {
        try {
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
    await finalizeImport(newImportId, {
      successCount: localSuccess,
      errorCount: localErrors.length,
      errorLog: localErrors,
      status: finalStatus,
    });

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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-2xl font-semibold">Run import</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Writing <span className="font-medium text-foreground">{file.rows.length}</span> rows to{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{collectionName}</code> in batches of {BATCH_SIZE}.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span>Progress</span>
            <Badge variant="outline" className="font-mono text-[11px]">
              {phase === "idle" ? "Ready" : phase === "running" ? "Running…" : phase === "done" ? "Completed" : "Failed"}
            </Badge>
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
          <Progress value={progress} className="h-2" />
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-md border bg-card p-3">
              <div className="text-xs text-muted-foreground">Total</div>
              <div className="font-heading text-2xl font-semibold">{file.rows.length}</div>
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
              <Loader2 className="h-4 w-4 animate-spin" /> Writing to Firestore…
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
): Promise<{ written: WrittenDoc[] }> {
  const colRef = fsCollection(db, collectionName);
  const batch = writeBatch(db);
  const written: WrittenDoc[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowIndex = offset + i;
    const data: Record<string, unknown> = {};
    let rowHasError = false;

    for (const m of config.mappings) {
      if (!m.sourceColumn || !m.targetField.trim()) continue;
      const raw = row[m.sourceColumn];
      const res = coerceValue(raw, m.firestoreType, { db, arrayElementType: m.arrayElementType });
      if (!res.ok) {
        errors.push({ rowIndex, field: m.targetField, message: res.error });
        rowHasError = true;
        break;
      }
      if (res.value !== null || m.firestoreType === "null") {
        data[m.targetField] = res.value;
      }
    }
    if (rowHasError) continue;

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