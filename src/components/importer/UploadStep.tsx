import { useRef, useState } from "react";
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

export function UploadStep({ value, onChange, onBack, onNext, collectionName }: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

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
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-2xl font-semibold">Upload source file</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          CSV, TSV or Excel. Rows will be imported into{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{collectionName}</code>.
        </p>
      </div>

      {!value ? (
        <Card
          className={`border-dashed transition-colors ${isDragging ? "border-primary bg-primary/5" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            const f = e.dataTransfer.files[0];
            if (f) handleFile(f);
          }}
        >
          <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <Upload className="h-6 w-6 text-primary" />
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
        <Card>
          <CardHeader className="flex flex-row items-start justify-between space-y-0">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
                <FileSpreadsheet className="h-5 w-5 text-accent" />
              </div>
              <div>
                <CardTitle className="font-mono text-base">{value.fileName}</CardTitle>
                <CardDescription>
                  {value.rows.length} rows · {value.columns.length} columns
                </CardDescription>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => onChange(null)}>
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
                <TableHeader className="sticky top-0 bg-muted/50">
                  <TableRow>
                    {value.columns.map((c) => (
                      <TableHead key={c} className="font-mono text-xs whitespace-nowrap">
                        {c}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {value.rows.slice(0, 10).map((row, i) => (
                    <TableRow key={i}>
                      {value.columns.map((c) => (
                        <TableCell key={c} className="font-mono text-xs whitespace-nowrap max-w-[200px] truncate">
                          {row[c] === null || row[c] === undefined || row[c] === ""
                            ? <span className="text-muted-foreground italic">—</span>
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

      <div className="flex justify-between">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <Button onClick={onNext} disabled={!value}>
          Continue to mapping <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}