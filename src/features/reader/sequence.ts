import type { Crop, ReadingPrefs } from '../../core/db/types';

/** Dónde está el lector: posición en el orden virtual, y si está en el paso de media página. */
export interface View {
  pos: number;
  half: boolean;
}
export interface Seq {
  count: number;
  mode: ReadingPrefs['mode'];
  halfPage: boolean;
  twoUpStep: 1 | 2;
}

export function nextView(v: View, s: Seq): View | null {
  if (s.mode === 'two-up')
    return v.pos + 2 >= s.count
      ? null
      : { pos: Math.min(v.pos + s.twoUpStep, s.count - 1), half: false };
  if (v.pos + 1 >= s.count) return null;
  return s.halfPage && !v.half ? { pos: v.pos, half: true } : { pos: v.pos + 1, half: false };
}

export function prevView(v: View, s: Seq): View | null {
  if (s.mode === 'two-up')
    return v.pos === 0 ? null : { pos: Math.max(0, v.pos - s.twoUpStep), half: false };
  if (v.half) return { pos: v.pos, half: false };
  if (v.pos === 0) return null;
  return { pos: v.pos - 1, half: s.halfPage };
}

/** Orden virtual validado contra el PDF; si no hay (o quedó inválido), el orden natural. */
export function resolveOrder(pageOrder: number[] | undefined, pageCount: number): number[] {
  const valid = (pageOrder ?? []).filter((p) => Number.isInteger(p) && p >= 0 && p < pageCount);
  return valid.length ? valid : Array.from({ length: pageCount }, (_, i) => i);
}

/** "1, 2, 3, 2-4" (base 1) -> páginas reales base 0. undefined si queda vacío o es el orden natural. */
export function parsePageOrder(text: string, pageCount: number): number[] | undefined {
  const out: number[] = [];
  for (const part of text.split(/[,\s]+/).filter(Boolean)) {
    const m = /^(\d+)(?:-(\d+))?$/.exec(part);
    if (!m) continue;
    const from = Number(m[1]);
    const to = Number(m[2] ?? m[1]);
    for (let p = from; from <= to ? p <= to : p >= to; p += from <= to ? 1 : -1)
      if (p >= 1 && p <= pageCount) out.push(p - 1);
  }
  const natural = out.length === pageCount && out.every((p, i) => p === i);
  return out.length && !natural ? out : undefined;
}

export const formatPageOrder = (order: number[]) => order.map((p) => p + 1).join(', ');

/** Geometría de una página recortada mostrada a `width` px de ancho. */
export function pageGeometry(
  size: { w: number; h: number },
  crop: Crop | undefined,
  width: number,
) {
  const c = crop ?? { top: 0, right: 0, bottom: 0, left: 0 };
  const fw = Math.max(0.1, 1 - c.left - c.right);
  const fh = Math.max(0.1, 1 - c.top - c.bottom);
  const fullW = width / fw;
  const fullH = (fullW * size.h) / size.w;
  return { fullW, fullH, h: fullH * fh, left: c.left * fullW, top: c.top * fullH };
}

export const croppedAspect = (size: { w: number; h: number }, crop?: Crop) =>
  pageGeometry(size, crop, 1).h;
