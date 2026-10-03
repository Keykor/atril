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

export function AnnotationToolbar(p: Props) {
  const a = t.annotate;
  return (
    <div
      className="annotation-toolbar"
      role="toolbar"
      aria-label={a.toolbar}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="at-group">
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
      </div>
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
      <div className="at-group">
        <button className="icon-btn" aria-label={a.undo} disabled={!p.canUndo} onClick={p.onUndo}>
          <Icon name="undo" size={22} />
        </button>
        <button className="icon-btn" aria-label={a.redo} disabled={!p.canRedo} onClick={p.onRedo}>
          <Icon name="redo" size={22} />
        </button>
      </div>
      <div className="at-group">
        <button
          className="at-penonly"
          role="switch"
          aria-checked={p.penOnly}
          onClick={() => p.onPenOnly(!p.penOnly)}
        >
          <Icon name={p.penOnly ? 'check' : 'pen'} size={16} />
          {t.settings.penOnly}
        </button>
        <button className="btn primary" onClick={p.onDone}>
          {t.done}
        </button>
      </div>
    </div>
  );
}
