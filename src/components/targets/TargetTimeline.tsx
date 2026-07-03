import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Loader2,
  Plus,
  Send,
  MessageCircle,
  Calendar,
  Video,
  FileText,
  Bell,
  RefreshCw,
  CheckCircle,
  Pin,
  Sparkles,
  User,
  type LucideIcon,
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
  TIMELINE_EVENT_TYPES,
  createManualTimelineEvent,
  listTimelineEvents,
  timelineEventsByTargetKey,
  type TimelineEventType,
} from "@/lib/target-timeline.queries";
import { cn } from "@/lib/utils";

const EVENT_CONFIG: Record<
  TimelineEventType,
  { label: string; icon: LucideIcon; color: string; bgColor: string }
> = {
  contato_inicial:    { label: "Contato enviado",    icon: Send,          color: "text-blue-600",   bgColor: "bg-blue-50" },
  resposta_recebida:  { label: "Resposta recebida",  icon: MessageCircle, color: "text-green-600",  bgColor: "bg-green-50" },
  reuniao_agendada:   { label: "Reunião agendada",   icon: Calendar,      color: "text-yellow-600", bgColor: "bg-yellow-50" },
  reuniao_realizada:  { label: "Reunião realizada",  icon: Video,         color: "text-purple-600", bgColor: "bg-purple-50" },
  proposta_recebida:  { label: "Proposta recebida",  icon: FileText,      color: "text-orange-600", bgColor: "bg-orange-50" },
  follow_up_recebido: { label: "Follow-up recebido", icon: Bell,          color: "text-cyan-600",   bgColor: "bg-cyan-50" },
  negociacao:         { label: "Negociação",         icon: RefreshCw,     color: "text-indigo-600", bgColor: "bg-indigo-50" },
  encerramento:       { label: "Encerrado",          icon: CheckCircle,   color: "text-slate-600",  bgColor: "bg-slate-50" },
  outro:              { label: "Evento",             icon: Pin,           color: "text-gray-600",   bgColor: "bg-gray-50" },
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function TargetTimeline({
  targetId,
  missionId,
}: {
  targetId: string;
  missionId: string;
}) {
  const qc = useQueryClient();
  const { data: user } = useCurrentUser();
  const [showForm, setShowForm] = useState(false);
  const [eventType, setEventType] = useState<TimelineEventType>("contato_inicial");
  const [description, setDescription] = useState("");
  const [eventDate, setEventDate] = useState(todayISO());

  const { data: events = [], isLoading } = useQuery({
    queryKey: timelineEventsByTargetKey(targetId),
    queryFn: () => listTimelineEvents(targetId),
  });

  const createMut = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Sem usuário");
      if (!description.trim()) throw new Error("Descreva o evento");
      await createManualTimelineEvent({
        missionId,
        targetId,
        eventType,
        description: description.trim(),
        eventDate,
        createdBy: user.id,
      });
    },
    onSuccess: () => {
      toast.success("Evento registrado");
      qc.invalidateQueries({ queryKey: timelineEventsByTargetKey(targetId) });
      setShowForm(false);
      setDescription("");
      setEventType("contato_inicial");
      setEventDate(todayISO());
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao salvar"),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">
          Linha do tempo{events.length > 0 ? ` (${events.length})` : ""}
        </h3>
        <Button
          size="sm"
          variant={showForm ? "outline" : "default"}
          onClick={() => setShowForm((v) => !v)}
        >
          <Plus className="h-4 w-4 mr-1" />
          {showForm ? "Cancelar" : "Adicionar evento manual"}
        </Button>
      </div>

      {showForm && (
        <Card className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs uppercase tracking-wide text-muted-foreground">Tipo</label>
              <Select value={eventType} onValueChange={(v) => setEventType(v as TimelineEventType)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIMELINE_EVENT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{EVENT_CONFIG[t].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-muted-foreground">Data</label>
              <Input
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <div>
            <label className="text-xs uppercase tracking-wide text-muted-foreground">Descrição</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="O que aconteceu neste evento?"
              className="mt-1"
            />
          </div>
          <div className="flex justify-end">
            <Button
              onClick={() => createMut.mutate()}
              disabled={createMut.isPending || !description.trim()}
            >
              {createMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar evento"}
            </Button>
          </div>
        </Card>
      )}

      {isLoading ? (
        <div className="grid place-items-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : events.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          Nenhum evento registrado ainda. Continue a conversa com o assistente para que os eventos de abordagem sejam registrados automaticamente.
        </Card>
      ) : (
        <ol className="relative border-l border-border ml-3 space-y-4">
          {events.map((ev) => {
            const cfg = EVENT_CONFIG[ev.event_type as TimelineEventType] ?? EVENT_CONFIG.outro;
            const Icon = cfg.icon;
            const isAi = ev.source === "ai";
            return (
              <li key={ev.id} className="ml-6">
                <span
                  className={cn(
                    "absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-background",
                    cfg.bgColor,
                  )}
                >
                  <Icon className={cn("h-3.5 w-3.5", cfg.color)} />
                </span>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary" className={cn("text-[11px]", cfg.color)}>
                    {cfg.label}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] gap-1",
                      isAi ? "border-primary/40 text-primary" : "border-muted-foreground/40",
                    )}
                  >
                    {isAi ? <Sparkles className="h-2.5 w-2.5" /> : <User className="h-2.5 w-2.5" />}
                    {isAi ? "IA" : "Manual"}
                  </Badge>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {new Date(ev.event_date).toLocaleDateString("pt-BR")}
                  </span>
                </div>
                <p className="text-sm mt-1 whitespace-pre-wrap">{ev.description}</p>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}