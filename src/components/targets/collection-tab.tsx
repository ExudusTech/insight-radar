import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, ChevronDown, CheckCircle2, AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
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
  type CollectionRow,
} from "@/lib/collection.queries";
import { docVersionsKey, listDocumentVersions } from "@/lib/document-versions.queries";
import { targetDetailKey } from "@/lib/targets.queries";
import {
  createNotifications,
  getMissionContractorId,
  listSuperadminIds,
} from "@/lib/notifications.queries";

type BlockExtras = { observation: string; doubt: string; doubt_blocking: boolean };

function extractExtras(rows: CollectionRow[]) {
  const out: Record<string, BlockExtras> = {};
  for (const b of COLLECTION_BLOCKS) out[b] = { observation: "", doubt: "", doubt_blocking: false };
  for (const r of rows) {
    const slot = out[r.block as string] ?? { observation: "", doubt: "", doubt_blocking: false };
    if (r.field_key === "observation") slot.observation = String(r.field_value ?? "");
    if (r.field_key === "doubt") slot.doubt = String(r.field_value ?? "");
    if (r.field_key === "doubt_blocking") slot.doubt_blocking = r.field_value === true;
    out[r.block as string] = slot;
  }
  return out;
}

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
  const extras = extractExtras(rows);
  const done = countCompleteBlocks(rows);

  // local edit state
  const [drafts, setDrafts] = useState<
    Record<string, { notes: string; status: string; observation: string; doubt: string; doubt_blocking: boolean }>
  >({});
  const [openBlock, setOpenBlock] = useState<CollectionBlock>("A");

  useEffect(() => {
    const initial: Record<string, { notes: string; status: string; observation: string; doubt: string; doubt_blocking: boolean }> = {};
    for (const b of COLLECTION_BLOCKS) {
      initial[b] = {
        notes: indexed[b].notes,
        status: indexed[b].block_status,
        observation: extras[b].observation,
        doubt: extras[b].doubt,
        doubt_blocking: extras[b].doubt_blocking,
      };
    }
    setDrafts(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows.length, targetId]);

  const saveMut = useMutation({
    mutationFn: async (block: CollectionBlock) => {
      if (!user?.id) throw new Error("Sem usuário");
      const d = drafts[block];
      const prev = extras[block];
      const baseFields = [
        { key: "notes", value: d.notes },
        { key: "block_status", value: d.status },
        { key: "observation", value: d.observation },
        { key: "doubt", value: d.doubt },
        { key: "doubt_blocking", value: d.doubt_blocking },
      ];
      for (const f of baseFields) {
        await upsertCollectionField({
          missionId,
          targetId,
          block,
          fieldKey: f.key,
          value: f.value,
          userId: user.id,
        });
      }

      // notifications: new doubt or observation
      const doubtChanged = d.doubt.trim() && d.doubt !== prev.doubt;
      const obsChanged = d.observation.trim() && d.observation !== prev.observation;
      if (doubtChanged || obsChanged) {
        const [contractorId, superadmins] = await Promise.all([
          getMissionContractorId(missionId),
          listSuperadminIds(),
        ]);
        const recipients = new Set<string>(superadmins);
        if (contractorId) recipients.add(contractorId);
        recipients.delete(user.id);
        const notifType = doubtChanged ? (d.doubt_blocking ? "blocking" : "doubt") : "observation";
        const message = doubtChanged ? d.doubt : d.observation;
        await createNotifications(
          [...recipients].map((uid) => ({
            user_id: uid,
            origin_user_id: user.id,
            mission_id: missionId,
            target_id: targetId,
            block,
            type: notifType,
            message,
          })),
        );
      }

      // blocking -> set status incomplete
      if (d.doubt_blocking && !prev.doubt_blocking) {
        await supabase.from("targets").update({ status: "incomplete" }).eq("id", targetId);
        await supabase.from("activity_logs").insert({
          mission_id: missionId,
          user_id: user.id,
          action: "target_status_changed",
          entity_type: "target",
          entity_id: targetId,
          details: { from: "in_progress", to: "incomplete", reason: "doubt_blocking" },
        });
      }

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
      qc.invalidateQueries({ queryKey: ["collection", "by-mission", missionId] });
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
          <span className="text-sm font-medium">
            Bloco {openBlock} de G — {BLOCK_STATUS_LABEL[drafts[openBlock]?.status ?? "not_started"]}
          </span>
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

      {COLLECTION_BLOCKS.map((block, idx) => {
        const draft = drafts[block] ?? { notes: "", status: "not_started", observation: "", doubt: "", doubt_blocking: false };
        const instruction = blockInstructions[block] ?? blockInstructions[`Bloco ${block}`];
        const isDone = draft.status === "done";
        const isOpen = openBlock === block;
        return (
          <Collapsible key={block} open={isOpen} onOpenChange={(o) => o && setOpenBlock(block)}>
            <Card className="overflow-hidden">
              <CollapsibleTrigger className="w-full p-4 flex items-center justify-between hover:bg-muted/40">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="font-mono">Bloco {block}</Badge>
                  <span className="text-sm text-muted-foreground">
                    {BLOCK_STATUS_LABEL[draft.status]}
                  </span>
                  {isDone && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                  {draft.doubt_blocking && <AlertTriangle className="h-4 w-4 text-destructive" />}
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
                  <div>
                    <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Observação
                    </label>
                    <Textarea
                      value={draft.observation}
                      onChange={(e) =>
                        setDrafts((s) => ({ ...s, [block]: { ...draft, observation: e.target.value } }))
                      }
                      rows={2}
                      placeholder="Observação para contratante e superadmin..."
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Dúvida
                    </label>
                    <Textarea
                      value={draft.doubt}
                      onChange={(e) =>
                        setDrafts((s) => ({ ...s, [block]: { ...draft, doubt: e.target.value } }))
                      }
                      rows={2}
                      placeholder="Algo que precisa de feedback..."
                      className="mt-1"
                    />
                    <label className="flex items-center gap-2 mt-2 text-xs">
                      <Switch
                        checked={draft.doubt_blocking}
                        onCheckedChange={(v) =>
                          setDrafts((s) => ({ ...s, [block]: { ...draft, doubt_blocking: v } }))
                        }
                      />
                      Esta dúvida é bloqueante
                    </label>
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
                  <div className="flex justify-between pt-2 border-t">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={idx === 0}
                      onClick={() => setOpenBlock(COLLECTION_BLOCKS[idx - 1])}
                    >
                      <ChevronLeft className="h-4 w-4" /> Bloco anterior
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={idx === COLLECTION_BLOCKS.length - 1}
                      onClick={() => setOpenBlock(COLLECTION_BLOCKS[idx + 1])}
                    >
                      Próximo bloco <ChevronRight className="h-4 w-4" />
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