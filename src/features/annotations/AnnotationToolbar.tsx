import { useState } from 'react';
import { Icon, type IconName } from '../../ui/Icon';
import { t } from '../../app/strings';
import { COLORS, WIDTHS, type Tool, type ToolState } from './strokes';
import './annotations.css';

interface Props {
  tool: ToolState;
  onTool: (tool: ToolState) => void;
  penOnly: boolean;
  onPenOnly: (value: boolean) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onDone: () => void;
}

const TOOLS: { id: Tool; icon: IconName }[] = [
  { id: 'pen', icon: 'pen' },
  { id: 'highlighter', icon: 'highlighter' },
  { id: 'text', icon: 'text' },
  { id: 'eraser', icon: 'eraser' },
];

/** Una sola fila, para tapar lo menos posible. Color, grosor y "solo lápiz" van en un desplegable. */
export function AnnotationToolbar(p: Props) {
  const a = t.annotate;
  const [styleOpen, setStyleOpen] = useState(false);
  return (
    <div
      className="annotation-toolbar"
      role="toolbar"
      aria-label={a.toolbar}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {TOOLS.map(({ id, icon }) => (
        <button
          key={id}
          className="icon-btn"
          aria-label={a.tools[id]}
          aria-pressed={p.tool.tool === id}
          onClick={() => p.onTool({ ...p.tool, tool: id })}
        >
          <Icon name={icon} size={22} />
        </button>
      ))}
      <button
        className="at-color"
        aria-label={a.style}
        aria-expanded={styleOpen}
        onClick={() => setStyleOpen(!styleOpen)}
      >
        <span style={{ background: p.tool.color }} />
      </button>
      <span className="at-sep" />
      <button className="icon-btn" aria-label={a.undo} disabled={!p.canUndo} onClick={p.onUndo}>
        <Icon name="undo" size={22} />
      </button>
      <button className="icon-btn" aria-label={a.redo} disabled={!p.canRedo} onClick={p.onRedo}>
        <Icon name="redo" size={22} />
      </button>
      <button className="btn primary at-done" aria-label={t.done} onClick={p.onDone}>
        <Icon name="check" size={20} />
        <span>{t.done}</span>
      </button>

      {styleOpen && (
        <div className="popover at-style">
          <div className="at-group" role="group" aria-label={a.color}>
            {COLORS.map((color, i) => (
              <button
                key={color}
                className="at-color"
                aria-label={a.colors[i]}
                aria-pressed={p.tool.color === color}
                onClick={() => p.onTool({ ...p.tool, color })}
              >
                <span style={{ background: color }} />
              </button>
            ))}
          </div>
          <div className="at-group" role="group" aria-label={a.width}>
            {WIDTHS.map((_, i) => (
              <button
                key={i}
                className="icon-btn"
                aria-label={a.widths[i]}
                aria-pressed={p.tool.width === i}
                onClick={() => p.onTool({ ...p.tool, width: i })}
              >
                <span className="at-width" style={{ height: 2 + i * 3 }} />
              </button>
            ))}
          </div>
          <button
            className="at-penonly"
            role="switch"
            aria-checked={p.penOnly}
            onClick={() => p.onPenOnly(!p.penOnly)}
          >
            <Icon name={p.penOnly ? 'check' : 'pen'} size={16} />
            {t.settings.penOnly}
          </button>
        </div>
      )}
    </div>
  );
}
