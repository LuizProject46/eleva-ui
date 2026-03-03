import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface PdiApprovalSectionProps {
  onApprove: () => void;
  onReject: () => void;
}

export function PdiApprovalSection({ onApprove, onReject }: PdiApprovalSectionProps) {
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);

  return (
    <div className="rounded-lg border border-border bg-card p-4 md:p-6 space-y-4">
      <h2 className="font-semibold text-foreground">Aprovação</h2>
      <p className="text-sm text-muted-foreground">Este PDI está aguardando sua aprovação.</p>
      <div className="flex gap-2">
        <Button onClick={() => setApproveOpen(true)}>Aprovar</Button>
        <Button variant="outline" onClick={() => setRejectOpen(true)}>
          Devolver para ajustes
        </Button>
      </div>

      <AlertDialog open={approveOpen} onOpenChange={setApproveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Aprovar PDI?</AlertDialogTitle>
            <AlertDialogDescription>
              O PDI ficará ativo e o colaborador poderá executar as ações.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button
              onClick={() => {
                onApprove();
                setApproveOpen(false);
              }}
            >
              Aprovar
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Devolver PDI?</AlertDialogTitle>
            <AlertDialogDescription>
              O status voltará para rascunho. O gestor poderá fazer ajustes e reenviar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={() => {
                onReject();
                setRejectOpen(false);
              }}
            >
              Devolver
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
