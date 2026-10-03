import { useEffect, useRef, useState } from 'react';
import { playNote } from '../../core/audio/engine';
import { beatsOf, Metronome, tapTempo } from '../../core/audio/metronome';
import { midiToLabel, parseNote } from '../../core/audio/notes';
import type { Score, StartNotes } from '../../core/db/types';
import { Icon } from '../../ui/Icon';
import { t } from '../../app/strings';
import './practice.css';

const p = t.practice;
const SIGNATURES = ['2/4', '3/4', '4/4', '6/8'];
const BLACK = new Set([1, 3, 6, 8, 10]);
const SHARP_NAMES: Record<number, string> = { 1: 'Do', 3: 'Re', 6: 'Fa', 8: 'Sol', 10: 'La' };
const clampBpm = (n: number) => Math.min(250, Math.max(30, Math.round(n)));

/** Toca las notas de inicio: cada grupo (voz) en secuencia, sus notas juntas. */
export function playStartNotes(groups: StartNotes[] = []) {
  groups.forEach((g, i) =>
    g.notes.forEach((n) => {
      const midi = parseNote(n);
      if (midi !== undefined) playNote(midi, 1.4, i * 0.8);
    }),
  );
}

interface Props {
  score: Score;
  onChange: (patch: Pick<Partial<Score>, 'bpm' | 'timeSignature'>) => void;
  onClose: () => void;
}

/** Panel de ensayo sobre el lector: metrónomo y teclado. No tapa la partitura entera. */
export function PracticePanel({ score, onChange, onClose }: Props) {
  return (
    <section
      className="practice"
      role="region"
      aria-label={p.title}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <button className="icon-btn round practice-close" aria-label={p.close} onClick={onClose}>
        <Icon name="close" />
      </button>
      <MetronomeBox score={score} onChange={onChange} />
      <KeyboardBox startNotes={score.startNotes} />
    </section>
  );
}

function MetronomeBox({ score, onChange }: Pick<Props, 'score' | 'onChange'>) {
  const [bpm, setBpm] = useState(score.bpm ?? 72);
  const [signature, setSignature] = useState(score.timeSignature ?? '4/4');
  const [running, setRunning] = useState(false);
  const [beat, setBeat] = useState(-1);
  const metronome = useRef<Metronome>(null);
  const taps = useRef<number[]>([]);
  const beats = beatsOf(signature);

  useEffect(() => {
    const m = (metronome.current = new Metronome());
    m.onBeat = setBeat;
    return () => m.stop();
  }, []);

  // Cambiar tempo o compás con el metrónomo andando lo rearranca con los valores nuevos.
  useEffect(() => {
    if (running) metronome.current!.start(bpm, beats);
    else {
      metronome.current!.stop();
      setBeat(-1);
    }
  }, [running, bpm, beats]);

  // El tempo queda guardado en la partitura.
  useEffect(() => {
    if (bpm === (score.bpm ?? 72) && signature === (score.timeSignature ?? '4/4')) return;
    const id = setTimeout(() => onChange({ bpm, timeSignature: signature }), 500);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bpm, signature]);

  const tap = () => {
    taps.current = [...taps.current.slice(-4), performance.now()];
    const tempo = tapTempo(taps.current);
    if (tempo) setBpm(tempo);
    else taps.current = taps.current.slice(-1);
  };

  return (
    <div className="practice-box">
      <header>
        <h2>{p.metronome}</h2>
        <span>{p.savedTempo}</span>
      </header>
      <div className="metro-main">
        <button
          className="icon-btn round"
          aria-label={p.slower}
          onClick={() => setBpm(clampBpm(bpm - 1))}
        >
          −
        </button>
        <div className="metro-bpm">
          <strong aria-live="polite">{bpm}</strong>
          <span>{p.bpm}</span>
        </div>
        <button
          className="icon-btn round"
          aria-label={p.faster}
          onClick={() => setBpm(clampBpm(bpm + 1))}
        >
          +
        </button>
      </div>
      <input
        type="range"
        min={30}
        max={250}
        value={bpm}
        aria-label={p.tempo}
        onChange={(e) => setBpm(clampBpm(Number(e.target.value)))}
      />
      <div className="metro-beats" aria-label={beat >= 0 ? p.beatOf(beat + 1, beats) : undefined}>
        {Array.from({ length: beats }, (_, i) => (
          <span key={i} data-on={i === beat || undefined} data-accent={i === 0 || undefined} />
        ))}
      </div>
      <div className="metro-actions">
        <select
          className="btn"
          aria-label={p.signature}
          value={signature}
          onChange={(e) => setSignature(e.target.value)}
        >
          {[...new Set([signature, ...SIGNATURES])].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <button className="btn" onClick={tap}>
          {p.tap}
        </button>
        <button className="btn primary" onClick={() => setRunning(!running)}>
          {running ? p.stop : p.start}
        </button>
      </div>
    </div>
  );
}

function KeyboardBox({ startNotes }: { startNotes?: StartNotes[] }) {
  const [octave, setOctave] = useState(4);
  const first = (octave + 1) * 12; // Do de la octava
  const keys = Array.from({ length: 24 }, (_, i) => first + i);
  const whites = keys.filter((m) => !BLACK.has(m % 12));
  const label = (midi: number) =>
    BLACK.has(midi % 12)
      ? p.sharp(SHARP_NAMES[midi % 12], Math.floor(midi / 12) - 1)
      : midiToLabel(midi);

  return (
    <div className="practice-box">
      <header>
        <h2>{p.keyboard}</h2>
        <div className="kb-octave">
          <button
            className="icon-btn round"
            aria-label={p.octaveDown}
            disabled={octave <= 1}
            onClick={() => setOctave(octave - 1)}
          >
            −
          </button>
          <span>{p.range(midiToLabel(first), midiToLabel(first + 23))}</span>
          <button
            className="icon-btn round"
            aria-label={p.octaveUp}
            disabled={octave >= 6}
            onClick={() => setOctave(octave + 1)}
          >
            +
          </button>
        </div>
      </header>
      <div className="kb" role="group" aria-label={p.keyboardLabel}>
        {whites.map((midi) => (
          <button
            key={midi}
            className="kb-white"
            aria-label={label(midi)}
            onPointerDown={() => playNote(midi)}
          >
            {midi % 12 === 0 && <span>{midiToLabel(midi)}</span>}
          </button>
        ))}
        {keys
          .filter((m) => BLACK.has(m % 12))
          .map((midi) => {
            // Cada negra va sobre el borde derecho de la blanca anterior.
            const whiteIndex = whites.findIndex((w) => w > midi);
            return (
              <button
                key={midi}
                className="kb-black"
                style={{ left: `${(whiteIndex / whites.length) * 100}%` }}
                aria-label={label(midi)}
                onPointerDown={() => playNote(midi)}
              />
            );
          })}
      </div>
      {startNotes?.length ? (
        <div className="kb-start">
          <span>{p.startNotes}</span>
          {startNotes.flatMap((g, gi) =>
            g.notes.map((n, ni) => {
              const midi = parseNote(n);
              return midi === undefined ? null : (
                <button key={`${gi}-${ni}`} className="btn" onPointerDown={() => playNote(midi)}>
                  {g.label ? `${g.label} · ` : ''}
                  {midiToLabel(midi)}
                </button>
              );
            }),
          )}
        </div>
      ) : null}
    </div>
  );
}
