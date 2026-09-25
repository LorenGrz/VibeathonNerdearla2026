'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSession, fetchSamples, startSession } from '@/features/admin/api';
import { buildDemoSessions } from '@/features/admin/demo';

export function QuickDemoButton({ className = '' }: { className?: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLaunch = async () => {
    setLoading(true);
    try {
      const samples = await fetchSamples();
      const demo = buildDemoSessions(samples);
      if (!demo) {
        alert('No se encontraron los samples de audio.');
        return;
      }
      const created = await Promise.all(demo.map((dto) => createSession(dto)));
      await Promise.all(created.map((s) => startSession(s.id)));
      router.refresh();
      // If first session created, navigate directly to it
      if (created[0]) {
        router.push(`/s/${created[0].id}?lang=es`);
      }
    } catch (err) {
      console.error(err);
      alert('Error iniciando la demo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleLaunch}
      disabled={loading}
      className={`inline-flex items-center justify-center gap-2 rounded-cta bg-accent px-5 py-2.5 font-display text-xs font-bold uppercase tracking-wider text-ink shadow-md hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 ${className}`}
    >
      {loading ? (
        <>
          <span className="h-3.5 w-3.5 rounded-full border-2 border-ink border-t-transparent animate-spin" />
          <span>Iniciando Demo…</span>
        </>
      ) : (
        <>
          <span>⚡</span>
          <span>Lanzar Demo en Vivo (2 Salas)</span>
        </>
      )}
    </button>
  );
}
