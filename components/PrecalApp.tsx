'use client';

import { useEffect } from 'react';
import { PRECAL_BODY_HTML } from './precal-body';

declare global {
  interface Window {
    __SUPA_URL__?: string;
    __SUPA_KEY__?: string;
    initPrecal?: () => void;
  }
}

export default function PrecalApp() {
  useEffect(() => {
    window.__SUPA_URL__ = process.env.NEXT_PUBLIC_SUPABASE_URL;
    window.__SUPA_KEY__ = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const existing = document.getElementById('precal-script');
    if (existing) {
      window.initPrecal?.();
      return;
    }

    const loadScript = (src: string, id?: string) =>
      new Promise<void>((resolve) => {
        const s = document.createElement('script');
        if (id) s.id = id;
        s.src = src;
        s.onload = () => resolve();
        s.onerror = () => resolve();
        document.body.appendChild(s);
      });

    loadScript('/jspdf.min.js')
      .then(() => loadScript('/jspdf-autotable.min.js'))
      .then(() => loadScript('/precal-script.js', 'precal-script'))
      .then(() => window.initPrecal?.());
  }, []);

  return <div dangerouslySetInnerHTML={{ __html: PRECAL_BODY_HTML }} />;
}
