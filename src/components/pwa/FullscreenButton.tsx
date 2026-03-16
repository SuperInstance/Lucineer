'use client';
import { Maximize2, Minimize2 } from 'lucide-react';
import { useFullscreen } from '@/hooks/useFullscreen';
import { Button } from '@/components/ui/button';

export function FullscreenButton() {
  const { isFullscreen, isSupported, toggle } = useFullscreen();
  if (!isSupported) return null;

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => toggle()}
      title={isFullscreen ? 'Exit full screen' : 'Enter full screen'}
      className="fixed top-4 right-4 z-50 bg-black/40 backdrop-blur-sm hover:bg-black/60 text-white border border-white/10"
    >
      {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
    </Button>
  );
}
