import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { listAssignmentsByUser } from '@/services/courseAssignmentService';
import { isCourseCompleted } from '@/services/courseProgressService';

const MAX_ASSIGNMENTS_TO_CHECK = 15;

interface PdiContextSectionProps {
  employeeId: string;
}

export function PdiContextSection({ employeeId }: PdiContextSectionProps) {
  const [completedCourseTitles, setCompletedCourseTitles] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchCompletedCourses = useCallback(async () => {
    if (!employeeId) return;
    setIsLoading(true);
    try {
      const assignments = await listAssignmentsByUser(employeeId);
      const toCheck = assignments.slice(0, MAX_ASSIGNMENTS_TO_CHECK);
      const completed = await Promise.all(
        toCheck.map(async (a) => {
          const ok = await isCourseCompleted(a.id);
          return ok ? a.course_id : null;
        })
      );
      const completedCourseIds = completed.filter((id): id is string => id != null);
      if (completedCourseIds.length === 0) {
        setCompletedCourseTitles([]);
        setIsLoading(false);
        return;
      }
      const { data: courses } = await supabase
        .from('courses')
        .select('id, title')
        .in('id', completedCourseIds);
      const titles = (courses ?? []).map((c) => c.title ?? '').filter(Boolean);
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
      <div className="rounded-lg border border-border bg-card p-4 md:p-6">
        <h2 className="font-semibold text-foreground mb-2">Contexto para o PDI</h2>
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (completedCourseTitles.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4 md:p-6">
      <h2 className="font-semibold text-foreground mb-2">Contexto para o PDI</h2>
      <p className="text-sm text-muted-foreground mb-2">
        Cursos concluídos que podem informar o desenvolvimento (uso como referência para decisões):
      </p>
      <ul className="text-sm text-foreground list-disc list-inside space-y-1">
        {completedCourseTitles.map((title, i) => (
          <li key={i}>{title}</li>
        ))}
      </ul>
    </div>
  );
}
