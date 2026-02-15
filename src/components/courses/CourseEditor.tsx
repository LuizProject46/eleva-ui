import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, FileText, ListOrdered, HelpCircle, Users } from 'lucide-react';
import { toast } from 'sonner';
import {
  getCourse,
  updateCourse,
  uploadCourseCover,
  validateCourseCoverFile,
  listRoadmapItems,
  getQuestionnaireByCourseId,
  listQuestionnaireQuestions,
} from '@/services/courseService';
import { getCourseAssignmentsAdminList } from '@/services/courseAssignmentService';
import type { Course, CourseRoadmapItem, CourseQuestionnaire, QuestionnaireQuestion } from '@/types/courses';
import type { CourseAssignmentAdminRow } from '@/types/courses';
import { useCourseCoverUrl } from '@/hooks/useCourseCoverUrl';
import { CourseCoverImage } from './CourseCoverImage';
import { RoadmapEditor } from '@/components/courses/RoadmapEditor';
import { QuestionnaireEditor } from '@/components/courses/QuestionnaireEditor';
import { CourseAssignments } from '@/components/courses/CourseAssignments';

interface CourseEditorCoverProps {
  currentCoverPath: string | null;
  coverPreviewUrl: string | null;
  onCoverChange: (file: File | null) => void;
  onRemove: () => void;
}

function CourseEditorCover({
  currentCoverPath,
  coverPreviewUrl,
  onCoverChange,
  onRemove,
}: CourseEditorCoverProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resolvedUrl = useCourseCoverUrl(currentCoverPath);
  const displayUrl = coverPreviewUrl ?? resolvedUrl;

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
      <div className="w-full sm:w-40 aspect-video rounded-lg overflow-hidden bg-muted shrink-0">
        <CourseCoverImage
          coverUrl={displayUrl}
          alt="Capa do curso"
          className="w-full h-full object-cover"
          aspectRatio="video"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(e) => onCoverChange(e.target.files?.[0] ?? null)}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
        >
          Selecionar imagem
        </Button>
        <p className="text-xs text-muted-foreground">JPG, PNG ou WebP. Máx. 2MB.</p>
        {(currentCoverPath || coverPreviewUrl) && (
          <Button type="button" variant="outline" size="sm" onClick={onRemove}>
            Remover capa
          </Button>
        )}
      </div>
    </div>
  );
}

interface CourseEditorProps {
  courseId: string;
  onClose: () => void;
  onSaved?: () => void;
}

