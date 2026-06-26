import { useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, FileUp, Loader2, Sparkles, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MissionForm } from "@/components/missions/mission-form";
import { useCurrentUser } from "@/hooks/use-current-user";
import { createMission, updateMissionFromExtraction } from "@/lib/missions.queries";
import {
  uploadAndCreateVersion,
  freezeVersion,
  createTargetsFromExtraction,
} from "@/lib/document-versions.queries";
import { extractMissionDocument } from "@/lib/document-versions.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/missions/new")({
  component: NewMissionPage,
});

type UploadStatus = "idle" | "uploading" | "extracting" | "done" | "error";

function NewMissionPage() {
  const navigate = useNavigate();
  const { data: user } = useCurrentUser();
  const extractFn = useServerFn(extractMissionDocument);
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"upload" | "manual">("upload");
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleFile(file: File) {
    if (!/\.(pdf|docx)$/i.test(file.name)) {
      toast.error("Apenas PDF ou DOCX");
      return;
    }
    if (!user?.id) return;

    setErrorMsg(null);
    setStatus("uploading");
    try {
      const mission = await createMission({
        name: "Nova missão",
        target_label: "Concorrente",
        analyst_ids: [],
        contractor_ids: [],
      });
      const version = await uploadAndCreateVersion({
        missionId: mission.id,
        file,
        authorId: user.id,
        docType: "base",
      });

      setStatus("extracting");
      try {
        await extractFn({ data: { versionId: version.id } });
        const { data: ver } = await supabase
          .from("document_versions")
          .select("extracted_data")
          .eq("id", version.id)
          .single();
        const extracted = (ver?.extracted_data ?? {}) as Parameters<
          typeof updateMissionFromExtraction
        >[1];
        await updateMissionFromExtraction(mission.id, extracted);
        await freezeVersion(version.id);
        await createTargetsFromExtraction(version.id);
      } catch (e) {
        console.error("Extraction failed", e);
        toast.warning("Não consegui extrair tudo automaticamente. Edite os campos manualmente.");
      }

      setStatus("done");
      setTimeout(
        () => navigate({ to: "/missions/$missionId", params: { missionId: mission.id } }),
        800,
      );
    } catch (e) {
      console.error(e);
      setStatus("error");
      setErrorMsg(e instanceof Error ? e.message : "Falha ao criar missão");
      toast.error(e instanceof Error ? e.message : "Falha ao criar missão");
    }
  }

  return (
    <div className="max-w-3xl mx-auto w-full space-y-6">
      <div>
        <Link
          to="/missions"
          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-2"
        >
          <ArrowLeft className="h-3 w-3" /> Voltar para missões
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Nova missão</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Envie o briefing e a IA cria a missão para você — ou preencha manualmente.
        </p>
      </div>

      {mode === "upload" ? (
        <UploadMode
          status={status}
          errorMsg={errorMsg}
          fileRef={fileRef}
          onFile={handleFile}
          onSwitchManual={() => setMode("manual")}
          onRetry={() => {
            setStatus("idle");
            setErrorMsg(null);
          }}
        />
      ) : (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => setMode("upload")}
            className="text-xs text-primary hover:underline inline-flex items-center gap-1"
          >
            <Sparkles className="h-3 w-3" /> Voltar para envio por IA
          </button>
          <MissionForm />
        </div>
      )}
    </div>
  );
}

function UploadMode({
  status,
  errorMsg,
  fileRef,
  onFile,
  onSwitchManual,
  onRetry,
}: {
  status: UploadStatus;
  errorMsg: string | null;
  fileRef: React.RefObject<HTMLInputElement | null>;
  onFile: (f: File) => void;
  onSwitchManual: () => void;
  onRetry: () => void;
}) {
  if (status === "uploading" || status === "extracting" || status === "done") {
    const message =
      status === "uploading"
        ? "Enviando arquivo…"
        : status === "extracting"
          ? "IA lendo o documento e extraindo dados da missão…"
          : "Missão criada! Redirecionando…";
    return (
      <Card className="p-12 flex flex-col items-center justify-center gap-4 text-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <div>
          <p className="font-medium">{message}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Isso pode levar alguns segundos. Não feche a página.
          </p>
        </div>
      </Card>
    );
  }

  if (status === "error") {
    return (
      <Card className="p-8 flex flex-col items-center text-center gap-4">
        <AlertTriangle className="h-10 w-10 text-destructive" />
        <div>
          <p className="font-medium">Não foi possível criar a missão</p>
          {errorMsg && <p className="text-xs text-muted-foreground mt-1">{errorMsg}</p>}
        </div>
        <div className="flex gap-2">
          <Button onClick={onRetry}>Tentar novamente</Button>
          <Button variant="ghost" onClick={onSwitchManual}>
            Preencher manualmente
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card
        className="p-12 border-2 border-dashed border-border hover:border-primary/50 transition-colors flex flex-col items-center justify-center gap-4 text-center cursor-pointer"
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          e.currentTarget.classList.add("border-primary");
        }}
        onDragLeave={(e) => {
          e.currentTarget.classList.remove("border-primary");
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.currentTarget.classList.remove("border-primary");
          const f = e.dataTransfer.files[0];
          if (f) onFile(f);
        }}
      >
        <FileUp className="h-12 w-12 text-muted-foreground" />
        <div>
          <h2 className="text-lg font-semibold">Enviar briefing da missão</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-md">
            A IA lê o documento e cria a missão automaticamente. Você edita os detalhes depois.
          </p>
        </div>
        <Button type="button" onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}>
          <Sparkles className="h-4 w-4 mr-2" />
          Selecionar arquivo (PDF ou DOCX)
        </Button>
        <p className="text-[11px] text-muted-foreground">ou arraste o arquivo aqui</p>
        <input
          type="file"
          ref={fileRef}
          accept=".pdf,.docx"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            e.target.value = "";
          }}
        />
      </Card>

      <div className="text-center">
        <button
          type="button"
          onClick={onSwitchManual}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Prefere preencher manualmente?{" "}
          <span className="text-primary underline">Abrir formulário</span>
        </button>
      </div>
    </div>
  );
}