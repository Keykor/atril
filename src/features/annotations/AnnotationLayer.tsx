import { useLiveQuery } from 'dexie-react-hooks';
import { useRef, useState } from 'react';
import { db, newId } from '../../core/db/db';
import { annotationId, emptyAnnotations } from '../../core/db/repos';
import type { PageAnnotations, Stroke, TextNote } from '../../core/db/types';
import {
  eraseAt,
  HIGHLIGHTER_FACTOR,
  strokePath,
  TEXT_SIZE,
  VB,
  WIDTHS,
  type ToolState,
} from './strokes';
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
    useLiveQuery(() => db.annotations.get(annotationId(p.scoreId, p.page)), [p.scoreId, p.page]) ??
    emptyAnnotations(p.scoreId, p.page);
  const [draft, setDraft] = useState<PageAnnotations>(); // mientras se usa la goma
  const [editing, setEditing] = useState<TextNote>();
  const root = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const shown = draft ?? saved;

  const g = useRef({
    id: -1,
    points: [] as Stroke['points'],
    before: saved,
    erased: saved,
    touches: new Set<number>(),
    twoFingerAt: 0,
    textAt: null as [number, number] | null,
  }).current;

  const norm = (e: { clientX: number; clientY: number }) => {
    const r = root.current!.getBoundingClientRect();
    return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height] as const;
  };
  const strokeWidth = () =>
    WIDTHS[p.tool.width] * (p.tool.tool === 'highlighter' ? HIGHLIGHTER_FACTOR : 1);

  const cancel = () => {
    g.id = -1;
    setDraft(undefined);
    const c = canvas.current;
    c?.getContext('2d')?.clearRect(0, 0, c.width, c.height);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'touch') {
      g.touches.add(e.pointerId);
      if (p.active && g.touches.size === 2) {
        // Segundo dedo: no es un trazo. Si levantan enseguida, es "deshacer".
        cancel();
        g.twoFingerAt = performance.now();
        e.stopPropagation();
        return;
      }
    }
    const draws =
      !p.locked && (p.active ? e.pointerType !== 'touch' || !p.penOnly : e.pointerType === 'pen');
    if (!draws || g.id !== -1 || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.stopPropagation();
    const tool = p.active ? p.tool.tool : p.tool.tool === 'text' ? 'pen' : p.tool.tool;
    if (!p.active) p.onPenStart();

    const [x, y] = norm(e);
    if (tool === 'text') {
      // El editor se abre en el click: abrirlo acá lo desenfocaría el mousedown que sigue.
      g.textAt = [x, y];
      return;
    }
    root.current!.setPointerCapture(e.pointerId);
    g.id = e.pointerId;
    g.before = saved;
    if (tool === 'eraser') {
      g.erased = eraseAt(saved, x, y, p.aspect);
      setDraft(g.erased);
      return;
    }
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
    if (e.pointerId !== g.id) return;
    e.stopPropagation();
    if (draft) {
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
        if (performance.now() - g.twoFingerAt < 400) p.onUndo();
        g.twoFingerAt = 0;
        e.stopPropagation();
        return;
      }
    }
    if (e.pointerId !== g.id) return;
    e.stopPropagation();
    if (draft) {
      if (g.erased !== g.before) p.onCommit(g.before, g.erased);
    } else if (e.type === 'pointerup') {
      const tool = p.tool.tool === 'highlighter' ? 'highlighter' : 'pen';
      const stroke: Stroke = {
        id: newId(),
        tool,
        color: p.tool.color,
        width: strokeWidth(),
        points: g.points.map(([x, y, pr]) => [round(x), round(y), Math.round(pr * 100) / 100]),
      };
      p.onCommit(g.before, { ...g.before, strokes: [...g.before.strokes, stroke] });
    }
    cancel();
  };

  const onClick = () => {
    if (!g.textAt) return;
    const [x, y] = g.textAt;
    g.textAt = null;
    const hit = saved.texts.find(
      (n) => Math.abs(n.x - x) < 0.08 && Math.abs((n.y - y) * p.aspect) < n.size,
    );
    setEditing(hit ?? { id: newId(), x, y, text: '', color: p.tool.color, size: TEXT_SIZE });
  };

  const commitText = (text: string) => {
    if (!editing) return;
    const others = saved.texts.filter((n) => n.id !== editing.id);
    const texts = text.trim() ? [...others, { ...editing, text: text.trim() }] : others;
    if (texts.length !== saved.texts.length || text.trim() !== editing.text)
      p.onCommit(saved, { ...saved, texts });
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
