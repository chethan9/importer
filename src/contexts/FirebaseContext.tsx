import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import type { FirebaseApp } from "firebase/app";
import { getAuth, signInAnonymously, type Auth } from "firebase/auth";
import type { Firestore } from "firebase/firestore";
import {
  FirebaseConfig,
  FieldSchema,
  initFirebase,
  teardownFirebase,
  inferCollectionSchema,
  saveLastConfig,
} from "@/lib/firebase";
import {
  saveServiceAccount,
  loadServiceAccount,
  clearServiceAccount,
  listCollectionsAdmin,
  inferSchemaAdmin,
  type ServiceAccount,
} from "@/services/adminFirestoreService";
import {
  defaultBucketFromProjectId,
  loadPersistedBucket,
  loadPersistedFolder,
  persistStoragePrefs,
  sanitizeStorageFolder,
} from "@/lib/storagePrefs";

export type CollectionInfo = {
  name: string;
  docCount: number;
  fields: FieldSchema[];
};

export type AuthMode = "web" | "admin";

type Ctx = {
  authMode: AuthMode;
  app: FirebaseApp | null;
  db: Firestore | null;
  auth: Auth | null;
  authUid: string | null;
  config: FirebaseConfig | null;
  serviceAccount: ServiceAccount | null;
  projectId: string | null;
  connected: boolean;
  collections: CollectionInfo[];
  selectedCollection: string | null;
  step: number;
  setStep: (n: number) => void;
  /** Bucket hostname only, e.g. myproj.firebasestorage.app */
  storageBucketId: string;
  /** Object path prefix inside the bucket (no leading slash) */
  storageFolder: string;
  setStoragePrefs: (prefs: { storageBucketId?: string; storageFolder?: string }) => void;
  connectWeb: (c: FirebaseConfig) => Promise<void>;
  connectAdmin: (sa: ServiceAccount) => Promise<void>;
  disconnect: () => Promise<void>;
  addCollection: (name: string) => Promise<void>;
  removeCollection: (name: string) => void;
  selectCollection: (name: string) => void;
};

const FirebaseCtx = createContext<Ctx | null>(null);

export function FirebaseProvider({ children }: { children: ReactNode }) {
  const [authMode, setAuthMode] = useState<AuthMode>("web");
  const [app, setApp] = useState<FirebaseApp | null>(null);
  const [db, setDb] = useState<Firestore | null>(null);
  const [auth, setAuth] = useState<Auth | null>(null);
  const [authUid, setAuthUid] = useState<string | null>(null);
  const [config, setConfig] = useState<FirebaseConfig | null>(null);
  const [serviceAccount, setServiceAccount] = useState<ServiceAccount | null>(null);
  const [collections, setCollections] = useState<CollectionInfo[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const [step, setStep] = useState<number>(1);
  const [storageBucketId, setStorageBucketId] = useState("");
  const [storageFolder, setStorageFolder] = useState("imports");

  const projectId = config?.projectId ?? serviceAccount?.project_id ?? null;

  useEffect(() => {
    if (!projectId) return;
    const pb = loadPersistedBucket();
    const pf = loadPersistedFolder();
    if (pb) {
      setStorageBucketId(pb);
    } else if (config?.storageBucket?.trim()) {
      setStorageBucketId(config.storageBucket.trim());
    } else {
      setStorageBucketId(defaultBucketFromProjectId(projectId));
    }
    setStorageFolder(pf ? sanitizeStorageFolder(pf) : "imports");
  }, [projectId, config?.storageBucket]);

  useEffect(() => {
    if (!projectId || !storageBucketId) return;
    persistStoragePrefs(storageBucketId, storageFolder);
  }, [projectId, storageBucketId, storageFolder]);

  const setStoragePrefs = useCallback(
    (prefs: { storageBucketId?: string; storageFolder?: string }) => {
      if (prefs.storageBucketId !== undefined) {
        const b = prefs.storageBucketId.trim() || (projectId ? defaultBucketFromProjectId(projectId) : "");
        setStorageBucketId(b);
      }
      if (prefs.storageFolder !== undefined) {
        setStorageFolder(sanitizeStorageFolder(prefs.storageFolder));
      }
    },
    [projectId],
  );

  const connectWeb = useCallback(
    async (c: FirebaseConfig) => {
      if (app) await teardownFirebase(app);
      const { app: newApp, db: newDb } = initFirebase(c);
      const newAuth = getAuth(newApp);
      setAuthMode("web");
      setApp(newApp);
      setDb(newDb);
      setAuth(newAuth);
      setConfig(c);
      setServiceAccount(null);
      saveLastConfig(c);
      try {
        const cred = await signInAnonymously(newAuth);
        setAuthUid(cred.user.uid);
      } catch (err) {
        console.warn("Anonymous sign-in failed.", err);
        setAuthUid(null);
      }
      setStep(2);
    },
    [app],
  );

  const connectAdmin = useCallback(
    async (sa: ServiceAccount) => {
      if (app) await teardownFirebase(app);
      // Validate by listing collections (will throw if SA invalid)
      await listCollectionsAdmin(sa);
      setAuthMode("admin");
      setApp(null);
      setDb(null);
      setAuth(null);
      setAuthUid(null);
      setConfig(null);
      setServiceAccount(sa);
      saveServiceAccount(sa);
      setStep(2);
    },
    [app],
  );

  const disconnect = useCallback(async () => {
    if (app) await teardownFirebase(app);
    setApp(null);
    setDb(null);
    setAuth(null);
    setAuthUid(null);
    setConfig(null);
    setServiceAccount(null);
    clearServiceAccount();
    setCollections([]);
    setSelectedCollection(null);
    setStep(1);
  }, [app]);

  const addCollection = useCallback(
    async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      if (collections.find((c) => c.name === trimmed)) return;

      let info: { docCount: number; fields: FieldSchema[] };
      if (authMode === "admin") {
        if (!serviceAccount) throw new Error("No service account");
        info = await inferSchemaAdmin(serviceAccount, trimmed);
      } else {
        if (!db) throw new Error("Not connected to Firebase");
        info = await inferCollectionSchema(db, trimmed);
      }
      setCollections((prev) => [...prev, { name: trimmed, ...info }]);
    },
    [authMode, db, serviceAccount, collections],
  );

  const removeCollection = useCallback(
    (name: string) => {
      setCollections((prev) => prev.filter((c) => c.name !== name));
      if (selectedCollection === name) setSelectedCollection(null);
    },
    [selectedCollection],
  );

  const selectCollection = useCallback((name: string) => {
    setSelectedCollection(name);
  }, []);

  const connected = authMode === "admin" ? !!serviceAccount : !!app;

  return (
    <FirebaseCtx.Provider
      value={{
        authMode,
        app,
        db,
        auth,
        authUid,
        config,
        serviceAccount,
        projectId,
        connected,
        collections,
        selectedCollection,
        step,
        setStep,
        storageBucketId,
        storageFolder,
        setStoragePrefs,
        connectWeb,
        connectAdmin,
        disconnect,
        addCollection,
        removeCollection,
        selectCollection,
      }}
    >
      {children}
    </FirebaseCtx.Provider>
  );
}

export function useFirebase() {
  const ctx = useContext(FirebaseCtx);
  if (!ctx) throw new Error("useFirebase must be used inside FirebaseProvider");
  return ctx;
}

export { loadServiceAccount };