import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from './Icon';
import './ui.css';

interface Props {
  title: string;
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
  modal?: boolean; // false: sin fondo oscuro y más baja, para ver la partitura mientras se ajusta
}

/**
 * Hoja inferior. En pantallas anchas queda centrada abajo; en el celular, si es modal, ocupa
 * toda la altura. Cuando hay más contenido abajo lo avisa con un degradé y una flecha.
 */
export function Sheet({ title, closeLabel, onClose, children, modal = true }: Props) {
  const body = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    const el = body.current!;
    const check = () => setMore(el.scrollTop + el.clientHeight < el.scrollHeight - 8);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    for (const child of el.children) ro.observe(child);
    el.addEventListener('scroll', check, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener('scroll', check);
    };
  }, []);

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
        <div className="sheet-body" ref={body}>
          {children}
        </div>
        {more && (
          <div className="sheet-more" aria-hidden="true">
            <Icon name="down" size={18} />
          </div>
        )}
      </section>
    </div>
  );
}
