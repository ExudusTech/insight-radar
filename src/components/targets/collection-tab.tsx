import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, ChevronDown, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  COLLECTION_BLOCKS,
  BLOCK_STATUS_LABEL,
  collectionByTargetKey,
  countCompleteBlocks,
  indexCollectionRows,
  listCollectionByTarget,
  upsertCollectionField,
  type CollectionBlock,
} from "@/lib/collection.queries";
import { docVersionsKey, listDocumentVersions } from "@/lib/document-versions.queries";
import { targetDetailKey } from "@/lib/targets.queries";

export function CollectionTab({
  missionId,
  targetId,
}: {
  missionId: string;
  targetId: string;
}) {
  const qc = useQueryClient();
  const { data: user } = useCurrentUser();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: collectionByTargetKey(targetId),
    queryFn: () => listCollectionByTarget(targetId),
  });

  const { data: versions = [] } = useQuery({
    queryKey: docVersionsKey(missionId),
    queryFn: () => listDocumentVersions(missionId),
  });
  const frozen = versions.find((v) => v.status === "frozen");
  const extracted = (frozen?.extracted_data ?? {}) as { collection_blocks?: Record<string, string> };
  const blockInstructions = extracted.collection_blocks ?? {};

  const indexed = indexCollectionRows(rows);
  const done = countCompleteBlocks(rows);

  // local edit state
  const [drafts, setDrafts] = useState<Record<string, { notes: string; status: string }>>({});
  useEffect(() => {
    const initial: Record<string, { notes: string; status: string }> = {};
    for (const b of COLLECTION_BLOCKS) {
      initial[b] = { notes: indexed[b].notes, status: indexed[b].block_status };
    }
    setDrafts(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows.length, targetId]);

  const saveMut = useMutation({
    mutationFn: async (block: CollectionBlock) => {
      if (!user?.id) throw new Error("Sem usuário");
      const d = drafts[block];
      await upsertCollectionField({
        missionId,
        targetId,
        block,
        fieldKey: "notes",
        value: d.notes,
        userId: user.id,
      });
      await upsertCollectionField({
        missionId,
        targetId,
        block,
        fieldKey: "block_status",
        value: d.status,
        userId: user.id,
      });

      // auto-complete target if all 7 blocks marked done
      const updatedRows = await listCollectionByTarget(targetId);
      const completed = countCompleteBlocks(updatedRows);
      if (completed === 7) {
        await supabase
          .from("targets")
          .update({ status: "collection_complete" })
          .eq("id", targetId);
        await supabase.from("activity_logs").insert({
          mission_id: missionId,
          user_id: user.id,
          action: "target_collection_complete",
          entity_type: "target",
          entity_id: targetId,
        });
      }
      return { block, completed };
    },
    onSuccess: ({ block, completed }) => {
      toast.success(`Bloco ${block} salvo`);
      qc.invalidateQueries({ queryKey: collectionByTargetKey(targetId) });
      qc.invalidateQueries({ queryKey: targetDetailKey(targetId) });
      qc.invalidateQueries({ queryKey: ["targets", "by-mission", missionId] });
      if (completed === 7) toast.success("Coleta concluída — alvo marcado como concluído");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao salvar"),
  });

  if (isLoading) {
    return (
      <div className="grid place-items-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">Progresso da coleta</span>
          <span className="text-sm text-muted-foreground">{done}/7 blocos</span>
        </div>
        <Progress value={(done / 7) * 100} />
      </Card>

      {!frozen && (
        <Card className="p-4 text-sm text-muted-foreground">
          Nenhum documento-base congelado. As instruções dos blocos aparecerão aqui após o
          congelamento da versão.
        </Card>
      )}

      {COLLECTION_BLOCKS.map((block) => {
        const draft = drafts[block] ?? { notes: "", status: "not_started" };
        const instruction = blockInstructions[block] ?? blockInstructions[`Bloco ${block}`];
        const isDone = draft.status === "done";
        return (
          <Collapsible key={block} defaultOpen={!isDone}>
            <Card className="overflow-hidden">
              <CollapsibleTrigger className="w-full p-4 flex items-center justify-between hover:bg-muted/40">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="font-mono">Bloco {block}</Badge>
                  <span className="text-sm text-muted-foreground">
                    {BLOCK_STATUS_LABEL[draft.status]}
                  </span>
                  {isDone && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                </div>
                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform data-[state=open]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="p-4 pt-0 space-y-3 border-t">
                  {instruction && (
                    <div className="text-sm text-muted-foreground whitespace-pre-wrap bg-muted/40 rounded p-3">
                      {instruction}
                    </div>
                  )}
                  <div>
                    <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Anotações
                    </label>
                    <Textarea
                      value={draft.notes}
                      onChange={(e) =>
                        setDrafts((s) => ({ ...s, [block]: { ...draft, notes: e.target.value } }))
                      }
                      rows={4}
                      placeholder="Registre o que foi coletado neste bloco..."
                      className="mt-1"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Status do bloco
                      </label>
                      <Select
                        value={draft.status}
                        onValueChange={(v) =>
                          setDrafts((s) => ({ ...s, [block]: { ...draft, status: v } }))
                        }
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="not_started">Não iniciado</SelectItem>
                          <SelectItem value="in_progress">Em andamento</SelectItem>
                          <SelectItem value="done">Concluído</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      onClick={() => saveMut.mutate(block)}
                      disabled={saveMut.isPending}
                      className="self-end"
                    >
                      {saveMut.isPending && saveMut.variables === block ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Salvar bloco"
                      )}
                    </Button>
                  </div>
                </div>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        );
      })}
    </div>
  );
}