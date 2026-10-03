import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from './Icon';
import './ui.css';

interface Props {
  title: string;
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode; // acciones fijas abajo, fuera de lo que se desplaza
  // side: panel lateral, para lo que se abre dentro del lector (la partitura sigue a la vista).
  // center: diálogo centrado, para el resto.
  variant?: 'side' | 'center';
  modal?: boolean; // false: sin fondo oscuro, para ver la partitura mientras se ajusta
}

/**
 * Panel lateral o diálogo centrado. En el celular el panel lateral modal ocupa toda la
 * pantalla. Cuando hay más contenido abajo lo avisa con un degradé y una flecha.
 */
export function Sheet({
  title,
  closeLabel,
  onClose,
  children,
  footer,
  variant = 'center',
  modal = true,
}: Props) {
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
      className={`sheet-backdrop ${variant}${modal ? '' : ' passive'}`}
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
        <header className="sheet-header">
          <h2>{title}</h2>
          <button className="icon-btn round" aria-label={closeLabel} onClick={onClose}>
            <Icon name="close" />
          </button>
        </header>
        <div className="sheet-scroll">
          <div className="sheet-body" ref={body}>
            {children}
          </div>
          {more && (
            <div className="sheet-more" aria-hidden="true">
              <Icon name="down" size={18} />
            </div>
          )}
        </div>
        {footer && <footer className="sheet-footer">{footer}</footer>}
      </section>
    </div>
  );
}
