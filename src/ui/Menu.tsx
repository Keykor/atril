import { useEffect, useRef, type ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import './ui.css';

export interface MenuItem {
  label: string;
  icon?: IconName;
  hint?: string; // segunda línea, más chica: aclara qué hace
  checked?: boolean; // opción de un grupo (p. ej. el ajuste de página): muestra un tilde
  className?: string; // para ocultarlo cuando la acción ya está a la vista en la barra
  onSelect: () => void;
}
export interface MenuGroup {
  label?: string;
  items: MenuItem[];
}

interface Props {
  label: string;
  groups: MenuGroup[];
  onClose: () => void;
  footer?: ReactNode;
}

/**
 * Menú desplegable del botón ⋯ ("Más"). Cada opción tiene ícono y nombre: lo que no entra en la
 * barra va acá con su texto (patrón "Priority+": lo más usado a la vista, el resto en "Más").
 */
export function Menu({ label, groups, onClose }: Props) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    root.current?.querySelector<HTMLElement>('[role^="menuitem"]')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return onClose();
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      e.preventDefault();
      const items = [...root.current!.querySelectorAll<HTMLElement>('[role^="menuitem"]')].filter(
        (el) => el.offsetParent !== null,
      );
      const i = items.indexOf(document.activeElement as HTMLElement);
      items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
    };
    // Tocar afuera lo cierra (en captura, antes de que el toque llegue a otra cosa).
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) onClose();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown, true);
    };
  }, [onClose]);

  return (
    <div ref={root} className="menu" role="menu" aria-label={label}>
      {groups.map((group, gi) => (
        <div key={gi} className="menu-group" role="group" aria-label={group.label}>
          {group.label && <div className="menu-group-label">{group.label}</div>}
          {group.items.map((item) => (
            <button
              key={item.label}
              type="button"
              role={item.checked === undefined ? 'menuitem' : 'menuitemradio'}
              aria-checked={item.checked}
              className={`menu-item ${item.className ?? ''}`}
              onClick={() => {
                onClose();
                item.onSelect();
              }}
            >
              <span className="menu-icon">
                {item.checked !== undefined
                  ? item.checked && <Icon name="check" size={20} />
                  : item.icon && <Icon name={item.icon} size={20} />}
              </span>
              <span className="menu-text">
                <span>{item.label}</span>
                {item.hint && <small>{item.hint}</small>}
              </span>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
