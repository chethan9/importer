import { useState, useRef } from "react";
import { ImageUp, Loader2, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFirebase } from "@/contexts/FirebaseContext";
import {
  uploadSourceUrlViaWeb,
  uploadSourceUrlViaAdmin,
  uploadLocalFileViaWeb,
  uploadLocalFileViaAdmin,
} from "@/lib/imageImport";
import { useToast } from "@/hooks/use-toast";

export function ImageStorageTool() {
  const { connected, authMode, app, config, serviceAccount } = useFirebase();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const canUpload =
    connected &&
    (authMode === "admin" ? !!serviceAccount : !!(app && config?.projectId));

  async function handleUrlUpload() {
    const raw = urlInput.trim();
    if (!raw) {
      toast({ title: "Paste a URL", variant: "destructive" });
      return;
    }
    setLoading(true);
    setError(null);
    setResultUrl(null);
    setCopied(false);
    try {
      let out: string;
      if (authMode === "admin") {
        if (!serviceAccount) throw new Error("Service account missing");
        out = await uploadSourceUrlViaAdmin(serviceAccount, raw);
      } else {
        if (!app || !config?.projectId) throw new Error("Web Firebase connection missing");
        out = await uploadSourceUrlViaWeb(app, config.storageBucket, config.projectId, raw);
      }
      setResultUrl(out);
      toast({ title: "Image uploaded to Storage", description: "Copy the URL below into your CSV or Firestore field." });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      toast({ title: "Upload failed", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function handleFileUpload(file: File | null) {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResultUrl(null);
    setCopied(false);
    try {
      let out: string;
      if (authMode === "admin") {
        if (!serviceAccount) throw new Error("Service account missing");
        out = await uploadLocalFileViaAdmin(serviceAccount, file);
      } else {
        if (!app || !config?.projectId) throw new Error("Web Firebase connection missing");
        out = await uploadLocalFileViaWeb(app, config.storageBucket, file);
      }
      setResultUrl(out);
      toast({ title: "File uploaded to Storage" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      toast({ title: "Upload failed", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function copyResult() {
    if (!resultUrl) return;
    try {
      await navigator.clipboard.writeText(resultUrl);
      setCopied(true);
      toast({ title: "Copied to clipboard" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Could not copy", variant: "destructive" });
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          setUrlInput("");
          setResultUrl(null);
          setError(null);
          setCopied(false);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5" title="Download from URL or upload a file to Firebase Storage">
          <ImageUp className="h-4 w-4" />
          <span className="hidden sm:inline">Storage image</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Image → Firebase Storage</DialogTitle>
          <DialogDescription>
            Downloads from a URL (including Google Drive share links) or uploads a file from your device, then stores it under{" "}
            <code className="rounded bg-muted px-1 font-mono text-[11px]">imports/…</code> with a download URL you can paste into Firestore or CSV.
          </DialogDescription>
        </DialogHeader>

        {!connected && (
          <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100">
            Connect to Firebase first (Connect step).
          </p>
        )}
        {connected && !canUpload && (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            Connection incomplete — refresh or reconnect.
          </p>
        )}

        <Tabs defaultValue="url" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="url">From URL</TabsTrigger>
            <TabsTrigger value="file">From device</TabsTrigger>
          </TabsList>
          <TabsContent value="url" className="space-y-3 pt-2">
            <div className="space-y-2">
              <Label htmlFor="img-url">Image URL</Label>
              <Input
                id="img-url"
                placeholder="https://… or Google Drive link"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                disabled={!canUpload || loading}
                className="font-mono text-xs"
              />
            </div>
            <Button type="button" className="w-full" disabled={!canUpload || loading} onClick={() => void handleUrlUpload()}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Download &amp; upload to Storage
            </Button>
          </TabsContent>
          <TabsContent value="file" className="space-y-3 pt-2">
            <div className="space-y-2">
              <Label htmlFor="img-file">Choose image file</Label>
              <Input
                id="img-file"
                ref={fileRef}
                type="file"
                accept="image/*,.webp,.svg"
                disabled={!canUpload || loading}
                onChange={(e) => void handleFileUpload(e.target.files?.[0] ?? null)}
              />
              <p className="text-xs text-muted-foreground">Max 25 MB. Uses your default Storage bucket rules.</p>
            </div>
          </TabsContent>
        </Tabs>

        {error && (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
        )}

        {resultUrl && (
          <div className="space-y-2">
            <Label>Storage download URL</Label>
            <div className="flex gap-2">
              <Input readOnly value={resultUrl} className="font-mono text-[11px]" />
              <Button type="button" variant="secondary" size="icon" onClick={() => void copyResult()} title="Copy">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        )}

        <DialogFooter className="sm:justify-start">
          <p className="text-[11px] text-muted-foreground">
            Needs Storage write permission for your auth (Rules). Service account imports avoid browser CORS limits on some hosts.
          </p>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
