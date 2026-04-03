import { useCallback, useEffect, useState } from 'react';
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/lib/supabase';
import {
  getNineBoxEvaluationFullForModal,
  upsertNineBoxEvaluation,
} from '@/services/nineBoxService';
import type { NineBoxAxisLevel } from '@/types/nineBox';

const AXIS_OPTIONS: { value: NineBoxAxisLevel; label: string }[] = [
  { value: 'low', label: 'Baixo' },
  { value: 'medium', label: 'Médio' },
  { value: 'high', label: 'Alto' },
];

export interface ProfileOption {
  id: string;
  name: string;
}

export interface NineBoxEvalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  currentUserId: string;
  isManager: boolean;
  managerUserId: string | undefined;
  mode: 'create' | 'edit';
  /** Fixed employee when adding from list row or editing */
  employeeId: string | null;
  employeeName?: string | null;
  onSuccess: () => void;
}

function isAxisLevel(v: string): v is NineBoxAxisLevel {
  return v === 'low' || v === 'medium' || v === 'high';
}

export function NineBoxEvalModal({
  open,
  onOpenChange,
  tenantId,
  currentUserId,
  isManager,
  managerUserId,
  mode,
  employeeId: fixedEmployeeId,
  employeeName: fixedEmployeeName,
  onSuccess,
}: NineBoxEvalModalProps) {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [selectedEmployeeName, setSelectedEmployeeName] = useState('');
  const [performance, setPerformance] = useState<NineBoxAxisLevel>('medium');
  const [potential, setPotential] = useState<NineBoxAxisLevel>('medium');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loadingEval, setLoadingEval] = useState(false);

  const [comboOpen, setComboOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ProfileOption[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const employeePickerLocked = mode === 'edit' || fixedEmployeeId !== null;

  const searchEmployees = useCallback(
    async (q: string) => {
      if (!tenantId) return;
      setSearchLoading(true);
      let query = supabase
        .from('profiles')
        .select('id, name')
        .eq('tenant_id', tenantId)
        .neq('id', currentUserId)
        .eq('is_active', true)
        .order('name')
        .limit(20);
      if (isManager && managerUserId) {
        query = query.eq('manager_id', managerUserId);
      }
      if (q.trim()) {
        query = query.ilike('name', `%${q.trim()}%`);
      }
      const { data, error } = await query;
      setSearchLoading(false);
      if (error) {
        setSearchResults([]);
        return;
      }
      setSearchResults((data ?? []).map((p) => ({ id: p.id, name: p.name })));
    },
    [tenantId, currentUserId, isManager, managerUserId]
  );

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      void searchEmployees(searchQuery);
    }, 200);
    return () => clearTimeout(t);
  }, [open, searchQuery, searchEmployees]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    async function resetOrLoad() {
      setSearchQuery('');
      setComboOpen(false);
      setSubmitting(false);

      if (mode === 'edit' && fixedEmployeeId) {
        setSelectedEmployeeId(fixedEmployeeId);
        setSelectedEmployeeName(fixedEmployeeName ?? '');
        setLoadingEval(true);
        try {
          const row = await getNineBoxEvaluationFullForModal(tenantId, fixedEmployeeId);
          if (cancelled || !row) {
            if (!cancelled && !row) toast.error('Avaliação não encontrada');
            return;
          }
          if (isAxisLevel(row.performance)) setPerformance(row.performance);
          if (isAxisLevel(row.potential)) setPotential(row.potential);
          setNotes(row.notes ?? '');
        } catch {
          if (!cancelled) toast.error('Erro ao carregar avaliação');
        } finally {
          if (!cancelled) setLoadingEval(false);
        }
        return;
      }

      setLoadingEval(false);
      setPerformance('medium');
      setPotential('medium');
      setNotes('');
      if (fixedEmployeeId) {
        setSelectedEmployeeId(fixedEmployeeId);
        setSelectedEmployeeName(fixedEmployeeName ?? '');
      } else {
        setSelectedEmployeeId('');
        setSelectedEmployeeName('');
      }
    }

    void resetOrLoad();
    return () => {
      cancelled = true;
    };
  }, [open, mode, fixedEmployeeId, fixedEmployeeName, tenantId]);

  const handleSubmit = async () => {
    const empId = selectedEmployeeId;
    if (!empId) {
      toast.error('Selecione um colaborador');
      return;
    }
    setSubmitting(true);
    try {
      await upsertNineBoxEvaluation({
        tenantId,
        employeeId: empId,
        performance,
        potential,
        notes: notes.trim() ? notes : null,
        evaluatedBy: currentUserId,
      });
      toast.success(mode === 'edit' ? 'Avaliação atualizada' : 'Avaliação salva');
      onSuccess();
      onOpenChange(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro ao salvar';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === 'edit' ? 'Editar posição 9-Box' : 'Nova avaliação 9-Box'}</DialogTitle>
        </DialogHeader>

        {loadingEval ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4 py-1">
            <div className="space-y-2">
              <Label>Colaborador</Label>
              {employeePickerLocked ? (
                <p className="text-sm font-medium text-foreground border rounded-md px-3 py-2 bg-muted/30">
                  {selectedEmployeeName || '—'}
                </p>
              ) : (
                <Popover open={comboOpen} onOpenChange={setComboOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      aria-expanded={comboOpen}
                      className="w-full justify-between font-normal"
                    >
                      <span className="truncate">
                        {selectedEmployeeName || 'Buscar colaborador...'}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                    <Command shouldFilter={false}>
                      <CommandInput
                        placeholder="Nome..."
                        value={searchQuery}
                        onValueChange={setSearchQuery}
                      />
                      <CommandList>
                        {searchLoading ? (
                          <div className="py-6 text-center text-sm text-muted-foreground">
                            Carregando...
                          </div>
                        ) : (
                          <>
                            <CommandEmpty>Nenhum encontrado.</CommandEmpty>
                            <CommandGroup>
                              {searchResults.map((p) => (
                                <CommandItem
                                  key={p.id}
                                  value={p.id}
                                  onSelect={() => {
                                    setSelectedEmployeeId(p.id);
                                    setSelectedEmployeeName(p.name);
                                    setComboOpen(false);
                                  }}
                                >
                                  <Check
                                    className={
                                      selectedEmployeeId === p.id
                                        ? 'mr-2 h-4 w-4 opacity-100'
                                        : 'mr-2 h-4 w-4 opacity-0'
                                    }
                                  />
                                  {p.name}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </>
                        )}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="nine-box-performance">Desempenho</Label>
              <Select value={performance} onValueChange={(v) => setPerformance(v as NineBoxAxisLevel)}>
                <SelectTrigger id="nine-box-performance">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AXIS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="nine-box-potential">Potencial</Label>
              <Select value={potential} onValueChange={(v) => setPotential(v as NineBoxAxisLevel)}>
                <SelectTrigger id="nine-box-potential">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AXIS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="nine-box-notes">Observações (opcional)</Label>
              <Textarea
                id="nine-box-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Notas internas..."
                className="resize-none"
              />
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => void handleSubmit()} disabled={submitting || loadingEval}>
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
