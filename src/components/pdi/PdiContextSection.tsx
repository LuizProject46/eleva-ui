import { useState, useEffect, useCallback } from 'react';
import { ChevronDown } from 'lucide-react';
import { getCompletedCourseTitlesForPdiContext } from '@/modules/pdi/utils/pdiEmployeeCompletedCourses';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

interface PdiContextSectionProps {
  employeeId: string;
}

export function PdiContextSection({ employeeId }: PdiContextSectionProps) {
  const [completedCourseTitles, setCompletedCourseTitles] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);

  const fetchCompletedCourses = useCallback(async () => {
    if (!employeeId) return;
    setIsLoading(true);
    try {
      const titles = await getCompletedCourseTitlesForPdiContext(employeeId);
      setCompletedCourseTitles(titles);
    } catch {
      setCompletedCourseTitles([]);
    } finally {
      setIsLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    void fetchCompletedCourses();
  }, [fetchCompletedCourses]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-foreground">Contexto para o PDI</h2>
          <p className="text-sm text-muted-foreground">Carregando...</p>
        </CardHeader>
      </Card>
    );
  }

  if (completedCourseTitles.length === 0) {
    return null;
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CardHeader className="pb-2">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center justify-between text-left hover:opacity-80 transition-opacity rounded-md -m-2 p-2"
            >
              <h2 className="text-lg font-semibold text-foreground">
                Contexto para o PDI
              </h2>
              <ChevronDown
                className={`h-4 w-4 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
              />
            </button>
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Cursos concluídos que podem informar o desenvolvimento (uso como
              referência para decisões):
            </p>
            <ul className="text-sm text-foreground list-disc list-inside space-y-1">
              {completedCourseTitles.map((title, i) => (
                <li key={i}>{title}</li>
              ))}
            </ul>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
