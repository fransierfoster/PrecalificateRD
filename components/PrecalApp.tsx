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

    const script = document.createElement('script');
    script.id = 'precal-script';
    script.src = '/precal-script.js';
    script.onload = () => window.initPrecal?.();
    document.body.appendChild(script);
  }, []);

  return <div dangerouslySetInnerHTML={{ __html: PRECAL_BODY_HTML }} />;
}
