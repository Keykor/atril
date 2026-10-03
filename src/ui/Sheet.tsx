import { useEffect, type ReactNode } from 'react';
import { Icon } from './Icon';
import './ui.css';

interface Props {
  title: string;
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
  modal?: boolean; // false: sin fondo oscuro y más baja, para ver la partitura mientras se ajusta
}

/** Hoja inferior modal (en pantallas anchas queda centrada abajo). */
export function Sheet({ title, closeLabel, onClose, children, modal = true }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className={`sheet-backdrop${modal ? '' : ' passive'}`}
      onClick={modal ? onClose : undefined}
    >
      <section
        className="sheet"
        role="dialog"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div className="sheet-handle" />
        <header className="sheet-header">
          <h2>{title}</h2>
          <button className="icon-btn round" aria-label={closeLabel} onClick={onClose}>
            <Icon name="close" />
          </button>
        </header>
        <div className="sheet-body">{children}</div>
      </section>
    </div>
  );
}
