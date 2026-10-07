import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { holdNote, playNote, setPianoVolume } from '../../core/audio/engine';
import { beatsOf, Metronome, tapTempo } from '../../core/audio/metronome';
import { midiToLabel, midiToSci, parseNote } from '../../core/audio/notes';
import { getSetting } from '../../core/db/queries';
import { setSetting } from '../../core/db/repos';
import type { Score, StartNotes } from '../../core/db/types';
import { Icon } from '../../ui/Icon';
import { t } from '../../app/strings';
import './practice.css';

const p = t.practice;
const SIGNATURES = ['2/4', '3/4', '4/4', '6/8'];
const BLACK = new Set([1, 3, 6, 8, 10]);
const SHARP_NAMES: Record<number, string> = { 1: 'Do', 3: 'Re', 6: 'Fa', 8: 'Sol', 10: 'La' };
const PIANO = { sustain: false, volume: 0.8 };
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
  onChange: (patch: Pick<Partial<Score>, 'bpm' | 'timeSignature' | 'startNotes'>) => void;
  onClose: () => void;
  onHeight?: (px: number) => void; // alto del panel, para que el lector deje lugar abajo
}

/** Panel de ensayo sobre el lector: metrónomo y teclado. No tapa la partitura entera. */
export function PracticePanel({ score, onChange, onClose, onHeight }: Props) {
  // En el celular los dos no entran juntos: se muestra uno por vez con pestañas (solo CSS, así
  // el metrónomo sigue sonando al pasar al teclado). En tablet y compu se ven los dos.
  const [tab, setTab] = useState<'metronome' | 'keyboard'>('metronome');
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!onHeight) return;
    const ro = new ResizeObserver(() => onHeight(root.current!.offsetHeight));
    ro.observe(root.current!);
    return () => {
      ro.disconnect();
      onHeight(0);
    };
  }, [onHeight]);
  return (
    <section
      ref={root}
      className="practice"
      role="region"
      aria-label={p.title}
      data-tab={tab}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <button className="icon-btn round practice-close" aria-label={p.close} onClick={onClose}>
        <Icon name="close" />
      </button>
      <div className="practice-tabs" role="tablist" aria-label={p.title}>
        {(['metronome', 'keyboard'] as const).map((id) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
            {p[id]}
          </button>
        ))}
      </div>
      <MetronomeBox score={score} onChange={onChange} />
      <KeyboardBox
        startNotes={score.startNotes}
        onStartNotes={(startNotes) => onChange({ startNotes })}
      />
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
    <div className="practice-box metronome">
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

function KeyboardBox({
  startNotes,
  onStartNotes,
}: {
  startNotes?: StartNotes[];
  onStartNotes: (notes: StartNotes[] | undefined) => void;
}) {
  const [octave, setOctave] = useState(4);
  // Pedal y volumen: ajustes de este dispositivo (no viajan en el backup).
  const piano = useLiveQuery(() => getSetting('piano', PIANO), []) ?? PIANO;
  const setPiano = (patch: Partial<typeof PIANO>) =>
    void setSetting('piano', { ...piano, ...patch });
  useEffect(() => setPianoVolume(piano.volume), [piano.volume]);
  // Grabando: las teclas que se tocan pasan a ser las notas de inicio de la partitura.
  const [recording, setRecording] = useState<number[]>();
  // Tecla apretada -> cómo soltarla, por dedo (se pueden tocar varias a la vez).
  const held = useRef(new Map<number, () => void>());
  useEffect(() => {
    const keys = held.current;
    return () => keys.forEach((stop) => stop());
  }, []);
  const press = (e: React.PointerEvent, midi: number) => {
    // El soltar llega a esta tecla aunque el dedo se haya corrido.
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // Puntero sintético o ya suelto: sin captura, igual suena.
    }
    held.current.get(e.pointerId)?.();
    const stop = holdNote(midi);
    held.current.set(e.pointerId, piano.sustain ? () => {} : stop);
    if (recording) setRecording([...recording, midi]);
  };
  const release = (e: React.PointerEvent) => {
    held.current.get(e.pointerId)?.();
    held.current.delete(e.pointerId);
  };
  const keyProps = (midi: number) => ({
    'aria-label': label(midi),
    onPointerDown: (e: React.PointerEvent) => press(e, midi),
    onPointerUp: release,
    onPointerCancel: release,
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });
  const first = (octave + 1) * 12; // Do de la octava
  const keys = Array.from({ length: 24 }, (_, i) => first + i);
  const whites = keys.filter((m) => !BLACK.has(m % 12));
  const label = (midi: number) =>
    BLACK.has(midi % 12)
      ? p.sharp(SHARP_NAMES[midi % 12], Math.floor(midi / 12) - 1)
      : midiToLabel(midi);

  return (
    <div className="practice-box keyboard">
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
      <div className="kb-controls">
        <button
          type="button"
          className="kb-sustain"
          aria-pressed={piano.sustain}
          title={p.sustainHint}
          onClick={() => setPiano({ sustain: !piano.sustain })}
        >
          {p.sustain}
        </button>
        <input
          type="range"
          className="range"
          aria-label={p.volume}
          min={0}
          max={1}
          step={0.05}
          value={piano.volume}
          onChange={(e) => setPiano({ volume: Number(e.target.value) })}
        />
      </div>
      <div className="kb" role="group" aria-label={p.keyboardLabel}>
        {whites.map((midi) => (
          <button key={midi} className="kb-white" {...keyProps(midi)}>
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
                {...keyProps(midi)}
              />
            );
          })}
      </div>
      <div className="kb-start">
        <span>{p.startNotes}</span>
        {recording ? (
          <>
            {recording.length === 0 && <em>{p.recordHint}</em>}
            {recording.map((midi, i) => (
              <span key={i} className="chip">
                {midiToLabel(midi)}
              </span>
            ))}
            <button
              className="btn primary"
              disabled={recording.length === 0}
              onClick={() => {
                // Cada nota en su grupo: al dar el tono suenan una tras otra, en este orden.
                onStartNotes(recording.map((midi) => ({ notes: [midiToSci(midi)] })));
                setRecording(undefined);
              }}
            >
              {t.save}
            </button>
            <button className="btn ghost" onClick={() => setRecording(undefined)}>
              {t.cancel}
            </button>
          </>
        ) : (
          <>
            {startNotes?.flatMap((g, gi) =>
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
            <button className="btn ghost" onClick={() => setRecording([])}>
              {startNotes?.length ? p.recordAgain : p.record}
            </button>
            {startNotes?.length ? (
              <button className="btn ghost" onClick={() => onStartNotes(undefined)}>
                {p.clearStartNotes}
              </button>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
