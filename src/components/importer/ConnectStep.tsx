import { useEffect, useState } from "react";
import { FirebaseError } from "firebase/app";
import { Loader2, Link2, History, AlertCircle, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useFirebase } from "@/contexts/FirebaseContext";
import { FirebaseConfig, loadLastConfig, validateConfig } from "@/lib/firebase";

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
  const { connect } = useFirebase();
  const { toast } = useToast();
  const [fields, setFields] = useState<FirebaseConfig>(EMPTY);
  const [json, setJson] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasLast, setHasLast] = useState(false);

  useEffect(() => {
    setHasLast(!!loadLastConfig());
  }, []);

  const loadLast = () => {
    const c = loadLastConfig();
    if (!c) return;
    setFields({ ...EMPTY, ...c });
    setJson(JSON.stringify(c, null, 2));
    toast({ title: "Loaded last-used config", description: c.projectId });
  };

  const tryParseJson = (): FirebaseConfig | null => {
    try {
      const raw = json.trim();
      if (!raw) return null;
      const cleaned = raw
        .replace(/^\s*(const|let|var)\s+\w+\s*=\s*/m, "")
        .replace(/;\s*$/, "")
        .replace(/^\s*export\s+default\s+/m, "");
      const parsed = JSON.parse(
        cleaned.startsWith("{") ? cleaned.replace(/([{,]\s*)([a-zA-Z_]\w*)\s*:/g, '$1"$2":').replace(/'/g, '"') : cleaned,
      );
      return parsed as FirebaseConfig;
    } catch {
      return null;
    }
  };

  const handleConnect = async (source: "fields" | "json") => {
    setError(null);
    let cfg: FirebaseConfig | null = null;
    if (source === "json") {
      cfg = tryParseJson();
      if (!cfg) {
        setError("Could not parse JSON. Paste a valid firebaseConfig object.");
        return;
      }
    } else {
      cfg = fields;
    }
    const v = validateConfig(cfg);
    if (v) {
      setError(v);
      return;
    }
    setLoading(true);
    try {
      await connect(cfg);
      toast({
        title: "Connected",
        description: `Firebase initialized for ${cfg.projectId}`,
      });
    } catch (e) {
      const msg = e instanceof FirebaseError ? e.message : (e as Error).message;
      setError(msg || "Failed to initialize Firebase");
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
            Your credentials stay in the browser. Nothing is sent to our servers — Firestore writes
            run client-side via the Firebase Web SDK.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs defaultValue="json" className="w-full">
            <div className="flex items-center justify-between gap-3">
              <TabsList>
                <TabsTrigger value="json">Paste config</TabsTrigger>
                <TabsTrigger value="fields">Individual fields</TabsTrigger>
              </TabsList>
              {hasLast && (
                <Button size="sm" variant="ghost" onClick={loadLast} className="gap-1.5">
                  <History className="h-3.5 w-3.5" />
                  Load last used
                </Button>
              )}
            </div>

            <TabsContent value="json" className="mt-4 space-y-3">
              <Label htmlFor="json" className="text-xs font-medium text-muted-foreground">
                firebaseConfig object
              </Label>
              <Textarea
                id="json"
                value={json}
                onChange={(e) => setJson(e.target.value)}
                placeholder={`{
  "apiKey": "AIzaSy...",
  "authDomain": "my-app.firebaseapp.com",
  "projectId": "my-app",
  "storageBucket": "my-app.appspot.com",
  "messagingSenderId": "1234567890",
  "appId": "1:1234:web:abcd"
}`}
                rows={10}
                className="font-mono text-xs"
              />
              <Button
                onClick={() => void handleConnect("json")}
                disabled={loading}
                className="w-full gap-2"
                size="lg"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Link2 className="h-4 w-4" />
                )}
                Connect
              </Button>
            </TabsContent>

            <TabsContent value="fields" className="mt-4 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                {FIELDS.map((f) => (
                  <div key={f.key} className={f.key === "apiKey" ? "sm:col-span-2" : ""}>
                    <Label
                      htmlFor={f.key}
                      className="mb-1.5 block font-mono text-xs text-muted-foreground"
                    >
                      {f.label}
                      {f.required && <span className="ml-1 text-destructive">*</span>}
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
              <Button
                onClick={() => void handleConnect("fields")}
                disabled={loading}
                className="w-full gap-2"
                size="lg"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Link2 className="h-4 w-4" />
                )}
                Connect
              </Button>
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

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Find your config in the Firebase Console → Project settings → Your apps → SDK setup and
        configuration.
      </p>
    </div>
  );
}