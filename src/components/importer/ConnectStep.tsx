import { useEffect, useRef, useState } from "react";
import { FirebaseError } from "firebase/app";
import { Loader2, Link2, AlertCircle, KeyRound, Shield, Globe, CheckCircle2, Upload as UploadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useFirebase, loadServiceAccount } from "@/contexts/FirebaseContext";
import { type FirebaseConfig, loadLastConfig, validateConfig } from "@/lib/firebase";
import { saveServiceAccount, type ServiceAccount } from "@/services/adminFirestoreService";

const FIELDS: Array<{ key: keyof FirebaseConfig; label: string; placeholder: string; required: boolean }> = [
  { key: "apiKey", label: "API Key", placeholder: "AIzaSy…", required: true },
  { key: "authDomain", label: "Auth Domain", placeholder: "my-app.firebaseapp.com", required: true },
  { key: "projectId", label: "Project ID", placeholder: "my-app", required: true },
  { key: "storageBucket", label: "Storage Bucket", placeholder: "my-app.appspot.com", required: false },
  { key: "messagingSenderId", label: "Messaging Sender ID", placeholder: "123456789", required: false },
  { key: "appId", label: "App ID", placeholder: "1:123:web:abc", required: false },
];

export function ConnectStep() {
  const { connected, config: activeConfig, connectWeb, connectAdmin } = useFirebase();
  const { toast } = useToast();
  const [jsonText, setJsonText] = useState("");
  const [fieldsForm, setFieldsForm] = useState<FirebaseConfig>({
    apiKey: "",
    authDomain: "",
    projectId: "",
    storageBucket: "",
    messagingSenderId: "",
    appId: "",
  });
  const [saJsonText, setSaJsonText] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const saFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const last = loadLastConfig();
    if (last) setFieldsForm(last);
    const sa = loadServiceAccount();
    if (sa) setSaJsonText(JSON.stringify(sa, null, 2));
  }, []);

  function parseJsonPaste(text: string): FirebaseConfig | null {
    try {
      const normalized = text
        .replace(/^[\s\S]*?=\s*/, "")
        .replace(/;?\s*$/, "")
        .replace(/([a-zA-Z0-9_]+)\s*:/g, '"$1":')
        .replace(/'/g, '"');
      const o = JSON.parse(normalized);
      return o as FirebaseConfig;
    } catch {
      try {
        return JSON.parse(text) as FirebaseConfig;
      } catch {
        return null;
      }
    }
  }

  async function onConnectWeb(cfg: FirebaseConfig) {
    const validationError = validateConfig(cfg);
    if (validationError) {
      toast({ title: "Missing fields", description: validationError, variant: "destructive" });
      return;
    }
    setConnecting(true);
    setLocalError(null);
    try {
      await connectWeb(cfg);
      toast({ title: "Connected", description: `Project ${cfg.projectId}` });
    } catch (e) {
      const msg = e instanceof FirebaseError ? e.message : e instanceof Error ? e.message : "Connect failed";
      setLocalError(msg);
      toast({ title: "Connection failed", description: msg, variant: "destructive" });
    } finally {
      setConnecting(false);
    }
  }

  async function onConnectAdmin() {
    let parsed: ServiceAccount | null = null;
    try {
      parsed = JSON.parse(saJsonText) as ServiceAccount;
    } catch {
      toast({ title: "Invalid JSON", description: "Paste the complete service account JSON.", variant: "destructive" });
      return;
    }
    if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
      toast({ title: "Incomplete service account", description: "Need project_id, client_email, private_key.", variant: "destructive" });
      return;
    }
    setConnecting(true);
    setLocalError(null);
    try {
      await connectAdmin(parsed);
      saveServiceAccount(parsed);
      toast({ title: "Connected (admin)", description: `Project ${parsed.project_id}` });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Connect failed";
      setLocalError(msg);
      toast({ title: "Connection failed", description: msg, variant: "destructive" });
    } finally {
      setConnecting(false);
    }
  }

  function onSaFile(f: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      setSaJsonText(text);
    };
    reader.readAsText(f);
  }

  return (
    <div className="mx-auto w-full max-w-3xl animate-fade-in-up space-y-6 px-4 pb-20 sm:px-6">
      {connected && activeConfig && (
        <Alert className="border-emerald-500/35 bg-emerald-500/[0.08] dark:bg-emerald-500/[0.12]">
          <CheckCircle2 className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
          <AlertDescription className="flex items-center justify-between gap-2">
            <span>Connected to <code className="font-mono text-xs">{activeConfig.projectId}</code></span>
            <Badge variant="outline" className="font-mono text-[10px]">ready</Badge>
          </AlertDescription>
        </Alert>
      )}

      <Card className="overflow-hidden">
        <Tabs defaultValue="admin" className="w-full">
          <div className="border-b bg-muted/30 px-2 pt-2">
            <TabsList className="grid w-full grid-cols-2 bg-transparent">
              <TabsTrigger value="admin" className="gap-1.5 data-[state=active]:bg-background">
                <Shield className="h-3.5 w-3.5" /> Service account
              </TabsTrigger>
              <TabsTrigger value="web" className="gap-1.5 data-[state=active]:bg-background">
                <Globe className="h-3.5 w-3.5" /> Web SDK
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="admin" className="mt-0">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Service account JSON</CardTitle>
              <CardDescription>
                Paste or upload the JSON from Firebase Console &rarr; Project Settings &rarr; Service accounts.
                Private keys stay in your browser + this tab only.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <Label htmlFor="sa-json" className="text-xs text-muted-foreground">
                    Paste JSON
                  </Label>
                  <input
                    ref={saFileRef}
                    type="file"
                    accept=".json,application/json"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) onSaFile(f);
                    }}
                  />
                  <Button variant="ghost" size="sm" onClick={() => saFileRef.current?.click()} className="h-7">
                    <UploadIcon className="mr-1.5 h-3 w-3" /> Upload file
                  </Button>
                </div>
                <Textarea
                  id="sa-json"
                  value={saJsonText}
                  onChange={(e) => setSaJsonText(e.target.value)}
                  placeholder='{"type":"service_account","project_id":"…","private_key":"…"}'
                  className="min-h-[140px] font-mono text-[11px]"
                />
              </div>
              <Button
                onClick={onConnectAdmin}
                disabled={connecting || !saJsonText.trim()}
                size="lg"
                variant="default"
                className="w-full"
              >
                {connecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}
                Connect with service account
              </Button>
            </CardContent>
          </TabsContent>

          <TabsContent value="web" className="mt-0">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Web SDK configuration</CardTitle>
              <CardDescription>
                Paste the <code className="rounded bg-muted px-1 font-mono text-[11px]">firebaseConfig</code> object,
                or fill fields individually. Writes require open security rules.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Tabs defaultValue="paste" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="paste">Paste JSON</TabsTrigger>
                  <TabsTrigger value="fields">Fields</TabsTrigger>
                </TabsList>

                <TabsContent value="paste" className="mt-3 space-y-3">
                  <Textarea
                    value={jsonText}
                    onChange={(e) => setJsonText(e.target.value)}
                    placeholder={`{\n  apiKey: "…",\n  authDomain: "…",\n  projectId: "…"\n}`}
                    className="min-h-[140px] font-mono text-[11px]"
                  />
                  <Button
                    onClick={() => {
                      const parsed = parseJsonPaste(jsonText);
                      if (!parsed) {
                        toast({ title: "Could not parse JSON", variant: "destructive" });
                        return;
                      }
                      setFieldsForm(parsed);
                      void onConnectWeb(parsed);
                    }}
                    disabled={connecting || !jsonText.trim()}
                    size="lg"
                    className="w-full"
                  >
                    {connecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}
                    Parse &amp; connect
                  </Button>
                </TabsContent>

                <TabsContent value="fields" className="mt-3 space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {FIELDS.map((f) => (
                      <div key={f.key} className={f.key === "apiKey" ? "sm:col-span-2" : ""}>
                        <Label htmlFor={f.key} className="text-xs">
                          {f.label}
                          {f.required && <span className="text-destructive"> *</span>}
                        </Label>
                        <Input
                          id={f.key}
                          value={fieldsForm[f.key] ?? ""}
                          onChange={(e) => setFieldsForm((v) => ({ ...v, [f.key]: e.target.value }))}
                          placeholder={f.placeholder}
                          className="mt-1 font-mono text-xs"
                        />
                      </div>
                    ))}
                  </div>
                  <Button
                    onClick={() => void onConnectWeb(fieldsForm)}
                    disabled={connecting}
                    size="lg"
                    className="w-full"
                  >
                    {connecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}
                    Connect with fields
                  </Button>
                </TabsContent>
              </Tabs>
            </CardContent>
          </TabsContent>
        </Tabs>
      </Card>

      {localError && (
        <Alert variant="destructive" className="animate-error-shake">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{localError}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
