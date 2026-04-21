import { useEffect, useState } from "react";
import { FirebaseError } from "firebase/app";
import { Loader2, Link2, History, AlertCircle, KeyRound, Shield, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useFirebase, loadServiceAccount } from "@/contexts/FirebaseContext";
import { FirebaseConfig, loadLastConfig, validateConfig } from "@/lib/firebase";
import type { ServiceAccount } from "@/services/adminFirestoreService";

const FIELDS: { key: keyof FirebaseConfig; label: string; required?: boolean; placeholder?: string }[] = [
  { key: "apiKey", label: "apiKey", required: true, placeholder: "AIzaSy…" },
  { key: "authDomain", label: "authDomain", required: true, placeholder: "my-app.firebaseapp.com" },
  { key: "projectId", label: "projectId", required: true, placeholder: "my-app" },
  { key: "storageBucket", label: "storageBucket", placeholder: "my-app.appspot.com" },
  { key: "messagingSenderId", label: "messagingSenderId", placeholder: "1234567890" },
  { key: "appId", label: "appId", placeholder: "1:1234:web:abcd" },
];

const EMPTY: FirebaseConfig = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: "",
};

export function ConnectStep() {
  const { connectWeb, connectAdmin } = useFirebase();
  const { toast } = useToast();
  const [fields, setFields] = useState<FirebaseConfig>(EMPTY);
  const [json, setJson] = useState("");
  const [saJson, setSaJson] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasLast, setHasLast] = useState(false);
  const [hasLastSa, setHasLastSa] = useState(false);

  useEffect(() => {
    setHasLast(!!loadLastConfig());
    setHasLastSa(!!loadServiceAccount());
  }, []);

  const loadLastWeb = () => {
    const c = loadLastConfig();
    if (!c) return;
    setFields({ ...EMPTY, ...c });
    setJson(JSON.stringify(c, null, 2));
    toast({ title: "Loaded last web config", description: c.projectId });
  };

  const loadLastSa = () => {
    const sa = loadServiceAccount();
    if (!sa) return;
    setSaJson(JSON.stringify(sa, null, 2));
    toast({ title: "Loaded last service account", description: sa.project_id });
  };

  const tryParseJson = (raw: string): Record<string, unknown> | null => {
    try {
      const s = raw.trim();
      if (!s) return null;
      const cleaned = s
        .replace(/^\s*(const|let|var)\s+\w+\s*=\s*/m, "")
        .replace(/;\s*$/, "")
        .replace(/^\s*export\s+default\s+/m, "");
      const parsed = JSON.parse(
        cleaned.startsWith("{") ? cleaned.replace(/([{,]\s*)([a-zA-Z_]\w*)\s*:/g, '$1"$2":').replace(/'/g, '"') : cleaned,
      );
      return parsed as Record<string, unknown>;
    } catch {
      return null;
    }
  };

  const handleConnectWeb = async (source: "fields" | "json") => {
    setError(null);
    let cfg: FirebaseConfig | null = null;
    if (source === "json") {
      cfg = tryParseJson(json) as FirebaseConfig | null;
      if (!cfg) { setError("Could not parse JSON. Paste a valid firebaseConfig object."); return; }
    } else {
      cfg = fields;
    }
    const v = validateConfig(cfg);
    if (v) { setError(v); return; }
    setLoading(true);
    try {
      await connectWeb(cfg);
      toast({ title: "Connected", description: `Firebase Web SDK · ${cfg.projectId}` });
    } catch (e) {
      const msg = e instanceof FirebaseError ? e.message : (e as Error).message;
      setError(msg || "Failed to initialize Firebase");
    } finally {
      setLoading(false);
    }
  };

  const handleConnectAdmin = async () => {
    setError(null);
    const parsed = tryParseJson(saJson);
    if (!parsed) { setError("Could not parse service account JSON."); return; }
    const required = ["project_id", "private_key", "client_email"];
    const missing = required.filter((k) => !parsed[k]);
    if (missing.length) { setError(`Service account missing: ${missing.join(", ")}`); return; }
    setLoading(true);
    try {
      await connectAdmin(parsed as unknown as ServiceAccount);
      toast({ title: "Connected", description: `Service account · ${parsed.project_id}` });
    } catch (e) {
      setError((e as Error).message || "Failed to validate service account");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl animate-fade-in-up px-6 pb-16">
      <Card className="card-lift">
        <CardHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded bg-primary/10 text-primary ring-1 ring-primary/20">
              <KeyRound className="h-3.5 w-3.5" />
            </div>
            <CardTitle className="text-xl">Connect to Firebase</CardTitle>
          </div>
          <CardDescription>
            Use a <strong>service account</strong> to bypass Firestore rules (recommended), or the Web SDK config
            if your rules already allow authenticated writes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs defaultValue="admin" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="admin" className="gap-1.5"><Shield className="h-3.5 w-3.5" /> Service account</TabsTrigger>
              <TabsTrigger value="web" className="gap-1.5"><Globe className="h-3.5 w-3.5" /> Web SDK config</TabsTrigger>
            </TabsList>

            <TabsContent value="admin" className="mt-4 space-y-3">
              <Alert className="border-accent/40 bg-accent/5">
                <Shield className="h-4 w-4 text-accent" />
                <AlertDescription className="text-xs text-foreground">
                  <strong>Recommended.</strong> Bypasses Firestore security rules. Generate one in Firebase Console → Project settings → Service accounts → <em>Generate new private key</em>. JSON stays in your browser.
                </AlertDescription>
              </Alert>
              <div className="flex items-center justify-between">
                <Label htmlFor="sa" className="text-xs font-medium text-muted-foreground">Service account JSON</Label>
                {hasLastSa && (
                  <Button size="sm" variant="ghost" onClick={loadLastSa} className="gap-1.5 h-7">
                    <History className="h-3.5 w-3.5" /> Load last used
                  </Button>
                )}
              </div>
              <Textarea
                id="sa"
                value={saJson}
                onChange={(e) => setSaJson(e.target.value)}
                placeholder={`{
  "type": "service_account",
  "project_id": "my-app",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\\n...",
  "client_email": "firebase-adminsdk-xxx@my-app.iam.gserviceaccount.com",
  ...
}`}
                rows={10}
                className="font-mono text-xs"
              />
              <Button onClick={handleConnectAdmin} disabled={loading} className="w-full gap-2" size="lg">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
                Connect with service account
              </Button>
            </TabsContent>

            <TabsContent value="web" className="mt-4 space-y-3">
              <Alert className="border-border bg-muted/40">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Requires Firestore rules that allow authenticated writes. The app signs in anonymously on connect.
                </AlertDescription>
              </Alert>
              <Tabs defaultValue="json">
                <div className="flex items-center justify-between gap-3">
                  <TabsList>
                    <TabsTrigger value="json">Paste config</TabsTrigger>
                    <TabsTrigger value="fields">Individual fields</TabsTrigger>
                  </TabsList>
                  {hasLast && (
                    <Button size="sm" variant="ghost" onClick={loadLastWeb} className="gap-1.5">
                      <History className="h-3.5 w-3.5" /> Load last used
                    </Button>
                  )}
                </div>

                <TabsContent value="json" className="mt-4 space-y-3">
                  <Textarea
                    value={json}
                    onChange={(e) => setJson(e.target.value)}
                    placeholder={`{
  "apiKey": "AIzaSy...",
  "projectId": "my-app",
  ...
}`}
                    rows={8}
                    className="font-mono text-xs"
                  />
                  <Button onClick={() => void handleConnectWeb("json")} disabled={loading} className="w-full gap-2" size="lg">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                    Connect
                  </Button>
                </TabsContent>

                <TabsContent value="fields" className="mt-4 space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {FIELDS.map((f) => (
                      <div key={f.key} className={f.key === "apiKey" ? "sm:col-span-2" : ""}>
                        <Label htmlFor={f.key} className="mb-1.5 block font-mono text-xs text-muted-foreground">
                          {f.label}{f.required && <span className="ml-1 text-destructive">*</span>}
                        </Label>
                        <Input
                          id={f.key}
                          value={fields[f.key] ?? ""}
                          onChange={(e) => setFields({ ...fields, [f.key]: e.target.value })}
                          placeholder={f.placeholder}
                          className="font-mono text-sm"
                        />
                      </div>
                    ))}
                  </div>
                  <Button onClick={() => void handleConnectWeb("fields")} disabled={loading} className="w-full gap-2" size="lg">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                    Connect
                  </Button>
                </TabsContent>
              </Tabs>
            </TabsContent>
          </Tabs>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}