import { useState, useEffect, useCallback } from 'react';
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
import { createPdi } from '@/services/pdiService';
import type { PdiOrigin } from '@/types/pdi';
import { toast } from 'sonner';
import { AsyncSearchCombobox } from '@/components/async/AsyncSearchCombobox';
import type { AsyncSearchOption } from '@/components/async/AsyncSearchCombobox';

interface CreatePdiDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (pdiId: string) => void;
}

interface EvaluationOption {
  id: string;
  submitted_at: string | null;
}

const ORIGIN_OPTIONS: { value: PdiOrigin; label: string }[] = [
  { value: 'evaluation', label: 'Avaliação' },
  { value: 'disc', label: 'DISC' },
  { value: 'feedback', label: 'Feedback' },
];

const NONE_VALUE = '__none__';

export function CreatePdiDialog({ open, onOpenChange, onSuccess }: CreatePdiDialogProps) {
  const { user, canManagePdi } = useAuth();
  const [employee, setEmployee] = useState<AsyncSearchOption | null>(null);
  const [evaluations, setEvaluations] = useState<EvaluationOption[]>([]);
  const [assessments, setAssessments] = useState<{ id: string }[]>([]);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [origin, setOrigin] = useState<PdiOrigin>('evaluation');
  const [evaluationId, setEvaluationId] = useState<string>('');
  const [behavioralAssessmentId, setBehavioralAssessmentId] = useState<string>('');
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

  const fetchEvaluationsForEmployee = useCallback(async (empId: string) => {
    const { data } = await supabase
      .from('evaluations')
      .select('id, submitted_at')
      .eq('evaluated_id', empId)
      .eq('status', 'submitted')
      .order('submitted_at', { ascending: false });
    setEvaluations((data ?? []) as EvaluationOption[]);
  }, []);

  const fetchAssessmentForEmployee = useCallback(async (empId: string) => {
    const { data } = await supabase
      .from('behavioral_assessments')
      .select('id')
      .eq('user_id', empId)
      .eq('status', 'completed')
      .maybeSingle();
    setAssessments(data ? [data] : []);
  }, []);

  useEffect(() => {
    if (!employee?.id) {
      setEvaluations([]);
      setAssessments([]);
      setEvaluationId('');
      setBehavioralAssessmentId('');
      return;
    }
    fetchEvaluationsForEmployee(employee.id);
    fetchAssessmentForEmployee(employee.id);
    setEvaluationId('');
    setBehavioralAssessmentId('');
  }, [employee?.id, fetchEvaluationsForEmployee, fetchAssessmentForEmployee]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.tenantId || !employee?.id || !startDate || !endDate) {
      toast.error('Preencha colaborador e período.');
      return;
    }
    if (new Date(startDate) > new Date(endDate)) {
      toast.error('Data inicial deve ser anterior à data final.');
      return;
    }
    setIsSubmitting(true);
    try {
      const pdi = await createPdi({
        tenant_id: user.tenantId,
        employee_id: employee.id,
        start_date: startDate,
        end_date: endDate,
        origin,
        evaluation_id: origin === 'evaluation' && evaluationId ? evaluationId : null,
        behavioral_assessment_id: origin === 'disc' && behavioralAssessmentId ? behavioralAssessmentId : null,
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
      setStartDate('');
      setEndDate('');
      setOrigin('evaluation');
      setEvaluationId('');
      setBehavioralAssessmentId('');
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
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="pdi-start">Data inicial</Label>
              <Input
                id="pdi-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pdi-end">Data final</Label>
              <Input
                id="pdi-end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pdi-origin">Origem</Label>
            <Select value={origin} onValueChange={(v) => setOrigin(v as PdiOrigin)}>
              <SelectTrigger id="pdi-origin">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ORIGIN_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {origin === 'evaluation' && evaluations.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="pdi-evaluation">Avaliação vinculada (opcional)</Label>
              <Select
                value={evaluationId || NONE_VALUE}
                onValueChange={(v) => setEvaluationId(v === NONE_VALUE ? '' : v)}
              >
                <SelectTrigger id="pdi-evaluation">
                  <SelectValue placeholder="Nenhuma" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>Nenhuma</SelectItem>
                  {evaluations.map((ev) => (
                    <SelectItem key={ev.id} value={ev.id}>
                      Avaliação {ev.submitted_at ? new Date(ev.submitted_at).toLocaleDateString('pt-BR') : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {origin === 'disc' && assessments.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="pdi-disc">DISC vinculado (opcional)</Label>
              <Select
                value={behavioralAssessmentId || NONE_VALUE}
                onValueChange={(v) => setBehavioralAssessmentId(v === NONE_VALUE ? '' : v)}
              >
                <SelectTrigger id="pdi-disc">
                  <SelectValue placeholder="Nenhum" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>Nenhum</SelectItem>
                  {assessments.map((a) => (
                    <SelectItem key={a.id} value={a.id}>Teste DISC</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
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
