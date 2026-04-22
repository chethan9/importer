import {
  Flame,
  History,
  Power,
  Link2,
  Database,
  Upload,
  ArrowRightLeft,
  PlayCircle,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { useFirebase } from "@/contexts/FirebaseContext";

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

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <div className="flex items-center gap-2 px-1 py-1.5">
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white shadow-sm"
              style={{ backgroundColor: "hsl(var(--primary))" }}
            >
              <Flame className="h-4 w-4" />
            </div>
            <div className="min-w-0 group-data-[collapsible=icon]:hidden">
              <div className="truncate font-heading text-sm font-bold leading-tight">Firebase Importer</div>
              {connected && config ? (
                <div className="truncate font-mono text-[10px] text-muted-foreground">{config.projectId}</div>
              ) : (
                <div className="text-[10px] text-muted-foreground">Not connected</div>
              )}
            </div>
          </div>
        </SidebarHeader>
        <SidebarSeparator />
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {NAV.map((n) => {
                  const isActive = step === n.id;
                  const isDone = step > n.id;
                  const isReachable = n.id === 1 || connected;
                  const Icon = n.icon;
                  return (
                    <SidebarMenuItem key={n.id}>
                      <SidebarMenuButton
                        isActive={isActive}
                        tooltip={n.label}
                        disabled={!isReachable}
                        onClick={() => {
                          if (isReachable) setStep(n.id);
                        }}
                        style={isActive ? { color: "hsl(var(" + n.color + "))" } : undefined}
                      >
                        <Icon
                          className="h-4 w-4"
                          style={
                            isActive || isDone
                              ? { color: "hsl(var(" + n.color + "))" }
                              : undefined
                          }
                        />
                        <span>{n.label}</span>
                        {isDone && (
                          <span
                            className="ml-auto h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: "hsl(var(" + n.color + "))" }}
                          />
                        )}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton tooltip="History" onClick={onOpenHistory}>
                <History className="h-4 w-4" />
                <span>History</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            {connected && (
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="Disconnect"
                  onClick={disconnect}
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <Power className="h-4 w-4" />
                  <span>Disconnect</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-40 flex h-12 shrink-0 items-center gap-2 border-b bg-background px-3">
          <SidebarTrigger />
          <div className="flex items-center gap-2 md:hidden">
            <div
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white"
              style={{ backgroundColor: "hsl(var(--primary))" }}
            >
              <Flame className="h-4 w-4" />
            </div>
            <div className="truncate font-heading text-sm font-bold">Firebase Importer</div>
          </div>
        </header>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}