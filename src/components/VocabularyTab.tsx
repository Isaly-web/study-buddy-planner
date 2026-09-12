import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listVocabularyOverview } from "@/lib/vocabulary.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { VocabularySetDialog } from "@/components/VocabularySetDialog";
import { VocabularyPracticeDialog } from "@/components/VocabularyPracticeDialog";
import { useTranslation } from "@/lib/i18n";

export function VocabularyTab({
  examId,
  topics,
}: {
  examId: string;
  topics: { id: string; title: string }[];
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const overviewFn = useServerFn(listVocabularyOverview);
  const { data: overview, isLoading } = useQuery({
    queryKey: ["vocabulary-overview", examId],
    queryFn: () => overviewFn({ data: { exam_id: examId } }),
  });

  const [manageTopic, setManageTopic] = useState<{ id: string; title: string } | null>(null);
  const [practiceTopic, setPracticeTopic] = useState<{ id: string; title: string } | null>(null);

  const overviewByTopic = new Map((overview ?? []).map((o) => [o.topic_id, o]));

  return (
    <div className="space-y-4">
      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      ) : topics.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("vocabulary_no_terms")}</p>
      ) : (
        topics.map((topic) => {
          const stats = overviewByTopic.get(topic.id);
          const termCount = stats?.term_count ?? 0;
          return (
            <Card key={topic.id} className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-base font-semibold">{topic.title}</h3>
                <span className="text-xs text-muted-foreground">
                  {termCount} {t("vocabulary_terms_label")}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {stats?.accuracy !== null && stats?.accuracy !== undefined
                  ? `${t("vocabulary_accuracy")}: ${stats.accuracy}%`
                  : t("vocabulary_never_practiced")}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setManageTopic({ id: topic.id, title: topic.title })}
                >
                  {t("vocabulary_manage_terms")}
                </Button>
                <Button
                  size="sm"
                  disabled={termCount === 0}
                  onClick={() => setPracticeTopic({ id: topic.id, title: topic.title })}
                >
                  {t("vocabulary_practice")}
                </Button>
              </div>
            </Card>
          );
        })
      )}

      <VocabularySetDialog
        topicId={manageTopic?.id ?? null}
        topicTitle={manageTopic?.title ?? ""}
        open={!!manageTopic}
        onOpenChange={(v) => {
          if (!v) {
            setManageTopic(null);
            qc.invalidateQueries({ queryKey: ["vocabulary-overview", examId] });
          }
        }}
      />

      <VocabularyPracticeDialog
        topicId={practiceTopic?.id ?? null}
        topicTitle={practiceTopic?.title ?? ""}
        open={!!practiceTopic}
        onOpenChange={(v) => !v && setPracticeTopic(null)}
      />
    </div>
  );
}
