import type { ReactNode } from 'react';
import { UpdateBanner } from '../features/settings/Update';
import { Icon, type IconName } from '../ui/Icon';
import { t } from './strings';
import './shell.css';

export type Section = 'library' | 'lists' | 'settings';

const ITEMS: { id: Section; href: string; icon: IconName; label: string }[] = [
  { id: 'library', href: '#/', icon: 'book', label: t.nav.library },
  { id: 'lists', href: '#/lists', icon: 'list', label: t.nav.lists },
  { id: 'settings', href: '#/settings', icon: 'sliders', label: t.nav.settings },
];

interface Props {
  section: Section;
  sidebar?: ReactNode; // contenido extra de la barra lateral (etiquetas)
  footer?: ReactNode; // estado del backup
  children: ReactNode;
}

/** Barra lateral en tablet, barra inferior en celular. */
export function Shell({ section, sidebar, footer, children }: Props) {
  return (
    <div className="shell">
      <nav className="shell-nav" aria-label={t.nav.sections}>
        <div className="shell-brand">
          <img src="icon.svg" alt="" width="32" height="32" />
          <span>{t.appName}</span>
        </div>
        <div className="shell-links">
          {ITEMS.map((i) => (
            <a key={i.id} href={i.href} aria-current={i.id === section ? 'page' : undefined}>
              <Icon name={i.icon} />
              {i.label}
            </a>
          ))}
        </div>
        <div className="shell-extra">{sidebar}</div>
        <div className="shell-footer">{footer}</div>
      </nav>
      <main className="shell-main">
        <UpdateBanner />
        {children}
      </main>
    </div>
  );
}
