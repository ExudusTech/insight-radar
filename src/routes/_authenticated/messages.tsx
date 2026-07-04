import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, MessageCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  coordinationInboxKey,
  listCoordinationInbox,
  type CoordinationInboxEntry,
} from "@/lib/coordination-messages.queries";
import { CoordinationThread } from "@/components/coordination/coordination-thread";

export const Route = createFileRoute("/_authenticated/messages")({
  component: MessagesInbox,
});

function MessagesInbox() {
  const { data: me } = useCurrentUser();
  const meId = me?.id ?? "";
  const [selected, setSelected] = useState<CoordinationInboxEntry | null>(null);

  const { data: inbox, isLoading } = useQuery({
    queryKey: coordinationInboxKey(meId),
    queryFn: () => listCoordinationInbox(meId),
    enabled: !!meId,
    refetchInterval: 20_000,
  });

  const entries = useMemo(() => inbox ?? [], [inbox]);

  return (
    <div className="max-w-6xl mx-auto w-full space-y-6">
      <div>
        <Badge variant="secondary" className="font-medium mb-1">
          Canal interno
        </Badge>
        <h1 className="text-2xl font-bold tracking-tight font-display">
          Mensagens
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Conversas por missão entre coordenação e analistas.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-4">
        <Card className="p-0 overflow-hidden">
          {isLoading ? (
            <div className="grid place-items-center py-16">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : entries.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              <MessageCircle className="h-6 w-6 mx-auto mb-2 opacity-60" />
              Nenhuma conversa ainda.
            </div>
          ) : (
            <ul className="divide-y">
              {entries.map((e) => {
                const active =
                  selected?.mission_id === e.mission_id &&
                  selected?.other_user_id === e.other_user_id;
                return (
                  <li key={`${e.mission_id}-${e.other_user_id}`}>
                    <button
                      type="button"
                      onClick={() => setSelected(e)}
                      className={`w-full text-left p-3 hover:bg-muted/60 transition ${
                        active ? "bg-muted" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-medium truncate">
                          {e.other_user_name ?? "Usuário"}
                        </div>
                        {e.unread > 0 && (
                          <Badge
                            variant="destructive"
                            className="h-4 min-w-4 px-1 text-[10px]"
                          >
                            {e.unread}
                          </Badge>
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {e.mission_name ?? "—"}
                      </div>
                      <div className="text-xs text-muted-foreground/80 truncate mt-1">
                        {e.last_message_preview}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <div>
          {selected ? (
            <CoordinationThread
              missionId={selected.mission_id}
              otherUserId={selected.other_user_id}
              otherUserName={selected.other_user_name}
            />
          ) : (
            <Card className="h-[420px] grid place-items-center text-sm text-muted-foreground">
              Selecione uma conversa à esquerda.
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
