import { Check, Link2, Database, ArrowRightLeft, Upload, PlayCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ComponentType } from "react";

type StepDef = {
  id: number;
  label: string;
  icon: ComponentType<{ className?: string }>;
  colorVar: string;
};

const STEPS: StepDef[] = [
  { id: 1, label: "Connect", icon: Link2, colorVar: "--step-connect" },
  { id: 2, label: "Browse", icon: Database, colorVar: "--step-browse" },
  { id: 3, label: "Upload", icon: Upload, colorVar: "--step-upload" },
  { id: 4, label: "Map", icon: ArrowRightLeft, colorVar: "--step-map" },
  { id: 5, label: "Import", icon: PlayCircle, colorVar: "--step-import" },
];

type Props = { current: number; connected: boolean };

export function Stepper({ current, connected }: Props) {
  return (
    <ol className="flex w-full items-start gap-0 overflow-x-auto pb-1 sm:justify-between">
      {STEPS.map((step, idx) => {
        const state: "done" | "active" | "upcoming" =
          step.id === 1 && connected && current > 1
            ? "done"
            : current > step.id
            ? "done"
            : current === step.id
            ? "active"
            : "upcoming";
        const color = `hsl(var(${step.colorVar}))`;
        const isLast = idx === STEPS.length - 1;
        const Icon = state === "done" ? Check : step.icon;
        return (
          <li key={step.id} className="flex flex-1 min-w-0 items-start">
            <div className="flex min-w-[4.25rem] flex-col items-center gap-1.5 sm:min-w-[5rem]">
              <div className="relative">
                {state === "active" && (
                  <span
                    aria-hidden
                    className="absolute inset-0 animate-pulse-ring rounded-full"
                    style={{ backgroundColor: color, opacity: 0.35 }}
                  />
                )}
                <div
                  className={cn(
                    "relative z-10 flex h-11 w-11 items-center justify-center rounded-full border-2 shadow-sm transition-all sm:h-14 sm:w-14",
                    state === "active" && "scale-105 shadow-md"
                  )}
                  style={
                    state === "upcoming"
                      ? {
                          borderColor: "hsl(var(--border))",
                          backgroundColor: "hsl(var(--card))",
                          color: "hsl(var(--muted-foreground))",
                        }
                      : { borderColor: color, backgroundColor: color, color: "white" }
                  }
                >
                  <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                </div>
              </div>
              <span
                className={cn(
                  "whitespace-nowrap text-[11px] font-medium sm:text-xs",
                  state === "upcoming" && "text-muted-foreground"
                )}
                style={state === "active" ? { color } : undefined}
              >
                {step.label}
              </span>
            </div>
            {!isLast && (
              <div className="flex-1 pt-5 sm:pt-7">
                <svg width="100%" height="4" className="overflow-visible" preserveAspectRatio="none">
                  <line
                    x1="0"
                    y1="2"
                    x2="100%"
                    y2="2"
                    stroke={state === "done" ? color : "hsl(var(--border))"}
                    strokeWidth="2"
                    strokeDasharray="4 4"
                    strokeLinecap="round"
                    className={state === "active" ? "animate-dash-flow" : ""}
                  />
                </svg>
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
