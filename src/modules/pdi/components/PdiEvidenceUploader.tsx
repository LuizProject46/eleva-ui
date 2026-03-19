import { useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { validatePdiEvidenceFile, getPdiEvidenceSignedUrl } from '@/modules/pdi/services/pdiEvidenceService';
import type { PdiEvidence } from '@/types/pdi';

import { toast } from 'sonner';
import { Eye, Loader2, Upload } from 'lucide-react';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(kb >= 100 ? 0 : 1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(mb >= 10 ? 1 : 2)} MB`;
}

function formatEvidenceDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR');
}

function statusBadgeVariant(status: PdiEvidence['status']): { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string } {
  switch (status) {
    case 'approved':
      return { variant: 'default', label: 'Aprovada' };
    case 'rejected':
      return { variant: 'destructive', label: 'Rejeitada' };
    case 'pending':
    default:
      return { variant: 'secondary', label: 'Pendente' };
  }
}

function getEvidenceAcceptAttr(): string {
  // Browser-friendly accept string (mime + extensions)
  return [
    'application/pdf',
    'image/*',
    '.doc',
    '.docx',
    '.xls',
    '.xlsx',
    '.ppt',
    '.pptx',
    '.txt',
    '.rtf',
    '.odt',
    '.ods',
    '.odp',
  ].join(',');
}

export interface PdiEvidenceUploaderProps {
  label: string;
  canUpload: boolean;
  evidences: PdiEvidence[];
  onUploadEvidence: (file: File) => Promise<void>;
}

export function PdiEvidenceUploader({
  label,
  canUpload,
  evidences,
  onUploadEvidence,
}: PdiEvidenceUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isViewingEvidenceId, setIsViewingEvidenceId] = useState<string | null>(null);
  const [viewEvidence, setViewEvidence] = useState<PdiEvidence | null>(null);
  const [viewSignedUrl, setViewSignedUrl] = useState<string | null>(null);

  const evidencesSorted = useMemo(() => {
    return [...evidences].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [evidences]);

  const handlePickFile = () => {
    if (!canUpload) return;
    inputRef.current?.click();
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const err = validatePdiEvidenceFile(file);
    if (err) {
      toast.error(err);
      e.target.value = '';
      return;
    }

    setIsUploading(true);
    try {
      await onUploadEvidence(file);
      toast.success('Evidência enviada.');
    } catch (uploadErr) {
      const msg = uploadErr instanceof Error ? uploadErr.message : 'Falha ao enviar evidência.';
      toast.error(msg);
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleViewEvidence = async (evidence: PdiEvidence) => {
    setIsViewingEvidenceId(evidence.id);
    setViewEvidence(evidence);
    setViewSignedUrl(null);
    try {
      const url = await getPdiEvidenceSignedUrl({ storagePath: evidence.storage_path, expiresInSeconds: 3600 });
      setViewSignedUrl(url);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Não foi possível abrir o arquivo.';
      toast.error(msg);
    } finally {
      setIsViewingEvidenceId(null);
    }
  };

  const hasEvidences = evidencesSorted.length > 0;
  const isViewRejected = viewEvidence?.status === 'rejected';
  const viewFeedbackTrimmed = viewEvidence?.feedback?.trim() ?? '';
  const canShowViewFeedback = isViewRejected && viewFeedbackTrimmed.length > 0;
  const viewBadge = viewEvidence ? statusBadgeVariant(viewEvidence.status) : null;
  const isFetchingViewUrl = viewEvidence ? isViewingEvidenceId === viewEvidence.id : false;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
        {canUpload && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="shrink-0"
            disabled={isUploading}
            onClick={handlePickFile}
          >
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Enviar
              </>
            )}
          </Button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={getEvidenceAcceptAttr()}
        className="hidden"
        onChange={handleFileSelected}
        disabled={!canUpload || isUploading}
      />

      {!hasEvidences ? (
        <p className="text-sm text-muted-foreground italic">Nenhuma evidência enviada.</p>
      ) : (
        <div className="space-y-2">
          {evidencesSorted.map((evidence) => {
            const badge = statusBadgeVariant(evidence.status);
            const isViewing = isViewingEvidenceId === evidence.id;
            return (
              <div
                key={evidence.id}
                className={cn(
                  'flex items-start justify-between gap-3 rounded-md border bg-background p-2',
                  evidence.status === 'rejected' ? 'border-destructive/30' : 'border-border'
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={badge.variant} className="shrink-0">
                      {badge.label}
                    </Badge>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(evidence.created_at).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-foreground truncate mt-1">{evidence.file_name}</p>
                  <p className="text-xs text-muted-foreground">{formatBytes(evidence.file_size_bytes)}</p>
                </div>
                <div className="shrink-0">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="gap-2"
                    onClick={() => void handleViewEvidence(evidence)}
                    disabled={isViewing}
                  >
                    {isViewing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                    Ver
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog
        open={viewEvidence !== null}
        onOpenChange={(open) => {
          if (open) return;
          if (isFetchingViewUrl) return;
          setViewEvidence(null);
          setViewSignedUrl(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detalhes da evidência</DialogTitle>
          </DialogHeader>

          {viewEvidence && viewBadge ? (
            <div className="space-y-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={viewBadge.variant} className="shrink-0">
                    {viewBadge.label}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    Enviada em {formatEvidenceDate(viewEvidence.created_at)}
                  </span>
                </div>
                <p className="text-sm font-medium text-foreground break-words">{viewEvidence.file_name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatBytes(viewEvidence.file_size_bytes)}
                </p>
              </div>

              {canShowViewFeedback ? (
                <div className="rounded-lg border border-destructive/25 bg-destructive/5 p-3">
                  <p className="text-xs font-medium text-destructive mb-2">Feedback do gestor</p>
                  <blockquote className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                    {viewFeedbackTrimmed}
                  </blockquote>
                </div>
              ) : null}
            </div>
          ) : null}

          <DialogFooter className="gap-2 sm:gap-0 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (isFetchingViewUrl) return;
                setViewEvidence(null);
                setViewSignedUrl(null);
              }}
              disabled={isFetchingViewUrl}
            >
              Fechar
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (!viewSignedUrl) {
                  toast.error('Arquivo ainda não está pronto para abrir.');
                  return;
                }
                window.open(viewSignedUrl, '_blank', 'noopener,noreferrer');
              }}
              disabled={!viewSignedUrl || isFetchingViewUrl}
              className="gap-2"
            >
              {isFetchingViewUrl ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Abrir arquivo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

