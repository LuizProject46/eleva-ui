import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Pencil, Trash2 } from 'lucide-react';
import { useInView } from '@/hooks/useInView';
import { useCourseCoverUrl } from '@/hooks/useCourseCoverUrl';
import { CourseCoverImage } from './CourseCoverImage';
import type { Course } from '@/types/courses';

const COURSE_TYPE_LABELS: Record<string, string> = {
  mandatory: 'Obrigatório',
  optional: 'Opcional',
};

interface CourseAdminCardProps {
  course: Course;
  onEdit: () => void;
  onRemove: () => void;
}

export function CourseAdminCard({ course, onEdit, onRemove }: CourseAdminCardProps) {
  const { ref, isInView } = useInView({ rootMargin: '80px' });
  const coverUrl = useCourseCoverUrl(course.cover_url, { enabled: isInView });
  const isLoadingCover = isInView && !!course.cover_url && !coverUrl;

  return (
    <Card
      ref={ref}
      className="group overflow-hidden rounded-xl border border-border bg-card transition-all duration-200 hover:border-muted-foreground/20 hover:shadow-lg"
    >
      <div className="flex flex-col justify-between h-full">
        <div className="relative w-full aspect-video overflow-hidden bg-muted">
          <CourseCoverImage
            coverUrl={coverUrl}
            alt={course.title}
            className="absolute inset-0 h-full w-full rounded-none"
            aspectRatio="video"
            isLoading={isLoadingCover}
          />
          <div className="absolute right-2 top-2">
            <Badge
              variant={course.type === 'mandatory' ? 'default' : 'secondary'}
              className="shadow-sm"
            >
              {COURSE_TYPE_LABELS[course.type] ?? course.type}
            </Badge>
          </div>
        </div>
        <CardHeader className="space-y-1.5 p-4 pb-2">
          <h3 className="font-semibold leading-snug line-clamp-2 text-foreground">
            {course.title}
          </h3>
          {course.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {course.description}
            </p>
          )}
        </CardHeader>
        <CardContent className="flex flex-row gap-2 p-4 pt-0">
          <Button
            variant="outline"
            size="sm"
            onClick={onEdit}
            className="gap-1.5 flex-1 sm:flex-initial"
          >
            <Pencil className="w-3.5 h-3.5" />
            Editar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Remover
          </Button>
        </CardContent>
      </div>
    </Card>
  );
}
