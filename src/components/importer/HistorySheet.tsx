import { useCallback, useEffect, useState } from "react";
import {
  doc as fsDoc,
  writeBatch,
  Firestore,
  deleteField,
} from "firebase/firestore";
import {
  History,
  Loader2,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Undo2,
  AlertTriangle,
  PlayCircle,
  RefreshCw,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  fetchImports,
  fetchImportedDocs,
  markImportReverted,
  markImportReverting,
} from "@/services/importService";
import { useFirebase } from "@/contexts/FirebaseContext";
import { useToast } from "@/hooks/use-toast";

type ImportRow = Awaited<ReturnType<typeof fetchImports>>[number];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onResumeRequest?: (importRow: ImportRow) => void;
  onRetryFailed?: (importRow: ImportRow) => void;
};

export function HistorySheet({ open, onOpenChange, onResumeRequest, onRetryFailed }: Props) {
  const { db, config, connected } = useFirebase();
  const { toast } = useToast();
  const [imports, setImports] = useState<ImportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [revertingId, setRevertingId] = useState<string | null>(null);
  const [revertProgress, setRevertProgress] = useState(0);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchImports();
      setImports(data);
    } catch (err) {
      toast({
        title: "Failed to load history",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  async function revert(importRow: ImportRow) {
    if (!db || !config) {
      toast({
        title: "Connect Firebase first",
        description: "Connect to the same Firebase project you imported into, then try again.",
        variant: "destructive",
      });
      return;
    }
    if (config.projectId !== importRow.project_id) {
      toast({
        title: "Project mismatch",
        description: `This import targeted ${importRow.project_id}, but you're connected to ${config.projectId}.`,
        variant: "destructive",
      });
      return;
    }

    setRevertingId(importRow.id);
    setRevertProgress(0);
    try {
      await markImportReverting(importRow.id);
      const docs = await fetchImportedDocs(importRow.id);
      const total = docs.length;
      const CHUNK = 400;

      for (let i = 0; i < docs.length; i += CHUNK) {
        const slice = docs.slice(i, i + CHUNK);
        const batch = writeBatch(db);
        for (const d of slice) {
          const ref = fsDoc(db as Firestore, importRow.collection_name, d.doc_id);
          if (d.action === "created") {
            batch.delete(ref);
          } else if (d.action === "updated" && d.pre_existing_snapshot) {
            const snap = d.pre_existing_snapshot as Record<string, unknown>;
            const restored: Record<string, unknown> = { ...snap };
            const mappings = (importRow.mappings ?? []) as Array<{ targetField?: string }>;
            mappings.forEach((m) => {
              if (m.targetField && !(m.targetField in snap)) {
                restored[m.targetField] = deleteField();
              }
            });
            batch.set(ref, restored);
          }
        }
        await batch.commit();
        setRevertProgress(Math.round(((i + slice.length) / Math.max(total, 1)) * 100));
      }

      await markImportReverted(importRow.id);
      toast({ title: "Reverted", description: `${total} documents rolled back in ${importRow.collection_name}.` });
      await load();
    } catch (err) {
      toast({
        title: "Revert failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setRevertingId(null);
      setRevertProgress(0);
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2 font-heading">
              <History className="h-5 w-5" /> Import history
            </SheetTitle>
            <SheetDescription>
              Every import is logged. Revert deletes created docs or restores pre-merge snapshots.
            </SheetDescription>
          </SheetHeader>

          {!connected && (
            <Alert className="mt-4 border-primary/30 bg-primary/5">
              <AlertTriangle className="h-4 w-4 text-primary" />
              <AlertDescription className="text-foreground text-sm">
                Connect to Firebase to enable revert.
              </AlertDescription>
            </Alert>
          )}

          <div className="mt-4 space-y-3">
            {loading && (
              <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading history…
              </div>
            )}
            {!loading && imports.length === 0 && (
              <div className="rounded-md border border-dashed py-12 text-center text-sm text-muted-foreground">
                No imports yet. Run your first import to see it here.
              </div>
            )}
            {!loading &&
              imports.map((imp) => {
                const isReverted = imp.status === "reverted";
                const isPaused = imp.status === "paused";
                const isReverting = revertingId === imp.id;
                const canRevert = imp.success_count > 0 && !isReverted && imp.status !== "running" && imp.status !== "reverting" && imp.status !== "paused";
                const canResume = isPaused && !!onResumeRequest;
                const canRetry = imp.status === "completed" && imp.error_count > 0 && !!onRetryFailed;
                const projectMatch = config?.projectId === imp.project_id;
                const lastRow = (imp as unknown as { last_processed_row?: number }).last_processed_row ?? 0;

                return (
                  <Card key={imp.id} className={isReverted ? "opacity-70" : ""}>
                    <CardContent className="space-y-2 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <code className="truncate rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                              {imp.collection_name}
                            </code>
                            <StatusBadge status={imp.status} />
                          </div>
                          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                            <span>{imp.mode === "merge" ? "Merge" : "Create"}</span>
                            <span>·</span>
                            <span className="font-mono">{imp.project_id}</span>
                            <span>·</span>
                            <span>{new Date(imp.started_at).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="flex items-center gap-1 text-accent">
                          <CheckCircle2 className="h-3.5 w-3.5" /> {imp.success_count} written
                        </span>
                        {imp.error_count > 0 && (
                          <span className="flex items-center gap-1 text-destructive">
                            <XCircle className="h-3.5 w-3.5" /> {imp.error_count} failed
                          </span>
                        )}
                        <span className="text-muted-foreground">of {imp.total_rows}</span>
                      </div>

                      {isPaused && lastRow > 0 && (
                        <div className="rounded border border-primary/30 bg-primary/5 p-2 text-xs">
                          <span className="font-medium text-primary">Paused at row {lastRow} of {imp.total_rows}</span>
                          <span className="text-muted-foreground"> · Re-upload the same file to resume</span>
                        </div>
                      )}

                      {isReverting && (
                        <div className="text-xs text-muted-foreground">Reverting… {revertProgress}%</div>
                      )}

                      <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                        {canResume && (
                          <Button
                            variant="accent"
                            size="sm"
                            onClick={() => {
                              onOpenChange(false);
                              onResumeRequest?.(imp);
                            }}
                          >
                            <PlayCircle className="mr-1.5 h-3.5 w-3.5" /> Resume
                          </Button>
                        )}
                        {canRetry && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              onOpenChange(false);
                              onRetryFailed?.(imp);
                            }}
                          >
                            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Retry {imp.error_count} failed
                          </Button>
                        )}
                        <Button
                          variant={canRevert ? "outline" : "ghost"}
                          size="sm"
                          disabled={!canRevert || isReverting || !connected || !projectMatch}
                          onClick={() => setConfirmId(imp.id)}
                          title={!projectMatch ? "Connect to the matching Firebase project to revert" : ""}
                        >
                          {isReverting ? (
                            <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Reverting</>
                          ) : isReverted ? (
                            <><Undo2 className="mr-1.5 h-3.5 w-3.5" /> Reverted</>
                          ) : (
                            <><RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Revert</>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!confirmId} onOpenChange={(o) => !o && setConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revert this import?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete created documents and restore pre-existing data for merged ones in your live Firestore.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const target = imports.find((i) => i.id === confirmId);
                setConfirmId(null);
                if (target) revert(target);
              }}
            >
              Revert
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    running: { label: "Running", className: "bg-primary/10 text-primary" },
    completed: { label: "Completed", className: "bg-accent/10 text-accent" },
    failed: { label: "Failed", className: "bg-destructive/10 text-destructive" },
    paused: { label: "Paused", className: "bg-primary/20 text-primary" },
    reverting: { label: "Reverting", className: "bg-primary/10 text-primary" },
    reverted: { label: "Reverted", className: "bg-muted text-muted-foreground" },
  };
  const s = map[status] ?? { label: status, className: "bg-muted text-muted-foreground" };
  return <Badge variant="outline" className={`text-[10px] ${s.className}`}>{s.label}</Badge>;
}