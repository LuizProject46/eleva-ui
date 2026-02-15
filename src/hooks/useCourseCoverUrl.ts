import { useState, useEffect } from 'react';
import { getSignedUrl } from '@/services/courseService';

export interface UseCourseCoverUrlOptions {
  /** When false, does not fetch the signed URL (e.g. for lazy loading). */
  enabled?: boolean;
}

/**
 * Resolves a course cover storage path to a signed URL for display.
 * Returns null if path is null/empty, when enabled is false, or while loading / on error.
 */
export function useCourseCoverUrl(
  coverPath: string | null,
  options: UseCourseCoverUrlOptions = {}
): string | null {
  const { enabled = true } = options;
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !coverPath || !coverPath.trim()) {
      setUrl(null);
      return;
    }
    let cancelled = false;
    getSignedUrl(coverPath, 3600)
      .then((signedUrl) => {
        if (!cancelled) setUrl(signedUrl);
      })
      .catch(() => {
        if (!cancelled) setUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [coverPath, enabled]);

  return url;
}
