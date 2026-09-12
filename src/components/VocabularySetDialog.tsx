import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getOrCreateVocabularySet,
  listVocabularyTerms,
  createVocabularyTerm,
  updateVocabularyTerm,
  deleteVocabularyTerm,
  deleteVocabularySet,
} from "@/lib/vocabulary.functions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Trash2, Pencil, Plus, X, Check } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/lib/i18n";

type Term = { id: string; term: string; definition: string; example: string | null; order: number };

export function VocabularySetDialog({
  topicId,
  topicTitle,
  open,
  onOpenChange,
}: {
  topicId: string | null;
  topicTitle: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const getOrCreateFn = useServerFn(getOrCreateVocabularySet);
  const { data: set } = useQuery({
    queryKey: ["vocabulary-set", topicId],
    queryFn: () => getOrCreateFn({ data: { topic_id: topicId!, title: topicTitle } }),
    enabled: open && !!topicId,
  });

  const listTermsFn = useServerFn(listVocabularyTerms);
  const { data: terms, isLoading } = useQuery({
    queryKey: ["vocabulary-terms", set?.id],
    queryFn: () => listTermsFn({ data: { vocabulary_set_id: set!.id } }),
    enabled: !!set?.id,
  });

  function invalidateAfterChange() {
    if (set?.id) qc.invalidateQueries({ queryKey: ["vocabulary-terms", set.id] });
    qc.invalidateQueries({ queryKey: ["vocabulary-overview"] });
  }

  const createFn = useServerFn(createVocabularyTerm);
  const createMutation = useMutation({
    mutationFn: createFn,
    onSuccess: () => {
      toast.success(t("vocabulary_term_added"));
      invalidateAfterChange();
    },
  });

  const updateFn = useServerFn(updateVocabularyTerm);
  const updateMutation = useMutation({
    mutationFn: updateFn,
    onSuccess: () => {
      toast.success(t("vocabulary_term_updated"));
      invalidateAfterChange();
    },
  });

  const deleteTermFn = useServerFn(deleteVocabularyTerm);
  const deleteTermMutation = useMutation({
    mutationFn: deleteTermFn,
    onSuccess: () => {
      toast.success(t("vocabulary_term_deleted"));
      invalidateAfterChange();
    },
  });

  const deleteSetFn = useServerFn(deleteVocabularySet);
  const deleteSetMutation = useMutation({
    mutationFn: deleteSetFn,
    onSuccess: () => {
      toast.success(t("vocabulary_set_deleted"));
      qc.invalidateQueries({ queryKey: ["vocabulary-overview"] });
      onOpenChange(false);
    },
  });

  const [newTerm, setNewTerm] = useState("");
  const [newDefinition, setNewDefinition] = useState("");
  const [newExample, setNewExample] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTerm, setEditTerm] = useState("");
  const [editDefinition, setEditDefinition] = useState("");
  const [editExample, setEditExample] = useState("");
  const [confirmDeleteTermId, setConfirmDeleteTermId] = useState<string | null>(null);
  const [confirmDeleteSet, setConfirmDeleteSet] = useState(false);

  useEffect(() => {
    if (!open) {
      setNewTerm("");
      setNewDefinition("");
      setNewExample("");
      setEditingId(null);
    }
  }, [open]);

  function submitNewTerm() {
    if (!set?.id || !newTerm.trim() || !newDefinition.trim()) return;
    createMutation.mutate(
      {
        data: {
          vocabulary_set_id: set.id,
          term: newTerm,
          definition: newDefinition,
          example: newExample.trim() ? newExample : null,
        },
      },
      {
        onSuccess: () => {
          setNewTerm("");
          setNewDefinition("");
          setNewExample("");
        },
      },
    );
  }

  function startEdit(term: Term) {
    setEditingId(term.id);
    setEditTerm(term.term);
    setEditDefinition(term.definition);
    setEditExample(term.example ?? "");
  }

  function submitEdit() {
    if (!editingId || !editTerm.trim() || !editDefinition.trim()) return;
    updateMutation.mutate(
      {
        data: {
          id: editingId,
          term: editTerm,
          definition: editDefinition,
          example: editExample.trim() ? editExample : null,
        },
      },
      { onSuccess: () => setEditingId(null) },
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("vocabulary_manage_terms")}</DialogTitle>
            <DialogDescription>{topicTitle}</DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{t("loading")}</p>
          ) : (
            <div className="space-y-3">
              {(terms ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("vocabulary_no_terms")}</p>
              ) : (
                (terms ?? []).map((term) => (
                  <div key={term.id} className="rounded-md border p-3">
                    {editingId === term.id ? (
                      <div className="space-y-2">
                        <Input value={editTerm} onChange={(e) => setEditTerm(e.target.value)} />
                        <Textarea
                          className="min-h-[60px]"
                          value={editDefinition}
                          onChange={(e) => setEditDefinition(e.target.value)}
                        />
                        <Input
                          value={editExample}
                          onChange={(e) => setEditExample(e.target.value)}
                          placeholder={t("vocabulary_example_placeholder")}
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={submitEdit}
                            disabled={updateMutation.isPending}
                          >
                            <Check className="h-3.5 w-3.5" /> {t("save")}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                            <X className="h-3.5 w-3.5" /> {t("cancel")}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium">{term.term}</p>
                          <p className="text-sm text-muted-foreground">{term.definition}</p>
                          {term.example ? (
                            <p className="mt-1 text-xs italic text-muted-foreground">
                              {term.example}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <Button size="sm" variant="ghost" onClick={() => startEdit(term)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setConfirmDeleteTermId(term.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}

              <Separator />

              <div className="space-y-2 rounded-md border border-dashed p-3">
                <Label>{t("vocabulary_add_term")}</Label>
                <Input
                  value={newTerm}
                  onChange={(e) => setNewTerm(e.target.value)}
                  placeholder={t("vocabulary_term_placeholder")}
                />
                <Textarea
                  className="min-h-[60px]"
                  value={newDefinition}
                  onChange={(e) => setNewDefinition(e.target.value)}
                  placeholder={t("vocabulary_definition_placeholder")}
                />
                <Input
                  value={newExample}
                  onChange={(e) => setNewExample(e.target.value)}
                  placeholder={t("vocabulary_example_placeholder")}
                />
                <Button
                  size="sm"
                  onClick={submitNewTerm}
                  disabled={!newTerm.trim() || !newDefinition.trim() || createMutation.isPending}
                >
                  <Plus className="h-3.5 w-3.5" /> {t("vocabulary_add_term")}
                </Button>
              </div>

              {(terms ?? []).length > 0 ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={() => setConfirmDeleteSet(true)}
                >
                  <Trash2 className="h-3.5 w-3.5" /> {t("vocabulary_delete_set")}
                </Button>
              ) : null}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!confirmDeleteTermId}
        onOpenChange={(v) => !v && setConfirmDeleteTermId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("vocabulary_delete_term_confirm_title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("vocabulary_delete_term_confirm_desc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmDeleteTermId)
                  deleteTermMutation.mutate({ data: { id: confirmDeleteTermId } });
                setConfirmDeleteTermId(null);
              }}
            >
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmDeleteSet} onOpenChange={setConfirmDeleteSet}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("vocabulary_delete_set_confirm_title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("vocabulary_delete_set_confirm_desc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (set?.id) deleteSetMutation.mutate({ data: { id: set.id } });
                setConfirmDeleteSet(false);
              }}
            >
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
