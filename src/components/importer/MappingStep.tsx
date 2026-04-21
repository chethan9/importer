import { useMemo, useState, useEffect } from "react";
import { ArrowRight, ArrowLeft, AlertTriangle, CheckCircle2, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ImportMapping, ImportMode } from "@/services/importService";
import { FIRESTORE_TYPES, coerceValue, inferType, type FirestoreType, type ArrayElementType } from "@/lib/coerce";
import type { ParsedFile } from "./UploadStep";
import type { CollectionInfo } from "@/contexts/FirebaseContext";
import { useFirebase } from "@/contexts/FirebaseContext";

type DocIdStrategy = { kind: "auto" } | { kind: "column"; column: string };

export type MappingConfig = {
  mappings: ImportMapping[];
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
  const [mappings, setMappings] = useState<ImportMapping[]>(() => value?.mappings ?? buildInitialMappings(file, collection));
  const [mode, setMode] = useState<ImportMode>(value?.mode ?? "create");
  const [docIdStrategy, setDocIdStrategy] = useState<DocIdStrategy>(value?.docIdStrategy ?? { kind: "auto" });

  useEffect(() => {
    onChange({ mappings, mode, docIdStrategy });
  }, [mappings, mode, docIdStrategy, onChange]);

  const activeMappings = mappings.filter((m) => m.sourceColumn);
  const duplicateTargets = findDuplicates(activeMappings.map((m) => m.targetField));

  const validationPreview = useMemo(() => {
    const sample = file.rows.slice(0, 20);
    let errorCount = 0;
    const errors: { row: number; field: string; msg: string }[] = [];
    sample.forEach((row, i) => {
      activeMappings.forEach((m) => {
        const raw = row[m.sourceColumn!];
        const res = coerceValue(raw, m.firestoreType, { db: db ?? undefined, arrayElementType: m.arrayElementType });
        if (res.ok === false) {
          errorCount++;
          if (errors.length < 5) errors.push({ row: i + 1, field: m.targetField, msg: res.error });
        }
      });
    });
    return { errorCount, errors, totalChecked: sample.length * activeMappings.length };
  }, [file.rows, activeMappings, db]);

  function updateMapping(idx: number, patch: Partial<ImportMapping>) {
    setMappings((prev) => prev.map((m, i) => (i === idx ? { ...m, ...patch } : m)));
  }

  function addFieldMapping() {
    setMappings((prev) => [
      ...prev,
      { sourceColumn: null, targetField: "", firestoreType: "string" },
    ]);
  }

  function removeMapping(idx: number) {
    setMappings((prev) => prev.filter((_, i) => i !== idx));
  }

  const canProceed =
    activeMappings.length > 0 &&
    activeMappings.every((m) => m.targetField.trim().length > 0) &&
    duplicateTargets.length === 0 &&
    (docIdStrategy.kind === "auto" || (docIdStrategy.kind === "column" && docIdStrategy.column));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-2xl font-semibold">Map fields</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Match each source column to a Firestore field and pick its type. Values that don't match their type will be
          logged and skipped.
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
                  <div className="text-xs text-muted-foreground">
                    Update existing docs, create if missing. Pre-existing data is snapshotted for revert.
                  </div>
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
              <CardTitle className="text-base">Field mappings</CardTitle>
              <CardDescription>
                {activeMappings.length} active · {file.columns.length} columns available
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={addFieldMapping}>
              <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Add field
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-[1fr_auto_1fr_1fr_auto] items-center gap-2 border-b pb-2 text-xs font-medium text-muted-foreground">
            <div>Source column</div>
            <div />
            <div>Firestore field</div>
            <div>Type</div>
            <div />
          </div>
          {mappings.map((m, idx) => (
            <div key={idx} className="grid grid-cols-[1fr_auto_1fr_1fr_auto] items-center gap-2">
              <Select
                value={m.sourceColumn ?? "__skip__"}
                onValueChange={(v) => updateMapping(idx, { sourceColumn: v === "__skip__" ? null : v })}
              >
                <SelectTrigger className="font-mono text-xs">
                  <SelectValue placeholder="Skip" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__skip__" className="text-muted-foreground">— Skip —</SelectItem>
                  {file.columns.map((c) => (
                    <SelectItem key={c} value={c} className="font-mono text-xs">{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <Input
                value={m.targetField}
                onChange={(e) => updateMapping(idx, { targetField: e.target.value })}
                placeholder="firestoreField"
                className="font-mono text-xs"
              />
              <div className="flex gap-1">
                <Select
                  value={m.firestoreType}
                  onValueChange={(v) => updateMapping(idx, { firestoreType: v as FirestoreType })}
                >
                  <SelectTrigger className="text-xs">
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
                {m.firestoreType === "array" && (
                  <Select
                    value={m.arrayElementType ?? "string"}
                    onValueChange={(v) => updateMapping(idx, { arrayElementType: v as ArrayElementType })}
                  >
                    <SelectTrigger className="w-24 text-xs">
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
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeMapping(idx)}>
                <span className="text-lg">×</span>
              </Button>
            </div>
          ))}
          {duplicateTargets.length > 0 && (
            <Alert variant="destructive" className="mt-3">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Duplicate target fields: {duplicateTargets.map((d) => <code key={d} className="mx-1 font-mono text-xs">{d}</code>)}
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
            Checked first 20 rows · {validationPreview.errorCount} issues found
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
            {validationPreview.errorCount > validationPreview.errors.length && (
              <p className="mt-2 text-xs text-muted-foreground">
                …and {validationPreview.errorCount - validationPreview.errors.length} more. These rows will be skipped and logged.
              </p>
            )}
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

function buildInitialMappings(file: ParsedFile, collection: CollectionInfo): ImportMapping[] {
  const existingFields = new Map<string, FirestoreType>();
  collection.fields?.forEach((f) => existingFields.set(f.name, f.type as FirestoreType));
  return file.columns.map((col) => {
    const existing = existingFields.get(col);
    const sampleValue = file.rows[0]?.[col];
    return {
      sourceColumn: col,
      targetField: col,
      firestoreType: existing ?? inferType(sampleValue),
    };
  });
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