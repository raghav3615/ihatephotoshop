'use client';
import { useEffect, useRef, useState } from 'react';
import { EDITOR_SHELL_HTML } from '../editor-shell-content.js';

export default function CanvaPage() {
  const mount = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    const saved = typeof window !== 'undefined' ? localStorage.getItem('ihp-theme') : null;
    const isDark = saved === 'dark' || (!saved && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (isDark && typeof document !== 'undefined') {
      document.documentElement.classList.add('dark', 'editor-dark');
      document.body.classList.add('dark', 'editor-dark');
    }

    if (!mount.current) return;

    mount.current.innerHTML = EDITOR_SHELL_HTML;

    import('../../app.js')
      .then((mod) => {
        if (mod?.initEditor) {
          mod.initEditor();
        }
        if (active) setReady(true);
      })
      .catch((err) => {
        console.error('Editor initialization error:', err);
        if (active) setReady(true);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {!ready && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-zinc-950 text-sm font-medium text-lime-300">
          Loading ihatephotoshop…
        </div>
      )}
      <div ref={mount} />
    </main>
  );
}
