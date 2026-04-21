import { useState } from "react";
import {
  Database,
  Plus,
  Loader2,
  X,
  ArrowRight,
  AlertCircle,
  FileCode2,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useFirebase, type CollectionInfo } from "@/contexts/FirebaseContext";
import { useToast } from "@/hooks/use-toast";
import type { FirestoreFieldType } from "@/lib/firebase";

const TYPE_COLORS: Record<FirestoreFieldType, string> = {
  string: "bg-blue-500/10 text-blue-700 ring-blue-500/20",
  number: "bg-violet-500/10 text-violet-700 ring-violet-500/20",
  boolean: "bg-amber-500/10 text-amber-700 ring-amber-500/20",
  timestamp: "bg-accent/10 text-accent ring-accent/20",
  geopoint: "bg-emerald-500/10 text-emerald-700 ring-emerald-500/20",
  reference: "bg-primary/10 text-primary ring-primary/20",
  array: "bg-fuchsia-500/10 text-fuchsia-700 ring-fuchsia-500/20",
  map: "bg-indigo-500/10 text-indigo-700 ring-indigo-500/20",
  null: "bg-muted text-muted-foreground ring-border",
  bytes: "bg-slate-500/10 text-slate-700 ring-slate-500/20",
};

export function BrowseStep() {
  const { collections, addCollection, removeCollection, selectCollection, selectedCollection, setStep } =
    useFirebase();
  const { toast } = useToast();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAdd = async () => {
    setError(null);
    const names = input
      .split(",")
      .map((n) => n.trim())
      .filter(Boolean);
    if (!names.length) return;
    setLoading(true);
    try {
      for (const n of names) {
        try {
          await addCollection(n);
        } catch (e) {
          const msg = (e as Error).message;
          toast({
            title: `Couldn't load "${n}"`,
            description: msg.includes("permission")
              ? "Permission denied — check your Firestore rules."
              : msg,
            variant: "destructive",
          });
        }
      }
      setInput("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const selected = collections.find((c) => c.name === selectedCollection);

  return (
    <div className="mx-auto w-full max-w-5xl animate-fade-in-up space-y-6 px-6 pb-16">
      <Card className="card-lift">
        <CardHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded bg-primary/10 text-primary ring-1 ring-primary/20">
              <Database className="h-3.5 w-3.5" />
            </div>
            <CardTitle className="text-xl">Browse collections</CardTitle>
          </div>
          <CardDescription>
            Firestore's Web SDK can&apos;t list collections automatically — add them by name. Schema
            is inferred from the first 20 docs.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              placeholder="e.g. users, products, orders"
              className="font-mono text-sm"
              disabled={loading}
            />
            <Button onClick={handleAdd} disabled={loading || !input.trim()} className="gap-1.5">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Add
            </Button>
          </div>
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {collections.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-muted/40 p-8 text-center">
              <Layers className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
              <p className="text-sm font-medium">No collections yet</p>
              <p className="text-xs text-muted-foreground">
                Add a collection name above to inspect its schema.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {collections.map((c) => (
                <CollectionCard
                  key={c.name}
                  info={c}
                  selected={selectedCollection === c.name}
                  onSelect={() => selectCollection(c.name)}
                  onRemove={() => removeCollection(c.name)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {selected && (
        <Card className="card-lift animate-fade-in-up">
          <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <FileCode2 className="h-4 w-4 text-accent" />
                <CardTitle className="font-mono text-lg">{selected.name}</CardTitle>
                <Badge variant="outline" className="font-mono text-[10px]">
                  {selected.docCount} sampled
                </Badge>
              </div>
              <CardDescription>
                {selected.fields.length} field{selected.fields.length === 1 ? "" : "s"} inferred
                from sample docs
              </CardDescription>
            </div>
            <Button
              size="sm"
              variant="default"
              onClick={() => setStep(3)}
              className="gap-1.5 bg-accent text-accent-foreground hover:bg-accent/90"
            >
              Continue to mapping
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </CardHeader>
          <CardContent>
            {selected.fields.length === 0 ? (
              <div className="rounded-md bg-muted/50 p-6 text-center text-sm text-muted-foreground">
                No documents found in this collection.
              </div>
            ) : (
              <div className="overflow-hidden rounded-md ring-1 ring-border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-[40%]">Field</TableHead>
                      <TableHead className="w-[20%]">Type</TableHead>
                      <TableHead>Sample</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selected.fields.map((f) => (
                      <TableRow key={f.name}>
                        <TableCell className="font-mono text-xs">{f.name}</TableCell>
                        <TableCell>
                          <span
                            className={cn(
                              "inline-flex items-center rounded px-1.5 py-0.5 font-mono text-[10px] ring-1",
                              TYPE_COLORS[f.type],
                            )}
                          >
                            {f.type}
                          </span>
                        </TableCell>
                        <TableCell className="max-w-[320px] truncate font-mono text-xs text-muted-foreground">
                          {formatSample(f.sample)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function CollectionCard({
  info,
  selected,
  onSelect,
  onRemove,
}: {
  info: CollectionInfo;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "group relative rounded-lg border bg-card p-4 text-left transition-all hover:shadow-md",
        selected
          ? "border-primary ring-2 ring-primary/30 shadow-sm"
          : "border-border hover:border-primary/40",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-mono text-sm font-medium">{info.name}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {info.docCount} docs · {info.fields.length} fields
          </div>
        </div>
        <span
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="rounded p-1 text-muted-foreground opacity-0 transition hover:bg-muted hover:text-destructive group-hover:opacity-100"
          role="button"
          aria-label="Remove"
        >
          <X className="h-3.5 w-3.5" />
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-1">
        {info.fields.slice(0, 6).map((f) => (
          <span key={f.name} className="field-chip">
            {f.name}
          </span>
        ))}
        {info.fields.length > 6 && (
          <span className="field-chip bg-transparent">+{info.fields.length - 6}</span>
        )}
      </div>
    </button>
  );
}

function formatSample(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") return v.length > 60 ? `"${v.slice(0, 60)}…"` : `"${v}"`;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return `[${v.length} items]`;
  try {
    const s = JSON.stringify(v);
    return s.length > 60 ? `${s.slice(0, 60)}…` : s;
  } catch {
    return String(v);
  }
}