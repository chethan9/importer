import { Flame, History, Power, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter } from "@/components/ui/sheet";
import { useFirebase } from "@/contexts/FirebaseContext";

type Props = { onOpenHistory: () => void };

export function AppHeader({ onOpenHistory }: Props) {
  const { connected, config, disconnect } = useFirebase();

  return (
    <header className="border-b bg-card/80 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm sm:h-10 sm:w-10">
            <Flame className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate font-heading text-base font-semibold sm:text-lg">Firebase Data Importer</h1>
            <p className="hidden text-xs text-muted-foreground sm:block">
              Bulk CSV / Excel &rarr; Firestore, with type safety and revert.
            </p>
          </div>
        </div>

        <div className="hidden items-center gap-2 sm:flex">
          {connected && config && (
            <Badge variant="outline" className="max-w-[180px] truncate font-mono text-[10px]">
              {config.projectId}
            </Badge>
          )}
          <Button variant="ghost" size="sm" onClick={onOpenHistory}>
            <History className="mr-1.5 h-4 w-4" /> History
          </Button>
          {connected && (
            <Button variant="outline" size="sm" onClick={disconnect}>
              <Power className="mr-1.5 h-4 w-4" /> Disconnect
            </Button>
          )}
        </div>

        <div className="sm:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetHeader>
                <SheetTitle className="text-left">Menu</SheetTitle>
              </SheetHeader>
              <div className="mt-4 flex flex-col gap-2">
                {connected && config && (
                  <div className="rounded-md border bg-muted/30 p-3">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Connected project</div>
                    <div className="mt-0.5 truncate font-mono text-xs">{config.projectId}</div>
                  </div>
                )}
                <Button variant="ghost" className="justify-start" onClick={onOpenHistory}>
                  <History className="mr-2 h-4 w-4" /> Import history
                </Button>
              </div>
              <SheetFooter className="mt-4">
                {connected && (
                  <Button variant="outline" className="w-full" onClick={disconnect}>
                    <Power className="mr-2 h-4 w-4" /> Disconnect
                  </Button>
                )}
              </SheetFooter>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
