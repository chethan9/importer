import { FileSpreadsheet, Zap, Database, CheckCircle2 } from "lucide-react";
import type { CSSProperties } from "react";

type Phase = "idle" | "running" | "done" | "failed";

type Props = {
  phase: Phase;
  rowsPerSec: number;
  successCount: number;
  errorCount: number;
  totalRows: number;
  batchInfo: { current: number; total: number } | null;
};

export function ImportPipeline({ phase, rowsPerSec, successCount, errorCount, totalRows, batchInfo }: Props) {
  const isRunning = phase === "running";
  const isDone = phase === "done";
  const isFailed = phase === "failed";
  const idle = phase === "idle";

  return (
    <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-card via-card to-muted/40 p-4 shadow-sm sm:p-6">
      <div className="overflow-x-auto">
        <div className="flex min-w-max items-center gap-3 sm:gap-4">
          <PipelineNode
            icon={FileSpreadsheet}
            label="Source file"
            sublabel={`${totalRows.toLocaleString()} rows`}
            colorVar="--primary"
            pulsing={false}
          />
          <Connector flowing={isRunning} failed={isFailed} colorVar="--primary" />
          <PipelineNode
            icon={Zap}
            label="Transform"
            sublabel={batchInfo ? `Batch ${batchInfo.current}/${batchInfo.total}` : idle ? "Ready" : isDone ? "Complete" : isFailed ? "Paused" : "Working"}
            colorVar="--primary"
            pulsing={isRunning}
          />
          <Connector flowing={isRunning} failed={isFailed} colorVar="--primary" />
          <div className="flex items-center gap-3">
            <div className="relative">
              <PipelineNode
                icon={Database}
                label="Firestore"
                sublabel={`${successCount.toLocaleString()} written${errorCount > 0 ? ` · ${errorCount}✗` : ""}`}
                colorVar="--primary"
                pulsing={isRunning}
              />
              {isDone && (
                <div className="absolute -right-1 -top-1 animate-scale-in">
                  <div className="rounded-full bg-background p-0.5 shadow-md">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                  </div>
                </div>
              )}
            </div>
            {(isRunning || isDone) && <RowsPerSecGauge value={rowsPerSec} />}
          </div>
        </div>
      </div>
    </div>
  );
}

function PipelineNode({
  icon: Icon,
  label,
  sublabel,
  colorVar,
  pulsing,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  sublabel: string;
  colorVar: string;
  pulsing: boolean;
}) {
  return (
    <div className="flex flex-shrink-0 flex-col items-center gap-1.5">
      <div className="relative">
        {pulsing && (
          <span
            aria-hidden
            className="absolute inset-0 -m-1.5 rounded-full animate-pulse-ring"
            style={{ backgroundColor: `hsl(var(${colorVar}) / 0.35)` }}
          />
        )}
        <div
          className="relative z-10 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-md sm:h-16 sm:w-16"
          style={{ backgroundColor: `hsl(var(${colorVar}))` }}
        >
          <Icon className="h-6 w-6 sm:h-7 sm:w-7" />
        </div>
      </div>
      <div className="text-center">
        <div className="text-xs font-semibold sm:text-sm">{label}</div>
        <div className="font-mono text-[10px] text-muted-foreground">{sublabel}</div>
      </div>
    </div>
  );
}

function Connector({ flowing, failed, colorVar }: { flowing: boolean; failed: boolean; colorVar: string }) {
  const color = failed ? "--destructive" : colorVar;
  return (
    <div className="relative flex h-16 w-16 flex-shrink-0 items-center sm:w-24" aria-hidden>
      <svg width="100%" height="12" viewBox="0 0 100 12" preserveAspectRatio="none" className="overflow-visible">
        <line
          x1="0"
          y1="6"
          x2="100"
          y2="6"
          stroke={`hsl(var(${color}))`}
          strokeWidth="2"
          strokeDasharray="4 4"
          strokeLinecap="round"
          className={flowing ? "animate-dash-flow" : ""}
          style={failed ? { opacity: 0.4 } : undefined}
        />
        {flowing && (
          <circle
            r="3"
            cy="6"
            fill={`hsl(var(${color}))`}
            className="animate-particle-travel"
            style={{ "--travel-distance": "100px" } as CSSProperties}
          />
        )}
      </svg>
    </div>
  );
}

function RowsPerSecGauge({ value }: { value: number }) {
  const max = 500;
  const pct = Math.min(Math.max(value, 0) / max, 1);
  const radius = 22;
  const circ = 2 * Math.PI * radius;
  const dashOffset = circ * (1 - pct);
  return (
    <div className="relative flex h-14 w-14 flex-shrink-0 items-center justify-center sm:h-16 sm:w-16">
      <svg width="100%" height="100%" viewBox="0 0 56 56" className="-rotate-90">
        <circle cx="28" cy="28" r={radius} fill="none" stroke="hsl(var(--muted))" strokeWidth="4" />
        <circle
          cx="28"
          cy="28"
          r={radius}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={dashOffset}
          style={{ transition: "stroke-dashoffset 500ms ease-out" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center leading-none">
        <span className="font-mono text-xs font-bold tabular-nums">{value}</span>
        <span className="text-[8px] text-muted-foreground">rows/s</span>
      </div>
    </div>
  );
}
