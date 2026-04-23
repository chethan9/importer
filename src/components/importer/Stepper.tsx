import { Check, Link2, Database, Upload, ArrowRightLeft, PlayCircle } from "lucide-react";
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
    <ol className="flex items-center gap-1.5 sm:gap-2">
      {STEPS.map((s, i) => {
        const isDone = s.n < current || (s.n === 1 && connected && current > 1);
        const isActive = s.n === current;
        const { Icon } = s;
        return (
          <li key={s.n} className="flex items-center gap-1.5 sm:gap-2">
            <div
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-medium transition-colors",
                isDone && "border-accent bg-accent text-accent-foreground",
                isActive && !isDone && "border-primary bg-primary text-primary-foreground",
                !isActive && !isDone && "border-border bg-muted text-muted-foreground",
              )}
            >
              {isDone ? <Check className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
            </div>
            <span
              className={cn(
                "hidden text-xs font-medium sm:inline",
                isActive ? "text-foreground" : isDone ? "text-foreground/70" : "text-muted-foreground",
              )}
            >
              {s.label}
            </span>
            {i < STEPS.length - 1 && <span className="h-px w-4 bg-border sm:w-6" />}
          </li>
        );
      })}
    </ol>
  );
}