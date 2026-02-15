import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FileText, Video, GripVertical, Trash2, Check, Pencil, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  createRoadmapItem,
  updateRoadmapItem,
  deleteRoadmapItem,
  uploadCourseFile,
  validateCoursePdfFile,
  validateCourseVideoFile,
} from '@/services/courseService';
import type { CourseRoadmapItem } from '@/types/courses';
import type { RoadmapContentType, RoadmapItemPdfPayload, RoadmapItemVideoPayload } from '@/types/courses';

interface RoadmapEditorProps {
  courseId: string;
  tenantId: string;
  items: CourseRoadmapItem[];
  onUpdate: () => void;
}

const CONTENT_TYPE_LABELS: Record<RoadmapContentType, string> = {
  pdf: 'PDF',
  video: 'Vídeo',
  audio: 'Áudio',
  external_link: 'Link externo',
};

function getFileNameFromPath(path: string): string {
  if (!path) return '';
  const segment = path.split('/').pop();
  return segment ?? path;
}

type VideoEntry = { title: string; storage_path?: string; url?: string };

export function RoadmapEditor({ courseId, tenantId, items, onUpdate }: RoadmapEditorProps) {
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const replacePdfInputRef = useRef<HTMLInputElement>(null);
  const replaceVideoInputRef = useRef<HTMLInputElement>(null);

  const [addingType, setAddingType] = useState<RoadmapContentType | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newPdfFile, setNewPdfFile] = useState<File | null>(null);
  const [newVideoFile, setNewVideoFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const [editingItem, setEditingItem] = useState<CourseRoadmapItem | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editPdfReplacementFile, setEditPdfReplacementFile] = useState<File | null>(null);
  const [editVideo, setEditVideo] = useState<VideoEntry | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [isReplacingVideo, setIsReplacingVideo] = useState(false);

  const startEditing = (item: CourseRoadmapItem) => {
    setEditingItem(item);
    setEditTitle(item.title);
    setEditPdfReplacementFile(null);
    setIsReplacingVideo(false);
    if (item.content_type === 'pdf') {
      setEditVideo(null);
    } else if (item.content_type === 'video') {
      const payload = item.payload as unknown as RoadmapItemVideoPayload;
      const videos = payload?.videos ?? [];
      const first = videos[0];
      setEditVideo(
        first
          ? { title: first.title ?? '', storage_path: first.storage_path, url: first.url }
          : null
      );
    }
  };

  const cancelEditing = () => {
    setEditingItem(null);
    setEditTitle('');
    setEditPdfReplacementFile(null);
    setEditVideo(null);
    setIsReplacingVideo(false);
  };

  const handleSaveEdit = async () => {
    if (!editingItem) return;
    if (!editTitle.trim()) {
      toast.error('Informe o título da etapa.');
      return;
    }
    if (editingItem.content_type === 'video') {
      if (!editVideo?.storage_path) {
        toast.error('Selecione um arquivo de vídeo para a etapa.');
        return;
      }
      if (!editVideo.title.trim()) {
        toast.error('Informe o título do vídeo.');
        return;
      }
    }

    setEditSaving(true);
    try {
      if (editingItem.content_type === 'pdf') {
        const current = editingItem.payload as unknown as RoadmapItemPdfPayload | undefined;
        let payload: RoadmapItemPdfPayload = current?.storage_path ? current : { storage_path: '' };
        if (editPdfReplacementFile) {
          const pathSuffix = `roadmap/${crypto.randomUUID()}/${editPdfReplacementFile.name}`;
          const { path } = await uploadCourseFile(tenantId, courseId, pathSuffix, editPdfReplacementFile);
          payload = { storage_path: path };
        }
        await updateRoadmapItem(editingItem.id, {
          title: editTitle.trim(),
          payload: payload as unknown as Record<string, unknown>,
        });
      } else if (editingItem.content_type === 'video' && editVideo) {
        const payload: RoadmapItemVideoPayload = {
          videos: [
            {
              title: editVideo.title.trim(),
              storage_path: editVideo.storage_path,
              url: editVideo.url,
            },
          ],
        };
        await updateRoadmapItem(editingItem.id, {
          title: editTitle.trim(),
          payload: payload as unknown as Record<string, unknown>,
        });
      } else {
        await updateRoadmapItem(editingItem.id, { title: editTitle.trim() });
      }
      toast.success('Etapa atualizada.');
      cancelEditing();
      onUpdate();
    } catch {
      toast.error('Erro ao salvar alterações.');
    } finally {
      setEditSaving(false);
    }
  };

  const handleReplacePdfInEdit = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (file) {
      const err = validateCoursePdfFile(file);
      if (err) {
        toast.error(err);
        e.target.value = '';
        return;
      }
      setEditPdfReplacementFile(file);
    }
  };

  const handleVideoFileInEdit = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    const err = validateCourseVideoFile(file);
    if (err) {
      toast.error(err);
      e.target.value = '';
      return;
    }
    const pathSuffix = `roadmap/${crypto.randomUUID()}/${file.name}`;
    setIsReplacingVideo(true);
    uploadCourseFile(tenantId, courseId, pathSuffix, file)
      .then(({ path }) => {
        setEditVideo((prev) => {
          const isReplace = !!prev?.storage_path;
          toast.success(isReplace ? 'Vídeo substituído.' : 'Vídeo adicionado.');
          return {
            title: prev?.title?.trim() || file.name.replace(/\.[^/.]+$/, ''),
            storage_path: path,
          };
        });
      })
      .catch(() => toast.error('Erro ao enviar vídeo.'))
      .finally(() => {
        setIsReplacingVideo(false);
        e.target.value = '';
      });
  };

  const handleAddPdf = async () => {
    if (!newTitle.trim() || !newPdfFile) {
      toast.error('Informe o título e selecione um arquivo PDF.');
      return;
    }
    setUploading(true);
    try {
      const pathSuffix = `roadmap/${crypto.randomUUID()}/${newPdfFile.name}`;
      const { path } = await uploadCourseFile(tenantId, courseId, pathSuffix, newPdfFile);
      await createRoadmapItem({
        course_id: courseId,
        position: items.length,
        content_type: 'pdf',
        title: newTitle.trim(),
        payload: { storage_path: path },
      });
      toast.success('Etapa adicionada.');
      setNewTitle('');
      setNewPdfFile(null);
      setAddingType(null);
      onUpdate();
    } catch {
      toast.error('Erro ao enviar PDF.');
    } finally {
      setUploading(false);
    }
  };

  const handleAddVideo = async () => {
    if (!newTitle.trim()) {
      toast.error('Informe o título da etapa.');
      return;
    }
    if (!newVideoFile) {
      toast.error('Selecione um arquivo de vídeo.');
      return;
    }
    setUploading(true);
    try {
      const pathSuffix = `roadmap/${crypto.randomUUID()}/${newVideoFile.name}`;
      const { path } = await uploadCourseFile(tenantId, courseId, pathSuffix, newVideoFile);
      await createRoadmapItem({
        course_id: courseId,
        position: items.length,
        content_type: 'video',
        title: newTitle.trim(),
        payload: { videos: [{ title: newTitle.trim(), storage_path: path }] },
      });
      toast.success('Etapa de vídeo adicionada.');
      setNewTitle('');
      setNewVideoFile(null);
      setAddingType(null);
      onUpdate();
    } catch {
      toast.error('Erro ao enviar vídeo.');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (item: CourseRoadmapItem) => {
    try {
      await deleteRoadmapItem(item.id);
      if (editingItem?.id === item.id) cancelEditing();
      toast.success('Etapa removida.');
      onUpdate();
    } catch {
      toast.error('Erro ao remover.');
    }
  };

  const handleMove = async (item: CourseRoadmapItem, direction: 'up' | 'down') => {
    const idx = items.findIndex((i) => i.id === item.id);
    if (idx < 0) return;
    const newIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= items.length) return;
    const reordered = [...items];
    const [removed] = reordered.splice(idx, 1);
    reordered.splice(newIdx, 0, removed);
    try {
      await Promise.all(
        reordered.map((it, pos) => updateRoadmapItem(it.id, { position: pos }))
      );
      onUpdate();
    } catch {
      toast.error('Erro ao reordenar.');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Trilha de conclusão</CardTitle>
        <CardDescription>
          Ordem das etapas que o colaborador deve concluir. Clique em editar para alterar título e arquivos.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-2">
          {items.map((item, index) => (
            <li
              key={item.id}
              className="flex items-center gap-2 p-3 rounded-lg border bg-card"
            >
              <div className="flex items-center gap-1 text-muted-foreground">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleMove(item, 'up')}
                  disabled={index === 0}
                  aria-label="Mover para cima"
                >
                  <GripVertical className="w-4 h-4" />
                </Button>
                <span className="text-sm font-medium w-6">{index + 1}.</span>
              </div>
              {item.content_type === 'pdf' && <FileText className="w-4 h-4 text-muted-foreground shrink-0" />}
              {item.content_type === 'video' && <Video className="w-4 h-4 text-muted-foreground shrink-0" />}
              <span className="flex-1 font-medium truncate min-w-0">{item.title}</span>
              <Badge variant="secondary" className="shrink-0">
                {CONTENT_TYPE_LABELS[item.content_type]}
              </Badge>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => startEditing(item)}
                aria-label="Editar etapa"
              >
                <Pencil className="w-4 h-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive shrink-0"
                onClick={() => handleDelete(item)}
                aria-label="Remover etapa"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </li>
          ))}
        </ul>

        {editingItem && (
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-lg">Editar etapa</CardTitle>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={cancelEditing}
                  aria-label="Fechar"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <CardDescription>
                {CONTENT_TYPE_LABELS[editingItem.content_type]} — altere título e arquivos conforme necessário.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-title">Título da etapa</Label>
                <Input
                  id="edit-title"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Ex: Módulo 1 - Introdução"
                />
              </div>

              {editingItem.content_type === 'pdf' && (
                <div className="space-y-2">
                  <Label>Arquivo PDF</Label>
                  <p className="text-sm text-muted-foreground">
                    Atual: {getFileNameFromPath((editingItem.payload as unknown as RoadmapItemPdfPayload)?.storage_path ?? '') || '—'}
                  </p>
                  <Input
                    ref={replacePdfInputRef}
                    type="file"
                    accept="application/pdf"
                    className="sr-only"
                    onChange={handleReplacePdfInEdit}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => replacePdfInputRef.current?.click()}
                  >
                    Substituir PDF
                  </Button>
                  {editPdfReplacementFile && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-primary shrink-0" aria-hidden />
                      <span>Novo arquivo: {editPdfReplacementFile.name}</span>
                    </p>
                  )}
                </div>
              )}

              {editingItem.content_type === 'video' && (
                <div className="space-y-3">
                  <Label>Vídeo da etapa</Label>
                  <p className="text-xs text-muted-foreground">
                    Um vídeo por etapa. MP4, WebM ou MOV. Máx. 5MB.
                  </p>
                  <div className="flex flex-col gap-2 rounded-lg border bg-background p-3 sm:flex-row sm:items-center sm:gap-3">
                    <Input
                      className="sm:flex-1"
                      value={editVideo?.title ?? ''}
                      onChange={(e) =>
                        setEditVideo((prev) => (prev ? { ...prev, title: e.target.value } : { title: e.target.value }))
                      }
                      placeholder="Título do vídeo"
                    />
                    <span className="text-xs text-muted-foreground truncate sm:max-w-[140px]">
                      {editVideo?.storage_path ? getFileNameFromPath(editVideo.storage_path) : 'Nenhum arquivo'}
                    </span>
                    <Input
                      ref={replaceVideoInputRef}
                      type="file"
                      accept="video/mp4,video/webm,video/quicktime"
                      className="sr-only"
                      onChange={handleVideoFileInEdit}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isReplacingVideo}
                      onClick={() => replaceVideoInputRef.current?.click()}
                    >
                      {isReplacingVideo ? 'Enviando...' : editVideo?.storage_path ? 'Substituir vídeo' : 'Selecionar vídeo'}
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-2">
                <Button onClick={handleSaveEdit} disabled={editSaving}>
                  {editSaving ? 'Salvando...' : 'Salvar alterações'}
                </Button>
                <Button type="button" variant="outline" onClick={cancelEditing}>
                  Cancelar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {addingType === null && !editingItem && (
          <Select
            value=""
            onValueChange={(v) => setAddingType(v as RoadmapContentType)}
          >
            <SelectTrigger className="w-full md:w-64">
              <SelectValue placeholder="Adicionar etapa..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pdf">PDF</SelectItem>
              <SelectItem value="video">Vídeo</SelectItem>
            </SelectContent>
          </Select>
        )}

        {addingType === 'pdf' && (
          <div className="p-4 rounded-lg border bg-muted/30 space-y-3">
            <Label>Título da etapa (PDF)</Label>
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Ex: Módulo 1 - Introdução"
            />
            <div className="flex flex-col gap-2">
              <Label>Arquivo PDF</Label>
              <Input
                ref={pdfInputRef}
                type="file"
                accept="application/pdf"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  if (file) {
                    const err = validateCoursePdfFile(file);
                    if (err) {
                      toast.error(err);
                      e.target.value = '';
                      return;
                    }
                  }
                  setNewPdfFile(file);
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => pdfInputRef.current?.click()}
              >
                Selecionar PDF
              </Button>
              <p className="text-xs text-muted-foreground">Máx. 5MB.</p>
              {newPdfFile && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-primary shrink-0" aria-hidden />
                  <span>Arquivo selecionado: {newPdfFile.name}</span>
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <Button onClick={handleAddPdf} disabled={uploading}>
                {uploading ? 'Enviando...' : 'Adicionar'}
              </Button>
              <Button variant="outline" onClick={() => { setAddingType(null); setNewTitle(''); setNewPdfFile(null); }}>
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {addingType === 'video' && (
          <div className="p-4 rounded-lg border bg-muted/30 space-y-3">
            <Label>Título da etapa (vídeo)</Label>
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Ex: Sessão 1 - Aula em vídeo"
            />
            <div className="flex flex-col gap-2">
              <Label>Arquivo de vídeo</Label>
              <Input
                ref={videoInputRef}
                type="file"
                accept="video/mp4,video/webm,video/quicktime"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  if (file) {
                    const err = validateCourseVideoFile(file);
                    if (err) {
                      toast.error(err);
                      e.target.value = '';
                      return;
                    }
                  }
                  setNewVideoFile(file);
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => videoInputRef.current?.click()}
              >
                Selecionar vídeo
              </Button>
              <p className="text-xs text-muted-foreground">Um vídeo por etapa. MP4, WebM ou MOV. Máx. 5MB.</p>
              {newVideoFile && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-primary shrink-0" aria-hidden />
                  <span>Arquivo selecionado: {newVideoFile.name}</span>
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <Button onClick={handleAddVideo} disabled={uploading}>
                {uploading ? 'Enviando...' : 'Adicionar'}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setAddingType(null);
                  setNewTitle('');
                  setNewVideoFile(null);
                }}
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
