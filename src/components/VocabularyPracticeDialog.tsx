import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getOrCreateVocabularySet,
  listVocabularyTerms,
  recordVocabularyAttempt,
} from "@/lib/vocabulary.functions";
import {
  startSession,
  answerCurrent,
  isSessionComplete,
  currentPosition,
  buildIncorrectOnlySession,
  type PracticeSession,
} from "@/lib/vocabulary-practice";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, RotateCcw, Sparkles } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

export function VocabularyPracticeDialog({
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
  const { data: terms } = useQuery({
    queryKey: ["vocabulary-terms", set?.id],
    queryFn: () => listTermsFn({ data: { vocabulary_set_id: set!.id } }),
    enabled: !!set?.id,
  });

  const recordFn = useServerFn(recordVocabularyAttempt);
  const record = useMutation({
    mutationFn: recordFn,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vocabulary-overview"] }),
  });

  const [session, setSession] = useState<PracticeSession | null>(null);
  const [answer, setAnswer] = useState("");
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (open && terms) {
      setSession(startSession(terms));
      setAnswer("");
      setRevealed(false);
    }
    if (!open) {
      setSession(null);
    }
  }, [open, terms]);

  function check() {
    setRevealed(true);
  }

  function respond(wasCorrect: boolean) {
    if (!session?.current) return;
    record.mutate({ data: { term_id: session.current.id, is_correct: wasCorrect } });
    setSession(answerCurrent(session, wasCorrect));
    setAnswer("");
    setRevealed(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {t("vocabulary_practice_title")}
          </DialogTitle>
          <DialogDescription>{topicTitle}</DialogDescription>
        </DialogHeader>

        {!session || !terms ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t("loading")}</p>
        ) : terms.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t("vocabulary_no_terms_to_practice")}
          </p>
        ) : session.current ? (
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">
              {currentPosition(session)} / {session.totalInPass}
            </p>
            <p className="mt-2 text-lg font-semibold">{session.current.term}</p>

            {!revealed ? (
              <>
                <Textarea
                  className="mt-3 min-h-[80px]"
                  placeholder={t("vocabulary_answer_placeholder")}
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                />
                <Button className="mt-2" size="sm" onClick={check} disabled={!answer.trim()}>
                  {t("vocabulary_check_answer")}
                </Button>
              </>
            ) : (
              <div className="mt-3 space-y-3">
                <div className="rounded-md border bg-muted/40 p-3">
                  <p className="text-xs font-medium text-muted-foreground">
                    {t("vocabulary_your_answer_label")}
                  </p>
                  <p className="text-sm">{answer}</p>
                </div>
                <div className="rounded-md border border-primary/20 bg-primary/5 p-3">
                  <p className="text-xs font-medium text-muted-foreground">
                    {t("vocabulary_correct_definition_label")}
                  </p>
                  <p className="text-sm">{session.current.definition}</p>
                  {session.current.example ? (
                    <p className="mt-1 text-xs italic text-muted-foreground">
                      {session.current.example}
                    </p>
                  ) : null}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => respond(true)} disabled={record.isPending}>
                    <CheckCircle2 className="h-3.5 w-3.5" /> {t("vocabulary_was_right")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => respond(false)}
                    disabled={record.isPending}
                  >
                    <XCircle className="h-3.5 w-3.5" /> {t("vocabulary_was_wrong")}
                  </Button>
                </div>
              </div>
            )}
          </Card>
        ) : (
          <Card className="p-4 text-center">
            <p className="text-lg font-semibold">{t("vocabulary_pass_complete_title")}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("vocabulary_correct_count_label")}: {session.correctCount} ·{" "}
              {t("vocabulary_incorrect_count_label")}: {session.incorrectCount}
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {session.incorrectIds.length > 0 ? (
                <Button
                  size="sm"
                  onClick={() => {
                    setSession(buildIncorrectOnlySession(session, terms));
                    setAnswer("");
                    setRevealed(false);
                  }}
                >
                  <RotateCcw className="h-3.5 w-3.5" /> {t("vocabulary_practice_incorrect_only")}
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setSession(startSession(terms));
                  setAnswer("");
                  setRevealed(false);
                }}
              >
                {t("vocabulary_practice_all_again")}
              </Button>
            </div>
          </Card>
        )}
      </DialogContent>
    </Dialog>
  );
}
