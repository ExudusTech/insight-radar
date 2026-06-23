import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Upload,
  Loader2,
  FileText,
  ChevronDown,
  CheckCircle2,
  Snowflake,
  Users,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  docVersionsKey,
  listDocumentVersions,
  uploadAndCreateVersion,
  freezeVersion,
  createTargetsFromExtraction,
  type DocumentVersion,
} from "@/lib/document-versions.queries";
import { extractMissionDocument } from "@/lib/document-versions.functions";
import { targetsByMissionKey } from "@/lib/targets.queries";
import { missionDetailKey } from "@/lib/missions.queries";

type ExtractedData = {
  mission_name?: string;
  objective?: string;
  segment?: string;
  ethical_rules?: string;
  approach_type?: string;
  deadline_first?: string;
  deadline_final?: string;
  targets?: Array<{
    name?: string;
    instagram?: string;
    whatsapp?: string;
    linkedin?: string;
    category?: string;
  }>;
  collection_blocks?: Record<string, string>;
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho",
  reviewing: "Em revisão",
  approved: "Aprovado",
  rejected: "Rejeitado",
  replaced: "Substituído",
  frozen: "Congelado",
};

export function DocumentBaseTab({ missionId }: { missionId: string }) {
  const qc = useQueryClient();
  const { data: user } = useCurrentUser();
  const fileRef = useRef<HTMLInputElement>(null);
  const [extractingId, setExtractingId] = useState<string | null>(null);
  const extractFn = useServerFn(extractMissionDocument);

  const { data: versions = [], isLoading } = useQuery({
    queryKey: docVersionsKey(missionId),
    queryFn: () => listDocumentVersions(missionId),
  });

  const latest = versions[0] as DocumentVersion | undefined;

  const uploadMut = useMutation({
    mutationFn: async (file: File) => {
      if (!user?.id) throw new Error("Sem usuário");
      return uploadAndCreateVersion({ missionId, file, authorId: user.id });
    },
    onSuccess: async (version) => {
      toast.success(`Versão #${version.version_number} enviada. Extraindo com IA…`);
      await qc.invalidateQueries({ queryKey: docVersionsKey(missionId) });
      setExtractingId(version.id);
      try {
        await extractFn({ data: { versionId: version.id } });
        toast.success("Extração concluída. Revise abaixo.");
        await qc.invalidateQueries({ queryKey: docVersionsKey(missionId) });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Falha na extração");
      } finally {
        setExtractingId(null);
      }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha no upload"),
  });

  const reextractMut = useMutation({
    mutationFn: async (versionId: string) => {
      setExtractingId(versionId);
      return extractFn({ data: { versionId } });
    },
    onSuccess: async () => {
      toast.success("Extração concluída.");
      await qc.invalidateQueries({ queryKey: docVersionsKey(missionId) });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha na extração"),
    onSettled: () => setExtractingId(null),
  });

  const freezeMut = useMutation({
    mutationFn: (versionId: string) => freezeVersion(versionId),
    onSuccess: async () => {
      toast.success("Versão congelada. Missão atualizada.");
      await qc.invalidateQueries({ queryKey: docVersionsKey(missionId) });
      await qc.invalidateQueries({ queryKey: missionDetailKey(missionId) });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao congelar"),
  });

  const createTargetsMut = useMutation({
    mutationFn: (versionId: string) => createTargetsFromExtraction(versionId),
    onSuccess: async (res) => {
      toast.success(`${res.created} alvos criados (${res.skipped} pulados).`);
      await qc.invalidateQueries({ queryKey: targetsByMissionKey(missionId) });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao criar alvos"),
  });

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!/\.(pdf|docx)$/i.test(f.name)) {
      toast.error("Apenas PDF ou DOCX.");
      return;
    }
    uploadMut.mutate(f);
    e.target.value = "";
  };

  const hasFrozen = versions.some((v) => v.status === "frozen");

  return (
    <div className="space-y-5">
      <Card className="p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-base font-semibold">Documento-base da missão</h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-xl">
              Envie o briefing em PDF ou DOCX. A IA extrai objetivo, alvos, blocos de coleta
              e regras éticas para sua revisão.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden"
              onChange={onFile}
            />
            <Button
              onClick={() => fileRef.current?.click()}
              disabled={uploadMut.isPending}
            >
              {uploadMut.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {hasFrozen ? "Enviar nova versão" : "Enviar documento"}
            </Button>
          </div>
        </div>
      </Card>

      {isLoading ? (
        <div className="grid place-items-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : versions.length === 0 ? (
        <Card className="p-12 text-center text-sm text-muted-foreground">
          Nenhum documento enviado ainda.
        </Card>
      ) : (
        <>
          {latest && (
            <CurrentVersion
              version={latest}
              extracting={extractingId === latest.id}
              onReextract={() => reextractMut.mutate(latest.id)}
              onFreeze={() => freezeMut.mutate(latest.id)}
              onCreateTargets={() => createTargetsMut.mutate(latest.id)}
              freezing={freezeMut.isPending}
              creatingTargets={createTargetsMut.isPending}
            />
          )}

          {versions.length > 1 && (
            <Card className="p-5">
              <h3 className="text-sm font-semibold mb-3">Histórico de versões</h3>
              <ul className="space-y-2">
                {versions.slice(1).map((v) => (
                  <li
                    key={v.id}
                    className="flex items-center justify-between text-sm border-b border-border/40 pb-2 last:border-0"
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span>
                        v{v.version_number} · {v.file_name ?? "sem arquivo"}
                      </span>
                    </div>
                    <Badge variant="outline">{STATUS_LABEL[v.status] ?? v.status}</Badge>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function CurrentVersion({
  version,
  extracting,
  onReextract,
  onFreeze,
  onCreateTargets,
  freezing,
  creatingTargets,
}: {
  version: DocumentVersion;
  extracting: boolean;
  onReextract: () => void;
  onFreeze: () => void;
  onCreateTargets: () => void;
  freezing: boolean;
  creatingTargets: boolean;
}) {
  const extracted = (version.extracted_data ?? null) as ExtractedData | null;
  const isFrozen = version.status === "frozen";

  return (
    <Card className="p-6 space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold">
              v{version.version_number} · {version.file_name ?? "—"}
            </span>
            <Badge variant={isFrozen ? "default" : "outline"}>
              {STATUS_LABEL[version.status] ?? version.status}
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Enviado em {new Date(version.created_at).toLocaleString("pt-BR")}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isFrozen && extracted && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={onCreateTargets}
                disabled={creatingTargets}
              >
                {creatingTargets ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Users className="h-3.5 w-3.5" />
                )}
                Criar alvos da extração
              </Button>
              <Button size="sm" onClick={onFreeze} disabled={freezing}>
                {freezing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Snowflake className="h-3.5 w-3.5" />
                )}
                Aprovar e congelar
              </Button>
            </>
          )}
          {!isFrozen && !extracted && (
            <Button size="sm" variant="outline" onClick={onReextract} disabled={extracting}>
              {extracting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              Extrair com IA
            </Button>
          )}
        </div>
      </div>

      {extracting && (
        <div className="text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Claude está processando o documento…
        </div>
      )}

      {extracted && (
        <div className="space-y-2">
          <Section title="Objetivo" defaultOpen>
            <p className="text-sm whitespace-pre-wrap">
              {extracted.objective || <em className="text-muted-foreground">—</em>}
            </p>
          </Section>

          <Section
            title={`Alvos extraídos (${extracted.targets?.length ?? 0})`}
            defaultOpen
          >
            {extracted.targets && extracted.targets.length > 0 ? (
              <ul className="space-y-2">
                {extracted.targets.map((t, i) => (
                  <li
                    key={i}
                    className="text-sm border border-border/40 rounded-md p-2.5"
                  >
                    <div className="font-medium">{t.name || "Sem nome"}</div>
                    <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3">
                      {t.category && <span>Categoria: {t.category}</span>}
                      {t.instagram && <span>IG: {t.instagram}</span>}
                      {t.whatsapp && <span>WA: {t.whatsapp}</span>}
                      {t.linkedin && <span>LI: {t.linkedin}</span>}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground italic">Nenhum alvo identificado.</p>
            )}
          </Section>

          <Section title="Blocos de coleta (A–G)">
            {extracted.collection_blocks ? (
              <div className="space-y-2">
                {Object.entries(extracted.collection_blocks).map(([k, v]) => (
                  <div key={k} className="text-sm">
                    <div className="text-xs font-semibold text-muted-foreground">
                      Bloco {k}
                    </div>
                    <p className="whitespace-pre-wrap">{v || "—"}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">Sem blocos extraídos.</p>
            )}
          </Section>

          <Section title="Regras éticas">
            <p className="text-sm whitespace-pre-wrap">
              {extracted.ethical_rules || <em className="text-muted-foreground">—</em>}
            </p>
          </Section>

          <Section title="Abordagem, prazos e segmento">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <KV k="Abordagem" v={extracted.approach_type} />
              <KV k="Segmento" v={extracted.segment} />
              <KV k="Primeira entrega" v={extracted.deadline_first} />
              <KV k="Entrega final" v={extracted.deadline_final} />
            </div>
          </Section>
        </div>
      )}

      {isFrozen && (
        <div className="text-xs text-muted-foreground flex items-center gap-1.5 pt-2 border-t border-border/40">
          <CheckCircle2 className="h-3.5 w-3.5 text-[oklch(0.55_0.18_145)]" />
          Esta versão está congelada. Para alterações, envie uma nova versão.
        </div>
      )}
    </Card>
  );
}

function Section({
  title,
  defaultOpen,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Collapsible defaultOpen={defaultOpen}>
      <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium hover:bg-muted/50 group">
        {title}
        <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="px-3 pb-3 pt-1">{children}</CollapsibleContent>
    </Collapsible>
  );
}

function KV({ k, v }: { k: string; v?: string | null }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{k}</div>
      <div>{v || "—"}</div>
    </div>
  );
}