import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState } from 'react';
import { getPageAnnotations } from '../../core/db/queries';
import { emptyAnnotations, newId } from '../../core/db/repos';
import type { PageAnnotations, Stamp, Stroke, TextNote } from '../../core/db/types';
import {
  eraseAt,
  HIGHLIGHTER_FACTOR,
  strokePath,
  TEXT_SIZE,
  VB,
  WIDTHS,
  type ToolState,
} from './strokes';
import { hitsStamp, STAMP_SIZES, stampGeometry } from './symbols';
import './annotations.css';

interface Props {
  scoreId: string;
  page: number; // página real
  aspect: number; // alto / ancho de la página
  active: boolean; // modo anotar
  locked?: boolean; // modo show: no se dibuja
  penOnly: boolean;
  tool: ToolState;
  label: string;
  textPlaceholder: string;
  onPenStart: () => void; // se apoyó el lápiz mientras se leía
  onCommit: (before: PageAnnotations, after: PageAnnotations) => void;
  onUndo: () => void;
}

/**
 * Capa de anotaciones de una página: SVG para lo guardado y un canvas para el trazo vivo.
 * Si un puntero no dibuja (dedo con "solo lápiz", o modo lectura), el evento sigue hacia
 * el lector, que lo usa para pasar página.
 */
