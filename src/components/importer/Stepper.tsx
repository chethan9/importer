import { Check, Link2, Database, ArrowRightLeft, Upload } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { id: 1, label: "Connect", icon: Link2 },
  { id: 2, label: "Browse", icon: Database },
  { id: 3, label: "Map", icon: ArrowRightLeft },
  { id: 4, label: "Import", icon: Upload },
];

export function Stepper({ current }: { current: number }) {
  return (
    <ol className="mx-auto flex max-w-3xl items-center gap-2 px-6 py-6">
      {STEPS.map((s, idx) => {
        const Icon = s.icon;
        const done = current > s.id;
        const active = current === s.id;
        return (
          <li key={s.id} className="flex flex-1 items-center gap-2">
            <div className="flex items-center gap-2.5">
              <div
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full ring-1 transition-all",
                  done && "bg-accent text-accent-foreground ring-accent",
                  active &&
                    "bg-primary text-primary-foreground ring-primary shadow-sm shadow-primary/30",
                  !done && !active && "bg-muted text-muted-foreground ring-border",
                )}
              >
                {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              </div>
              <div className="flex flex-col leading-tight">
                <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                  Step {s.id}
                </span>
                <span
                  className={cn(
                    "text-sm font-medium",
                    (active || done) ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {s.label}
                </span>
              </div>
            </div>
            {idx < STEPS.length - 1 && (
              <div
                className={cn(
                  "mx-1 h-px flex-1 transition-colors",
                  done ? "bg-accent" : "bg-border",
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}