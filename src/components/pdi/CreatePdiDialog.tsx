import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { createPdi } from '@/modules/pdi/services/pdiService';
import type { PdiType } from '@/types/pdi';
import { PDI_TYPE_OPTIONS } from '@/constants/pdiTypes';
import { toast } from 'sonner';
import { AsyncSearchCombobox } from '@/components/async/AsyncSearchCombobox';
import type { AsyncSearchOption } from '@/components/async/AsyncSearchCombobox';

interface CreatePdiDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (pdiId: string) => void;
}

export function CreatePdiDialog({ open, onOpenChange, onSuccess }: CreatePdiDialogProps) {
  const { user } = useAuth();
  const [employee, setEmployee] = useState<AsyncSearchOption | null>(null);
  const [type, setType] = useState<PdiType>('performance_improvement');
  const [title, setTitle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const searchEmployees = useCallback(
    async (query: string): Promise<AsyncSearchOption[]> => {
      if (!user?.tenantId) return [];
      let q = supabase
        .from('profiles')
        .select('id, name')
        .eq('tenant_id', user.tenantId)
        .eq('is_active', true)
        .order('name')
        .limit(20);
      if (query.trim()) {
        q = q.ilike('name', `%${query.trim()}%`);
      }
      if (user?.role === 'manager' && user?.id) {
        q = q.eq('manager_id', user.id);
      }
      const { data, error } = await q;
      if (error) return [];
      return (data ?? []).map((r) => ({ id: r.id, label: r.name ?? '' }));
    },
    [user?.tenantId, user?.id, user?.role]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.tenantId || !employee?.id) {
      toast.error('Selecione o colaborador.');
      return;
    }
    setIsSubmitting(true);
    try {
      const pdi = await createPdi({
        tenant_id: user.tenantId,
        employee_id: employee.id,
        type,
        title: title.trim() || null,
        created_by: user?.id ?? null,
      });
      onSuccess(pdi.id);
    } catch {
      toast.error('Erro ao criar PDI.');
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setEmployee(null);
      setType('performance_improvement');
      setTitle('');
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo PDI</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pdi-employee">Colaborador</Label>
            <AsyncSearchCombobox
              value={employee}
              onValueChange={setEmployee}
              onSearch={searchEmployees}
              placeholder="Selecione"
              searchPlaceholder="Buscar por nome..."
              emptyMessage="Nenhum encontrado."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pdi-type">Tipo</Label>
            <Select value={type} onValueChange={(v) => setType(v as PdiType)}>
              <SelectTrigger id="pdi-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PDI_TYPE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pdi-title">Título (opcional)</Label>
            <Input
              id="pdi-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: PDI Q1 2025"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Criando...' : 'Criar PDI'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
