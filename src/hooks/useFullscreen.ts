'use client';
import { useState, useCallback, useEffect } from 'react';

interface FullscreenState {
  isFullscreen: boolean;
  isSupported: boolean;
  enter: (element?: HTMLElement) => Promise<void>;
  exit: () => Promise<void>;
  toggle: (element?: HTMLElement) => Promise<void>;
}

export function useFullscreen(): FullscreenState {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const isSupported =
    typeof document !== 'undefined' &&
    !!(
      document.fullscreenEnabled ||
      (document as any).webkitFullscreenEnabled ||
      (document as any).mozFullScreenEnabled
    );

  useEffect(() => {
    const onChange = () => {
      setIsFullscreen(
        !!(
          document.fullscreenElement ||
          (document as any).webkitFullscreenElement ||
          (document as any).mozFullScreenElement
        )
      );
    };
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange);
    document.addEventListener('mozfullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      document.removeEventListener('webkitfullscreenchange', onChange);
      document.removeEventListener('mozfullscreenchange', onChange);
    };
  }, []);

  const enter = useCallback(async (element?: HTMLElement) => {
    const el = element ?? document.documentElement;
    if (el.requestFullscreen) await el.requestFullscreen();
    else if ((el as any).webkitRequestFullscreen) await (el as any).webkitRequestFullscreen();
    else if ((el as any).mozRequestFullScreen) await (el as any).mozRequestFullScreen();
  }, []);

  const exit = useCallback(async () => {
    if (document.exitFullscreen) await document.exitFullscreen();
    else if ((document as any).webkitExitFullscreen) await (document as any).webkitExitFullscreen();
    else if ((document as any).mozCancelFullScreen) await (document as any).mozCancelFullScreen();
  }, []);

  const toggle = useCallback(
    async (element?: HTMLElement) => {
      if (isFullscreen) await exit();
      else await enter(element);
    },
    [isFullscreen, enter, exit]
  );

  return { isFullscreen, isSupported, enter, exit, toggle };
}
