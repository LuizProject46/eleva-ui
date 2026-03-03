import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { PdiCloseResult } from '@/types/pdi';

const RESULT_LABELS: Record<PdiCloseResult, string> = {
  completed: 'Concluído',
  partial: 'Parcial',
  not_completed: 'Não concluído',
};

interface PdiCloseSectionProps {
  onClose: (result: PdiCloseResult, closeComment: string | null) => void;
}

export function PdiCloseSection({ onClose }: PdiCloseSectionProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [result, setResult] = useState<PdiCloseResult>('completed');
  const [closeComment, setCloseComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      onClose(result, closeComment.trim() || null);
      setDialogOpen(false);
      setResult('completed');
      setCloseComment('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4 md:p-6 space-y-4">
      <h2 className="font-semibold text-foreground">Encerrar PDI</h2>
      <p className="text-sm text-muted-foreground">
        Ao encerrar, informe o resultado e opcionalmente um comentário final.
      </p>
      <Button onClick={() => setDialogOpen(true)}>Encerrar PDI</Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Encerrar PDI</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Resultado</Label>
              <Select value={result} onValueChange={(v) => setResult(v as PdiCloseResult)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(RESULT_LABELS) as [PdiCloseResult, string][]).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="close-comment">Comentário final (opcional)</Label>
              <Textarea
                id="close-comment"
                value={closeComment}
                onChange={(e) => setCloseComment(e.target.value)}
                className="min-h-[80px]"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Encerrando...' : 'Encerrar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
