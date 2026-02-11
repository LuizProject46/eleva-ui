import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Save } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

export type EntityType = 'evaluation' | 'assessment';
export type IntervalKind = 'bimonthly' | 'quarterly' | 'semiannual' | 'annual' | 'custom';

export interface PeriodicityConfigRow {
  id: string;
  tenant_id: string;
  entity_type: EntityType;
  interval_kind: IntervalKind;
  custom_interval_days: number | null;
  custom_interval_months: number | null;
  reference_start_date: string;
  notification_lead_days: number[];
  created_at: string;
  updated_at: string;
}

const INTERVAL_LABELS: Record<IntervalKind, string> = {
  bimonthly: 'Bimestral',
  quarterly: 'Trimestral',
  semiannual: 'Semestral',
  annual: 'Anual',
  custom: 'Personalizado',
};

const LEAD_DAY_OPTIONS = [7, 14, 30];

interface EntityFormState {
  intervalKind: IntervalKind;
  customIntervalDays: string;
  customIntervalMonths: string;
  referenceStartDate: string;
  leadDays: number[];
}

const defaultEntityState = (): EntityFormState => ({
  intervalKind: 'semiannual',
  customIntervalDays: '',
  customIntervalMonths: '',
  referenceStartDate: '',
  leadDays: [7, 14, 30],
});

function parseLeadDays(arr: unknown): number[] {
  if (!Array.isArray(arr)) return [7, 14, 30];
  const nums = arr.filter((x): x is number => typeof x === 'number' && Number.isInteger(x) && x > 0);
  return nums.length > 0 ? nums : [7, 14, 30];
}

interface PeriodicityConfigProps {
  tenantId: string;
}

