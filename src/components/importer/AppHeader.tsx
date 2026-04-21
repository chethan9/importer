import { Flame, Github, Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useFirebase } from "@/contexts/FirebaseContext";

export function AppHeader() {
  const { connected, config, disconnect } = useFirebase();
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/80 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/40">
            <Flame className="h-5 w-5" strokeWidth={2.2} />
          </div>
          <div className="leading-tight">
            <div className="font-display text-base font-semibold">Firestore Importer</div>
            <div className="text-xs text-muted-foreground">
              Bulk CSV / Excel → Firestore, with revert
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {connected && config && (
            <Badge
              variant="outline"
              className="gap-1.5 border-accent/30 bg-accent/10 font-mono text-xs text-accent"
            >
              <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-accent" />
              {config.projectId}
            </Badge>
          )}
          {connected && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void disconnect()}
              className="gap-1.5 text-muted-foreground hover:text-destructive"
            >
              <Power className="h-3.5 w-3.5" />
              Disconnect
            </Button>
          )}
          <a
            href="https://firebase.google.com/docs/web/setup#config-object"
            target="_blank"
            rel="noreferrer"
            className="text-muted-foreground transition hover:text-foreground"
            aria-label="Firebase docs"
          >
            <Github className="h-4 w-4" />
          </a>
        </div>
      </div>
    </header>
  );
}