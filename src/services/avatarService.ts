/**
 * Avatar upload: validate (5MB, JPG/PNG/WEBP), resize to thumb + standard, convert to WEBP.
 * Storage path: {tenant_id}/{user_id}/standard.webp and thumb.webp.
 */

import { supabase } from '@/lib/supabase';

const MAX_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const STANDARD_MAX_PX = 512;
const THUMB_MAX_PX = 80;
const WEBP_QUALITY = 0.85;

export function validateAvatarFile(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return 'Formato inválido. Use JPG, PNG ou WebP.';
  }
  if (file.size > MAX_SIZE_BYTES) {
    return 'Arquivo muito grande. Máximo 5MB.';
  }
  return null;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Falha ao carregar imagem'));
    img.src = URL.createObjectURL(file);
  });
}

function resizeToBlob(
  img: HTMLImageElement,
  maxSizePx: number,
  mime: string = 'image/webp',
  quality = WEBP_QUALITY
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    const scale = Math.min(1, maxSizePx / Math.max(w, h));
    const cw = Math.round(w * scale);
    const ch = Math.round(h * scale);

    const canvas = document.createElement('canvas');
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Canvas não disponível'));
      return;
    }
    ctx.drawImage(img, 0, 0, cw, ch);
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Falha ao gerar imagem'));
      },
      mime,
      quality
    );
  });
}

export interface AvatarUploadResult {
  avatarUrl: string;
  avatarThumbUrl: string;
}

export async function uploadAvatar(
  tenantId: string,
  userId: string,
  file: File
): Promise<AvatarUploadResult> {
  const err = validateAvatarFile(file);
  if (err) throw new Error(err);

  const img = await loadImage(file);
  try {
    const [standardBlob, thumbBlob] = await Promise.all([
      resizeToBlob(img, STANDARD_MAX_PX),
      resizeToBlob(img, THUMB_MAX_PX),
    ]);

    const standardPath = `${tenantId}/${userId}/standard.webp`;
    const thumbPath = `${tenantId}/${userId}/thumb.webp`;

    const { error: standardError } = await supabase.storage
      .from('avatars')
      .upload(standardPath, standardBlob, { upsert: true, contentType: 'image/webp' });

    if (standardError) throw new Error(standardError.message ?? 'Falha no envio da foto.');

    const { error: thumbError } = await supabase.storage
      .from('avatars')
      .upload(thumbPath, thumbBlob, { upsert: true, contentType: 'image/webp' });

    if (thumbError) throw new Error(thumbError.message ?? 'Falha no envio da foto.');

    const { data: standardData } = supabase.storage.from('avatars').getPublicUrl(standardPath);
    const { data: thumbData } = supabase.storage.from('avatars').getPublicUrl(thumbPath);

    return {
      avatarUrl: standardData.publicUrl,
      avatarThumbUrl: thumbData.publicUrl,
    };
  } finally {
    URL.revokeObjectURL(img.src);
  }
}
