import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { ArrowLeft, ArrowRight, AlertTriangle, CheckCircle2, Plus, Wand2, Braces, Undo2, History, Bookmark, BookmarkPlus, Trash2, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ImportMode } from "@/services/importService";
import { inferTypeFromSamples, type FirestoreType } from "@/lib/coerce";
import type { ParsedFile } from "./UploadStep";
import type { CollectionInfo } from "@/contexts/FirebaseContext";
import { useFirebase } from "@/contexts/FirebaseContext";
import {
  type FieldNode,
  type LeafNode,
  type NodeContext,
  buildInitialTree,
  buildRowData,
  collectBoundColumns,
  updateNodeById,
  removeNodeById,
  addChildToMap,
  appendRoot,
  countNodes,
  findDuplicatesAtLevel,
  findNodeWithContext,
  insertAt,
  makeLeaf,
  makeMap,
} from "@/lib/mappingTree";
import { ColumnPalette } from "./mapping/ColumnPalette";
import { FieldTreeNode } from "./mapping/FieldTreeNode";
import { FirestorePreview } from "./mapping/FirestorePreview";
import { useToast } from "@/hooks/use-toast";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { ToastAction } from "@/components/ui/toast";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { collectBoundColumns as _collectBoundColumns } from "@/lib/mappingTree";
import { listPresets, savePreset, updatePreset, deletePreset, type MappingPreset } from "@/services/presetService";

type DocIdStrategy = { kind: "auto" } | { kind: "column"; column: string };

export type MappingConfig = {
  tree: FieldNode[];
  mode: ImportMode;
  docIdStrategy: DocIdStrategy;
};

type Props = {
  file: ParsedFile;
  collection: CollectionInfo;
  value: MappingConfig | null;
  onChange: (v: MappingConfig) => void;
  onBack: () => void;
  onNext: () => void;
};

