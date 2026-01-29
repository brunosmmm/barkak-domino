import { useCallback, useEffect, useState } from 'react';

export interface ContainerSize {
  width: number;
  height: number;
}

/**
 * Hook to track the size of a container element using ResizeObserver.
 * Returns a callback ref to attach to the container and its current dimensions.
 *
 * Uses a callback ref instead of useRef to properly handle cases where
 * the element isn't available on first render.
 */
export function useContainerSize(): [(element: HTMLDivElement | null) => void, ContainerSize] {
  const [size, setSize] = useState<ContainerSize>({ width: 0, height: 0 });
  const [element, setElement] = useState<HTMLDivElement | null>(null);

  // Callback ref that captures the element when it's attached
  const callbackRef = useCallback((node: HTMLDivElement | null) => {
    setElement(node);
  }, []);

  useEffect(() => {
    if (!element) {
      setSize({ width: 0, height: 0 });
      return;
    }

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        // Use contentBoxSize for accurate content dimensions
        const contentWidth = entry.contentBoxSize?.[0]?.inlineSize ?? entry.contentRect.width;
        const contentHeight = entry.contentBoxSize?.[0]?.blockSize ?? entry.contentRect.height;
        setSize({ width: contentWidth, height: contentHeight });
      }
    });

    observer.observe(element);

    // Set initial size immediately
    setSize({ width: element.clientWidth, height: element.clientHeight });

    return () => observer.disconnect();
  }, [element]);

  return [callbackRef, size];
}

/**
 * @deprecated Use useContainerSize instead for both width and height
 */
export function useContainerWidth(): [(element: HTMLDivElement | null) => void, number] {
  const [callbackRef, size] = useContainerSize();
  return [callbackRef, size.width];
}
