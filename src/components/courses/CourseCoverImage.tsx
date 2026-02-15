import { GraduationCap } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface CourseCoverImageProps {
  coverUrl: string | null;
  alt: string;
  className?: string;
  aspectRatio?: 'video' | 'square';
  /** When true, show skeleton instead of placeholder (e.g. lazy load in progress). */
  isLoading?: boolean;
}

/**
 * Renders course cover image or a placeholder when no cover.
 * Use with signed URL from useCourseCoverUrl(coverPath).
 * Add loading="lazy" for native lazy loading when URL is available.
 */
export function CourseCoverImage({
  coverUrl,
  alt,
  className = '',
  aspectRatio = 'video',
  isLoading = false,
}: CourseCoverImageProps) {
  const aspectClass = aspectRatio === 'video' ? 'aspect-video' : 'aspect-square';

  if (isLoading) {
    return (
      <Skeleton
        className={`${aspectClass} w-full rounded-lg ${className}`}
        aria-hidden
      />
    );
  }

  if (!coverUrl) {
    return (
      <div
        className={`${aspectClass} w-full bg-muted flex items-center justify-center rounded-lg ${className}`}
        aria-hidden
      >
        <GraduationCap className="w-10 h-10 text-muted-foreground/50 md:w-12 md:h-12" />
      </div>
    );
  }

  return (
    <img
      src={coverUrl}
      alt={alt}
      loading="lazy"
      decoding="async"
      className={`${aspectClass} w-full object-cover rounded-lg ${className}`}
    />
  );
}
