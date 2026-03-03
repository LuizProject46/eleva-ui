import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { createObjective } from '@/services/pdiService';
import { discAttentionPoints } from '@/constants/discProfiles';
import type { DiscKey } from '@/constants/discProfiles';
import type { Pdi } from '@/types/pdi';

const LOW_SCORE_THRESHOLD = 3;

interface LowScoreCompetency {
  competency_id: string;
  name: string;
  score: number;
}

interface PdiDiagnosticSectionProps {
  pdi: Pdi;
  onObjectivesCreated: () => void;
}

export function PdiDiagnosticSection({ pdi, onObjectivesCreated }: PdiDiagnosticSectionProps) {
  const [lowScoreCompetencies, setLowScoreCompetencies] = useState<LowScoreCompetency[]>([]);
  const [discPoints, setDiscPoints] = useState<string[]>([]);
  const [selectedCompetencyIds, setSelectedCompetencyIds] = useState<Set<string>>(new Set());
  const [selectedDiscIndices, setSelectedDiscIndices] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadDiagnostic = useCallback(async () => {
    setLowScoreCompetencies([]);
    setDiscPoints([]);
    if (pdi.evaluation_id) {
      const { data: scores } = await supabase
        .from('evaluation_scores')
        .select('competency_id, score')
        .eq('evaluation_id', pdi.evaluation_id)
        .lte('score', LOW_SCORE_THRESHOLD);
      const { data: competencies } = await supabase.from('evaluation_competencies').select('id, name');
      const compMap = new Map((competencies ?? []).map((c) => [c.id, c.name]));
      setLowScoreCompetencies(
        (scores ?? []).map((s) => ({
          competency_id: s.competency_id,
          name: compMap.get(s.competency_id) ?? s.competency_id,
          score: s.score,
        }))
      );
    }
    if (pdi.behavioral_assessment_id) {
      const { data: assessment } = await supabase
        .from('behavioral_assessments')
        .select('result')
        .eq('id', pdi.behavioral_assessment_id)
        .maybeSingle();
      const result = (assessment as { result?: string } | null)?.result as DiscKey | undefined;
      if (result && result in discAttentionPoints) {
        setDiscPoints(discAttentionPoints[result]);
      }
    }
    setIsLoading(false);
  }, [pdi.evaluation_id, pdi.behavioral_assessment_id]);

  useEffect(() => {
    loadDiagnostic();
  }, [loadDiagnostic]);

  const toggleCompetency = (id: string) => {
    setSelectedCompetencyIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleDisc = (index: number) => {
    setSelectedDiscIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const handleAddAsObjectives = async () => {
    if (selectedCompetencyIds.size === 0 && selectedDiscIndices.size === 0) {
      toast.error('Selecione ao menos um item para virar objetivo.');
      return;
    }
    setIsSubmitting(true);
    try {
      let position = 0;
      for (const comp of lowScoreCompetencies) {
        if (!selectedCompetencyIds.has(comp.competency_id)) continue;
        await createObjective({
          pdi_id: pdi.id,
          description: `Desenvolver competência: ${comp.name}`,
          competency: comp.name,
          position: position++,
        });
      }
      for (const i of Array.from(selectedDiscIndices).sort((a, b) => a - b)) {
        const point = discPoints[i];
        if (!point) continue;
        await createObjective({
          pdi_id: pdi.id,
          description: `Atenção: ${point}`,
          competency: null,
          position: position++,
        });
      }
      setSelectedCompetencyIds(new Set());
      setSelectedDiscIndices(new Set());
      toast.success('Objetivos criados.');
      onObjectivesCreated();
    } catch {
      toast.error('Erro ao criar objetivos.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasData = lowScoreCompetencies.length > 0 || discPoints.length > 0;
  if (!hasData && !isLoading) return null;

  return (
    <div className="rounded-lg border border-border bg-card p-4 md:p-6 space-y-4">
      <h2 className="font-semibold text-foreground">Diagnóstico</h2>
      <p className="text-sm text-muted-foreground">
        Use os itens abaixo como referência para definir objetivos. Se desejar, selecione competências ou pontos de atenção para adicionar como objetivos ao PDI.
      </p>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : (
        <>
          {lowScoreCompetencies.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Competências com menor nota (avaliação)</p>
              <div className="rounded-md border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead>Competência</TableHead>
                      <TableHead>Nota</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lowScoreCompetencies.map((c) => (
                      <TableRow key={c.competency_id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedCompetencyIds.has(c.competency_id)}
                            onCheckedChange={() => toggleCompetency(c.competency_id)}
                          />
                        </TableCell>
                        <TableCell>{c.name}</TableCell>
                        <TableCell>{c.score}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {discPoints.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Pontos de atenção (DISC)</p>
              <ul className="space-y-2">
                {discPoints.map((point, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <Checkbox
                      checked={selectedDiscIndices.has(i)}
                      onCheckedChange={() => toggleDisc(i)}
                    />
                    <span className="text-sm">{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(selectedCompetencyIds.size > 0 || selectedDiscIndices.size > 0) && (
            <Button onClick={handleAddAsObjectives} disabled={isSubmitting}>
              {isSubmitting ? 'Criando...' : 'Adicionar como objetivos'}
            </Button>
          )}
        </>
      )}
    </div>
  );
}
