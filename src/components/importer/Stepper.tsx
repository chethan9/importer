import { Check, Link2, Database, ArrowRightLeft, Upload, PlayCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type StepDef = { id: number; label: string; icon: typeof Check };

const STEPS: StepDef[] = [
  { id: 1, label: "Connect", icon: Link2 },
  { id: 2, label: "Browse", icon: Database },
  { id: 3, label: "Upload", icon: Upload },
  { id: 4, label: "Map", icon: ArrowRightLeft },
  { id: 5, label: "Import", icon: PlayCircle },
];

type Props = {
  current: number;
  connected: boolean;
};

export function Stepper({ current, connected }: Props) {
  return (
    <ol className="flex items-center gap-1 overflow-x-auto py-1">
      {STEPS.map((s, idx) => {
        const isDone = current > s.id || (s.id === 1 && connected && current > 1);
        const isActive = current === s.id;
        const Icon = isDone ? Check : s.icon;
        return (
          <li key={s.id} className="flex items-center gap-1">
            <div
              className={cn(
                "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                isActive && "border-primary bg-primary text-primary-foreground shadow-sm",
                isDone && !isActive && "border-accent/40 bg-accent/10 text-accent",
                !isActive && !isDone && "border-border/70 bg-card text-muted-foreground",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="whitespace-nowrap">{s.label}</span>
            </div>
            {idx < STEPS.length - 1 && (
              <div
                className={cn(
                  "h-px w-6 transition-colors",
                  current > s.id ? "bg-accent/60" : "bg-border",
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}