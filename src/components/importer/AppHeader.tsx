import { Flame, History, Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useFirebase } from "@/contexts/FirebaseContext";

type Props = {
  onOpenHistory: () => void;
};

export function AppHeader({ onOpenHistory }: Props) {
  const { connected, config, disconnect } = useFirebase();
  return (
    <header className="sticky top-0 z-20 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <Flame className="h-4 w-4" />
          </div>
          <div>
            <h1 className="font-heading text-base font-semibold leading-tight">Firebase Data Importer</h1>
            <p className="text-xs text-muted-foreground leading-tight">
              Bulk CSV / Excel → Firestore, with type safety and revert.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {connected && config && (
            <Badge variant="outline" className="hidden gap-1.5 font-mono text-[10px] sm:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" /> {config.projectId}
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
      </div>
    </header>
  );
}