export function PeriodicityConfig({ tenantId }: PeriodicityConfigProps) {
  const [evaluationState, setEvaluationState] = useState<EntityFormState>(defaultEntityState);
  const [assessmentState, setAssessmentState] = useState<EntityFormState>(defaultEntityState);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const loadConfig = useCallback(async () => {
    if (!tenantId) return;
    setIsLoading(true);
    const { data, error } = await supabase
      .from('periodicity_config')
      .select('id, entity_type, interval_kind, custom_interval_days, custom_interval_months, reference_start_date, notification_lead_days')
      .eq('tenant_id', tenantId)
      .in('entity_type', ['evaluation', 'assessment']);

    if (error) {
      toast.error('Erro ao carregar configuração');
      setIsLoading(false);
      return;
    }

    const rows = (data ?? []) as PeriodicityConfigRow[];
    const evalRow = rows.find((r) => r.entity_type === 'evaluation');
    const assessRow = rows.find((r) => r.entity_type === 'assessment');

    if (evalRow) {
      setEvaluationState({
        intervalKind: evalRow.interval_kind,
        customIntervalDays: evalRow.custom_interval_days != null ? String(evalRow.custom_interval_days) : '',
        customIntervalMonths: evalRow.custom_interval_months != null ? String(evalRow.custom_interval_months) : '',
        referenceStartDate: evalRow.reference_start_date ?? '',
        leadDays: parseLeadDays(evalRow.notification_lead_days),
      });
    }
    if (assessRow) {
      setAssessmentState({
        intervalKind: assessRow.interval_kind,
        customIntervalDays: assessRow.custom_interval_days != null ? String(assessRow.custom_interval_days) : '',
        customIntervalMonths: assessRow.custom_interval_months != null ? String(assessRow.custom_interval_months) : '',
        referenceStartDate: assessRow.reference_start_date ?? '',
        leadDays: parseLeadDays(assessRow.notification_lead_days),
      });
    }
    setIsLoading(false);
  }, [tenantId]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const toggleLeadDay = (entity: 'evaluation' | 'assessment', days: number) => {
    const setter = entity === 'evaluation' ? setEvaluationState : setAssessmentState;
    setter((prev) => {
      const next = prev.leadDays.includes(days) ? prev.leadDays.filter((d) => d !== days) : [...prev.leadDays, days].sort((a, b) => a - b);
      return { ...prev, leadDays: next.length > 0 ? next : [7] };
    });
  };

  const buildPayload = (state: EntityFormState, entityType: EntityType) => {
    const customDays = state.customIntervalDays.trim() ? parseInt(state.customIntervalDays, 10) : null;
    const customMonths = state.customIntervalMonths.trim() ? parseInt(state.customIntervalMonths, 10) : null;
    return {
      tenant_id: tenantId,
      entity_type: entityType,
      interval_kind: state.intervalKind,
      custom_interval_days: state.intervalKind === 'custom' ? customDays : null,
      custom_interval_months: state.intervalKind === 'custom' ? customMonths : null,
      reference_start_date: state.referenceStartDate || null,
      notification_lead_days: state.leadDays,
    };
  };

  const validate = (state: EntityFormState, label: string): boolean => {
    if (!state.referenceStartDate.trim()) {
      toast.error(`Data de referência é obrigatória para ${label}`);
      return false;
    }
    if (state.intervalKind === 'custom') {
      const days = state.customIntervalDays.trim() ? parseInt(state.customIntervalDays, 10) : 0;
      const months = state.customIntervalMonths.trim() ? parseInt(state.customIntervalMonths, 10) : 0;
      if (days < 1 && months < 1) {
        toast.error('Informe o intervalo personalizado em dias (1–365) ou meses (1–24)');
        return false;
      }
      if (days > 0 && (days < 1 || days > 365)) {
        toast.error('Dias devem estar entre 1 e 365');
        return false;
      }
      if (months > 0 && (months < 1 || months > 24)) {
        toast.error('Meses devem estar entre 1 e 24');
        return false;
      }
    }
    if (state.leadDays.length === 0) {
      toast.error('Selecione ao menos uma antecedência para notificações');
      return false;
    }
    return true;
  };

  const handleSave = async (entityType: EntityType) => {
    const state = entityType === 'evaluation' ? evaluationState : assessmentState;
    const label = entityType === 'evaluation' ? 'Avaliações' : 'Testes (DISC)';
    if (!validate(state, label)) return;

    setIsSaving(true);
    const payload = buildPayload(state, entityType);
    const { error } = await supabase.from('periodicity_config').upsert(payload, {
      onConflict: 'tenant_id,entity_type',
    });

    if (error) {
      toast.error(error.message ?? 'Erro ao salvar');
      setIsSaving(false);
      return;
    }
    toast.success(`Configuração de ${label} salva`);
    setIsSaving(false);
  };

  const renderEntityBlock = (
    title: string,
    state: EntityFormState,
    setState: React.Dispatch<React.SetStateAction<EntityFormState>>,
    entityType: EntityType
  ) => (
    <div className="space-y-4 p-4 rounded-lg border border-border bg-muted/30">
      <h3 className="font-medium text-foreground">{title}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Intervalo</Label>
          <Select
            value={state.intervalKind}
            onValueChange={(v) => setState((prev) => ({ ...prev, intervalKind: v as IntervalKind }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(INTERVAL_LABELS) as IntervalKind[]).map((k) => (
                <SelectItem key={k} value={k}>
                  {INTERVAL_LABELS[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {state.intervalKind === 'custom' && (
          <>
            <div className="space-y-2">
              <Label>Intervalo em dias (1–365)</Label>
              <Input
                type="number"
                min={1}
                max={365}
                placeholder="Ex: 45"
                value={state.customIntervalDays}
                onChange={(e) => setState((prev) => ({ ...prev, customIntervalDays: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Ou em meses (1–24)</Label>
              <Input
                type="number"
                min={1}
                max={24}
                placeholder="Ex: 3"
                value={state.customIntervalMonths}
                onChange={(e) => setState((prev) => ({ ...prev, customIntervalMonths: e.target.value }))}
              />
            </div>
          </>
        )}
        <div className="space-y-2">
          <Label>Data de referência (início do ciclo)</Label>
          <Input
            type="date"
            value={state.referenceStartDate}
            onChange={(e) => setState((prev) => ({ ...prev, referenceStartDate: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label>Antecedência das notificações (dias antes)</Label>
          <div className="flex flex-wrap gap-4 pt-2">
            {LEAD_DAY_OPTIONS.map((d) => (
              <label key={d} className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={state.leadDays.includes(d)}
                  onCheckedChange={() => toggleLeadDay(entityType, d)}
                />
                <span className="text-sm">{d} dias</span>
              </label>
            ))}
          </div>
        </div>
      </div>
      <div className="flex justify-end">
        <Button
          onClick={() => handleSave(entityType)}
          disabled={isSaving}
          variant="outline"
        >
          <Save className="w-4 h-4 mr-2" />
          {isSaving ? 'Salvando...' : `Salvar ${title}`}
        </Button>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="text-sm text-muted-foreground py-4">
        Carregando configuração...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {renderEntityBlock('Avaliações 360°', evaluationState, setEvaluationState, 'evaluation')}
      {renderEntityBlock('Testes comportamentais (DISC)', assessmentState, setAssessmentState, 'assessment')}
    </div>
  );
}
