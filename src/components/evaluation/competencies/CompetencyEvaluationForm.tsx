import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { EvaluationCompetencyRow } from '@/types/performanceCompetency';

const RATING_OPTIONS = [
  { value: '1', label: 'Abaixo das expectativas', short: 'Abaixo' },
  { value: '2', label: 'Atende às expectativas', short: 'Atende' },
  { value: '3', label: 'Acima das expectativas', short: 'Acima' },
] as const;

interface CompetencyEvaluationDraft {
  rating: string;
  comment: string;
}

interface CompetencyEvaluationFormProps {
  competency: EvaluationCompetencyRow;
  draft: CompetencyEvaluationDraft;
  canManage: boolean;
  isAssigned: boolean;
  isSaving: boolean;
  onDraftChange: (next: CompetencyEvaluationDraft) => void;
  onSave: () => void;
}

export function CompetencyEvaluationForm({
  competency,
  draft,
  canManage,
  isAssigned,
  isSaving,
  onDraftChange,
  onSave,
}: CompetencyEvaluationFormProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold leading-snug">
          {competency.name}
          {isAssigned ? (
            <span className="ml-2 rounded-md border border-border bg-muted/30 px-2 py-0.5 text-xs font-medium text-muted-foreground">
              Atribuída
            </span>
          ) : (
            <span className="ml-2 rounded-md border border-border bg-muted/30 px-2 py-0.5 text-xs font-medium text-muted-foreground">
              Catálogo
            </span>
          )}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{competency.description}</p>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
            {canManage ? 'Avaliação do gestor' : 'Resultado'}
          </Label>
          {canManage ? (
            <>
              <RadioGroup
                value={draft.rating === '' ? undefined : draft.rating}
                onValueChange={(value) => onDraftChange({ ...draft, rating: value })}
                className="grid gap-2 sm:grid-cols-3"
              >
                {RATING_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    htmlFor={`${competency.id}-r-${option.value}`}
                    className={cn(
                      'flex cursor-pointer items-start gap-2 rounded-lg border border-border p-3 text-sm transition-colors',
                      draft.rating === option.value ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                    )}
                  >
                    <RadioGroupItem value={option.value} id={`${competency.id}-r-${option.value}`} className="mt-0.5" />
                    <span>
                      <span className="font-medium block">{option.short}</span>
                      <span className="text-xs text-muted-foreground">{option.label}</span>
                    </span>
                  </label>
                ))}
              </RadioGroup>
              {draft.rating !== '' ? (
                <Button
                  type="button"
                  variant="link"
                  className="h-auto p-0 text-xs text-muted-foreground"
                  onClick={() => onDraftChange({ ...draft, rating: '' })}
                >
                  Limpar nota
                </Button>
              ) : null}
            </>
          ) : (
            <div className="space-y-4 rounded-lg border border-border bg-muted/20 px-3 py-3 text-sm">
              {draft.rating !== '' ? (
                <p>
                  <span className="font-medium text-foreground">
                    {RATING_OPTIONS.find((x) => x.value === draft.rating)?.label ?? `Nota ${draft.rating}`}
                  </span>
                  <span className="text-muted-foreground"> (escala {draft.rating})</span>
                </p>
              ) : (
                <p className="text-muted-foreground">Resultado ainda não disponível.</p>
              )}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${competency.id}-comment`}>Comentário (opcional)</Label>
          <Textarea
            id={`${competency.id}-comment`}
            value={draft.comment}
            onChange={(e) => onDraftChange({ ...draft, comment: e.target.value })}
            disabled={!canManage}
            rows={3}
            className="resize-y min-h-[80px]"
          />
        </div>

        {canManage ? (
          <Button type="button" variant="secondary" className="w-full sm:w-auto" disabled={isSaving} onClick={onSave}>
            {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden /> : null}
            Salvar avaliação
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