export function AnnotationLayer(p: Props) {
  const saved =
    useLiveQuery(() => getPageAnnotations(p.scoreId, p.page), [p.scoreId, p.page]) ??
    emptyAnnotations(p.scoreId, p.page);
  const [draft, setDraft] = useState<PageAnnotations>(); // mientras se borra o se mueve un símbolo
  const [editing, setEditing] = useState<TextNote>();
  const root = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  // Lo que se ve, y desde donde arranca cada gesto: puede ir adelante de lo guardado.
  const shown = draft ?? saved;

  // Lo provisorio (goma, símbolo arrastrado, trazo recién hecho) queda a la vista hasta que la
  // base devuelve lo guardado. Si se descartara al soltar, por un instante se vería lo de antes.
  // Cada cambio guardado lleva la hora en que se hizo; la base guarda con una hora igual o
  // posterior. Se descarta lo provisorio solo cuando lo guardado lo alcanza, así una respuesta
  // vieja (de un cambio anterior) no lo pisa.
  useEffect(() => {
    setDraft((d) => (d && saved.updatedAt >= d.updatedAt ? undefined : d));
  }, [saved.updatedAt]);

  const g = useRef({
    id: -1,
    mode: 'stroke' as 'stroke' | 'erase' | 'stamp',
    stampAt: null as [number, number] | null, // símbolo nuevo: dónde se apoyó
    stampDrag: null as { id: string; dx: number; dy: number } | null, // símbolo que se arrastra
    points: [] as Stroke['points'],
    before: saved,
    erased: saved,
    touches: new Map<number, { x: number; y: number }>(), // dedos apoyados y dónde empezaron
    twoFingerAt: 0,
    twoFingerMoved: false, // los dos dedos se movieron: fue mover o hacer zoom, no "deshacer"
    textAt: null as [number, number] | null,
    committed: false, // el gesto que termina guardó algo
  }).current;

  const norm = (e: { clientX: number; clientY: number }) => {
    const r = root.current!.getBoundingClientRect();
    return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height] as const;
  };
  const strokeWidth = () =>
    WIDTHS[p.tool.width] * (p.tool.tool === 'highlighter' ? HIGHLIGHTER_FACTOR : 1);

  const cancel = (keepDraft = false) => {
    g.id = -1;
    g.stampAt = g.stampDrag = null;
    if (!keepDraft) setDraft(undefined);
    const c = canvas.current;
    c?.getContext('2d')?.clearRect(0, 0, c.width, c.height);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'touch') {
      g.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (p.active && g.touches.size === 2) {
        // Segundo dedo: no es un trazo. Si se mueven, el lector mueve la página o hace zoom
        // (lo escucha en la fase de captura); si levantan enseguida sin moverse, es "deshacer".
        cancel();
        g.twoFingerAt = performance.now();
        g.twoFingerMoved = false;
        e.stopPropagation();
        return;
      }
    }
    const draws =
      !p.locked && (p.active ? e.pointerType !== 'touch' || !p.penOnly : e.pointerType === 'pen');
    if (!draws || g.id !== -1 || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.stopPropagation();
    // Con el lápiz apoyado mientras se lee, texto y símbolos no tienen sentido: dibuja.
    const tool =
      p.active || (p.tool.tool !== 'text' && p.tool.tool !== 'stamp') ? p.tool.tool : 'pen';
    if (!p.active) p.onPenStart();

    const [x, y] = norm(e);
    if (tool === 'text') {
      // El editor se abre en el click: abrirlo acá lo desenfocaría el mousedown que sigue.
      g.textAt = [x, y];
      return;
    }
    root.current!.setPointerCapture(e.pointerId);
    g.id = e.pointerId;
    g.before = shown;
    g.erased = shown;
    if (tool === 'stamp') {
      // Tocar un símbolo lo agarra para moverlo; tocar en otro lado pega uno nuevo al soltar.
      g.mode = 'stamp';
      const hit = [...(shown.stamps ?? [])]
        .reverse()
        .find((s) => hitsStamp(s, x, y, p.aspect, STAMP_HIT));
      g.stampDrag = hit ? { id: hit.id, dx: hit.x - x, dy: hit.y - y } : null;
      g.stampAt = hit ? null : [x, y];
      return;
    }
    if (tool === 'eraser') {
      g.mode = 'erase';
      g.erased = eraseAt(shown, x, y, p.aspect);
      setDraft(g.erased);
      return;
    }
    g.mode = 'stroke';
    g.points = [[x, y, e.pressure || 0.5]];
    const c = canvas.current!;
    const r = root.current!.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(r.width * dpr);
    c.height = Math.round(r.height * dpr);
    const ctx = c.getContext('2d')!;
    ctx.lineCap = ctx.lineJoin = 'round';
    ctx.lineWidth = strokeWidth() * c.width;
    ctx.strokeStyle = p.tool.color;
    ctx.globalAlpha = tool === 'highlighter' ? 0.4 : 1;
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const touch = g.twoFingerAt ? g.touches.get(e.pointerId) : undefined;
    if (touch && Math.hypot(e.clientX - touch.x, e.clientY - touch.y) > 12) g.twoFingerMoved = true;
    if (e.pointerId !== g.id) return;
    e.stopPropagation();
    if (g.mode === 'stamp') {
      const drag = g.stampDrag;
      if (!drag) return;
      const [x, y] = norm(e);
      const stamps = (g.before.stamps ?? []).map((s) =>
        s.id === drag.id ? { ...s, x: clamp01(x + drag.dx), y: clamp01(y + drag.dy) } : s,
      );
      setDraft((g.erased = { ...g.before, stamps }));
      return;
    }
    if (g.mode === 'erase') {
      const [x, y] = norm(e);
      const next = eraseAt(g.erased, x, y, p.aspect);
      if (next !== g.erased) setDraft((g.erased = next));
      return;
    }
    // Eventos coalescidos: todos los puntos del lápiz entre frames, no solo el último.
    const events = e.nativeEvent.getCoalescedEvents?.() ?? [];
    const c = canvas.current!;
    const ctx = c.getContext('2d')!;
    const last = g.points[g.points.length - 1];
    ctx.beginPath();
    ctx.moveTo(last[0] * c.width, last[1] * c.height);
    for (const ev of events.length ? events : [e.nativeEvent]) {
      const [x, y] = norm(ev);
      g.points.push([x, y, ev.pressure || 0.5]);
      ctx.lineTo(x * c.width, y * c.height);
    }
    ctx.stroke();
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (e.pointerType === 'touch') {
      g.touches.delete(e.pointerId);
      if (g.twoFingerAt && g.touches.size === 0) {
        if (!g.twoFingerMoved && performance.now() - g.twoFingerAt < 400) p.onUndo();
        g.twoFingerAt = 0;
        e.stopPropagation();
        return;
      }
    }
    if (e.pointerId !== g.id) return;
    e.stopPropagation();
    g.committed = false;
    if (g.mode === 'stamp') {
      if (g.stampDrag) {
        if (g.erased !== g.before) commit(g.before, roundStamps(g.erased));
      } else if (g.stampAt && e.type === 'pointerup') {
        const [x, y] = g.stampAt;
        const stamp: Stamp = {
          id: newId(),
          symbol: p.tool.symbol,
          x: round(x),
          y: round(y),
          size: STAMP_SIZES[p.tool.width],
          color: p.tool.color,
        };
        commit(g.before, { ...g.before, stamps: [...(g.before.stamps ?? []), stamp] });
      }
      g.stampAt = g.stampDrag = null;
    } else if (g.mode === 'erase') {
      if (g.erased !== g.before) commit(g.before, g.erased);
    } else if (e.type === 'pointerup') {
      const tool = p.tool.tool === 'highlighter' ? 'highlighter' : 'pen';
      const stroke: Stroke = {
        id: newId(),
        tool,
        color: p.tool.color,
        width: strokeWidth(),
        points: g.points.map(([x, y, pr]) => [round(x), round(y), Math.round(pr * 100) / 100]),
      };
      commit(g.before, { ...g.before, strokes: [...g.before.strokes, stroke] });
    }
    // Si se guardó algo, lo provisorio queda hasta que vuelva de la base (ver el efecto arriba).
    cancel(g.committed);
  };

  const commit = (before: PageAnnotations, after: PageAnnotations) => {
    const marked = { ...after, updatedAt: Date.now() };
    p.onCommit(before, marked);
    setDraft(marked);
    g.committed = true;
  };

  const onClick = () => {
    if (!g.textAt) return;
    const [x, y] = g.textAt;
    g.textAt = null;
    const hit = shown.texts.find(
      (n) => Math.abs(n.x - x) < 0.08 && Math.abs((n.y - y) * p.aspect) < n.size,
    );
    setEditing(hit ?? { id: newId(), x, y, text: '', color: p.tool.color, size: TEXT_SIZE });
  };

  const commitText = (text: string) => {
    if (!editing) return;
    const others = shown.texts.filter((n) => n.id !== editing.id);
    const texts = text.trim() ? [...others, { ...editing, text: text.trim() }] : others;
    if (texts.length !== shown.texts.length || text.trim() !== editing.text)
      commit(shown, { ...shown, texts });
    setEditing(undefined);
  };

  const vbH = VB * p.aspect;
  return (
    <div
      ref={root}
      className="annotation-layer"
      data-active={p.active || undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClick={onClick}
    >
      <svg viewBox={`0 0 ${VB} ${vbH}`} preserveAspectRatio="none" aria-label={p.label}>
        {shown.strokes.map((s) => (
          <path
            key={s.id}
            d={strokePath(s, p.aspect)}
            fill={s.color}
            className={s.tool === 'highlighter' ? 'highlighter' : undefined}
          />
        ))}
        {shown.texts
          .filter((n) => n.id !== editing?.id)
          .map((n) => (
            <text key={n.id} x={n.x * VB} y={n.y * vbH} fontSize={n.size * VB} fill={n.color}>
              {n.text}
            </text>
          ))}
        {shown.stamps?.map((s) => {
          const geo = stampGeometry(s, p.aspect);
          return (
            <text
              key={s.id}
              className="stamp"
              data-symbol={s.symbol}
              x={geo.originX * VB}
              y={geo.originY * VB}
              fontSize={s.size * VB}
              fill={s.color}
            >
              {geo.char}
            </text>
          );
        })}
      </svg>
      <canvas ref={canvas} />
      {editing && (
        <input
          className="annotation-text"
          autoFocus
          defaultValue={editing.text}
          placeholder={p.textPlaceholder}
          aria-label={p.textPlaceholder}
          style={{
            left: `${editing.x * 100}%`,
            top: `${editing.y * 100}%`,
            color: editing.color,
            fontSize: `${editing.size * (root.current?.offsetWidth ?? 800)}px`,
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
          onBlur={(e) => commitText(e.target.value)}
        />
      )}
    </div>
  );
}

const round = (n: number) => Math.round(n * 10000) / 10000;
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const roundStamps = (a: PageAnnotations): PageAnnotations => ({
  ...a,
  stamps: a.stamps?.map((s) => ({ ...s, x: round(s.x), y: round(s.y) })),
});
// Margen para agarrar un símbolo con el dedo, como fracción del ancho de página.
const STAMP_HIT = 0.012;
