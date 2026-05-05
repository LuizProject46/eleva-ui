import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import type { EvaluationCompetencyRow } from '@/types/performanceCompetency';

interface CompetencyFormProps {
  open: boolean;
  mode: 'create' | 'edit';
  title: string;
  competencyOptions: EvaluationCompetencyRow[];
  selectedCompetencyId: string;
  weightPercent: string;
  isSaving: boolean;
  autoBalanceEnabled: boolean;
  disableCompetencyField?: boolean;
  helperText: string;
  onOpenChange: (open: boolean) => void;
  onSelectedCompetencyIdChange: (id: string) => void;
  onWeightPercentChange: (weight: string) => void;
  onAutoBalanceEnabledChange: (checked: boolean) => void;
  onSubmit: () => void;
}

export function CompetencyForm({
  open,
  mode,
  title,
  competencyOptions,
  selectedCompetencyId,
  weightPercent,
  isSaving,
  autoBalanceEnabled,
  disableCompetencyField = false,
  helperText,
  onOpenChange,
  onSelectedCompetencyIdChange,
  onWeightPercentChange,
  onAutoBalanceEnabledChange,
  onSubmit,
}: CompetencyFormProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor={`${mode}-competency`}>Competência</Label>
            <Select
              value={selectedCompetencyId}
              onValueChange={onSelectedCompetencyIdChange}
              disabled={disableCompetencyField}
            >
              <SelectTrigger id={`${mode}-competency`}>
                <SelectValue placeholder="Selecionar do catálogo de competências" />
              </SelectTrigger>
              <SelectContent>
                {competencyOptions.map((competency) => (
                  <SelectItem key={competency.id} value={competency.id}>
                    {competency.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${mode}-weight`}>Peso (%)</Label>
            <Input
              id={`${mode}-weight`}
              type="number"
              min={0}
              max={100}
              step={0.01}
              inputMode="decimal"
              value={weightPercent}
              onChange={(e) => onWeightPercentChange(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">{helperText}</p>
          </div>

          {mode === 'create' ? (
            <div className="rounded-lg border border-border bg-muted/20 px-3 py-2.5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Label htmlFor="auto-balance-switch" className="text-sm">
                    Auto-balancear pesos
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Ajusta automaticamente os pesos atuais para manter total em 100%.
                  </p>
                </div>
                <Switch
                  id="auto-balance-switch"
                  checked={autoBalanceEnabled}
                  onCheckedChange={onAutoBalanceEnabledChange}
                />
              </div>
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={onSubmit} disabled={isSaving}>
            {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden /> : null}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
