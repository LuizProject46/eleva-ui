import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { createCourse, createQuestionnaire, createRoadmapItem, uploadCourseFile, uploadCourseCover, updateCourse, validateCourseCoverFile, validateCoursePdfFile } from '@/services/courseService';
import type { CourseType } from '@/types/courses';
import { CourseCoverImage } from './CourseCoverImage';

interface CreateCourseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  createdBy: string | null;
  onSuccess: (courseId: string) => void;
}

export function CreateCourseDialog({
  open,
  onOpenChange,
  tenantId,
  createdBy,
  onSuccess,
}: CreateCourseDialogProps) {
  const [mode, setMode] = useState<'manual' | 'pdf'>('manual');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [workloadHours, setWorkloadHours] = useState('');
  const [type, setType] = useState<CourseType>('optional');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (coverPreviewUrl) URL.revokeObjectURL(coverPreviewUrl);
    if (file) {
      const err = validateCourseCoverFile(file);
      if (err) {
        toast.error(err);
        e.target.value = '';
        return;
      }
    }
    setCoverFile(file);
    setCoverPreviewUrl(file ? URL.createObjectURL(file) : null);
  };

  const handlePdfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (file) {
      const err = validateCoursePdfFile(file);
      if (err) {
        toast.error(err);
        e.target.value = '';
        return;
      }
    }
    setPdfFile(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Informe o título do curso.');
      return;
    }
    if (mode === 'pdf' && !pdfFile) {
      toast.error('Selecione um arquivo PDF.');
      return;
    }
    setIsSubmitting(true);
    try {
      const hours = workloadHours.trim() ? parseInt(workloadHours.trim(), 10) : null;
      const workload =
        hours != null && !Number.isNaN(hours) && hours > 0 ? hours : null;

      const course = await createCourse({
        tenant_id: tenantId,
        title: title.trim(),
        description: description.trim() || null,
        type,
        source: mode === 'pdf' ? 'imported_pdf' : 'manual',
        workload_hours: workload,
        created_by: createdBy,
      });
      await createQuestionnaire({
        course_id: course.id,
        title: 'Questionário final',
        passing_score: 70,
      });
      if (mode === 'pdf' && pdfFile) {
        const pathSuffix = `roadmap/${crypto.randomUUID()}/${pdfFile.name}`;
        const { path } = await uploadCourseFile(tenantId, course.id, pathSuffix, pdfFile);
        await createRoadmapItem({
          course_id: course.id,
          position: 0,
          content_type: 'pdf',
          title: title.trim(),
          payload: { storage_path: path },
        });
      }
      if (coverFile) {
        const { path } = await uploadCourseCover(tenantId, course.id, coverFile);
        await updateCourse(course.id, { cover_url: path });
      }
      toast.success(mode === 'pdf' ? 'Curso criado a partir do PDF.' : 'Curso criado.');
      setTitle('');
      setDescription('');
      setWorkloadHours('');
      setType('optional');
      setPdfFile(null);
      setCoverFile(null);
      if (coverPreviewUrl) URL.revokeObjectURL(coverPreviewUrl);
      setCoverPreviewUrl(null);
      onSuccess(course.id);
    } catch {
      toast.error('Erro ao criar curso.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo curso</DialogTitle>
        </DialogHeader>
        <Tabs value={mode} onValueChange={(v) => setMode(v as 'manual' | 'pdf')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="manual">Criar vazio</TabsTrigger>
            <TabsTrigger value="pdf">Importar PDF</TabsTrigger>
          </TabsList>
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="course-title">Título</Label>
              <Input
                id="course-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Segurança do trabalho"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="course-description">Descrição (opcional)</Label>
              <Input
                id="course-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Breve descrição do curso"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="course-workload">Carga horária (opcional)</Label>
              <Input
                id="course-workload"
                type="number"
                min={1}
                step={1}
                value={workloadHours}
                onChange={(e) => setWorkloadHours(e.target.value)}
                placeholder="Ex: 8"
              />
              <p className="text-xs text-muted-foreground">
                Horas do curso. Aparece no certificado de conclusão.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Capa do curso (opcional)</Label>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                <div className="w-full sm:w-32 aspect-video rounded-lg overflow-hidden bg-muted shrink-0">
                  <CourseCoverImage
                    coverUrl={coverPreviewUrl}
                    alt="Preview"
                    className="w-full h-full object-cover"
                    aspectRatio="video"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <Input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleCoverChange}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    JPG, PNG ou WebP. Máx. 2MB.
                  </p>
                </div>
              </div>
            </div>
            {mode === 'pdf' && (
              <div className="space-y-2">
                <Label>Arquivo PDF</Label>
                <Input
                  type="file"
                  accept="application/pdf"
                  onChange={handlePdfChange}
                />
                <p className="text-xs text-muted-foreground">
                  O PDF será a primeira etapa da trilha. Máx. 5MB.
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={type} onValueChange={(v) => setType(v as CourseType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="optional">Opcional</SelectItem>
                  <SelectItem value="mandatory">Obrigatório</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Criando...' : mode === 'pdf' ? 'Importar e criar' : 'Criar'}
              </Button>
            </DialogFooter>
          </form>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
