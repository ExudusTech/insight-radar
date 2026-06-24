import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Loader2,
  MessageCircle,
  Instagram,
  Linkedin,
  Mail,
  Phone,
  MessageSquare,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  INTERACTION_CHANNELS,
  INTERACTION_EVENT_LABEL,
  INTERACTION_EVENT_TYPES,
  createInteraction,
  interactionsByTargetKey,
  listInteractionsByTarget,
  type InteractionChannel,
  type InteractionEventType,
} from "@/lib/interactions.queries";
import { targetDetailKey } from "@/lib/targets.queries";
import { TARGET_STATUS_LABEL, TARGET_STATUS_ORDER, type TargetStatus } from "@/lib/target-status";

const CHANNEL_ICON: Record<string, typeof MessageCircle> = {
  WhatsApp: MessageCircle,
  Instagram: Instagram,
  LinkedIn: Linkedin,
  Email: Mail,
  Telefone: Phone,
  Outro: MessageSquare,
};

function toLocalInput(d: Date) {
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60_000);
  return local.toISOString().slice(0, 16);
}

export function TimelineTab({
  missionId,
  targetId,
}: {
  missionId: string;
  targetId: string;
}) {
  const qc = useQueryClient();
  const { data: user } = useCurrentUser();
  const [showForm, setShowForm] = useState(false);

  const { data: interactions = [], isLoading } = useQuery({
    queryKey: interactionsByTargetKey(targetId),
    queryFn: () => listInteractionsByTarget(targetId),
  });

  const [eventType, setEventType] = useState<InteractionEventType>("primeiro_contato");
  const [channel, setChannel] = useState<InteractionChannel>("WhatsApp");
  const [eventAt, setEventAt] = useState(toLocalInput(new Date()));
  const [content, setContent] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [statusAfter, setStatusAfter] = useState<TargetStatus | "">("");

  const createMut = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Sem usuário");
      return createInteraction({
        mission_id: missionId,
        target_id: targetId,
        event_type: eventType,
        channel,
        event_at: new Date(eventAt).toISOString(),
        content: content || null,
        next_action: nextAction || null,
        status_after: statusAfter || null,
        created_by: user.id,
      });
    },
    onSuccess: () => {
      toast.success("Interação registrada");
      qc.invalidateQueries({ queryKey: interactionsByTargetKey(targetId) });
      qc.invalidateQueries({ queryKey: targetDetailKey(targetId) });
      qc.invalidateQueries({ queryKey: ["targets", "by-mission", missionId] });
      setShowForm(false);
      setContent("");
      setNextAction("");
      setStatusAfter("");
      setEventAt(toLocalInput(new Date()));
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao salvar"),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-medium">Interações ({interactions.length})</h3>
        <Button size="sm" onClick={() => setShowForm((v) => !v)} variant={showForm ? "outline" : "default"}>
          <Plus className="h-4 w-4 mr-1" /> {showForm ? "Cancelar" : "Nova interação"}
        </Button>
      </div>

      {showForm && (
        <Card className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs uppercase tracking-wide text-muted-foreground">Tipo</label>
              <Select value={eventType} onValueChange={(v) => setEventType(v as InteractionEventType)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INTERACTION_EVENT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{INTERACTION_EVENT_LABEL[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-muted-foreground">Canal</label>
              <Select value={channel} onValueChange={(v) => setChannel(v as InteractionChannel)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INTERACTION_CHANNELS.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="text-xs uppercase tracking-wide text-muted-foreground">Data e hora</label>
            <Input
              type="datetime-local"
              value={eventAt}
              onChange={(e) => setEventAt(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wide text-muted-foreground">Conteúdo</label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={3}
              placeholder="Resumo do que aconteceu nessa interação"
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wide text-muted-foreground">Próxima ação</label>
            <Textarea
              value={nextAction}
              onChange={(e) => setNextAction(e.target.value)}
              rows={2}
              placeholder="O que será feito a seguir"
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wide text-muted-foreground">
              Status do alvo após esta interação (opcional)
            </label>
            <Select value={statusAfter || "none"} onValueChange={(v) => setStatusAfter(v === "none" ? "" : (v as TargetStatus))}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Sem mudança" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem mudança</SelectItem>
                {TARGET_STATUS_ORDER.map((s) => (
                  <SelectItem key={s} value={s}>{TARGET_STATUS_LABEL[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => createMut.mutate()} disabled={createMut.isPending}>
              {createMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
            </Button>
          </div>
        </Card>
      )}

      {isLoading ? (
        <div className="grid place-items-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : interactions.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          Nenhuma interação registrada ainda.
        </Card>
      ) : (
        <div className="space-y-2">
          {interactions.map((i) => {
            const Icon = CHANNEL_ICON[i.channel ?? "Outro"] ?? MessageSquare;
            return (
              <Card key={i.id} className="p-3">
                <div className="flex gap-3">
                  <div className="mt-0.5">
                    <div className="h-8 w-8 rounded-full bg-muted grid place-items-center">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary">
                        {INTERACTION_EVENT_LABEL[i.event_type as InteractionEventType] ?? i.event_type}
                      </Badge>
                      {i.channel && <span className="text-xs text-muted-foreground">{i.channel}</span>}
                      <span className="text-xs text-muted-foreground ml-auto">
                        {new Date(i.event_at).toLocaleString("pt-BR")}
                      </span>
                    </div>
                    {i.content && (
                      <p className="text-sm mt-1 whitespace-pre-wrap">{i.content}</p>
                    )}
                    {i.next_action && (
                      <p className="text-xs text-muted-foreground mt-1">
                        <strong>Próxima ação:</strong> {i.next_action}
                      </p>
                    )}
                    {i.status_after && (
                      <Badge variant="outline" className="mt-2 text-xs">
                        → {TARGET_STATUS_LABEL[i.status_after as TargetStatus] ?? i.status_after}
                      </Badge>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}