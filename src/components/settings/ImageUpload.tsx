import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Upload, Loader2, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function getExtension(mime: string): string {
  if (mime === 'image/jpeg') return 'jpg';
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  return 'jpg';
}

function getUniqueFileId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

interface ImageUploadProps {
  tenantId: string;
  pathPrefix: string; // e.g. 'logo' or 'login-cover'
  currentUrl?: string | null;
  onUploadSuccess: (url: string) => void;
  onRemove?: () => void;
  label: string;
  className?: string;
}

export function ImageUpload({
  tenantId,
  pathPrefix,
  currentUrl,
  onUploadSuccess,
  onRemove,
  label,
  className,
}: ImageUploadProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const displayUrl = previewUrl ?? currentUrl ?? null;

  const validateFile = (file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return 'Formato inválido. Use JPG, PNG ou WebP.';
    }
    if (file.size > MAX_SIZE_BYTES) {
      return 'Arquivo muito grande. Máximo 2MB.';
    }
    return null;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    const err = validateFile(file);
    if (err) {
      setError(err);
      return;
    }

    setPreviewUrl(URL.createObjectURL(file));
    setIsLoading(true);

    try {
      const ext = getExtension(file.type);
      const uniqueId = getUniqueFileId();
      const path = `${tenantId}/${pathPrefix}-${uniqueId}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('tenant-assets')
        .upload(path, file, { upsert: true, contentType: file.type });

      if (uploadError) {
        setError(uploadError.message ?? 'Falha no envio.');
        return;
      }

      const { data } = supabase.storage.from('tenant-assets').getPublicUrl(path);
      onUploadSuccess(data.publicUrl);
    } catch {
      setError('Falha no envio.');
    } finally {
      setIsLoading(false);
      e.target.value = '';
    }
  };

  return (
    <div className={cn('space-y-2', className)}>
      <Label>{label}</Label>
      <div className="flex items-center gap-4 flex-wrap">
        <div className="h-20 w-28 rounded-xl bg-muted border border-border flex items-center justify-center overflow-hidden shrink-0">
          {displayUrl ? (
            <img
              src={displayUrl}
              alt="Preview"
              className="h-full w-full object-contain"
              loading='lazy'
            />
          ) : (
            <span className="text-xs text-muted-foreground">Sem imagem</span>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <input
            ref={inputRef}
            type="file"
            accept={ALLOWED_TYPES.join(',')}
            onChange={handleFileChange}
            className="hidden"
            disabled={isLoading}
          />
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => inputRef.current?.click()}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Upload className="w-4 h-4 mr-2" />
              )}
              {isLoading ? 'Enviando...' : 'Enviar imagem'}
            </Button>
            {displayUrl && onRemove && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onRemove}
                disabled={isLoading}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Remover
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">Máx. 2MB. JPG, PNG ou WebP.</p>
        </div>
      </div>
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}
