'use client';
import { useEffect } from 'react';
import { registerServiceWorker } from '@/lib/sw-registration';

export function ServiceWorkerRegistration() {
  useEffect(() => {
    registerServiceWorker();
  }, []);
  return null;
}
