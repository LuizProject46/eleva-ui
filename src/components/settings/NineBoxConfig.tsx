import { useCallback, useEffect, useMemo, useState } from 'react';
import { Save } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getNineBoxConfig, upsertNineBoxConfig } from '@/services/nineBoxService';

interface NineBoxConfigProps {
  tenantId: string;
}

interface NineBoxFormState {
  evaluationYear: string;
  objectivesLowMax: string;
  objectivesMediumMax: string;
  competenciesLowMax: string;
  competenciesMediumMax: string;
}

function defaultFormState(): NineBoxFormState {
  const currentYear = new Date().getFullYear();
  return {
    evaluationYear: String(currentYear),
    objectivesLowMax: '1.5',
    objectivesMediumMax: '2.3',
    competenciesLowMax: '1.5',
    competenciesMediumMax: '2.3',
  };
}

function parseBoundedNumber(raw: string): number | null {
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  if (n < 1 || n > 3) return null;
  return Number(n.toFixed(2));
}

export function NineBoxConfig({ tenantId }: NineBoxConfigProps) {
  const [state, setState] = useState<NineBoxFormState>(defaultFormState);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const loadConfig = useCallback(async () => {
    if (!tenantId) return;
    setIsLoading(true);
    try {
      const row = await getNineBoxConfig(tenantId);
      if (!row) {
        setState(defaultFormState());
      } else {
        setState({
          evaluationYear: String(row.evaluation_year),
          objectivesLowMax: String(row.objectives_low_max),
          objectivesMediumMax: String(row.objectives_medium_max),
          competenciesLowMax: String(row.competencies_low_max),
          competenciesMediumMax: String(row.competencies_medium_max),
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao carregar configuração.';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  const validationError = useMemo(() => {
    const year = Number(state.evaluationYear);
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      return 'Informe um ano válido entre 2000 e 2100.';
    }

    const objectivesLowMax = parseBoundedNumber(state.objectivesLowMax);
    const objectivesMediumMax = parseBoundedNumber(state.objectivesMediumMax);
    const competenciesLowMax = parseBoundedNumber(state.competenciesLowMax);
    const competenciesMediumMax = parseBoundedNumber(state.competenciesMediumMax);

    if (
      objectivesLowMax == null ||
      objectivesMediumMax == null ||
      competenciesLowMax == null ||
      competenciesMediumMax == null
    ) {
      return 'Todos os thresholds devem ser números entre 1.00 e 3.00.';
    }
    if (objectivesLowMax >= objectivesMediumMax) {
      return 'No eixo Objetivos, o limite de Baixo deve ser menor que o de Médio.';
    }
    if (competenciesLowMax >= competenciesMediumMax) {
      return 'No eixo Competências, o limite de Baixo deve ser menor que o de Médio.';
    }
    return null;
  }, [state]);

  const handleSave = async () => {
    if (validationError) {
      toast.error(validationError);
      return;
    }

    const year = Number(state.evaluationYear);
    const objectivesLowMax = parseBoundedNumber(state.objectivesLowMax);
    const objectivesMediumMax = parseBoundedNumber(state.objectivesMediumMax);
    const competenciesLowMax = parseBoundedNumber(state.competenciesLowMax);
    const competenciesMediumMax = parseBoundedNumber(state.competenciesMediumMax);
    if (
      objectivesLowMax == null ||
      objectivesMediumMax == null ||
      competenciesLowMax == null ||
      competenciesMediumMax == null
    ) {
      return;
    }

    setIsSaving(true);
    try {
      await upsertNineBoxConfig({
        tenant_id: tenantId,
        evaluation_year: year,
        objectives_low_max: objectivesLowMax,
        objectives_medium_max: objectivesMediumMax,
        competencies_low_max: competenciesLowMax,
        competencies_medium_max: competenciesMediumMax,
      });
      toast.success('Configuração da Nine-Box salva.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao salvar configuração.';
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Carregando configuração...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="nine-box-year">Ano da avaliação anual</Label>
          <Input
            id="nine-box-year"
            type="number"
            min={2000}
            max={2100}
            value={state.evaluationYear}
            onChange={(e) => setState((prev) => ({ ...prev, evaluationYear: e.target.value }))}
          />
        </div>
      </div>

      <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Eixo Objetivos (horizontal)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="obj-low-max">Limite máximo de Baixo</Label>
            <Input
              id="obj-low-max"
              type="number"
              min={1}
              max={3}
              step={0.01}
              value={state.objectivesLowMax}
              onChange={(e) => setState((prev) => ({ ...prev, objectivesLowMax: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="obj-medium-max">Limite máximo de Médio</Label>
            <Input
              id="obj-medium-max"
              type="number"
              min={1}
              max={3}
              step={0.01}
              value={state.objectivesMediumMax}
              onChange={(e) =>
                setState((prev) => ({ ...prev, objectivesMediumMax: e.target.value }))
              }
            />
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Eixo Competências (vertical)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="comp-low-max">Limite máximo de Baixo</Label>
            <Input
              id="comp-low-max"
              type="number"
              min={1}
              max={3}
              step={0.01}
              value={state.competenciesLowMax}
              onChange={(e) =>
                setState((prev) => ({ ...prev, competenciesLowMax: e.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="comp-medium-max">Limite máximo de Médio</Label>
            <Input
              id="comp-medium-max"
              type="number"
              min={1}
              max={3}
              step={0.01}
              value={state.competenciesMediumMax}
              onChange={(e) =>
                setState((prev) => ({ ...prev, competenciesMediumMax: e.target.value }))
              }
            />
          </div>
        </div>
      </div>

      {validationError ? <p className="text-sm text-destructive">{validationError}</p> : null}

      <div className="flex justify-end">
        <Button type="button" variant="outline" onClick={handleSave} disabled={isSaving}>
          <Save className="w-4 h-4 mr-2" />
          {isSaving ? 'Salvando...' : 'Salvar Nine-Box'}
        </Button>
      </div>
    </div>
  );
}