export function CourseEditor({ courseId, onClose, onSaved }: CourseEditorProps) {
  const { user } = useAuth();
  const [course, setCourse] = useState<Course | null>(null);
  const [roadmapItems, setRoadmapItems] = useState<CourseRoadmapItem[]>([]);
  const [questionnaire, setQuestionnaire] = useState<CourseQuestionnaire | null>(null);
  const [questions, setQuestions] = useState<QuestionnaireQuestion[]>([]);
  const [assignments, setAssignments] = useState<CourseAssignmentAdminRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formType, setFormType] = useState<Course['type']>('optional');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);
  const [removeCover, setRemoveCover] = useState(false);
  const [savingCourse, setSavingCourse] = useState(false);

  useEffect(() => {
    if (!coverFile) {
      setCoverPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(coverFile);
    setCoverPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [coverFile]);

  const loadCourse = useCallback(async () => {
    const c = await getCourse(courseId);
    if (c) {
      setCourse(c);
      setFormTitle(c.title);
      setFormDescription(c.description ?? '');
      setFormType(c.type);
    }
  }, [courseId]);

  const loadRoadmap = useCallback(async () => {
    const items = await listRoadmapItems(courseId);
    setRoadmapItems(items);
  }, [courseId]);

  const loadQuestionnaire = useCallback(async () => {
    const q = await getQuestionnaireByCourseId(courseId);
    setQuestionnaire(q ?? null);
    if (q) {
      const list = await listQuestionnaireQuestions(q.id);
      setQuestions(list);
    } else {
      setQuestions([]);
    }
  }, [courseId]);

  const loadAssignments = useCallback(async () => {
    const list = await getCourseAssignmentsAdminList({ courseId });
    setAssignments(list);
  }, [courseId]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      try {
        await loadCourse();
        if (cancelled) return;
        await Promise.all([loadRoadmap(), loadQuestionnaire(), loadAssignments()]);
      } catch {
        toast.error('Erro ao carregar curso.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [courseId, loadCourse, loadRoadmap, loadQuestionnaire, loadAssignments]);

  const handleSaveCourse = async () => {
    if (!course) return;
    setSavingCourse(true);
    try {
      let coverUrl: string | null | undefined = undefined;
      if (removeCover) {
        coverUrl = null;
      } else if (coverFile) {
        const { path } = await uploadCourseCover(course.tenant_id, course.id, coverFile);
        coverUrl = path;
      }
      await updateCourse(course.id, {
        title: formTitle,
        description: formDescription || null,
        type: formType,
        ...(coverUrl !== undefined && { cover_url: coverUrl }),
      });
      setCoverFile(null);
      setRemoveCover(false);
      await loadCourse();
      onSaved?.();
      toast.success('Curso atualizado.');
    } catch {
      toast.error('Erro ao salvar.');
    } finally {
      setSavingCourse(false);
    }
  };

  const refreshAssignments = () => void loadAssignments();

  if (isLoading || !course) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={onClose} className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </Button>
        <Skeleton className="h-96 w-full rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <Button variant="ghost" onClick={onClose} className="gap-2 w-fit">
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </Button>
        <h1 className="text-2xl font-bold tracking-tight text-foreground truncate">
          {course.title}
        </h1>
      </div>

      <Tabs defaultValue="info" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4">
          <TabsTrigger value="info" className="gap-2">
            <FileText className="w-4 h-4" />
            Curso
          </TabsTrigger>
          <TabsTrigger value="roadmap" className="gap-2">
            <ListOrdered className="w-4 h-4" />
            Trilha
          </TabsTrigger>
          <TabsTrigger value="questionnaire" className="gap-2">
            <HelpCircle className="w-4 h-4" />
            Questionário
          </TabsTrigger>
          <TabsTrigger value="assignments" className="gap-2">
            <Users className="w-4 h-4" />
            Atribuições
          </TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Informações do curso</CardTitle>
              <CardDescription>Título, descrição e tipo (obrigatório ou opcional).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-title">Título</Label>
                <Input
                  id="edit-title"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-desc">Descrição</Label>
                <Textarea
                  id="edit-desc"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Opcional"
                  rows={3}
                  className="resize-none"
                />
              </div>
              <div className="space-y-2">
                <Label>Capa do curso</Label>
                <CourseEditorCover
                  currentCoverPath={removeCover || coverFile ? null : course.cover_url}
                  coverPreviewUrl={coverPreviewUrl}
                  onCoverChange={(file) => {
                    if (!file) {
                      setCoverFile(null);
                      return;
                    }
                    const err = validateCourseCoverFile(file);
                    if (err) {
                      toast.error(err);
                      return;
                    }
                    setCoverFile(file);
                  }}
                  onRemove={() => {
                    setCoverFile(null);
                    setRemoveCover(true);
                  }}
                />
              </div>
              <div className="flex items-center gap-2">
                <Label>Tipo:</Label>
                <Badge variant={formType === 'mandatory' ? 'default' : 'secondary'}>
                  {formType === 'mandatory' ? 'Obrigatório' : 'Opcional'}
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setFormType(formType === 'mandatory' ? 'optional' : 'mandatory')}
                >
                  Alternar
                </Button>
              </div>
              <Button onClick={handleSaveCourse} disabled={savingCourse}>
                {savingCourse ? 'Salvando...' : 'Salvar alterações'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="roadmap" className="space-y-4">
          <RoadmapEditor
            courseId={courseId}
            tenantId={course.tenant_id}
            items={roadmapItems}
            onUpdate={loadRoadmap}
          />
        </TabsContent>

        <TabsContent value="questionnaire" className="space-y-4">
          <QuestionnaireEditor
            courseId={courseId}
            questionnaire={questionnaire}
            questions={questions}
            onUpdate={loadQuestionnaire}
          />
        </TabsContent>

        <TabsContent value="assignments" className="space-y-4">
          <CourseAssignments
            courseId={courseId}
            assignments={assignments}
            onUpdate={refreshAssignments}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
