import { cert, deleteApp, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

export type ServiceAccountJson = {
  project_id: string;
  private_key: string;
  client_email: string;
  [k: string]: unknown;
};

export async function withAdmin<T>(
  sa: ServiceAccountJson,
  fn: (db: Firestore) => Promise<T>,
): Promise<T> {
  const appName = `admin-${sa.project_id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const app: App = initializeApp(
    {
      credential: cert({
        projectId: sa.project_id,
        clientEmail: sa.client_email,
        privateKey: sa.private_key.replace(/\\n/g, "\n"),
      }),
      projectId: sa.project_id,
    },
    appName,
  );
  try {
    const db = getFirestore(app);
    return await fn(db);
  } finally {
    const existing = getApps().find((a) => a.name === appName);
    if (existing) await deleteApp(existing);
  }
}

export async function resolveRefPath(
  db: Firestore,
  targetCollection: string,
  matchField: string,
  matchValue: unknown,
): Promise<string | null> {
  const snap = await db
    .collection(targetCollection)
    .where(matchField, "==", matchValue)
    .limit(1)
    .get();
  if (snap.empty) return null;
  return snap.docs[0].ref.path;
}