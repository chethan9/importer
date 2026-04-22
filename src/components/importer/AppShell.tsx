import { useState } from "react";
import { Flame, History, Power, Menu, Link2, Database, Upload, ArrowRightLeft, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useFirebase } from "@/contexts/FirebaseContext";
import { cn } from "@/lib/utils";

type Props = { onOpenHistory: () => void; children: React.ReactNode };

const NAV = [
  { id: 1, label: "Connect", icon: Link2, color: "--step-connect" },
  { id: 2, label: "Browse", icon: Database, color: "--step-browse" },
  { id: 3, label: "Upload", icon: Upload, color: "--step-upload" },
  { id: 4, label: "Map", icon: ArrowRightLeft, color: "--step-map" },
  { id: 5, label: "Import", icon: PlayCircle, color: "--step-import" },
];

export function AppShell({ onOpenHistory, children }: Props) {
  const { connected, config, step, setStep, disconnect } = useFirebase();
  const [mobileOpen, setMobileOpen] = useState(false);

  function SidebarBody({ onNav }: { onNav?: () => void }) {
    return (
      <>
        <div className="flex items-center gap-2 border-b px-3 py-4">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white shadow-sm"
            style={{ backgroundColor: "hsl(var(--primary))" }}
          >
            <Flame className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="truncate font-heading text-sm font-bold">Firebase Importer</div>
            {connected && config && (
              <div className="truncate font-mono text-[10px] text-muted-foreground">{config.projectId}</div>
            )}
          </div>
        </div>

        <nav className="flex flex-col gap-1 p-2">
          {NAV.map((n) => {
            const isActive = step === n.id;
            const isDone = step > n.id;
            const isReachable = n.id === 1 || connected;
            const Icon = n.icon;
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => {
                  if (isReachable) {
                    setStep(n.id);
                    onNav?.();
                  }
                }}
                disabled={!isReachable}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors",
                  isActive && "shadow-sm",
                  !isActive && isReachable && "text-foreground hover:bg-muted",
                  !isReachable && "cursor-not-allowed text-muted-foreground opacity-50",
                )}
                style={
                  isActive
                    ? { backgroundColor: `hsl(var(${n.color}) / 0.15)`, color: `hsl(var(${n.color}))` }
                    : undefined
                }
              >
                <Icon
                  className="h-4 w-4 shrink-0"
                  style={isActive || isDone ? { color: `hsl(var(${n.color}))` } : undefined}
                />
                <span className="flex-1 truncate">{n.label}</span>
                {isDone && (
                  <div
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: `hsl(var(${n.color}))` }}
                  />
                )}
              </button>
            );
          })}
        </nav>

        <div className="mt-auto flex flex-col gap-1 border-t p-2">
          <button
            type="button"
            onClick={() => {
              onOpenHistory();
              onNav?.();
            }}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-muted"
          >
            <History className="h-4 w-4 shrink-0" />
            <span>History</span>
          </button>
          {connected && (
            <button
              type="button"
              onClick={() => {
                disconnect();
                onNav?.();
              }}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
            >
              <Power className="h-4 w-4 shrink-0" />
              <span>Disconnect</span>
            </button>
          )}
        </div>
      </>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="sticky top-0 hidden h-screen w-56 flex-col border-r bg-card/50 md:flex">
        <SidebarBody />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex items-center gap-2 border-b bg-card/80 px-3 py-2 backdrop-blur md:hidden">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="flex w-64 flex-col p-0">
              <SheetHeader className="sr-only">
                <SheetTitle>Navigation</SheetTitle>
              </SheetHeader>
              <SidebarBody onNav={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>
          <div className="flex items-center gap-2">
            <div
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white"
              style={{ backgroundColor: "hsl(var(--primary))" }}
            >
              <Flame className="h-4 w-4" />
            </div>
            <div className="truncate font-heading text-sm font-bold">Firebase Importer</div>
          </div>
        </header>

        <main className="min-w-0 flex-1 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}