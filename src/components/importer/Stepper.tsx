import { Check, ChevronRight, Link2, Database, Upload, ArrowRightLeft, PlayCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = { current: number; connected: boolean };

const STEPS = [
  { n: 1, label: "Connect", Icon: Link2 },
  { n: 2, label: "Browse", Icon: Database },
  { n: 3, label: "Upload", Icon: Upload },
  { n: 4, label: "Map", Icon: ArrowRightLeft },
  { n: 5, label: "Import", Icon: PlayCircle },
];

export function Stepper({ current, connected }: Props) {
  return (
    <ol className="flex flex-wrap items-center justify-center gap-x-1 gap-y-2 sm:justify-start">
      {STEPS.map((s, i) => {
        const isDone = s.n < current || (s.n === 1 && connected && current > 1);
        const isActive = s.n === current;
        const { Icon } = s;
        return (
          <li key={s.n} className="flex items-center gap-1 sm:gap-2">
            <div
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-medium shadow-sm transition-all duration-200",
                isDone && "border-emerald-600/90 bg-emerald-600 text-white dark:bg-emerald-700 dark:border-emerald-700",
                isActive &&
                  !isDone &&
                  "border-foreground bg-foreground text-background ring-2 ring-border ring-offset-2 ring-offset-background",
                !isActive && !isDone && "border-border bg-muted/80 text-muted-foreground",
              )}
            >
              {isDone ? <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> : <Icon className="h-3.5 w-3.5" />}
            </div>
            <span
              className={cn(
                "hidden text-xs font-medium md:inline",
                isActive ? "text-foreground" : isDone ? "text-foreground/75" : "text-muted-foreground",
              )}
            >
              {s.label}
            </span>
            {i < STEPS.length - 1 && (
              <ChevronRight
                className="mx-0.5 hidden h-4 w-4 shrink-0 text-muted-foreground/45 sm:block"
                aria-hidden
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}