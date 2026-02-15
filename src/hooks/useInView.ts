import { useState, useEffect, useRef, useCallback } from 'react';

interface UseInViewOptions {
  rootMargin?: string;
  threshold?: number;
  root?: Element | null;
}

/**
 * Returns true when the element is in view (Intersection Observer).
 * Use with a ref on the element to lazy-load content when visible.
 */
export function useInView(options: UseInViewOptions = {}) {
  const { rootMargin = '100px', threshold = 0, root = null } = options;
  const ref = useRef<HTMLDivElement | null>(null);
  const [isInView, setIsInView] = useState(false);

  const setRef = useCallback((node: HTMLDivElement | null) => {
    ref.current = node;
  }, []);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsInView(true);
      },
      { rootMargin, threshold, root }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [rootMargin, threshold, root]);

  return { ref: setRef, isInView };
}
