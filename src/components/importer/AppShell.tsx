import { History, Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Stepper } from "@/components/importer/Stepper";
import { ImageStorageTool } from "@/components/importer/ImageStorageTool";
import { useFirebase } from "@/contexts/FirebaseContext";

type Props = { onOpenHistory: () => void; children: React.ReactNode };

export function AppShell({ onOpenHistory, children }: Props) {
  const { connected, config, step, disconnect } = useFirebase();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-3 py-3 sm:px-6">
          <div className="hidden min-w-0 flex-col sm:flex">
            {connected && config ? (
              <>
                <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" title="Connected" aria-hidden />
                  Project
                </span>
                <span className="truncate font-mono text-xs font-medium">{config.projectId}</span>
              </>
            ) : (
              <span className="text-xs text-muted-foreground">Not connected</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <Stepper current={step} connected={connected} />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ImageStorageTool />
            <Button variant="ghost" size="sm" onClick={onOpenHistory} className="gap-1.5">
              <History className="h-4 w-4" />
              <span className="hidden sm:inline">History</span>
            </Button>
            {connected && (
              <Button
                variant="ghost"
                size="sm"
                onClick={disconnect}
                className="gap-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Power className="h-4 w-4" />
                <span className="hidden sm:inline">Disconnect</span>
              </Button>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl">{children}</main>
    </div>
  );
}