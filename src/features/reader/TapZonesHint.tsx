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
    more: string;
  };
  moreHref: string;
  onDone: () => void;
}

/** Pista del lector: marca sobre la página qué hace un toque en cada zona. */
export function TapZonesHint({ zones, labels, moreHref, onDone }: Props) {
  return (
    <div className={`tap-hint ${zones}`} onPointerDown={(e) => e.stopPropagation()}>
      <div className="tap-hint-zone">← {labels.back}</div>
      {zones === 'thirds' && <div className="tap-hint-zone">{labels.bars}</div>}
      <div className="tap-hint-zone">{labels.next} →</div>
      {zones === 'halves' && <div className="tap-hint-long">{labels.barsLong}</div>}
      <Hint
        title={labels.title}
        text={labels.text}
        doneLabel={labels.done}
        moreLabel={labels.more}
        moreHref={moreHref}
        onDone={onDone}
      />
    </div>
  );
}
