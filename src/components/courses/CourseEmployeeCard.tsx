import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronRight } from 'lucide-react';
import { useInView } from '@/hooks/useInView';
import { useCourseCoverUrl } from '@/hooks/useCourseCoverUrl';
import { CourseCoverImage } from './CourseCoverImage';
import type { Course } from '@/types/courses';

interface CourseEmployeeCardProps {
  course: Course | null;
  progressLabel: string;
  /** 0-100 or null if not applicable */
  progressPercent?: number | null;
  startLabel?: string;
  onClick: () => void;
}

export function CourseEmployeeCard({
  course,
  progressLabel,
  progressPercent = null,
  startLabel = 'Iniciar curso',
  onClick,
}: CourseEmployeeCardProps) {
  const { ref, isInView } = useInView({ rootMargin: '80px' });
  const coverUrl = useCourseCoverUrl(course?.cover_url ?? null, { enabled: isInView });
  const isLoadingCover = isInView && !!course?.cover_url && !coverUrl;

  return (
    <Card
      ref={ref}
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-all duration-200 hover:border-primary/30 hover:shadow-lg"
    >
      <button
        type="button"
        className="flex flex-col flex-1 text-left min-w-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-xl"
        onClick={onClick}
      >
        <div className="relative w-full aspect-video overflow-hidden bg-muted">
          <CourseCoverImage
            coverUrl={coverUrl}
            alt={course?.title ?? 'Curso'}
            className="absolute inset-0 h-full w-full rounded-none transition-transform duration-200 group-hover:scale-[1.02]"
            aspectRatio="video"
            isLoading={isLoadingCover}
          />
          {course?.type === 'mandatory' && (
            <div className="absolute left-2 top-2">
              <Badge variant="destructive" className="shadow-sm text-xs">
                Obrigatório
              </Badge>
            </div>
          )}
        </div>
        <CardHeader className="space-y-1.5 p-4 pb-2">
          <h3 className="font-semibold leading-snug line-clamp-2 text-foreground">
            {course?.title ?? 'Curso'}
          </h3>
          {course?.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {course.description}
            </p>
          )}
        </CardHeader>
      </button>
      <CardContent className="p-4 pt-0 space-y-3">
        {progressPercent !== null && progressPercent !== undefined && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Progresso</span>
              <span className="font-medium text-foreground">{Math.round(progressPercent)}%</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
              />
            </div>
          </div>
        )}
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground truncate">{progressLabel}</span>
          <Button
            variant="default"
            size="sm"
            className="gap-1.5 shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onClick();
            }}
          >
            {startLabel}
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
