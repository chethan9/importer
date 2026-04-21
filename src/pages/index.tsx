import { useCallback, useState } from "react";
import { SEO } from "@/components/SEO";
import { AppHeader } from "@/components/importer/AppHeader";
import { Stepper } from "@/components/importer/Stepper";
import { ConnectStep } from "@/components/importer/ConnectStep";
import { BrowseStep } from "@/components/importer/BrowseStep";
import { UploadStep, type ParsedFile } from "@/components/importer/UploadStep";
import { MappingStep, type MappingConfig } from "@/components/importer/MappingStep";
import { ImportStep } from "@/components/importer/ImportStep";
import { HistorySheet } from "@/components/importer/HistorySheet";
import { useFirebase } from "@/contexts/FirebaseContext";

export default function Home() {
  const { step, setStep, connected, collections, selectedCollection } = useFirebase();
  const [file, setFile] = useState<ParsedFile | null>(null);
  const [mapping, setMapping] = useState<MappingConfig | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  const collectionInfo = collections.find((c) => c.name === selectedCollection) ?? null;

  const resetFlow = useCallback(() => {
    setFile(null);
    setMapping(null);
    setStep(2);
  }, [setStep]);

  return (
    <>
      <SEO
        title="Firebase Data Importer — Bulk CSV & Excel → Firestore"
        description="Connect to Firebase, map fields with type safety, import CSV/Excel into Firestore, and revert any import with one click."
      />
      <div className="min-h-screen bg-grid">
        <AppHeader onOpenHistory={() => setHistoryOpen(true)} />
        <div className="mx-auto max-w-6xl px-6 py-8">
          <Stepper current={step} connected={connected} />
          <main className="mt-8">
            {step === 1 && <ConnectStep />}
            {step === 2 && connected && <BrowseStep onContinue={() => setStep(3)} />}
            {step === 3 && connected && collectionInfo && (
              <UploadStep
                value={file}
                onChange={setFile}
                collectionName={collectionInfo.name}
                onBack={() => setStep(2)}
                onNext={() => setStep(4)}
              />
            )}
            {step === 4 && connected && collectionInfo && file && (
              <MappingStep
                file={file}
                collection={collectionInfo}
                value={mapping}
                onChange={setMapping}
                onBack={() => setStep(3)}
                onNext={() => setStep(5)}
              />
            )}
            {step === 5 && connected && collectionInfo && file && mapping && (
              <ImportStep
                file={file}
                collectionName={collectionInfo.name}
                config={mapping}
                onBack={() => setStep(4)}
                onReset={resetFlow}
                onOpenHistory={() => setHistoryOpen(true)}
              />
            )}
          </main>
        </div>
        <HistorySheet open={historyOpen} onOpenChange={setHistoryOpen} />
      </div>
    </>
  );
}