import { useCallback, useState } from 'react';
import { saveAnnotations } from '../../core/db/repos';
import type { PageAnnotations } from '../../core/db/types';

interface Entry {
  before: PageAnnotations;
  after: PageAnnotations;
}

/** Deshacer y rehacer de la sesión de lectura: snapshots por página. */
export function useAnnotationHistory() {
  const [stacks, setStacks] = useState<{ undo: Entry[]; redo: Entry[] }>({ undo: [], redo: [] });

  const commit = useCallback((before: PageAnnotations, after: PageAnnotations) => {
    void saveAnnotations(after);
    setStacks((s) => ({ undo: [...s.undo.slice(-99), { before, after }], redo: [] }));
  }, []);

  const undo = useCallback(() => {
    setStacks((s) => {
      const entry = s.undo.at(-1);
      if (!entry) return s;
      void saveAnnotations(entry.before);
      return { undo: s.undo.slice(0, -1), redo: [...s.redo, entry] };
    });
  }, []);

  const redo = useCallback(() => {
    setStacks((s) => {
      const entry = s.redo.at(-1);
      if (!entry) return s;
      void saveAnnotations(entry.after);
      return { undo: [...s.undo, entry], redo: s.redo.slice(0, -1) };
    });
  }, []);

  return { commit, undo, redo, canUndo: stacks.undo.length > 0, canRedo: stacks.redo.length > 0 };
}
