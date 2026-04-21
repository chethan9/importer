import { useMemo, useState, useEffect } from "react";
import { ArrowLeft, ArrowRight, AlertTriangle, CheckCircle2, Plus, Trash2, Hash, Columns3, Lock, MinusCircle, Wand2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { ImportMode } from "@/services/importService";
import { FIRESTORE_TYPES, coerceValue, inferType, inferTypeFromSamples, type FirestoreType, type ArrayElementType } from "@/lib/coerce";
import type { ParsedFile } from "./UploadStep";
import type { CollectionInfo } from "@/contexts/FirebaseContext";
import { useFirebase } from "@/contexts/FirebaseContext";

export type MappingSource =
  | { kind: "column"; column: string }
  | { kind: "fixed"; value: string }
  | { kind: "autoIncrement"; start: number; step: number }
  | { kind: "skip" };

export type FieldMapping = {
  targetField: string;
  firestoreType: FirestoreType;
  arrayElementType?: ArrayElementType;
  source: MappingSource;
};

type DocIdStrategy = { kind: "auto" } | { kind: "column"; column: string };

export type MappingConfig = {
  mappings: FieldMapping[];
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
  const [mappings, setMappings] = useState<FieldMapping[]>(() => value?.mappings ?? buildInitialMappings(file, collection));
  const [mode, setMode] = useState<ImportMode>(value?.mode ?? "create");
  const [docIdStrategy, setDocIdStrategy] = useState<DocIdStrategy>(value?.docIdStrategy ?? { kind: "auto" });

  useEffect(() => {
    onChange({ mappings, mode, docIdStrategy });
  }, [mappings, mode, docIdStrategy, onChange]);

  const activeMappings = mappings.filter((m) => m.source.kind !== "skip" && m.targetField.trim());
  const duplicateTargets = findDuplicates(activeMappings.map((m) => m.targetField.trim()));

  const validationPreview = useMemo(() => {
    const sample = file.rows.slice(0, 20);
    let errorCount = 0;
    const errors: { row: number; field: string; msg: string }[] = [];
    sample.forEach((row, i) => {
      activeMappings.forEach((m) => {
        const raw = resolveSourceValue(m.source, row, i);
        const res = coerceValue(raw, m.firestoreType, { db: db ?? undefined, arrayElementType: m.arrayElementType });
        if (res.ok === false) {
          errorCount++;
          if (errors.length < 5) errors.push({ row: i + 1, field: m.targetField, msg: res.error });
        }
      });
    });
    return { errorCount, errors };
  }, [file.rows, activeMappings, db]);

  function updateMapping(idx: number, patch: Partial<FieldMapping>) {
    setMappings((prev) => prev.map((m, i) => (i === idx ? { ...m, ...patch } : m)));
  }

  function updateSource(idx: number, source: MappingSource) {
    updateMapping(idx, { source });
  }

  function autoDetectTypeForColumn(column: string): FirestoreType {
    const samples = file.rows.slice(0, 50).map((r) => r[column]);
    return inferTypeFromSamples(samples);
  }

  function handleSourceKindChange(idx: number, kind: MappingSource["kind"]) {
    const current = mappings[idx];
    let next: MappingSource;
    switch (kind) {
      case "column":
        next = { kind: "column", column: file.columns[0] ?? "" };
        break;
      case "fixed":
        next = { kind: "fixed", value: "" };
        break;
      case "autoIncrement":
        next = { kind: "autoIncrement", start: 1, step: 1 };
        break;
      default:
        next = { kind: "skip" };
    }
    if (current.source.kind === kind) return;
    if (next.kind === "column" && next.column) {
      const detected = autoDetectTypeForColumn(next.column);
      updateMapping(idx, { source: next, firestoreType: detected });
    } else {
      updateSource(idx, next);
    }
  }

  function handleColumnChange(idx: number, column: string) {
    const detected = autoDetectTypeForColumn(column);
    updateMapping(idx, { source: { kind: "column", column }, firestoreType: detected });
  }

  function smartDetectAll() {
    setMappings((prev) =>
      prev.map((m) => {
        if (m.source.kind !== "column" || !m.source.column) return m;
        const detected = autoDetectTypeForColumn(m.source.column);
        return { ...m, firestoreType: detected };
      }),
    );
  }

  function changeSourceKind(idx: number, kind: MappingSource["kind"]) {
    handleSourceKindChange(idx, kind);
  }

  function addCustomField() {
    setMappings((prev) => [
      ...prev,
      { targetField: "", firestoreType: "string", source: { kind: "skip" } },
    ]);
  }

  function removeMapping(idx: number) {
    setMappings((prev) => prev.filter((_, i) => i !== idx));
  }

  const canProceed =
    activeMappings.length > 0 &&
    duplicateTargets.length === 0 &&
    activeMappings.every((m) => {
      if (m.source.kind === "column") return !!m.source.column;
      if (m.source.kind === "fixed") return m.source.value.trim().length > 0 || m.firestoreType === "null";
      return true;
    }) &&
    (docIdStrategy.kind === "auto" || (docIdStrategy.kind === "column" && !!docIdStrategy.column));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-2xl font-semibold">Map Firestore fields</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Each Firestore field on the left — bind it to a CSV column, a fixed value, or an auto-incrementing counter.
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
              <Select
                value={docIdStrategy.column}
                onValueChange={(col) => setDocIdStrategy({ kind: "column", column: col })}
              >
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
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Field bindings</CardTitle>
              <CardDescription>
                {activeMappings.length} of {mappings.length} field{mappings.length === 1 ? "" : "s"} will be written · {file.columns.length} CSV columns available
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={smartDetectAll} title="Auto-detect Firestore type from sample values">
              <Wand2 className="mr-1.5 h-3.5 w-3.5" /> Smart detect types
            </Button>
            <Button variant="outline" size="sm" onClick={addCustomField}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Add field
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {mappings.map((m, idx) => (
            <FieldRow
              key={idx}
              mapping={m}
              columns={file.columns}
              sampleRow={file.rows[0] ?? {}}
              isSkipped={m.source.kind === "skip"}
              onField={(targetField) => updateMapping(idx, { targetField })}
              onType={(firestoreType) => updateMapping(idx, { firestoreType })}
              onArrayElType={(t) => updateMapping(idx, { arrayElementType: t })}
              onSourceKind={(k) => changeSourceKind(idx, k)}
              onSource={(s) => updateSource(idx, s)}
              onColumnChange={(c) => handleColumnChange(idx, c)}
              onRemove={() => removeMapping(idx)}
            />
          ))}

          {mappings.length === 0 && (
            <div className="rounded-md border border-dashed bg-muted/30 p-8 text-center text-sm text-muted-foreground">
              No fields yet. Add fields manually or go back and select a collection with inferred schema.
            </div>
          )}

          {duplicateTargets.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Duplicate Firestore field names: {duplicateTargets.map((d) => <code key={d} className="mx-1 font-mono text-xs">{d}</code>)}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            {validationPreview.errorCount === 0 ? (
              <><CheckCircle2 className="h-4 w-4 text-accent" /> Type validation preview</>
            ) : (
              <><AlertTriangle className="h-4 w-4 text-destructive" /> Type validation preview</>
            )}
          </CardTitle>
          <CardDescription>
            Checked first 20 rows · {validationPreview.errorCount} issue{validationPreview.errorCount === 1 ? "" : "s"} found
          </CardDescription>
        </CardHeader>
        {validationPreview.errors.length > 0 && (
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
                {validationPreview.errors.map((e, i) => (
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

type FieldRowProps = {
  mapping: FieldMapping;
  columns: string[];
  sampleRow: Record<string, unknown>;
  isSkipped: boolean;
  onField: (v: string) => void;
  onType: (v: FirestoreType) => void;
  onArrayElType: (v: ArrayElementType) => void;
  onSourceKind: (k: MappingSource["kind"]) => void;
  onSource: (s: MappingSource) => void;
  onColumnChange: (c: string) => void;
  onRemove: () => void;
};

function FieldRow({
  mapping,
  columns,
  sampleRow,
  isSkipped,
  onField,
  onType,
  onArrayElType,
  onSourceKind,
  onSource,
  onColumnChange,
  onRemove,
}: FieldRowProps) {
  const src = mapping.source;
  return (
    <div className={cn("rounded-lg border bg-card p-3 transition-opacity", isSkipped && "opacity-60")}>
      <div className="grid items-start gap-3 md:grid-cols-[1.1fr_0.9fr_1.5fr_auto]">
        {/* Firestore field name + type */}
        <div className="space-y-1.5">
          <Label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Firestore field
          </Label>
          <Input
            value={mapping.targetField}
            onChange={(e) => onField(e.target.value)}
            placeholder="fieldName"
            className="h-9 font-mono text-xs"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Type</Label>
          <div className="flex gap-1">
            <Select value={mapping.firestoreType} onValueChange={(v) => onType(v as FirestoreType)}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FIRESTORE_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value} className="text-xs">
                    <div className="flex flex-col">
                      <span>{t.label}</span>
                      <span className="text-[10px] text-muted-foreground">{t.hint}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {mapping.firestoreType === "array" && (
              <Select value={mapping.arrayElementType ?? "string"} onValueChange={(v) => onArrayElType(v as ArrayElementType)}>
                <SelectTrigger className="h-9 w-24 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="string" className="text-xs">of String</SelectItem>
                  <SelectItem value="number" className="text-xs">of Number</SelectItem>
                  <SelectItem value="boolean" className="text-xs">of Boolean</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {/* Source */}
        <div className="space-y-1.5">
          <Label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Source</Label>
          <div className="flex gap-1.5">
            <Select value={src.kind} onValueChange={(v) => onSourceKind(v as MappingSource["kind"])}>
              <SelectTrigger className="h-9 w-[150px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="column" className="text-xs">
                  <span className="inline-flex items-center gap-1.5"><Columns3 className="h-3 w-3" /> CSV column</span>
                </SelectItem>
                <SelectItem value="fixed" className="text-xs">
                  <span className="inline-flex items-center gap-1.5"><Lock className="h-3 w-3" /> Fixed value</span>
                </SelectItem>
                <SelectItem value="autoIncrement" className="text-xs">
                  <span className="inline-flex items-center gap-1.5"><Hash className="h-3 w-3" /> Auto-increment</span>
                </SelectItem>
                <SelectItem value="skip" className="text-xs">
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground"><MinusCircle className="h-3 w-3" /> Skip</span>
                </SelectItem>
              </SelectContent>
            </Select>

            {src.kind === "column" && (
              <div className="flex-1 space-y-1">
                <Select value={src.column} onValueChange={onColumnChange}>
                  <SelectTrigger className="h-9 font-mono text-xs">
                    <SelectValue placeholder="Select column" />
                  </SelectTrigger>
                  <SelectContent>
                    {columns.map((c) => (
                      <SelectItem key={c} value={c} className="font-mono text-xs">{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {src.column && (
                  <div className="truncate font-mono text-[10px] text-muted-foreground">
                    sample: {formatPreview(sampleRow[src.column])}
                  </div>
                )}
              </div>
            )}

            {src.kind === "fixed" && (
              <Input
                value={src.value}
                onChange={(e) => onSource({ kind: "fixed", value: e.target.value })}
                placeholder="Value for every doc"
                className="h-9 flex-1 font-mono text-xs"
              />
            )}

            {src.kind === "autoIncrement" && (
              <div className="flex flex-1 gap-1.5">
                <div className="flex-1">
                  <Input
                    type="number"
                    value={src.start}
                    onChange={(e) => onSource({ ...src, start: Number(e.target.value) || 0 })}
                    placeholder="Start"
                    className="h-9 font-mono text-xs"
                  />
                  <div className="mt-0.5 text-[10px] text-muted-foreground">Start</div>
                </div>
                <div className="flex-1">
                  <Input
                    type="number"
                    value={src.step}
                    onChange={(e) => onSource({ ...src, step: Number(e.target.value) || 1 })}
                    placeholder="Step"
                    className="h-9 font-mono text-xs"
                  />
                  <div className="mt-0.5 text-[10px] text-muted-foreground">
                    preview: {src.start}, {src.start + src.step}, {src.start + src.step * 2}…
                  </div>
                </div>
              </div>
            )}

            {src.kind === "skip" && (
              <div className="flex flex-1 items-center px-2 text-xs text-muted-foreground">
                Field will be omitted
              </div>
            )}
          </div>
        </div>

        <Button variant="ghost" size="icon" className="mt-5 h-9 w-9 text-muted-foreground hover:text-destructive" onClick={onRemove}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function resolveSourceValue(source: MappingSource, row: Record<string, unknown>, rowIndex: number): unknown {
  switch (source.kind) {
    case "column":
      return row[source.column];
    case "fixed":
      return source.value;
    case "autoIncrement":
      return source.start + rowIndex * source.step;
    case "skip":
      return null;
  }
}

function formatPreview(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  const s = String(v);
  return s.length > 40 ? s.slice(0, 40) + "…" : s;
}

function buildInitialMappings(file: ParsedFile, collection: CollectionInfo): FieldMapping[] {
  const columnSet = new Set(file.columns);
  const rows: FieldMapping[] = [];

  collection.fields?.forEach((f) => {
    const matchingCol = columnSet.has(f.name) ? f.name : null;
    rows.push({
      targetField: f.name,
      firestoreType: f.type as FirestoreType,
      source: matchingCol ? { kind: "column", column: matchingCol } : { kind: "skip" },
    });
  });

  const mappedCols = new Set(rows.filter((r) => r.source.kind === "column").map((r) => (r.source as { column: string }).column));
  file.columns.forEach((col) => {
    if (!mappedCols.has(col) && !rows.find((r) => r.targetField === col)) {
      const sample = file.rows[0]?.[col];
      rows.push({
        targetField: col,
        firestoreType: inferType(sample),
        source: { kind: "column", column: col },
      });
    }
  });

  return rows;
}

function findDuplicates(arr: string[]): string[] {
  const seen = new Set<string>();
  const dups = new Set<string>();
  arr.forEach((v) => {
    if (v && seen.has(v)) dups.add(v);
    seen.add(v);
  });
  return Array.from(dups);
}