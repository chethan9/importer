import { useCallback, useState } from "react";
import { SEO } from "@/components/SEO";
import { AppShell } from "@/components/importer/AppShell";
import { ConnectStep } from "@/components/importer/ConnectStep";
import { BrowseStep } from "@/components/importer/BrowseStep";
import { UploadStep, type ParsedFile } from "@/components/importer/UploadStep";
import { MappingStep, type MappingConfig } from "@/components/importer/MappingStep";
import { ImportStep } from "@/components/importer/ImportStep";
import { HistorySheet } from "@/components/importer/HistorySheet";
import { useFirebase } from "@/contexts/FirebaseContext";
import { computeFileSignature, type FailedRowRecord } from "@/services/importService";
import { useToast } from "@/hooks/use-toast";

type ImportRow = {
  id: string;
  project_id: string;
  total_rows: number;
  last_processed_row?: number | null;
  success_count: number;
  error_count: number;
  file_signature?: string | null;
  failed_rows?: unknown;
  status: string;
};

type ResumeInfo = {
  importId: string;
  startRow: number;
  priorSuccess: number;
  priorErrors: number;
  priorFailedRows: FailedRowRecord[];
};

export default function Home() {
  const { step, setStep, collections, selectedCollection } = useFirebase();
  const [file, setFile] = useState<ParsedFile | null>(null);
  const [mapping, setMapping] = useState<MappingConfig | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [resumeInfo, setResumeInfo] = useState<ResumeInfo | null>(null);
  const { toast } = useToast();

  const collectionInfo = collections.find((c) => c.name === selectedCollection) ?? null;

  const handleResumeRequest = useCallback(
    (importRow: ImportRow) => {
      if (!file) {
        toast({
          title: "Upload the file first",
          description: "Re-upload the original CSV/Excel file, then click Resume again from History.",
          variant: "destructive",
        });
        return;
      }
      const currentSig = computeFileSignature(file.columns, file.rows.length);
      if (importRow.file_signature && importRow.file_signature !== currentSig) {
        toast({
          title: "File mismatch",
          description: "This file doesn't match the original import. Please upload the same file.",
          variant: "destructive",
        });
        return;
      }
      setResumeInfo({
        importId: importRow.id,
        startRow: importRow.last_processed_row ?? 0,
        priorSuccess: importRow.success_count ?? 0,
        priorErrors: importRow.error_count ?? 0,
        priorFailedRows: Array.isArray(importRow.failed_rows)
          ? (importRow.failed_rows as FailedRowRecord[])
          : [],
      });
      setStep(5);
    },
    [file, toast, setStep],
  );

  return (
    <>
      <SEO
        title="Firebase Data Importer - Bulk CSV / Excel to Firestore"
        description="Import CSV and Excel data into Firebase Firestore with type safety, smart field mapping, and one-click revert."
      />
      <AppShell onOpenHistory={() => setHistoryOpen(true)}>
        <div className="w-full space-y-6 px-3 py-4 sm:px-6 sm:py-6">
          {step === 1 && <ConnectStep />}
          {step === 2 && <BrowseStep />}
          {step === 3 && collectionInfo && (
            <UploadStep
              value={file}
              onChange={(f) => {
                setFile(f);
                setResumeInfo(null);
              }}
              onBack={() => setStep(2)}
              onNext={() => setStep(4)}
              collectionName={collectionInfo.name}
            />
          )}
          {step === 4 && collectionInfo && file && (
            <MappingStep
              file={file}
              collection={collectionInfo}
              value={mapping}
              onChange={(m) => {
                setMapping(m);
                setResumeInfo(null);
              }}
              onBack={() => setStep(3)}
              onNext={() => setStep(5)}
            />
          )}
          {step === 5 && collectionInfo && file && mapping && (
            <ImportStep
              file={file}
              collectionName={collectionInfo.name}
              config={mapping}
              onBack={() => setStep(4)}
              onReset={() => {
                setFile(null);
                setMapping(null);
                setResumeInfo(null);
                setStep(3);
              }}
              onOpenHistory={() => setHistoryOpen(true)}
              resumeInfo={resumeInfo ?? undefined}
            />
          )}
        </div>

        <HistorySheet
          open={historyOpen}
          onOpenChange={setHistoryOpen}
          onResumeRequest={handleResumeRequest}
        />
      </AppShell>
    </>
  );
}
