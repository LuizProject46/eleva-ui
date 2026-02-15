import { useState, useEffect } from 'react';
import { getSignedUrl } from '@/services/courseService';
import { Skeleton } from '@/components/ui/skeleton';
import { useInView } from '@/hooks/useInView';
import type { CourseRoadmapItem } from '@/types/courses';
import type { RoadmapItemPdfPayload, RoadmapItemVideoPayload } from '@/types/courses';

/** Lazy-loads video src only when in viewport. Uses preload="metadata" for faster first frame. */
function LazyVideo({ url, title }: { url: string; title: string }) {
  const { ref, isInView } = useInView({ rootMargin: '200px', threshold: 0 });

  return (
    <div ref={ref} className="rounded-lg border bg-muted/30 overflow-hidden">
      {title && (
        <p className="px-3 py-2 text-sm font-medium bg-muted/50">{title}</p>
      )}
      {isInView ? (
        <video
          src={url}
          controls
          controlsList="nodownload"
          disablePictureInPicture
          disableRemotePlayback
          playsInline
          preload="metadata"
          className="w-full h-[60vh] min-h-[400px]"
        >
          Seu navegador não suporta vídeo.
        </video>
      ) : (
        <div className="w-full h-[60vh] min-h-[400px] flex items-center justify-center bg-muted/50">
          <Skeleton className="w-full h-full rounded-none" />
        </div>
      )}
    </div>
  );
}

interface RoadmapStepViewerProps {
  item: CourseRoadmapItem;
  courseId: string;
  tenantId: string;
}

export function RoadmapStepViewer({ item, courseId, tenantId }: RoadmapStepViewerProps) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [videoUrls, setVideoUrls] = useState<Array<{ title: string; url: string }>>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (item.content_type === 'pdf') {
      const payload = item.payload as unknown as RoadmapItemPdfPayload;
      const path = payload?.storage_path;
      if (!path) {
        setError('Arquivo não configurado.');
        return;
      }
      getSignedUrl(path)
        .then((url) => {
          if (!cancelled) setPdfUrl(url);
        })
        .catch(() => {
          if (!cancelled) setError('Não foi possível carregar o PDF.');
        });
    } else if (item.content_type === 'video') {
      const payload = item.payload as unknown as RoadmapItemVideoPayload;
      const videos = payload?.videos ?? [];
      if (videos.length === 0) {
        setError('Nenhum vídeo configurado.');
        return;
      }
      Promise.all(
        videos.map(async (v) => {
          if (v.url) return { title: v.title ?? '', url: v.url };
          if (v.storage_path) {
            const url = await getSignedUrl(v.storage_path);
            return { title: v.title ?? '', url };
          }
          return { title: v.title ?? '', url: '' };
        })
      )
        .then((list) => {
          if (!cancelled) setVideoUrls(list.filter((x) => x.url));
        })
        .catch(() => {
          if (!cancelled) setError('Não foi possível carregar o(s) vídeo(s).');
        });
    }

    return () => { cancelled = true; };
  }, [item.content_type, item.payload]);

  if (error) {
    return (
      <div className="rounded-lg border bg-muted/50 p-4 text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (item.content_type === 'pdf' && pdfUrl) {
    return (
      <div className="rounded-lg border bg-muted/30 overflow-hidden">
        <iframe
          title={item.title}
          src={pdfUrl}
          className="w-full h-[60vh] min-h-[400px]"
        />
      </div>
    );
  }

  if (item.content_type === 'video' && videoUrls.length > 0) {
    return (
      <div className="space-y-4">
        {videoUrls.map((v, i) => (
          <LazyVideo key={i} url={v.url} title={v.title} />
        ))}
      </div>
    );
  }

  if (item.content_type === 'pdf') {
    return (
      <div className="rounded-lg border border-border overflow-hidden">
        <Skeleton className="w-full h-[60vh] min-h-[400px] rounded-none" />
      </div>
    );
  }

  if (item.content_type === 'video') {
    return (
      <div className="space-y-4">
        <Skeleton className="w-full aspect-video rounded-lg" />
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
      Tipo de conteúdo não suportado nesta tela: {item.content_type}
    </div>
  );
}
