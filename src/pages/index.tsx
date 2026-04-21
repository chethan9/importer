import { SEO } from "@/components/SEO";
import { AppHeader } from "@/components/importer/AppHeader";
import { Stepper } from "@/components/importer/Stepper";
import { ConnectStep } from "@/components/importer/ConnectStep";
import { BrowseStep } from "@/components/importer/BrowseStep";
import { PlaceholderStep } from "@/components/importer/PlaceholderStep";
import { useFirebase } from "@/contexts/FirebaseContext";

export default function Home() {
  const { step, connected } = useFirebase();
  const current = !connected ? 1 : step;

  return (
    <>
      <SEO
        title="Firestore Importer — Bulk CSV/Excel → Firebase"
        description="A fast, typed, revertable bulk data importer for Firebase Firestore. Paste config, map columns, import thousands of rows, undo with one click."
      />
      <div className="relative min-h-screen">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[320px] bg-grid opacity-40" />
        <div className="relative">
          <AppHeader />
          <Stepper current={current} />
          <main className="pb-20">
            {current === 1 && <ConnectStep />}
            {current === 2 && <BrowseStep />}
            {current === 3 && (
              <PlaceholderStep
                title="Field mapping — coming next"
                description="Upload a CSV/Excel file and map columns to Firestore fields with per-type validation. Ships in Task 2."
              />
            )}
            {current === 4 && (
              <PlaceholderStep
                title="Import runner — coming next"
                description="Batched Firestore writes with live progress, error log, and Supabase transaction logging for revert. Ships in Task 2."
              />
            )}
          </main>
        </div>
      </div>
    </>
  );
}