import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Upload, Trash2, FileText, Film, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  EVIDENCE_TYPES,
  EVIDENCE_TYPE_LABEL,
  deleteEvidence,
  evidencesByTargetKey,
  getEvidenceSignedUrl,
  listEvidencesByTarget,
  uploadEvidence,
  type Evidence,
  type EvidenceType,
} from "@/lib/evidences.queries";
import { targetDetailKey } from "@/lib/targets.queries";

const MAX_SIZE = 50 * 1024 * 1024;

function toLocalInput(d: Date) {
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 16);
}

export function EvidencesTab({
  missionId,
  targetId,
}: {
  missionId: string;
  targetId: string;
}) {
  const qc = useQueryClient();
  const { data: user } = useCurrentUser();
  const fileRef = useRef<HTMLInputElement>(null);

  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [evidenceType, setEvidenceType] = useState<EvidenceType>("screenshot");
  const [caption, setCaption] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [capturedAt, setCapturedAt] = useState(toLocalInput(new Date()));

  const { data: evidences = [], isLoading } = useQuery({
    queryKey: evidencesByTargetKey(targetId),
    queryFn: () => listEvidencesByTarget(targetId),
  });

  const uploadMut = useMutation({
    mutationFn: async () => {
      if (!user?.id || !pendingFile) throw new Error("Sem usuário/arquivo");
      return uploadEvidence({
        missionId,
        targetId,
        file: pendingFile,
        evidenceType,
        caption: caption || undefined,
        tags: tagsInput.split(",").map((t) => t.trim()).filter(Boolean),
        capturedAt: new Date(capturedAt).toISOString(),
        userId: user.id,
      });
    },
    onSuccess: () => {
      toast.success("Evidência enviada");
      qc.invalidateQueries({ queryKey: evidencesByTargetKey(targetId) });
      qc.invalidateQueries({ queryKey: targetDetailKey(targetId) });
      setPendingFile(null);
      setCaption("");
      setTagsInput("");
      setCapturedAt(toLocalInput(new Date()));
      setEvidenceType("screenshot");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao enviar"),
  });

  const delMut = useMutation({
    mutationFn: (ev: Evidence) => deleteEvidence(ev),
    onSuccess: () => {
      toast.success("Evidência removida");
      qc.invalidateQueries({ queryKey: evidencesByTargetKey(targetId) });
      qc.invalidateQueries({ queryKey: targetDetailKey(targetId) });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao remover"),
  });

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > MAX_SIZE) {
      toast.error("Arquivo excede 50 MB");
      e.target.value = "";
      return;
    }
    setPendingFile(f);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-medium">Evidências ({evidences.length})</h3>
        <Button size="sm" onClick={() => fileRef.current?.click()}>
          <Upload className="h-4 w-4 mr-1" /> Enviar arquivo
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,application/pdf,video/mp4"
          onChange={onPickFile}
          className="hidden"
        />
      </div>

      {isLoading ? (
        <div className="grid place-items-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : evidences.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          Nenhuma evidência ainda. Envie um screenshot, print, gravação ou documento.
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {evidences.map((ev) => (
            <EvidenceCard key={ev.id} ev={ev} onDelete={() => delMut.mutate(ev)} deleting={delMut.isPending} />
          ))}
        </div>
      )}

      <Dialog open={!!pendingFile} onOpenChange={(o) => !o && setPendingFile(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Detalhes da evidência</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {pendingFile && (
              <div className="text-xs text-muted-foreground">
                Arquivo: <strong>{pendingFile.name}</strong> ({Math.round(pendingFile.size / 1024)} KB)
              </div>
            )}
            <div>
              <label className="text-xs uppercase tracking-wide text-muted-foreground">Tipo</label>
              <Select value={evidenceType} onValueChange={(v) => setEvidenceType(v as EvidenceType)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EVIDENCE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{EVIDENCE_TYPE_LABEL[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-muted-foreground">Descrição</label>
              <Input value={caption} onChange={(e) => setCaption(e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-muted-foreground">
                Tags (separadas por vírgula)
              </label>
              <Input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="ex: instagram, preço" className="mt-1" />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-muted-foreground">Capturado em</label>
              <Input type="datetime-local" value={capturedAt} onChange={(e) => setCapturedAt(e.target.value)} className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingFile(null)}>Cancelar</Button>
            <Button onClick={() => uploadMut.mutate()} disabled={uploadMut.isPending}>
              {uploadMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EvidenceCard({ ev, onDelete, deleting }: { ev: Evidence; onDelete: () => void; deleting: boolean }) {
  const { data: signed } = useQuery({
    queryKey: ["evidence-signed", ev.id, ev.file_url],
    queryFn: () => (ev.file_url ? getEvidenceSignedUrl(ev.file_url) : Promise.resolve("")),
    enabled: !!ev.file_url,
    staleTime: 50 * 60_000,
  });
  const isImage = ev.file_url?.match(/\.(png|jpe?g|webp|gif)$/i);
  const isVideo = ev.file_url?.match(/\.mp4$/i);

  return (
    <Card className="overflow-hidden">
      <div className="aspect-video bg-muted grid place-items-center overflow-hidden">
        {isImage && signed ? (
          <a href={signed} target="_blank" rel="noreferrer">
            <img src={signed} alt={ev.caption ?? ""} className="w-full h-full object-cover" />
          </a>
        ) : isVideo ? (
          <Film className="h-10 w-10 text-muted-foreground" />
        ) : (
          <FileText className="h-10 w-10 text-muted-foreground" />
        )}
      </div>
      <div className="p-2 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <Badge variant="outline" className="text-[10px]">
            {EVIDENCE_TYPE_LABEL[ev.evidence_type as EvidenceType] ?? ev.evidence_type}
          </Badge>
          <Button size="icon" variant="ghost" onClick={onDelete} disabled={deleting} className="h-6 w-6">
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </Button>
        </div>
        {ev.caption && <p className="text-xs truncate" title={ev.caption}>{ev.caption}</p>}
        {ev.tags && ev.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {ev.tags.map((t) => (
              <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>
            ))}
          </div>
        )}
        <p className="text-[10px] text-muted-foreground">
          {ev.captured_at ? new Date(ev.captured_at).toLocaleString("pt-BR") : ""}
        </p>
      </div>
    </Card>
  );
}

// referenced to avoid unused import warning; ImageIcon may help future placeholder
void ImageIcon;