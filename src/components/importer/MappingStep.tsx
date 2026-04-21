import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, AlertTriangle, CheckCircle2, Plus, Wand2, Braces } from "lucide-react";
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
  buildInitialTree,
  buildRowData,
  collectBoundColumns,
  updateNodeById,
  removeNodeById,
  addChildToMap,
  appendRoot,
  countNodes,
  findDuplicatesAtLevel,
  makeLeaf,
  makeMap,
} from "@/lib/mappingTree";
import { ColumnPalette } from "./mapping/ColumnPalette";
import { FieldTreeNode } from "./mapping/FieldTreeNode";

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
  const { db } = useFirebase();
  const [tree, setTree] = useState<FieldNode[]>(() => value?.tree ?? buildInitialTree(collection, file.columns, file.rows));
  const [mode, setMode] = useState<ImportMode>(value?.mode ?? "create");
  const [docIdStrategy, setDocIdStrategy] = useState<DocIdStrategy>(value?.docIdStrategy ?? { kind: "auto" });

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
    setTree((t) => removeNodeById(t, id));
  }
  function onAddRoot() {
    setTree((t) => appendRoot(t, makeLeaf("newField")));
  }
  function onAddRootMap() {
    setTree((t) => appendRoot(t, makeMap("newMap", [])));
  }
  function onAddChild(parentId: string) {
    setTree((t) => addChildToMap(t, parentId, makeLeaf("newField")));
  }
  function onAddChildMap(parentId: string) {
    setTree((t) => addChildToMap(t, parentId, makeMap("newMap", [])));
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
            <div className="flex gap-1.5">
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
          <div className="grid gap-4 md:grid-cols-[260px_1fr]">
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
    </div>
  );
}