export function MappingStep({ file, collection, value, onChange, onBack, onNext }: Props) {
  const { db, config: fbConfig } = useFirebase();
  const { toast } = useToast();
  const [tree, setTree] = useState<FieldNode[]>(() => value?.tree ?? buildInitialTree(collection, file.columns, file.rows));
  const [mode, setMode] = useState<ImportMode>(value?.mode ?? "create");
  const [docIdStrategy, setDocIdStrategy] = useState<DocIdStrategy>(value?.docIdStrategy ?? { kind: "auto" });
  const [deletionHistory, setDeletionHistory] = useState<Array<NodeContext & { deletedAt: number; displayName: string }>>([]);
  const [presets, setPresets] = useState<MappingPreset[]>([]);
  const [presetsLoading, setPresetsLoading] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saving, setSaving] = useState(false);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const treeRef = useRef(tree);
  treeRef.current = tree;

  const refreshPresets = useCallback(async () => {
    setPresetsLoading(true);
    try {
      const list = await listPresets(collection.name);
      setPresets(list);
    } catch (err) {
      console.warn("Load presets failed:", err);
    } finally {
      setPresetsLoading(false);
    }
  }, [collection.name]);

  useEffect(() => { void refreshPresets(); }, [refreshPresets]);

  useEffect(() => {
    onChange({ tree, mode, docIdStrategy });
  }, [tree, mode, docIdStrategy, onChange]);

  const inferredTypes = useMemo<Record<string, FirestoreType>>(() => {
    const out: Record<string, FirestoreType> = {};
    file.columns.forEach((c) => {
      out[c] = inferTypeFromSamples(file.rows.slice(0, 50).map((r) => r[c]));
    });
    return out;
  }, [file]);

  const boundColumns = useMemo(() => collectBoundColumns(tree), [tree]);
  const { total, bound } = countNodes(tree);
  const duplicates = findDuplicatesAtLevel(tree);

  const validation = useMemo(() => {
    if (!db) return { errorCount: 0, errors: [] as { row: number; field: string; msg: string }[] };
    const sample = file.rows.slice(0, 20);
    const errors: { row: number; field: string; msg: string }[] = [];
    let errorCount = 0;
    sample.forEach((row, i) => {
      const { errors: rowErrs } = buildRowData(tree, row, i, db);
      rowErrs.forEach((e) => {
        errorCount++;
        if (errors.length < 5) errors.push({ row: i + 1, field: e.field, msg: e.message });
      });
    });
    return { errorCount, errors };
  }, [file.rows, tree, db]);

  function onNameChange(id: string, name: string) {
    setTree((t) => updateNodeById(t, id, (n) => ({ ...n, name })));
  }
  function onLeafChange(id: string, patch: Partial<Omit<LeafNode, "kind" | "id">>) {
    setTree((t) =>
      updateNodeById(t, id, (n) => {
        if (n.kind !== "leaf") return n;
        return { ...n, ...patch };
      }),
    );
  }
  function onConvertToMap(id: string) {
    setTree((t) => updateNodeById(t, id, (n) => (n.kind === "leaf" ? makeMap(n.name || "newMap", []) : n)));
  }
  function onConvertToLeaf(id: string) {
    setTree((t) => updateNodeById(t, id, (n) => (n.kind === "map" ? makeLeaf(n.name || "newField") : n)));
  }
  function onRemove(id: string) {
    const ctx = findNodeWithContext(treeRef.current, id);
    if (!ctx) return;
    const displayName = ctx.node.name.trim() || (ctx.node.kind === "map" ? "(unnamed map)" : "(unnamed field)");
    const entry = { ...ctx, deletedAt: Date.now(), displayName };
    const restore = () => {
      setTree((t) => insertAt(t, entry.parentId, entry.index, entry.node));
      setDeletionHistory((h) => h.filter((d) => d.deletedAt !== entry.deletedAt));
    };
    setTree((t) => removeNodeById(t, id));
    setDeletionHistory((h) => [entry, ...h].slice(0, 20));
    toast({
      title: `Removed "${displayName}"`,
      description: ctx.node.kind === "map" && ctx.node.children.length > 0
        ? `Including ${ctx.node.children.length} nested field${ctx.node.children.length === 1 ? "" : "s"}`
        : "Click Undo to restore",
      action: <ToastAction altText="Undo" onClick={restore}>Undo</ToastAction>,
    });
  }
  function onAddRoot() {
    const n = makeLeaf("newField");
    setTree((t) => appendRoot(t, n));
    setFocusId(n.id);
  }
  function onAddRootMap() {
    const n = makeMap("newMap", []);
    setTree((t) => appendRoot(t, n));
    setFocusId(n.id);
  }
  function onAddChild(parentId: string) {
    const n = makeLeaf("newField");
    setTree((t) => addChildToMap(t, parentId, n));
    setFocusId(n.id);
  }
  function onAddChildMap(parentId: string) {
    const n = makeMap("newMap", []);
    setTree((t) => addChildToMap(t, parentId, n));
    setFocusId(n.id);
  }
  function onDropColumn(leafId: string, column: string) {
    const detected = inferredTypes[column] ?? "string";
    setTree((t) =>
      updateNodeById(t, leafId, (n) => {
        if (n.kind !== "leaf") return n;
        return { ...n, source: { kind: "column", column }, firestoreType: detected };
      }),
    );
  }
  function onSmartDetect() {
    setTree((t) => {
      const walk = (ns: FieldNode[]): FieldNode[] =>
        ns.map((n) => {
          if (n.kind === "map") return { ...n, children: walk(n.children) };
          if (n.source.kind !== "column" || !n.source.column) return n;
          return { ...n, firestoreType: inferredTypes[n.source.column] ?? n.firestoreType };
        });
      return walk(t);
    });
  }

  function restoreFromHistory(deletedAt: number) {
    const entry = deletionHistory.find((d) => d.deletedAt === deletedAt);
    if (!entry) return;
    setTree((t) => insertAt(t, entry.parentId, entry.index, entry.node));
    setDeletionHistory((h) => h.filter((d) => d.deletedAt !== deletedAt));
  }

  async function onSavePreset() {
    if (!saveName.trim()) return;
    setSaving(true);
    try {
      const saved = await savePreset({
        name: saveName.trim(),
        projectId: fbConfig?.projectId ?? null,
        collectionName: collection.name,
        mode,
        docIdStrategy,
        mappingTree: tree,
      });
      setActivePresetId(saved.id);
      setSaveOpen(false);
      setSaveName("");
      await refreshPresets();
      toast({ title: "Preset saved", description: `"${saved.name}" saved for ${collection.name}` });
    } catch (err) {
      toast({ title: "Save failed", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function onUpdateActivePreset() {
    if (!activePresetId) return;
    const target = presets.find((p) => p.id === activePresetId);
    if (!target) return;
    setSaving(true);
    try {
      await updatePreset(activePresetId, { mode, docIdStrategy, mappingTree: tree });
      await refreshPresets();
      toast({ title: "Preset updated", description: `"${target.name}" overwritten with current mapping` });
    } catch (err) {
      toast({ title: "Update failed", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  function onLoadPreset(p: MappingPreset) {
    const boundCols = new Set<string>();
    const walk = (nodes: FieldNode[]) => nodes.forEach((n) => {
      if (n.kind === "map") walk(n.children);
      else if (n.source.kind === "column") boundCols.add(n.source.column);
      else if (n.source.kind === "refManual") boundCols.add(n.source.column);
      else if (n.source.kind === "refQuery" && n.source.matchSource.kind === "column") boundCols.add(n.source.matchSource.column);
    });
    walk(p.mappingTree);
    const fileCols = new Set(file.columns);
    const missing = [...boundCols].filter((c) => !fileCols.has(c));
    setTree(p.mappingTree);
    setMode(p.mode);
    setDocIdStrategy(p.docIdStrategy);
    setActivePresetId(p.id);
    toast({
      title: `Loaded "${p.name}"`,
      description: missing.length > 0
        ? `⚠ ${missing.length} bound column${missing.length === 1 ? "" : "s"} not in current file: ${missing.slice(0, 3).join(", ")}${missing.length > 3 ? "…" : ""}`
        : `${p.mappingTree.length} root fields applied`,
      variant: missing.length > 0 ? "destructive" : "default",
    });
  }

  async function onDeletePreset(p: MappingPreset) {
    if (!confirm(`Delete preset "${p.name}"?`)) return;
    try {
      await deletePreset(p.id);
      if (activePresetId === p.id) setActivePresetId(null);
      await refreshPresets();
      toast({ title: "Preset deleted" });
    } catch (err) {
      toast({ title: "Delete failed", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  }

  const canProceed =
    bound > 0 &&
    duplicates.length === 0 &&
    (docIdStrategy.kind === "auto" || (docIdStrategy.kind === "column" && !!docIdStrategy.column));

  const unmappedCount = file.columns.length - boundColumns.size;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-2xl font-semibold">Map your data</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Drag CSV columns from the left onto Firestore fields on the right. Expand maps to reach nested fields.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Import mode</CardTitle>
            <CardDescription>How to handle documents</CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup value={mode} onValueChange={(v) => setMode(v as ImportMode)}>
              <div className="flex items-start gap-3 rounded-md border p-3">
                <RadioGroupItem value="create" id="mode-create" className="mt-0.5" />
                <Label htmlFor="mode-create" className="flex-1 cursor-pointer font-normal">
                  <div className="font-medium">Create new</div>
                  <div className="text-xs text-muted-foreground">Fail if a doc with the same ID exists</div>
                </Label>
              </div>
              <div className="flex items-start gap-3 rounded-md border p-3">
                <RadioGroupItem value="merge" id="mode-merge" className="mt-0.5" />
                <Label htmlFor="mode-merge" className="flex-1 cursor-pointer font-normal">
                  <div className="font-medium">Merge / upsert</div>
                  <div className="text-xs text-muted-foreground">Update existing, create if missing. Snapshotted for revert.</div>
                </Label>
              </div>
            </RadioGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Document ID</CardTitle>
            <CardDescription>How to identify each doc</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <RadioGroup
              value={docIdStrategy.kind}
              onValueChange={(v) =>
                setDocIdStrategy(v === "auto" ? { kind: "auto" } : { kind: "column", column: file.columns[0] ?? "" })
              }
            >
              <div className="flex items-center gap-3">
                <RadioGroupItem value="auto" id="id-auto" />
                <Label htmlFor="id-auto" className="cursor-pointer font-normal">Auto-generate IDs</Label>
              </div>
              <div className="flex items-center gap-3">
                <RadioGroupItem value="column" id="id-col" />
                <Label htmlFor="id-col" className="cursor-pointer font-normal">Use column value</Label>
              </div>
            </RadioGroup>
            {docIdStrategy.kind === "column" && (
              <Select value={docIdStrategy.column} onValueChange={(col) => setDocIdStrategy({ kind: "column", column: col })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select ID column" />
                </SelectTrigger>
                <SelectContent>
                  {file.columns.map((c) => (
                    <SelectItem key={c} value={c} className="font-mono text-xs">{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[3fr_1fr]">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-base">Field bindings</CardTitle>
                <CardDescription>
                  {bound} of {total} fields mapped · {boundColumns.size} of {file.columns.length} CSV columns used
                  {unmappedCount > 0 && ` · ${unmappedCount} unmapped`}
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" title="Saved mapping presets">
                      <Bookmark className="mr-1.5 h-3.5 w-3.5" />
                      {activePresetId && presets.find((p) => p.id === activePresetId)?.name
                        ? `Preset: ${presets.find((p) => p.id === activePresetId)?.name}`
                        : `Presets${presets.length > 0 ? ` (${presets.length})` : ""}`}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-80">
                    <DropdownMenuLabel className="text-xs">Mapping presets · {collection.name}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => { setSaveName(""); setSaveOpen(true); }} className="text-xs">
                      <BookmarkPlus className="mr-2 h-3.5 w-3.5" /> Save current mapping as preset…
                    </DropdownMenuItem>
                    {activePresetId && (
                      <DropdownMenuItem onClick={() => void onUpdateActivePreset()} disabled={saving} className="text-xs">
                        <Bookmark className="mr-2 h-3.5 w-3.5" /> Overwrite active preset with current mapping
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="text-[10px] text-muted-foreground">
                      {presetsLoading ? "Loading…" : presets.length === 0 ? "No presets yet" : "Load a preset"}
                    </DropdownMenuLabel>
                    {presets.map((p) => (
                      <DropdownMenuItem
                        key={p.id}
                        className="flex items-start justify-between gap-2 text-xs"
                        onSelect={(e) => { e.preventDefault(); }}
                      >
                        <button
                          type="button"
                          className="flex-1 min-w-0 text-left"
                          onClick={() => onLoadPreset(p)}
                        >
                          <div className="truncate font-medium">{p.name}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {p.mode} · {p.docIdStrategy.kind === "auto" ? "auto ID" : `ID: ${p.docIdStrategy.column}`} · {new Date(p.updatedAt).toLocaleDateString()}
                          </div>
                        </button>
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={(e) => { e.stopPropagation(); void onDeletePreset(p); }}
                          title="Delete preset"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                {deletionHistory.length > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" title="Restore a recently deleted field">
                        <Undo2 className="mr-1.5 h-3.5 w-3.5" /> Restore ({deletionHistory.length})
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-72">
                      <DropdownMenuLabel className="text-xs">Recently deleted</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {deletionHistory.map((d) => (
                        <DropdownMenuItem
                          key={d.deletedAt}
                          onClick={() => restoreFromHistory(d.deletedAt)}
                          className="flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <div className="truncate font-mono text-xs">{d.displayName}</div>
                            <div className="text-[10px] text-muted-foreground">
                              {d.node.kind === "map" ? "map" : (d.node as LeafNode).firestoreType}
                              {d.parentId ? " · nested" : " · root"}
                            </div>
                          </div>
                          <History className="h-3 w-3 text-muted-foreground" />
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                <Button variant="outline" size="sm" onClick={onSmartDetect} title="Auto-detect Firestore type from sample values">
                  <Wand2 className="mr-1.5 h-3.5 w-3.5" /> Smart detect types
                </Button>
                <Button variant="outline" size="sm" onClick={onAddRoot}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" /> Field
                </Button>
                <Button variant="outline" size="sm" onClick={onAddRootMap}>
                  <Braces className="mr-1.5 h-3.5 w-3.5" /> Map
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-[240px_1fr]">
              <div className="rounded-lg border bg-muted/30 p-3">
                <ColumnPalette
                  columns={file.columns}
                  inferredTypes={inferredTypes}
                  boundColumns={boundColumns}
                  sampleRow={file.rows[0] ?? {}}
                />
              </div>
              <div className="rounded-lg border bg-card p-2 font-mono">
                {tree.length === 0 ? (
                  <div className="rounded-md border border-dashed bg-muted/20 p-8 text-center text-sm text-muted-foreground">
                    No fields yet. Use the buttons above to add fields or maps.
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    {tree.map((node) => (
                      <FieldTreeNode
                        key={node.id}
                        node={node}
                        depth={0}
                        sampleRow={file.rows[0] ?? {}}
                        focusId={focusId}
                        onFocusConsumed={() => setFocusId(null)}
                        onNameChange={onNameChange}
                        onLeafChange={onLeafChange}
                        onConvertToMap={onConvertToMap}
                        onConvertToLeaf={onConvertToLeaf}
                        onRemove={onRemove}
                        onAddChild={onAddChild}
                        onAddChildMap={onAddChildMap}
                        onDropColumn={onDropColumn}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {duplicates.length > 0 && (
              <Alert variant="destructive" className="mt-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Duplicate sibling field names: {duplicates.map((d) => <code key={d} className="mx-1 font-mono text-xs">{d}</code>)}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        <Card className="lg:sticky lg:top-4 lg:self-start">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Document preview</CardTitle>
            <CardDescription>
              First row as a Firestore doc · switch rows to spot-check
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PreviewRowSwitcher file={file} tree={tree} db={db} docIdStrategy={docIdStrategy} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            {validation.errorCount === 0 ? (
              <><CheckCircle2 className="h-4 w-4 text-accent" /> Type validation preview</>
            ) : (
              <><AlertTriangle className="h-4 w-4 text-destructive" /> Type validation preview</>
            )}
          </CardTitle>
          <CardDescription>
            Checked first 20 rows · {validation.errorCount} issue{validation.errorCount === 1 ? "" : "s"} found
          </CardDescription>
        </CardHeader>
        {validation.errors.length > 0 && (
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Row</TableHead>
                  <TableHead>Field</TableHead>
                  <TableHead>Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {validation.errors.map((e, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-xs">{e.row}</TableCell>
                    <TableCell><Badge variant="outline" className="font-mono text-[10px]">{e.field}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{e.msg}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        )}
      </Card>

      <div className="flex justify-between">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <Button onClick={onNext} disabled={!canProceed} variant="accent">
          Continue to import <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Save mapping preset</DialogTitle>
            <DialogDescription>
              Save the current field bindings, mode, and doc ID strategy for <span className="font-mono text-foreground">{collection.name}</span>. You can load it next time you import into this collection.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="preset-name" className="text-xs">Preset name</Label>
            <Input
              id="preset-name"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="e.g. Monthly services import"
              onKeyDown={(e) => { if (e.key === "Enter" && saveName.trim()) void onSavePreset(); }}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSaveOpen(false)}>Cancel</Button>
            <Button variant="accent" onClick={() => void onSavePreset()} disabled={!saveName.trim() || saving}>
              {saving ? <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Saving…</> : "Save preset"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PreviewRowSwitcher({
  file,
  tree,
  db,
  docIdStrategy,
}: {
  file: ParsedFile;
  tree: FieldNode[];
  db: ReturnType<typeof useFirebase>["db"];
  docIdStrategy: DocIdStrategy;
}) {
  const [rowIdx, setRowIdx] = useState(0);
  const total = file.rows.length;
  const row = file.rows[rowIdx] ?? {};
  const docId =
    docIdStrategy.kind === "column" && docIdStrategy.column
      ? String(row[docIdStrategy.column] ?? "").trim() || "(missing)"
      : undefined;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          Row <span className="font-mono text-foreground">{rowIdx + 1}</span> of{" "}
          <span className="font-mono text-foreground">{total}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={() => setRowIdx((i) => Math.max(0, i - 1))} disabled={rowIdx === 0}>
            ← Prev
          </Button>
          <Button variant="outline" size="sm" onClick={() => setRowIdx((i) => Math.min(total - 1, i + 1))} disabled={rowIdx >= total - 1}>
            Next →
          </Button>
        </div>
      </div>
      <FirestorePreview tree={tree} sampleRow={row} rowIndex={rowIdx} db={db} docId={docId} />
    </div>
  );
}