import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  extractVocabularyFromText,
  extractVocabularyFromImage,
  extractVocabularyFromPdf,
  bulkCreateVocabularyTerms,
} from "@/lib/vocabulary.functions";
import {
  flagDuplicateCandidates,
  MAX_IMPORT_FILE_BYTES,
  MAX_IMPORT_TEXT_LENGTH,
  ACCEPTED_IMAGE_MIME_TYPES,
  ACCEPTED_PDF_MIME_TYPE,
  type DedupedImportCandidate,
} from "@/lib/vocabulary-import";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { ClipboardPaste, Image as ImageIcon, FileText, Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/lib/i18n";

type ReviewRow = DedupedImportCandidate & { id: string; selected: boolean };

type ImportStep = "input" | "loading" | "review" | "error";
type InputMethod = "paste" | "image" | "pdf";

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("Kunde inte läsa filen."));
    reader.readAsDataURL(file);
  });
}

export function VocabularyImportPanel({
  vocabularySetId,
  existingTerms,
  invalidateAfterChange,
  onImported,
  onCancel,
}: {
  vocabularySetId: string;
  existingTerms: { term: string }[];
  invalidateAfterChange: () => void;
  onImported: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();

  const [step, setStep] = useState<ImportStep>("input");
  const [inputMethod, setInputMethod] = useState<InputMethod>("paste");
  const [pastedText, setPastedText] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reviewRows, setReviewRows] = useState<ReviewRow[]>([]);

  const textFn = useServerFn(extractVocabularyFromText);
  const imageFn = useServerFn(extractVocabularyFromImage);
  const pdfFn = useServerFn(extractVocabularyFromPdf);
  const bulkSaveFn = useServerFn(bulkCreateVocabularyTerms);

  function onExtracted(words: { term: string; definition: string; example?: string | null }[]) {
    const deduped = flagDuplicateCandidates(words, existingTerms);
    setReviewRows(
      deduped.map((w) => ({ ...w, id: crypto.randomUUID(), selected: !w.isDuplicate })),
    );
    setStep("review");
  }

  function onExtractError(error: unknown) {
    setErrorMessage(error instanceof Error ? error.message : t("vocabulary_import_generic_error"));
    setStep("error");
  }

  const textMutation = useMutation({
    mutationFn: (text: string) => textFn({ data: { text } }),
    onSuccess: (res) => onExtracted(res.words),
    onError: onExtractError,
  });

  const imageMutation = useMutation({
    mutationFn: (v: {
      image_data_url: string;
      mime_type: (typeof ACCEPTED_IMAGE_MIME_TYPES)[number];
    }) => imageFn({ data: v }),
    onSuccess: (res) => onExtracted(res.words),
    onError: onExtractError,
  });

  const pdfMutation = useMutation({
    mutationFn: (pdf_data_url: string) => pdfFn({ data: { pdf_data_url } }),
    onSuccess: (res) => onExtracted(res.words),
    onError: onExtractError,
  });

  const saveMutation = useMutation({
    mutationFn: bulkSaveFn,
    onSuccess: (created) => {
      toast.success(`${created.length} ${t("vocabulary_import_saved_toast_suffix")}`);
      invalidateAfterChange();
      onImported();
    },
  });

  async function handleFileChosen(file: File | null, method: "image" | "pdf") {
    if (!file) return;
    const acceptedTypes: readonly string[] =
      method === "image" ? ACCEPTED_IMAGE_MIME_TYPES : [ACCEPTED_PDF_MIME_TYPE];
    if (!acceptedTypes.includes(file.type)) {
      toast.error(t("vocabulary_import_invalid_file_type"));
      return;
    }
    if (file.size > MAX_IMPORT_FILE_BYTES) {
      toast.error(t("vocabulary_import_file_too_large"));
      return;
    }

    setStep("loading");
    try {
      const dataUrl = await readFileAsDataUrl(file);
      if (method === "image") {
        imageMutation.mutate({
          image_data_url: dataUrl,
          mime_type: file.type as (typeof ACCEPTED_IMAGE_MIME_TYPES)[number],
        });
      } else {
        pdfMutation.mutate(dataUrl);
      }
    } catch (err) {
      onExtractError(err);
    }
  }

  function updateRow(id: string, fields: Partial<ReviewRow>) {
    setReviewRows((rows) => rows.map((r) => (r.id === id ? { ...r, ...fields } : r)));
  }

  function removeRow(id: string) {
    setReviewRows((rows) => rows.filter((r) => r.id !== id));
  }

  function addBlankRow() {
    setReviewRows((rows) => [
      ...rows,
      {
        id: crypto.randomUUID(),
        term: "",
        definition: "",
        example: "",
        isDuplicate: false,
        selected: true,
      },
    ]);
  }

  function handleSave() {
    const terms = reviewRows
      .filter((r) => r.selected && r.term.trim() && r.definition.trim())
      .map((r) => ({
        term: r.term.trim(),
        definition: r.definition.trim(),
        example: r.example?.trim() ? r.example.trim() : null,
      }));
    if (terms.length === 0) return;
    saveMutation.mutate({ data: { vocabulary_set_id: vocabularySetId, terms } });
  }

  const isExtracting = textMutation.isPending || imageMutation.isPending || pdfMutation.isPending;
  const selectedSaveableCount = reviewRows.filter(
    (r) => r.selected && r.term.trim() && r.definition.trim(),
  ).length;

  if (step === "loading" || isExtracting) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t("vocabulary_import_loading")}
      </div>
    );
  }

  if (step === "error") {
    return (
      <div className="space-y-3 py-4">
        <p className="text-sm text-destructive">{errorMessage}</p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setStep("input")}>
            {t("vocabulary_import_retry")}
          </Button>
          <Button size="sm" variant="ghost" onClick={onCancel}>
            {t("vocabulary_import_back")}
          </Button>
        </div>
      </div>
    );
  }

  if (step === "review") {
    return (
      <div className="space-y-3">
        <div>
          <p className="text-sm font-medium">{t("vocabulary_import_review_title")}</p>
          <p className="text-xs text-muted-foreground">{t("vocabulary_import_review_desc")}</p>
        </div>

        {reviewRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("vocabulary_import_no_words_found")}</p>
        ) : (
          <div className="space-y-2">
            {reviewRows.map((row) => (
              <div key={row.id} className="flex items-start gap-2 rounded-md border p-3">
                <Checkbox
                  className="mt-1"
                  checked={row.selected}
                  onCheckedChange={(v) => updateRow(row.id, { selected: v === true })}
                />
                <div className="min-w-0 flex-1 space-y-1.5">
                  {row.isDuplicate ? (
                    <Badge variant="secondary" className="mb-1">
                      {t("vocabulary_import_duplicate_badge")}
                    </Badge>
                  ) : null}
                  <Input
                    value={row.term}
                    onChange={(e) => updateRow(row.id, { term: e.target.value })}
                    placeholder={t("vocabulary_term_placeholder")}
                  />
                  <Textarea
                    className="min-h-[50px]"
                    value={row.definition}
                    onChange={(e) => updateRow(row.id, { definition: e.target.value })}
                    placeholder={t("vocabulary_definition_placeholder")}
                  />
                  <Input
                    value={row.example ?? ""}
                    onChange={(e) => updateRow(row.id, { example: e.target.value })}
                    placeholder={t("vocabulary_example_placeholder")}
                  />
                </div>
                <Button size="sm" variant="ghost" onClick={() => removeRow(row.id)}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <Button size="sm" variant="outline" onClick={addBlankRow}>
          <Plus className="h-3.5 w-3.5" /> {t("vocabulary_import_add_row")}
        </Button>

        <div className="flex gap-2 pt-2">
          <Button
            size="sm"
            onClick={handleSave}
            disabled={selectedSaveableCount === 0 || saveMutation.isPending}
          >
            {saveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {t("vocabulary_import_save_button")}
          </Button>
          <Button size="sm" variant="ghost" onClick={onCancel} disabled={saveMutation.isPending}>
            {t("cancel")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={inputMethod === "paste" ? "default" : "outline"}
          onClick={() => setInputMethod("paste")}
        >
          <ClipboardPaste className="h-3.5 w-3.5" /> {t("vocabulary_import_method_paste")}
        </Button>
        <Button
          size="sm"
          variant={inputMethod === "image" ? "default" : "outline"}
          onClick={() => setInputMethod("image")}
        >
          <ImageIcon className="h-3.5 w-3.5" /> {t("vocabulary_import_method_image")}
        </Button>
        <Button
          size="sm"
          variant={inputMethod === "pdf" ? "default" : "outline"}
          onClick={() => setInputMethod("pdf")}
        >
          <FileText className="h-3.5 w-3.5" /> {t("vocabulary_import_method_pdf")}
        </Button>
      </div>

      {inputMethod === "paste" ? (
        <div className="space-y-2">
          <Textarea
            className="min-h-[140px]"
            value={pastedText}
            maxLength={MAX_IMPORT_TEXT_LENGTH}
            onChange={(e) => setPastedText(e.target.value)}
            placeholder={t("vocabulary_import_paste_placeholder")}
          />
          <Button
            size="sm"
            onClick={() => textMutation.mutate(pastedText)}
            disabled={!pastedText.trim()}
          >
            {t("vocabulary_import_extract_button")}
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <Label>{t("vocabulary_import_choose_file")}</Label>
          <input
            type="file"
            accept={
              inputMethod === "image" ? ACCEPTED_IMAGE_MIME_TYPES.join(",") : ACCEPTED_PDF_MIME_TYPE
            }
            onChange={(e) => handleFileChosen(e.target.files?.[0] ?? null, inputMethod)}
            className="block w-full text-sm text-foreground file:mr-3 file:rounded-md file:border file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium"
          />
        </div>
      )}

      <div className="flex justify-end">
        <Button size="sm" variant="ghost" onClick={onCancel}>
          {t("cancel")}
        </Button>
      </div>
    </div>
  );
}
