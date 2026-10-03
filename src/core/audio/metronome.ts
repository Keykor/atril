import { audio, click } from './engine';

const LOOKAHEAD = 0.1; // segundos de audio agendados por adelantado
const TICK_MS = 25;

export interface Beat {
  time: number; // en el reloj del AudioContext
  beat: number; // 0 = primer tiempo del compás
}

/**
 * Tiempos que caen en la ventana [.., now + lookahead). Cada tiempo se calcula desde el
 * arranque (start + n * intervalo), no sumando al anterior: así el metrónomo no deriva
 * aunque el timer de JS se atrase.
 */
export function dueBeats(
  s: { start: number; next: number; bpm: number; beats: number },
  now: number,
  lookahead = LOOKAHEAD,
): Beat[] {
  const out: Beat[] = [];
  const interval = 60 / s.bpm;
  while (s.start + s.next * interval < now + lookahead) {
    out.push({ time: s.start + s.next * interval, beat: s.next % s.beats });
    s.next++;
  }
  return out;
}

/** "4/4" -> 4, "6/8" -> 6. */
export const beatsOf = (timeSignature?: string) => {
  const n = Number(timeSignature?.split('/')[0]);
  return n >= 1 && n <= 12 ? n : 4;
};

/** BPM a partir de toques. Promedia los últimos intervalos; una pausa larga reinicia. */
export function tapTempo(taps: number[]): number | undefined {
  const recent = taps.slice(-5);
  const intervals = recent.slice(1).map((t, i) => t - recent[i]);
  if (!intervals.length || intervals.some((i) => i > 2000)) return undefined;
  const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  return Math.min(250, Math.max(30, Math.round(60000 / avg)));
}

export class Metronome {
  private timer = 0;
  private state = { start: 0, next: 0, bpm: 72, beats: 4 };
  onBeat?: (beat: number) => void;

  get running() {
    return this.timer !== 0;
  }

  start(bpm: number, beats: number) {
    this.stop();
    const ctx = audio();
    this.state = { start: ctx.currentTime + 0.05, next: 0, bpm, beats };
    const tick = () => {
      for (const b of dueBeats(this.state, ctx.currentTime)) {
        click(b.time, b.beat === 0);
        // El flash visual se dispara cuando suena, no cuando se agenda.
        setTimeout(() => this.onBeat?.(b.beat), Math.max(0, (b.time - ctx.currentTime) * 1000));
      }
    };
    tick();
    this.timer = window.setInterval(tick, TICK_MS);
  }

  stop() {
    clearInterval(this.timer);
    this.timer = 0;
  }
}
