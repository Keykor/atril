import { useState } from 'react';
import { createPortal } from 'react-dom';
import { t } from '../../app/strings';
import type { StickyNote } from '../../core/db/types';
import { Sheet } from '../../ui/Sheet';

interface Props {
  note: StickyNote;
  isNew: boolean; // recién pegada: se escribe enseguida (si se elimina, nunca existió)
  readOnly: boolean; // modo show: se lee, no se edita
  onSave: (text: string) => void; // vacío: se borra
  onDelete: () => void;
}

const stop = (e: React.SyntheticEvent) => e.stopPropagation();

/**
 * La notita abierta: se lee, y se puede escribir ahí mismo. Cerrar guarda. Va en un portal
 * porque la capa está dentro de la página con zoom (un `fixed` ahí adentro no queda fijo); el
 * envoltorio corta los eventos para que, en el árbol de React, no lleguen al lector ni a la capa.
 */
export function NoteSheet(p: Props) {
  const [text, setText] = useState(p.note.text);
  const n = t.annotate.note;
  return createPortal(
    <div style={{ display: 'contents' }} onPointerDown={stop} onPointerUp={stop} onClick={stop}>
      <Sheet
        variant="side"
        title={n.title}
        closeLabel={t.close}
        onClose={() => p.onSave(text)}
        footer={
          !p.readOnly && (
            <>
              <button className="btn danger" onClick={p.onDelete}>
                {t.delete}
              </button>
              <button className="btn primary" onClick={() => p.onSave(text)}>
                {t.done}
              </button>
            </>
          )
        }
      >
        <textarea
          className="input note-text"
          rows={8}
          value={text}
          readOnly={p.readOnly}
          // Solo al crearla: al abrir una para leerla no tiene que saltar el teclado.
          autoFocus={p.isNew}
          placeholder={n.placeholder}
          aria-label={n.title}
          onChange={(e) => setText(e.target.value)}
        />
      </Sheet>
    </div>,
    document.body,
  );
}
