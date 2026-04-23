import { useEffect, useRef, useState } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { Upload, FileSpreadsheet, X, ArrowRight, ArrowLeft, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

export type ParsedFile = {
  fileName: string;
  columns: string[];
  rows: Record<string, unknown>[];
};

type Props = {
  value: ParsedFile | null;
  onChange: (v: ParsedFile | null) => void;
  onBack: () => void;
  onNext: () => void;
  collectionName: string;
};

function useCountUp(target: number, duration = 600) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const from = 0;
    let raf = 0;
    const step = () => {
      const elapsed = Date.now() - start;
      const t = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setVal(Math.round(from + (target - from) * eased));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

export function UploadStep({ value, onChange, onBack, onNext, collectionName }: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const rowsDisplay = useCountUp(value?.rows.length ?? 0);
  const colsDisplay = useCountUp(value?.columns.length ?? 0);

  async function handleFile(file: File) {
    setLoading(true);
    try {
      const lower = file.name.toLowerCase();
      if (lower.endsWith(".csv") || lower.endsWith(".tsv")) {
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          complete: (res) => {
            const rows = (res.data as Record<string, unknown>[]).filter((r) =>
              Object.values(r).some((v) => v !== null && v !== undefined && v !== ""),
            );
            const columns = res.meta.fields ?? (rows[0] ? Object.keys(rows[0]) : []);
            onChange({ fileName: file.name, columns, rows });
            toast({ title: "File parsed", description: `${rows.length} rows, ${columns.length} columns` });
            setLoading(false);
          },
          error: (err) => {
            toast({ title: "Parse failed", description: err.message, variant: "destructive" });
            setLoading(false);
          },
        });
      } else if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array", cellDates: true });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
        const columns = json[0] ? Object.keys(json[0]) : [];
        onChange({ fileName: file.name, columns, rows: json });
        toast({ title: "File parsed", description: `${json.length} rows, ${columns.length} columns` });
        setLoading(false);
      } else {
        toast({ title: "Unsupported file", description: "Please upload .csv, .tsv, .xlsx or .xls", variant: "destructive" });
        setLoading(false);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Parse failed";
      toast({ title: "Parse error", description: msg, variant: "destructive" });
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl animate-fade-in-up space-y-6 px-4 pb-20 sm:px-6">
      {!value ? (
        <Card
          className={`card-lift border-2 border-dashed transition-all ${isDragging ? "scale-[1.01]" : ""}`}
          style={isDragging ? { borderColor: "hsl(var(--step-upload))", backgroundColor: "hsl(var(--step-upload) / 0.05)" } : undefined}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            const f = e.dataTransfer.files[0];
            if (f) handleFile(f);
          }}
        >
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center sm:py-16">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-full text-white shadow-md"
              style={{ backgroundColor: "hsl(var(--step-upload))" }}
            >
              <FileSpreadsheet className="h-7 w-7" />
            </div>
            <div>
              <p className="font-medium">Drop your file here</p>
              <p className="text-sm text-muted-foreground">or click to browse</p>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.tsv,.xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
            <Button variant="outline" onClick={() => inputRef.current?.click()} disabled={loading}>
              <FileText className="mr-2 h-4 w-4" />
              {loading ? "Parsing…" : "Choose file"}
            </Button>
            <p className="text-xs text-muted-foreground">Supports .csv, .tsv, .xlsx, .xls</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="card-lift">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <div
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg text-white shadow-sm"
                style={{ backgroundColor: "hsl(var(--step-upload))" }}
              >
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <CardTitle className="truncate font-mono text-base">{value.fileName}</CardTitle>
                <CardDescription className="flex flex-wrap items-center gap-2 pt-1">
                  <Badge variant="secondary" className="gap-1 font-mono text-[10px] tabular-nums">
                    <span className="font-semibold">{rowsDisplay.toLocaleString()}</span> rows
                  </Badge>
                  <Badge variant="secondary" className="gap-1 font-mono text-[10px] tabular-nums">
                    <span className="font-semibold">{colsDisplay}</span> columns
                  </Badge>
                </CardDescription>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => onChange(null)} className="self-end sm:self-auto">
              <X className="mr-1 h-4 w-4" /> Remove
            </Button>
          </CardHeader>
          <CardContent>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {value.columns.slice(0, 12).map((c) => (
                <Badge key={c} variant="outline" className="font-mono text-[11px]">
                  {c}
                </Badge>
              ))}
              {value.columns.length > 12 && (
                <Badge variant="outline" className="text-[11px]">+{value.columns.length - 12} more</Badge>
              )}
            </div>
            <div className="max-h-80 overflow-auto rounded-md border">
              <Table>
                <TableHeader className="sticky top-0 bg-muted/50 backdrop-blur">
                  <TableRow>
                    {value.columns.map((c) => (
                      <TableHead key={c} className="whitespace-nowrap font-mono text-xs">
                        {c}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {value.rows.slice(0, 10).map((row, i) => (
                    <TableRow key={i}>
                      {value.columns.map((c) => (
                        <TableCell key={c} className="max-w-[200px] truncate whitespace-nowrap font-mono text-xs">
                          {row[c] === null || row[c] === undefined || row[c] === ""
                            ? <span className="italic text-muted-foreground">—</span>
                            : String(row[c])}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Showing first 10 rows</p>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <Button variant="ghost" onClick={onBack} className="sm:w-auto">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <Button onClick={onNext} disabled={!value} variant="accent" size="lg" className="sm:w-auto">
          Continue to mapping <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}