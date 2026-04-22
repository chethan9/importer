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
import { useToast } from "@/hooks/use-toast";
import { computeFileSignature, type FailedRowRecord } from "@/services/importService";

type ResumeInfo = {
  importId: string;
  startRow: number;
  priorSuccess: number;
  priorErrors: number;
  priorFailedRows: FailedRowRecord[];
};

type ImportRow = {
  id: string;
  collection_name: string;
  mode: string;
  total_rows: number;
  success_count: number;
  error_count: number;
  file_signature: string | null;
  last_processed_row: number | null;
  failed_rows: unknown;
  project_id: string;
};

export default function Home() {
  const { step, setStep, connected, collections, selectedCollection } = useFirebase();
  const { toast } = useToast();
  const [file, setFile] = useState<ParsedFile | null>(null);
  const [mapping, setMapping] = useState<MappingConfig | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [resumeInfo, setResumeInfo] = useState<ResumeInfo | null>(null);

  const collectionInfo = collections.find((c) => c.name === selectedCollection) ?? null;

  const handleReset = useCallback(() => {
    setFile(null);
    setMapping(null);
    setResumeInfo(null);
    setStep(2);
  }, [setStep]);

  const handleResumeRequest = useCallback(
    (importRow: ImportRow) => {
      if (!file) {
        toast({
          title: "Upload the file first",
          description: "Re-upload the original CSV/Excel file, then click Resume from history.",
          variant: "destructive",
        });
        setStep(3);
        return;
      }
      if (!mapping) {
        toast({
          title: "Mapping missing",
          description: "Re-open the mapping step for this collection before resuming.",
          variant: "destructive",
        });
        setStep(4);
        return;
      }
      if (importRow.file_signature) {
        const currentSig = computeFileSignature(file.columns, file.rows.length);
        if (currentSig !== importRow.file_signature) {
          toast({
            title: "File mismatch",
            description: "This file doesn't match the original import. Please upload the same file.",
            variant: "destructive",
          });
          return;
        }
      }
      setResumeInfo({
        importId: importRow.id,
        startRow: importRow.last_processed_row ?? 0,
        priorSuccess: importRow.success_count ?? 0,
        priorErrors: importRow.error_count ?? 0,
        priorFailedRows: Array.isArray(importRow.failed_rows) ? (importRow.failed_rows as FailedRowRecord[]) : [],
      });
      setStep(5);
      toast({
        title: "Resuming import",
        description: `Continuing from row ${(importRow.last_processed_row ?? 0) + 1}`,
      });
    },
    [file, mapping, setStep, toast],
  );

  return (
    <>
      <SEO
        title="Firebase Data Importer"
        description="Visually map CSV/Excel to Firestore, run batched imports, and revert any import with one click."
      />
      <div className="min-h-screen bg-background">
        <AppHeader onOpenHistory={() => setHistoryOpen(true)} />
        <div className="mx-auto max-w-5xl px-4 pb-16 pt-6">
          <Stepper current={step} />
          <div className="mt-8">
            {step === 1 && <ConnectStep />}
            {step === 2 && <BrowseStep />}
            {step === 3 && (
              <UploadStep
                onNext={(f) => {
                  setFile(f);
                  setResumeInfo(null);
                  setStep(4);
                }}
                onBack={() => setStep(2)}
              />
            )}
            {step === 4 && file && collectionInfo && (
              <MappingStep
                file={file}
                collection={collectionInfo}
                initial={mapping ?? undefined}
                onBack={() => setStep(3)}
                onNext={(m) => {
                  setMapping(m);
                  setResumeInfo(null);
                  setStep(5);
                }}
              />
            )}
            {step === 5 && file && mapping && collectionInfo && connected && (
              <ImportStep
                file={file}
                collectionName={collectionInfo.name}
                config={mapping}
                onBack={() => setStep(4)}
                onReset={handleReset}
                onOpenHistory={() => setHistoryOpen(true)}
                resumeInfo={resumeInfo ?? undefined}
              />
            )}
          </div>
        </div>
        <HistorySheet
          open={historyOpen}
          onOpenChange={setHistoryOpen}
          onResumeRequest={handleResumeRequest}
        />
      </div>
    </>
  );
}