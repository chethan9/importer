import { GripVertical, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FirestoreType } from "@/lib/coerce";

type Props = {
  columns: string[];
  inferredTypes: Record<string, FirestoreType>;
  boundColumns: Set<string>;
  sampleRow: Record<string, unknown>;
};

export function ColumnPalette({ columns, inferredTypes, boundColumns, sampleRow }: Props) {
  const unmapped = columns.filter((c) => !boundColumns.has(c));
  const mapped = columns.filter((c) => boundColumns.has(c));

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-2 flex items-center justify-between px-1">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            CSV columns
          </h3>
          <span className="font-mono text-[10px] text-muted-foreground">
            {mapped.length}/{columns.length} mapped
          </span>
        </div>
        <p className="px-1 text-[11px] text-muted-foreground">
          Drag a pill onto a Firestore field on the right.
        </p>
      </div>

      {unmapped.length > 0 && (
        <div>
          <div className="mb-1.5 px-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Unmapped ({unmapped.length})
          </div>
          <div className="flex flex-wrap gap-1.5">
            {unmapped.map((col) => (
              <ColumnChip key={col} column={col} type={inferredTypes[col]} sample={sampleRow[col]} bound={false} />
            ))}
          </div>
        </div>
      )}

      {mapped.length > 0 && (
        <div>
          <div className="mb-1.5 px-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Mapped
          </div>
          <div className="flex flex-wrap gap-1.5">
            {mapped.map((col) => (
              <ColumnChip key={col} column={col} type={inferredTypes[col]} sample={sampleRow[col]} bound />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ColumnChip({
  column,
  type,
  sample,
  bound,
}: {
  column: string;
  type?: FirestoreType;
  sample: unknown;
  bound: boolean;
}) {
  const sampleStr = formatSample(sample);
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("application/x-csv-column", column);
        e.dataTransfer.effectAllowed = "copy";
      }}
      className={cn(
        "group inline-flex max-w-full cursor-grab items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[11px] transition-all active:cursor-grabbing active:scale-95",
        bound
          ? "border-accent/40 bg-accent/10 text-accent"
          : "border-primary/30 bg-primary/5 text-primary hover:border-primary/60 hover:bg-primary/10 hover:shadow-sm",
      )}
      title={sampleStr ? `sample: ${sampleStr}` : column}
    >
      <GripVertical className="h-3 w-3 opacity-60 group-hover:opacity-100" />
      <span className="truncate max-w-[140px]">{column}</span>
      {type && (
        <span className="rounded bg-background/60 px-1 py-0.5 text-[9px] uppercase tracking-wide text-muted-foreground">
          {type}
        </span>
      )}
      {bound && <Check className="h-3 w-3" />}
    </div>
  );
}

function formatSample(v: unknown): string {
  if (v === null || v === undefined || v === "") return "";
  const s = String(v);
  return s.length > 24 ? s.slice(0, 24) + "…" : s;
}