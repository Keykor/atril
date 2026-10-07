import { useId, type ReactNode } from 'react';
import { Icon } from './Icon';
import './ui.css';

interface SegmentedProps<T extends string | number> {
  label: string;
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (value: T) => void;
}

export function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: SegmentedProps<T>) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <div className="segmented" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
        {options.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            aria-pressed={o.value === value}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

interface SwitchProps {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export function Switch({ label, hint, checked, onChange }: SwitchProps) {
  return (
    <div className="switch-row">
      <div>
        <div className="switch-label">{label}</div>
        {hint && <div className="switch-hint">{hint}</div>}
      </div>
      <button
        type="button"
        role="switch"
        className="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
      />
    </div>
  );
}

interface DateFieldProps {
  label: string;
  value: string; // "YYYY-MM-DD" o "" sin fecha
  onChange: (value: string) => void;
  clearLabel: string;
  className?: string;
}

/**
 * Campo de fecha con un botón para dejarlo sin fecha: en el celular el selector del navegador
 * no trae cómo borrarla, y una vez puesta no se podía sacar.
 */
export function DateField({ label, value, onChange, clearLabel, className }: DateFieldProps) {
  const id = useId();
  return (
    <div className={`field date-field ${className ?? ''}`}>
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <div className="date-row">
        <input
          id={id}
          className="input"
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        {value && (
          <button type="button" className="btn ghost" onClick={() => onChange('')}>
            <Icon name="close" size={16} />
            {clearLabel}
          </button>
        )}
      </div>
    </div>
  );
}
