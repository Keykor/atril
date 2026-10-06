import { Hint } from '../../ui/Hint';

interface Props {
  zones: 'thirds' | 'halves';
  labels: {
    title: string;
    text: string;
    back: string;
    bars: string;
    barsLong: string;
    next: string;
    done: string;
  };
  onDone: () => void;
}

/** Pista del lector: marca sobre la página qué hace un toque en cada zona. Un toque en cualquier
 * lugar la cierra, no solo "Entendido". */
export function TapZonesHint({ zones, labels, onDone }: Props) {
  return (
    <div
      className={`tap-hint ${zones}`}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={onDone}
    >
      <div className="tap-hint-zone">← {labels.back}</div>
      {zones === 'thirds' && <div className="tap-hint-zone">{labels.bars}</div>}
      <div className="tap-hint-zone">{labels.next} →</div>
      {zones === 'halves' && <div className="tap-hint-long">{labels.barsLong}</div>}
      <Hint title={labels.title} text={labels.text} doneLabel={labels.done} onDone={onDone} />
    </div>
  );
}
