import { useState } from "react";
import {
  ChevronRight,
  ChevronDown,
  Trash2,
  Plus,
  X,
  Columns3,
  Lock,
  Hash,
  MinusCircle,
  Braces,
  CornerDownRight,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { FIRESTORE_TYPES, type FirestoreType, type ArrayElementType } from "@/lib/coerce";
import type { FieldNode, LeafNode, MapNode, Source } from "@/lib/mappingTree";

type Props = {
  node: FieldNode;
  depth: number;
  sampleRow: Record<string, unknown>;
  onNameChange: (id: string, name: string) => void;
  onLeafChange: (id: string, patch: Partial<Omit<LeafNode, "kind" | "id">>) => void;
  onConvertToMap: (id: string) => void;
  onConvertToLeaf: (id: string) => void;
  onRemove: (id: string) => void;
  onAddChild: (parentId: string) => void;
  onAddChildMap: (parentId: string) => void;
  onDropColumn: (leafId: string, column: string) => void;
};

export function FieldTreeNode(props: Props) {
  const { node } = props;
  if (node.kind === "map") return <MapNodeRow {...props} node={node} />;
  return <LeafNodeRow {...props} node={node} />;
}

function MapNodeRow(props: Props & { node: MapNode }) {
  const { node, depth, onNameChange, onRemove, onAddChild, onAddChildMap, onConvertToLeaf } = props;
  const [open, setOpen] = useState(true);

  return (
    <div className="group/map">
      <div
        className="flex items-center gap-2 rounded-md py-1.5 pr-2 transition-colors hover:bg-muted/40"
        style={{ paddingLeft: 8 + depth * 18 }}
      >
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex h-5 w-5 items-center justify-center rounded hover:bg-muted"
          aria-label={open ? "Collapse" : "Expand"}
        >
          {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>
        <Braces className="h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={node.name}
          onChange={(e) => onNameChange(node.id, e.target.value)}
          placeholder="mapField"
          className="h-7 w-48 border-transparent bg-transparent px-1.5 font-mono text-xs shadow-none focus-visible:border-border focus-visible:bg-background"
        />
        <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[9px] uppercase text-muted-foreground">
          map
        </span>
        <span className="text-[10px] text-muted-foreground">
          {node.children.length} field{node.children.length === 1 ? "" : "s"}
        </span>
        <div className="ml-auto flex items-center gap-0.5 opacity-0 transition-opacity group-hover/map:opacity-100">
          <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px]" onClick={() => onConvertToLeaf(node.id)}>
            make primitive
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => onRemove(node.id)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {open && (
        <div className="relative">
          <div
            className="absolute bottom-1 top-0 w-px bg-border"
            style={{ left: 8 + depth * 18 + 10 }}
            aria-hidden
          />
          {node.children.length === 0 && (
            <div className="py-1.5 text-[11px] text-muted-foreground/80" style={{ paddingLeft: 8 + (depth + 1) * 18 + 16 }}>
              No child fields yet.
            </div>
          )}
          {node.children.map((child) => (
            <FieldTreeNode key={child.id} {...props} node={child} depth={depth + 1} />
          ))}
          <div className="flex gap-1 py-1" style={{ paddingLeft: 8 + (depth + 1) * 18 }}>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-[11px] text-primary hover:bg-primary/5 hover:text-primary" onClick={() => onAddChild(node.id)}>
              <Plus className="mr-1 h-3 w-3" /> Add field
            </Button>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground" onClick={() => onAddChildMap(node.id)}>
              <Braces className="mr-1 h-3 w-3" /> Add map
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function LeafNodeRow(props: Props & { node: LeafNode }) {
  const { node, depth, sampleRow, onNameChange, onLeafChange, onRemove, onConvertToMap, onDropColumn } = props;
  const [dragOver, setDragOver] = useState(false);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const col = e.dataTransfer.getData("application/x-csv-column");
    if (col) onDropColumn(node.id, col);
  }

  return (
    <div
      className={cn(
        "group/leaf flex items-center gap-2 rounded-md border border-transparent py-1 pr-2 transition-colors hover:bg-muted/30",
        dragOver && "border-primary/60 bg-primary/5",
      )}
      style={{ paddingLeft: 8 + depth * 18 }}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("application/x-csv-column")) {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
          setDragOver(true);
        }
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      {depth > 0 && <CornerDownRight className="h-3 w-3 text-muted-foreground/60" />}
      <Input
        value={node.name}
        onChange={(e) => onNameChange(node.id, e.target.value)}
        placeholder="fieldName"
        className="h-7 w-40 border-transparent bg-transparent px-1.5 font-mono text-xs shadow-none focus-visible:border-border focus-visible:bg-background"
      />

      <Select
        value={node.firestoreType}
        onValueChange={(v) => onLeafChange(node.id, { firestoreType: v as FirestoreType })}
      >
        <SelectTrigger className="h-7 w-28 border-transparent px-1.5 text-[11px] hover:border-border">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {FIRESTORE_TYPES.filter((t) => t.value !== "map").map((t) => (
            <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {node.firestoreType === "array" && (
        <Select
          value={node.arrayElementType ?? "string"}
          onValueChange={(v) => onLeafChange(node.id, { arrayElementType: v as ArrayElementType })}
        >
          <SelectTrigger className="h-7 w-24 border-transparent px-1.5 text-[11px] hover:border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="string" className="text-xs">of String</SelectItem>
            <SelectItem value="number" className="text-xs">of Number</SelectItem>
            <SelectItem value="boolean" className="text-xs">of Boolean</SelectItem>
          </SelectContent>
        </Select>
      )}

      <span className="text-muted-foreground/60 text-xs">=</span>

      <div className="flex-1 min-w-0">
        <SourceEditor
          source={node.source}
          sampleRow={sampleRow}
          onChange={(s) => onLeafChange(node.id, { source: s })}
        />
      </div>

      <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover/leaf:opacity-100">
        <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px]" onClick={() => onConvertToMap(node.id)} title="Convert to nested map">
          <Braces className="h-3 w-3" />
        </Button>
        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => onRemove(node.id)}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function SourceEditor({
  source,
  sampleRow,
  onChange,
}: {
  source: Source;
  sampleRow: Record<string, unknown>;
  onChange: (s: Source) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Select
        value={source.kind}
        onValueChange={(v) => {
          const k = v as Source["kind"];
          if (k === source.kind) return;
          if (k === "column") onChange({ kind: "column", column: "" });
          else if (k === "fixed") onChange({ kind: "fixed", value: "" });
          else if (k === "autoIncrement") onChange({ kind: "autoIncrement", start: 1, step: 1 });
          else onChange({ kind: "skip" });
        }}
      >
        <SelectTrigger className="h-7 w-[34px] border-transparent px-1 hover:border-border [&>svg]:ml-0">
          <SourceKindIcon kind={source.kind} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="column" className="text-xs"><span className="inline-flex items-center gap-1.5"><Columns3 className="h-3 w-3" /> CSV column</span></SelectItem>
          <SelectItem value="fixed" className="text-xs"><span className="inline-flex items-center gap-1.5"><Lock className="h-3 w-3" /> Fixed value</span></SelectItem>
          <SelectItem value="autoIncrement" className="text-xs"><span className="inline-flex items-center gap-1.5"><Hash className="h-3 w-3" /> Auto-increment</span></SelectItem>
          <SelectItem value="skip" className="text-xs"><span className="inline-flex items-center gap-1.5 text-muted-foreground"><MinusCircle className="h-3 w-3" /> Skip</span></SelectItem>
        </SelectContent>
      </Select>

      {source.kind === "column" && (
        <ColumnBinding column={source.column} sample={source.column ? sampleRow[source.column] : undefined} onUnbind={() => onChange({ kind: "skip" })} />
      )}
      {source.kind === "fixed" && (
        <Input
          value={source.value}
          onChange={(e) => onChange({ kind: "fixed", value: e.target.value })}
          placeholder="Fixed value for every doc"
          className="h-7 flex-1 font-mono text-xs"
        />
      )}
      {source.kind === "autoIncrement" && (
        <div className="flex items-center gap-1.5 font-mono text-[11px]">
          <span className="text-muted-foreground">start</span>
          <Input
            type="number"
            value={source.start}
            onChange={(e) => onChange({ ...source, start: Number(e.target.value) || 0 })}
            className="h-7 w-16 font-mono text-xs"
          />
          <span className="text-muted-foreground">step</span>
          <Input
            type="number"
            value={source.step}
            onChange={(e) => onChange({ ...source, step: Number(e.target.value) || 1 })}
            className="h-7 w-16 font-mono text-xs"
          />
          <span className="text-muted-foreground/70">→ {source.start}, {source.start + source.step}, {source.start + source.step * 2}…</span>
        </div>
      )}
      {source.kind === "skip" && (
        <div className="flex-1 rounded border border-dashed border-border/80 px-2 py-1 text-[11px] italic text-muted-foreground/80">
          drop a column here, or pick a source ←
        </div>
      )}
    </div>
  );
}

function ColumnBinding({ column, sample, onUnbind }: { column: string; sample: unknown; onUnbind: () => void }) {
  if (!column) {
    return (
      <div className="flex-1 rounded border border-dashed border-primary/40 px-2 py-1 text-[11px] italic text-primary/70">
        drop a CSV column here
      </div>
    );
  }
  const sampleStr = sample === null || sample === undefined || sample === "" ? "" : String(sample);
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 font-mono text-[11px] text-accent">
      <Columns3 className="h-3 w-3" />
      <span className="truncate max-w-[160px]">{column}</span>
      {sampleStr && (
        <span className="hidden truncate max-w-[120px] text-accent/70 md:inline">· {sampleStr.length > 20 ? sampleStr.slice(0, 20) + "…" : sampleStr}</span>
      )}
      <button onClick={onUnbind} className="rounded-full p-0.5 hover:bg-accent/20" aria-label="Unbind">
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

function SourceKindIcon({ kind }: { kind: Source["kind"] }) {
  switch (kind) {
    case "column": return <Columns3 className="h-3.5 w-3.5 text-accent" />;
    case "fixed": return <Lock className="h-3.5 w-3.5 text-primary" />;
    case "autoIncrement": return <Hash className="h-3.5 w-3.5 text-primary" />;
    default: return <MinusCircle className="h-3.5 w-3.5 text-muted-foreground" />;
  }
}