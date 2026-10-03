import type { SetList } from '../../core/db/types';

/** Qué viene después del ítem `index`: los separadores intermedios y la próxima partitura. */
export function nextInShow(list: SetList, index: number) {
  const breaks: string[] = [];
  for (let i = index + 1; i < list.items.length; i++) {
    const item = list.items[i];
    if (item.type === 'score') return { breaks, next: { index: i, scoreId: item.scoreId } };
    breaks.push(item.label);
  }
  return { breaks, next: undefined };
}

export function prevInShow(list: SetList, index: number) {
  for (let i = index - 1; i >= 0; i--) if (list.items[i].type === 'score') return i;
  return undefined;
}

/** "obra 3 de 6": los separadores no cuentan. */
export function scoreNumber(list: SetList, index: number) {
  const scores = list.items.map((item, i) => ({ item, i })).filter((x) => x.item.type === 'score');
  return { n: scores.findIndex((x) => x.i === index) + 1, total: scores.length };
}

export function counts(list: SetList) {
  const scores = list.items.filter((i) => i.type === 'score').length;
  return { scores, breaks: list.items.length - scores };
}
