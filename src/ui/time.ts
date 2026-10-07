import { language } from '../core/language';

const rtf = new Intl.RelativeTimeFormat(language, { numeric: 'auto' });

/** "hace 2 minutos", "ayer". */
export function ago(timestamp: number, now = Date.now()) {
  const s = Math.round((timestamp - now) / 1000);
  if (Math.abs(s) < 60) return rtf.format(0, 'second');
  if (Math.abs(s) < 3600) return rtf.format(Math.round(s / 60), 'minute');
  if (Math.abs(s) < 86400) return rtf.format(Math.round(s / 3600), 'hour');
  return rtf.format(Math.round(s / 86400), 'day');
}
