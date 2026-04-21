import { createContext, useCallback, useContext, useState, ReactNode } from "react";
import type { FirebaseApp } from "firebase/app";
import type { Firestore } from "firebase/firestore";
import {
  FirebaseConfig,
  FieldSchema,
  initFirebase,
  teardownFirebase,
  inferCollectionSchema,
  saveLastConfig,
} from "@/lib/firebase";

export type CollectionInfo = {
  name: string;
  docCount: number;
  fields: FieldSchema[];
};

type Ctx = {
  app: FirebaseApp | null;
  db: Firestore | null;
  config: FirebaseConfig | null;
  connected: boolean;
  collections: CollectionInfo[];
  selectedCollection: string | null;
  step: number;
  setStep: (n: number) => void;
  connect: (c: FirebaseConfig) => Promise<void>;
  disconnect: () => Promise<void>;
  addCollection: (name: string) => Promise<void>;
  removeCollection: (name: string) => void;
  selectCollection: (name: string) => void;
};

const FirebaseCtx = createContext<Ctx | null>(null);

export function FirebaseProvider({ children }: { children: ReactNode }) {
  const [app, setApp] = useState<FirebaseApp | null>(null);
  const [db, setDb] = useState<Firestore | null>(null);
  const [config, setConfig] = useState<FirebaseConfig | null>(null);
  const [collections, setCollections] = useState<CollectionInfo[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const [step, setStep] = useState<number>(1);

  const connect = useCallback(
    async (c: FirebaseConfig) => {
      if (app) await teardownFirebase(app);
      const { app: newApp, db: newDb } = initFirebase(c);
      setApp(newApp);
      setDb(newDb);
      setConfig(c);
      saveLastConfig(c);
      setStep(2);
    },
    [app],
  );

  const disconnect = useCallback(async () => {
    if (app) await teardownFirebase(app);
    setApp(null);
    setDb(null);
    setConfig(null);
    setCollections([]);
    setSelectedCollection(null);
    setStep(1);
  }, [app]);

  const addCollection = useCallback(
    async (name: string) => {
      if (!db) throw new Error("Not connected to Firebase");
      const trimmed = name.trim();
      if (!trimmed) return;
      if (collections.find((c) => c.name === trimmed)) return;
      const info = await inferCollectionSchema(db, trimmed);
      setCollections((prev) => [...prev, { name: trimmed, ...info }]);
    },
    [db, collections],
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

  return (
    <FirebaseCtx.Provider
      value={{
        app,
        db,
        config,
        connected: !!app,
        collections,
        selectedCollection,
        step,
        setStep,
        connect,
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